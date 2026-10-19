import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultSettings,
  normalizeSettings,
  projectOwnership,
  type Farm,
} from "./model.ts";
import { validateAction } from "./actions.ts";
const now = new Date("2026-01-01T12:00:00Z");
function farm(): Farm {
  return {
    animals: [
      {
        id: "cow",
        tag: "1",
        sex: "F",
        born: "2022-01-01",
        weight: 400,
        owner: "a",
        status: "ativo",
      },
    ],
    investors: [{ id: "a", name: "Ana", color: "#123" }],
    transactions: [],
    settings: {
      ...defaultSettings,
      mortality: 0,
      calfMortality: 0,
      capacity: 10000,
      maturityMonths: 96,
      cullMonths: 240,
      femaleRetention: 0,
    },
  };
}
test("90 days after calving plus 295 days gestation produces a 385-day cycle", () => {
  const f = farm();
  f.animals[0].details = {
    birthSource: "known",
    reproductiveStatus: "pregnant",
  };
  const rows = projectOwnership(f, 6, now).total;
  assert.deepEqual(
    rows.slice(1).map((r) => r.births),
    [1, 1, 1, 1, 0, 1],
  );
  const faster = projectOwnership(
    { ...f, settings: { ...f.settings, gestationDays: 275 } },
    6,
    now,
  ).total;
  assert.deepEqual(
    faster.slice(1).map((r) => r.births),
    [1, 1, 1, 1, 1, 1],
  );
});
test("changing postpartum recovery changes births and does not add a second annual natality penalty", () => {
  const f = farm();
  f.settings.maturityMonths = 36;
  const normal = projectOwnership(f, 4, now).total;
  assert.deepEqual(
    normal.slice(1).map((r) => r.births),
    [1, 1, 1, 1],
  );
  const delayed = projectOwnership(
    { ...f, settings: { ...f.settings, postpartumDays: 300 } },
    4,
    now,
  ).total;
  assert.ok(
    delayed.reduce((n, r) => n + r.births, 0) <
      normal.reduce((n, r) => n + r.births, 0),
  );
});
test("first conception at maturity gets an exact gestation deadline, without rounding up an extra year", () => {
  const f = farm();
  f.animals[0].born = "2023-12-01";
  f.settings.maturityMonths = 36;
  const rows = projectOwnership(f, 3, now).total;
  assert.equal(rows[1].births, 0);
  assert.equal(rows[2].births, 1);
  const earlier = projectOwnership(
    { ...f, settings: { ...f.settings, maturityMonths: 24 } },
    1,
    now,
  ).total;
  assert.equal(earlier[1].births, 1);
});
test("legacy example of 78% is upgraded, explicit cycle settings and custom rates are preserved", () => {
  const { gestationDays, postpartumDays, ...legacy } = defaultSettings;
  const updated = normalizeSettings({ ...legacy, birthRate: 78 });
  assert.equal(updated.birthRate, 100);
  assert.equal(updated.gestationDays, 295);
  assert.equal(updated.postpartumDays, 90);
  assert.equal(normalizeSettings({ ...legacy, birthRate: 85 }).birthRate, 85);
  assert.equal(
    normalizeSettings({ ...defaultSettings, birthRate: 78 }).birthRate,
    78,
  );
  assert.equal(
    normalizeSettings({
      ...legacy,
      gestationDays: undefined,
      postpartumDays: undefined,
    }).gestationDays,
    295,
  );
});
test("invalid gestation and recovery parameters are rejected", () => {
  const f = farm();
  for (const bad of [
    { gestationDays: 0 },
    { gestationDays: 500 },
    { postpartumDays: -1 },
    { postpartumDays: 400 },
  ])
    assert.throws(() =>
      validateAction({ type: "settings", data: { ...f.settings, ...bad } }, f),
    );
});
test("invalid values edited directly in a sheet cannot create a zero-day loop", () => {
  const normalized = normalizeSettings({
    ...defaultSettings,
    gestationDays: 0,
    postpartumDays: 0,
  });
  assert.equal(normalized.gestationDays, 295);
  assert.equal(normalized.postpartumDays, 0);
  assert.equal(
    normalizeSettings({ ...defaultSettings, postpartumDays: NaN })
      .postpartumDays,
    90,
  );
  const f = farm();
  f.settings.gestationDays = 0;
  f.settings.postpartumDays = 0;
  assert.equal(projectOwnership(f, 1, now).total.length, 2);
});
