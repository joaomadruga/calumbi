import test from "node:test";
import assert from "node:assert/strict";
import {
  genealogyNodes,
  familyIds,
  genealogyLayout,
  paginateFamilies,
} from "./genealogy.ts";
import {
  defaultSettings,
  projectOwnership,
  type Farm,
  type ProjectedCohort,
} from "./model.ts";
const cohort = (
  id: string,
  overrides: Partial<ProjectedCohort> = {},
): ProjectedCohort => ({
  id,
  owner: "a",
  sex: "F",
  ageMonths: 48,
  birthYear: 2022,
  count: 1,
  animalId: id,
  tag: id,
  ...overrides,
});
const mother = cohort("mother");
const other = cohort("other");
const daughter = cohort("daughter", {
  animalId: undefined,
  tag: undefined,
  motherId: "mother",
  birthYear: 2027,
  ageMonths: 2,
  count: 0.45,
});
const granddaughter = cohort("granddaughter", {
  animalId: undefined,
  tag: undefined,
  motherId: "daughter",
  birthYear: 2031,
  ageMonths: 0,
  count: 0.2,
});

test("each projected calf retains its own mother across annual snapshots and later generations", () => {
  const f: Farm = {
    animals: [
      {
        id: "a",
        tag: "CL-1",
        sex: "F",
        born: "2022-01-01",
        weight: 400,
        owner: "a",
        status: "ativo",
      },
      {
        id: "b",
        tag: "CL-2",
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
      capacity: 10000,
      mortality: 0,
      calfMortality: 0,
      femaleRetention: 100,
      cullMonths: 240,
    },
  };
  const plan = projectOwnership(f, 7, new Date("2026-01-01T12:00:00Z"));
  const initial = plan.cohortsByYear[2027].filter((c) => c.motherId);
  assert.ok(initial.some((c) => c.motherId === "a"));
  assert.ok(initial.some((c) => c.motherId === "b"));
  const all = new Map(
    Object.values(plan.cohortsByYear)
      .flat()
      .map((c) => [c.id, c]),
  );
  let hasGrandchild = false;
  for (const c of all.values())
    if (c.motherId) {
      const mom = all.get(c.motherId);
      assert.ok(mom);
      assert.equal(mom.sex, "F");
      assert.ok(mom.birthYear < c.birthYear);
      if (mom.motherId) hasGrandchild = true;
    }
  assert.ok(hasGrandchild);
});
test("tree preserves exited ancestors without counting them as living or leaking future nodes", () => {
  const history = {
    2026: [mother, other],
    2027: [daughter, other],
    2031: [granddaughter, other],
  };
  const nodes = genealogyNodes(history, 2031, "a");
  assert.equal(
    nodes.find((n) => n.sourceIds[0] === "mother")?.historical,
    true,
  );
  assert.equal(
    nodes.find((n) => n.sourceIds[0] === "daughter")?.historical,
    true,
  );
  assert.equal(
    nodes.filter((n) => n.historical).reduce((sum, n) => sum + n.count, 0),
    0,
  );
  assert.ok(nodes.some((n) => n.sourceIds[0] === "granddaughter"));
  assert.ok(!genealogyNodes(history, 2026, "a").some((n) => n.motherId));
  assert.equal(genealogyNodes(history, 2031, "b").length, 0);
});
test("family focus includes ancestors and descendants while excluding unrelated roots", () => {
  const nodes = genealogyNodes(
    {
      2026: [mother, other],
      2027: [mother, other, daughter],
      2031: [mother, other, daughter, granddaughter],
    },
    2031,
    "a",
  );
  assert.deepEqual([...familyIds(nodes, "daughter")].sort(), [
    "daughter",
    "granddaughter",
    "mother",
  ]);
  assert.equal(familyIds(nodes, "missing").size, 0);
  assert.equal(familyIds(nodes, null).size, 4);
  const positions = genealogyLayout(nodes);
  assert.ok(positions.get("mother")!.y < positions.get("daughter")!.y);
  assert.ok(positions.get("daughter")!.y < positions.get("granddaughter")!.y);
});
test("different mothers and birth years never get merged, including a large herd", () => {
  const herd = Array.from({ length: 90 }, (_, i) => cohort(`mother-${i}`));
  const nodes = genealogyNodes({ 2026: herd }, 2026, "a");
  assert.equal(nodes.length, 90);
  const layout = genealogyLayout(nodes);
  assert.equal(
    new Set([...layout.values()].map((p) => `${p.x},${p.y}`)).size,
    90,
  );
  const orphan = genealogyNodes(
    { 2027: [cohort("orphan", { motherId: "unknown" })] },
    2027,
    "a",
  );
  assert.equal(orphan[0].motherId, undefined);
});

test("large herds are paged without splitting families or losing any roots", () => {
  const herd = Array.from({ length: 90 }, (_, i) =>
    cohort(`mother-${i}`, { owner: i % 2 ? "b" : "a" }),
  );
  const history = {
    2026: herd,
    2027: [
      ...herd,
      cohort("calf", {
        motherId: "mother-0",
        animalId: undefined,
        birthYear: 2027,
        ageMonths: 1,
      }),
    ],
  };
  const nodes = [
    ...genealogyNodes(history, 2027, "a"),
    ...genealogyNodes(history, 2027, "b"),
  ];
  const seen = new Set<string>();
  for (let i = 0; i < 15; i++) {
    const page = paginateFamilies(nodes, null, i);
    assert.equal(page.pageCount, 15);
    const roots = [...page.ids].filter((id) => id.startsWith("mother-"));
    assert.equal(roots.length, 6);
    for (const id of roots) {
      assert.ok(!seen.has(id));
      seen.add(id);
    }
    if (page.ids.has("mother-0")) assert.ok(page.ids.has("calf"));
  }
  assert.equal(seen.size, 90);
  assert.equal(paginateFamilies(nodes, "a", 999).currentPage, 7);
  const initial = paginateFamilies(nodes, null, 0);
  assert.ok([...initial.ids].some((id) => id === "mother-1"));
});
test("unrelated families wrap into rows rather than a single unbounded strip", () => {
  const nodes = genealogyNodes(
    { 2026: Array.from({ length: 90 }, (_, i) => cohort(`mother-${i}`)) },
    2026,
    "a",
  );
  const points = [...genealogyLayout(nodes).values()];
  assert.ok(new Set(points.map((p) => p.y)).size > 1);
  assert.ok(
    Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)) <
      900,
  );
});
