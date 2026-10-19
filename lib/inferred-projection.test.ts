import test from "node:test";
import assert from "node:assert/strict";
import { projectFromPurchases } from "./inferred-projection.ts";
import { defaultSettings, summary, type Farm } from "./model.ts";
const now = new Date("2026-10-19T12:00:00Z");
const farm = (): Farm => ({
  animals: [
    {
      id: "2023",
      tag: "Novilha",
      sex: "F",
      born: "2023-04-21",
      weight: 78,
      owner: "a",
      status: "ativo",
    },
    {
      id: "2025",
      tag: "Adulta",
      sex: "F",
      born: "2025-03-29",
      weight: 156,
      owner: "b",
      status: "ativo",
    },
  ],
  investors: [
    { id: "a", name: "Ana", color: "#123" },
    { id: "b", name: "Bruna", color: "#456" },
  ],
  transactions: [],
  settings: {
    ...defaultSettings,
    capacity: 10000,
    mortality: 0,
    calfMortality: 0,
    femaleRetention: 100,
    openingCash: 5000,
  },
});
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
test("2026 already contains inferred calves from the 2023 and 2025 purchase lots without changing the registry", () => {
  const f = farm(),
    before = JSON.stringify(f);
  const plan = projectFromPurchases(f, 5, now, { 2023: 24, 2025: 36 });
  assert.equal(plan.total[0].year, 2026);
  assert.ok(plan.total[0].births >= 2);
  assert.ok(plan.total[0].herd > f.animals.length);
  assert.ok(
    plan.cohortsByYear[2026].some((c) => c.motherId === "2023" && c.inferred),
  );
  assert.ok(
    plan.cohortsByYear[2026].some((c) => c.motherId === "2025" && c.inferred),
  );
  assert.ok(
    plan.cohortsByYear[2026].some((c) => c.inferred && c.birthYear === 2025),
  );
  assert.equal(plan.total[0].cash, summary(f).cash);
  assert.equal(JSON.stringify(f), before);
  for (const row of plan.total) {
    near(
      Object.values(plan.byOwner).reduce(
        (n, rows) => n + rows.find((r) => r.year === row.year)!.herd,
        0,
      ),
      row.herd,
    );
    near(
      plan.cohortsByYear[row.year].reduce((n, c) => n + c.count, 0),
      row.herd,
    );
  }
});
test("corrected acquisition ages override lot assumptions and retain the reproductive clock", () => {
  const f = farm();
  f.animals = [
    {
      ...f.animals[0],
      born: "2021-04-21",
      details: {
        birthSource: "estimated",
        estimatedMonths: 24,
        ageReferenceDate: "2023-04-21",
        acquiredAt: "2023-04-21",
        reproductiveStatus: "unknown",
      },
    },
  ];
  const plan = projectFromPurchases(f, 1, now, { 2023: 18 });
  assert.equal(
    plan.cohortsByYear[2026].find((c) => c.id === "2023")?.birthYear,
    2021,
  );
  assert.ok(plan.total[0].births > 0);
  assert.ok(plan.total[1].births > 0);
  near(
    plan.total[1].herd,
    plan.total[0].herd +
      plan.total[1].births -
      plan.total[1].deaths -
      plan.total[1].sales,
  );
});
test("without a purchase history no past births are invented from a known birth date", () => {
  const f = farm();
  const plan = projectFromPurchases(f, 1, now);
  assert.equal(plan.total[0].herd, 2);
  assert.equal(plan.total[0].births, 0);
  assert.ok(!plan.cohortsByYear[2026].some((c) => c.inferred));
});
test("inferred capacity sales and losses never remove known cattle or create real cash", () => {
  const f = farm();
  f.settings.capacity = 2;
  f.settings.mortality = 100;
  const plan = projectFromPurchases(f, 1, now, { 2023: 24, 2025: 36 });
  assert.equal(plan.total[0].herd, 2);
  assert.equal(plan.total[0].cash, 5000);
  assert.equal(plan.total[0].revenue, 0);
  assert.equal(plan.cohortsByYear[2026].filter((c) => c.animalId).length, 2);
});
