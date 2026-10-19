import test from "node:test";
import assert from "node:assert/strict";
import {
  type Farm,
  type Animal,
  demoFarm,
  summary,
  project,
  projectOwnership,
  defaultSettings,
  animalValue,
} from "./model.ts";
import { validateAction, applyAction } from "./actions.ts";
const now = new Date("2026-10-18T12:00:00Z");
const animal = (id: string, overrides: Partial<Animal> = {}): Animal => ({
  id,
  tag: id,
  sex: "F",
  born: "2022-10-15",
  weight: 400,
  owner: "a",

  status: "ativo",
  ...overrides,
});
const farm = (animals: Animal[] = []): Farm => ({
  animals,
  investors: [
    { id: "a", name: "Ana", color: "#333" },
    { id: "b", name: "João", color: "#888" },
  ],
  transactions: [],
  settings: { ...defaultSettings, openingCash: 0 },
});
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-7, `${a} differs from ${b}`);
test("shares and costs sum to the total, including replacement provision", () => {
  const f = farm([animal("1"), animal("2"), animal("3", { owner: "b" })]);
  const s = summary(f);
  near(s.shares[0].share, 2 / 3);
  near(
    s.shares.reduce((n, i) => n + i.share, 0),
    1,
  );
  near(
    s.shares.reduce((n, i) => n + i.monthly, 0),
    s.monthly + s.deathReserve,
  );
});
test("carcass equivalent uses yield, 15 kg per arroba and the selected price", () => {
  near(animalValue(450, { ...defaultSettings, arroba: 375, yield: 50 }), 5625);
});
test("sale removes head, redistributes ownership and credits cash exactly once", () => {
  const f = farm([animal("1"), animal("2", { owner: "b" })]);
  const a = validateAction(
    {
      type: "status",
      data: { id: "1", status: "vendido", amount: 6000, date: "2026-10-18" },
    },
    f,
  );
  const next = applyAction(f, a);
  assert.equal(summary(next).herd.length, 1);
  assert.equal(summary(next).shares[1].share, 1);
  assert.equal(summary(next).cash, 6000);
  assert.throws(() =>
    validateAction(
      {
        type: "status",
        data: { id: "1", status: "vendido", amount: 6000, date: "2026-10-18" },
      },
      next,
    ),
  );
});
test("death removes head without creating fictitious cash", () => {
  const f = farm([animal("1")]);
  const next = applyAction(
    f,
    validateAction(
      {
        type: "status",
        data: { id: "1", status: "morto", date: "2026-10-18", amount: 0 },
      },
      f,
    ),
  );
  assert.equal(summary(next).herd.length, 0);
  assert.equal(summary(next).cash, 0);
  assert.equal(next.transactions.length, 0);
});
test("annual balance reconciles births, deaths, sales and stock", () => {
  const f = demoFarm();
  const p = project(f, 15, now);
  for (let i = 1; i < p.length; i++) {
    near(p[i].herd, p[i - 1].herd + p[i].births - p[i].deaths - p[i].sales);
    assert.ok(p[i].herd <= f.settings.capacity + 1e-7);
    assert.ok(p[i].herd >= 0);
    near(
      p[i].cash,
      p[i - 1].cash + p[i].revenue - p[i].costs + p[i].contribution,
    );
    assert.ok(p[i].cash + 1e-7 >= p[i].reserve);
  }
});
test("no eligible female means no births; young females wait for maturity", () => {
  const f = farm([
    animal("1", { sex: "M", born: "2026-07-01" }),
    animal("2", { born: "2026-07-01" }),
  ]);
  f.settings.mortality = 0;
  f.settings.calfMortality = 0;
  const p = project(f, 5, now);
  assert.equal(p[1].births, 0);
  assert.equal(p[2].births, 0);
  assert.equal(p[3].births, 0);
  assert.ok(p[4].births > 0);
});
test("mortality reduces stock when reproduction is disabled", () => {
  const f = farm([animal("1")]);
  f.settings.birthRate = 0;
  f.settings.mortality = 10;
  const p = project(f, 1, now);
  near(p[1].deaths, 0.1);
  near(p[1].herd, 0.9);
});
test("Fibonacci never drives financial numbers and zero stock stays finite", () => {
  const f = farm();
  const p = project(f, 10, now);
  for (const row of p) {
    assert.equal(row.herd, 0);
    assert.equal(row.fibonacci, 0);
    assert.ok(Number.isFinite(row.contribution));
  }
  const full = project(demoFarm(), 4, now);
  near(full[2].fibonacci, full[0].herd * 2);
});
test("invalid costs, IDs, dates, duplicate tags and impossible settings are rejected", () => {
  const f = farm([animal("1")]);
  assert.throws(() =>
    validateAction(
      {
        type: "transaction",
        data: {
          date: "2026-10-18",
          kind: "despesa",
          amount: -3,
          category: "Outros",
          description: "x",
        },
      },
      f,
    ),
  );
  assert.throws(() =>
    validateAction(
      { type: "animal", data: { ...f.animals[0], owner: "missing" } },
      f,
    ),
  );
  assert.throws(() =>
    validateAction(
      {
        type: "animal",
        data: { ...f.animals[0], tag: "new", born: "2026-02-31" },
      },
      f,
    ),
  );
  assert.throws(() =>
    validateAction({ type: "animal", data: f.animals[0] }, f),
  );
  assert.throws(() =>
    validateAction(
      { type: "settings", data: { ...f.settings, cullMonths: 12 } },
      f,
    ),
  );
});
test("retention and capacity drive sales rather than silently dropping animals", () => {
  const f = farm([animal("1"), animal("2")]);
  f.settings.capacity = 2;
  f.settings.mortality = 0;
  f.settings.calfMortality = 0;
  f.settings.birthRate = 100;
  const p = project(f, 1, now);
  near(p[1].births, 2);
  near(p[1].sales, 2);
  near(p[1].herd, 2);
  assert.ok(p[1].revenue > 0);
});

test("overview graph contains only current active registered animals and no inferred or future births", () => {
  const f = farm([
    animal("mother"),
    animal("calf", { born: "2026-06-01", owner: "b" }),
    animal("sold", { status: "vendido" }),
    animal("dead", { status: "morto" }),
  ]);
  const plan = projectOwnership(f, 0, now);
  assert.equal(plan.total.length, 1);
  assert.equal(plan.total[0].herd, summary(f).herd.length);
  assert.equal(plan.total[0].births, 0);
  assert.equal(plan.total[0].inferred, undefined);
  assert.deepEqual(Object.keys(plan.cohortsByYear), ["2026"]);
  assert.deepEqual(plan.cohortsByYear[2026].map((c) => c.animalId).sort(), [
    "calf",
    "mother",
  ]);
  assert.ok(
    plan.cohortsByYear[2026].every((c) => !c.inferred && c.count === 1),
  );
  assert.equal(plan.byOwner.a[0].herd, 1);
  assert.equal(plan.byOwner.b[0].herd, 1);
});
