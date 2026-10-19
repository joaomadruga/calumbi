import test from "node:test";
import assert from "node:assert/strict";
import {
  projectOwnership,
  defaultSettings,
  type Farm,
  type AnnualSalePolicy,
  type ProjectionInference,
} from "./model.ts";
const now = new Date("2026-01-01T12:00:00Z");
const policy: AnnualSalePolicy = {
  calfPrice: 450,
  heiferPrice: 370,
  retainedPercent: 10,
  minimumArrobas: 6,
  arrobaBasis: "carcass",
  dailyGain: 0.01,
};
const farm = (): Farm => ({
  animals: [],
  investors: [
    { id: "a", name: "A", color: "#123" },
    { id: "b", name: "B", color: "#456" },
  ],
  transactions: [],
  settings: {
    ...defaultSettings,
    yield: 50,
    birthRate: 0,
    mortality: 0,
    calfMortality: 0,
    monthlyPerHead: 0,
    fixedMonthly: 0,
    reserveMonths: 0,
    openingCash: 0,
    capacity: 100,
  },
});
const seed = (
  id: string,
  owner: string,
  sex: "M" | "F",
  weight: number,
  ageMonths = 6,
): ProjectionInference["seeds"][number] => ({
  id,
  owner,
  sex,
  weight,
  ageMonths,
  count: 1,
  birthYear: 2025,
  inferred: false,
  motherId: "mother",
});
const run = (f: Farm, seeds: ProjectionInference["seeds"], p = policy) =>
  projectOwnership(
    f,
    2,
    now,
    {
      seeds,
      clocks: Object.fromEntries(seeds.map((s) => [s.id, Infinity])),
      birthsByOwner: {},
    },
    p,
  );
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
test("annual sale respects 6 arrobas, category prices and a single owner distribution", () => {
  const result = run(farm(), [
    seed("male", "a", "M", 180),
    seed("female", "b", "F", 180),
  ]);
  const year = result.total[1],
    arrobas = (180 + 365.25 * 0.01) / 30;
  near(year.sales, 2);
  near(year.revenue, arrobas * (450 + 370));
  near(year.retained!, year.revenue * 0.1);
  near(year.distributed!, year.revenue * 0.9);
  near(year.cash, year.retained!);
  near(year.contribution, 0);
  near(result.byOwner.a[1].distributed!, arrobas * 450 * 0.9);
  near(result.byOwner.b[1].distributed!, arrobas * 370 * 0.9);
  near(result.total[2].sales, 0);
});
test("capacity never forces an underweight calf or a breeding bull sale", () => {
  const f = farm();
  f.settings.capacity = 1;
  const result = run(f, [
    seed("small-a", "a", "M", 50),
    seed("small-b", "b", "F", 50),
    { ...seed("bull", "a", "M", 600, 36), breeder: true },
  ]);
  near(result.total[1].sales, 0);
  near(result.total[1].herd, 3);
  near(result.total[1].unsoldExcess!, 2);
});
test("capacity sells eligible matrices proportionally while preserving their owners", () => {
  const f = farm();
  f.settings.capacity = 1;
  f.animals = ["a", "b"].map((owner, i) => ({
    id: String(i),
    tag: "",
    owner,
    sex: "F",
    born: "2022-01-01",
    weight: 400,
    status: "ativo",
  }));
  const result = run(f, []);
  near(result.total[1].sales, 1);
  near(result.total[1].herd, 1);
  near(result.byOwner.a[1].sales, 0.5);
  near(result.byOwner.b[1].sales, 0.5);
});
test("retention funds maintenance only once, with contributions covering the remaining cost", () => {
  const f = farm();
  f.settings.fixedMonthly = 100;
  const result = run(f, [seed("male", "a", "M", 180)]);
  const row = result.total[1];
  near(row.cash, 0);
  near(row.contribution, 1200 - row.retained!);
  near(row.revenue, row.retained! + row.distributed!);
  for (const year of result.total.slice(1))
    for (const key of [
      "revenue",
      "retained",
      "distributed",
      "contribution",
      "costs",
    ] as const)
      near(
        year[key]!,
        result.byOwner.a.find((r) => r.year === year.year)![key]! +
          result.byOwner.b.find((r) => r.year === year.year)![key]!,
      );
  near(
    run(f, [seed("male", "a", "M", 180)], { ...policy, retainedPercent: 100 })
      .total[1].distributed!,
    0,
  );
  near(
    run(f, [seed("male", "a", "M", 180)], { ...policy, retainedPercent: 0 })
      .total[1].contribution,
    1200,
  );
});
test("live and carcass arrobas change eligibility without changing actual animal weight", () => {
  const seeds = [seed("small", "a", "M", 90)];
  near(run(farm(), seeds).total[1].sales, 0);
  near(
    run(farm(), seeds, { ...policy, arrobaBasis: "live" }).total[1].sales,
    1,
  );
});
test("newborn females are not sold at birth and all eligible descendants sell annually", () => {
  const f = farm();
  f.settings.birthRate = 100;
  f.animals = [
    {
      id: "mother",
      tag: "",
      owner: "a",
      sex: "F",
      born: "2022-01-01",
      weight: 400,
      status: "ativo",
    },
  ];
  const result = projectOwnership(f, 5, now, undefined, {
    ...policy,
    dailyGain: 0.5,
  });
  assert.ok(result.total[1].births > 0);
  assert.ok(
    result.cohortsByYear[2027].some(
      (c) => c.motherId === "mother" && c.sex === "F",
    ),
  );
  assert.ok(result.total.slice(2).some((r) => r.sales > 0));
  for (const cohorts of Object.values(result.cohortsByYear))
    assert.ok(cohorts.some((c) => c.animalId === "mother"));
});

test("a registered calf that reaches sale weight after age two still sells in the annual batch", () => {
  const f = farm();
  f.animals = [
    {
      id: "young",
      tag: "",
      owner: "a",
      sex: "F",
      born: "2025-07-01",
      weight: 110,
      status: "ativo",
    },
  ];
  const result = projectOwnership(f, 3, now, undefined, {
    ...policy,
    dailyGain: 0.1,
  });
  near(result.total[1].sales, 0);
  near(result.total[2].sales, 1);
});
