import test from "node:test";
import assert from "node:assert/strict";
import {
  type Farm,
  type ProjectedCohort,
  defaultSettings,
  projectOwnership,
  demoFarm,
} from "./model.ts";
import { cowStage, makeCowNodes, cowAgeLabel } from "./cow-nodes.ts";
const now = new Date("2026-10-18T12:00:00Z");
const farm: Farm = {
  animals: [
    {
      id: "calf",
      tag: "CL-001",
      owner: "a",
      sex: "F",
      born: "2026-10-01",
      weight: 100,

      status: "ativo",
    },
  ],
  investors: [{ id: "a", name: "Ana", color: "#789" }],
  transactions: [],
  settings: {
    ...defaultSettings,
    birthRate: 0,
    mortality: 0,
    calfMortality: 0,
    capacity: 10000,
  },
};
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("the same calf ages by twelve months and changes from newborn to young to adult", () => {
  const plan = projectOwnership(farm, 3, now);
  const stages = ["newborn", "young", "young", "adult"];
  for (let i = 0; i < 4; i++) {
    const cohort = plan.cohortsByYear[2026 + i].find((c) => c.id === "calf")!;
    assert.equal(cohort.ageMonths, i * 12);
    assert.equal(cohort.birthYear, 2026);
    assert.equal(cohort.animalId, "calf");
    const node = makeCowNodes([cohort]).find((n) =>
      n.sourceIds.includes("calf"),
    )!;
    assert.equal(node.stage, stages[i]);
    assert.equal(node.minAge, i * 12);
    assert.equal(node.maxAge, i * 12);
  }
});
test("projected births start as newborns and retain their birth year as they grow", () => {
  const breeder = {
    ...farm,
    animals: [
      { ...farm.animals[0], id: "mother", born: "2022-01-01", weight: 400 },
    ],
    settings: { ...farm.settings, birthRate: 100 },
  };
  const plan = projectOwnership(breeder, 4, now),
    id = "projected-a-2027-F";
  for (let i = 0; i < 4; i++) {
    const cohort = plan.cohortsByYear[2027 + i].find((c) => c.id === id)!;
    assert.equal(cohort.ageMonths, i * 12);
    assert.equal(cohort.birthYear, 2027);
    assert.equal(cohort.animalId, undefined);
  }
  assert.equal(
    cowStage(plan.cohortsByYear[2030].find((c) => c.id === id)!.ageMonths),
    "adult",
  );
});
test("visual groups preserve expected counts and never combine different life stages", () => {
  const cohorts: ProjectedCohort[] = Array.from({ length: 160 }, (_, i) => ({
    id: `c${i}`,
    owner: "a",
    sex: i % 2 ? "F" : "M",
    ageMonths: i,
    birthYear: 2026 - Math.floor(i / 12),
    count: 0.97,
  }));
  const nodes = makeCowNodes(cohorts);
  assert.ok(nodes.length <= 30);
  near(
    nodes.reduce((n, c) => n + c.count, 0),
    cohorts.reduce((n, c) => n + c.count, 0),
  );
  for (const node of nodes) {
    assert.equal(cowStage(node.minAge), node.stage);
    assert.equal(cowStage(node.maxAge), node.stage);
  }
  assert.deepEqual(makeCowNodes([]), []);
  assert.equal(cowAgeLabel(12), "1 ano");
});
test("every annual snapshot reconciles with the financial model and is not mutated by later years", () => {
  const plan = projectOwnership(demoFarm(), 15, now);
  for (const row of plan.total)
    near(
      plan.cohortsByYear[row.year].reduce((n, c) => n + c.count, 0),
      row.herd,
    );
  for (const [owner, rows] of Object.entries(plan.byOwner))
    for (const row of rows)
      near(
        plan.cohortsByYear[row.year]
          .filter((c) => c.owner === owner)
          .reduce((n, c) => n + c.count, 0),
        row.herd,
      );
  const calf = projectOwnership(farm, 3, now);
  assert.equal(calf.cohortsByYear[2026][0].ageMonths, 0);
  assert.equal(calf.cohortsByYear[2029][0].ageMonths, 36);
});
test("sold and fully deceased animals disappear from future age snapshots", () => {
  const male = {
    ...farm,
    animals: [{ ...farm.animals[0], sex: "M" as const, born: "2022-01-01" }],
  };
  const sale = projectOwnership(male, 1, now);
  assert.ok(sale.cohortsByYear[2026].some((c) => c.id === "calf"));
  assert.equal(
    sale.cohortsByYear[2027].some((c) => c.id === "calf"),
    false,
  );
  const dead = projectOwnership(
    { ...farm, settings: { ...farm.settings, calfMortality: 100 } },
    1,
    now,
  );
  assert.deepEqual(dead.cohortsByYear[2027], []);
});
