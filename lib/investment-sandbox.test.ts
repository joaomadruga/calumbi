import test from "node:test";
import assert from "node:assert/strict";
import { simulateInvestment, type SandboxInput } from "./investment-sandbox.ts";
import { defaultSettings, type Farm } from "./model.ts";
const now = new Date("2026-10-19T12:00:00Z");
function farm(): Farm {
  return {
    animals: ["a", "a", "b"].map((owner, i) => ({
      id: `cow-${i}`,
      tag: String(i),
      owner,
      sex: "F",
      born: "2022-01-01",
      weight: 400,
      status: "ativo",
    })),
    investors: ["a", "b", "c"].map((id) => ({ id, name: id, color: "#123" })),
    transactions: [],
    settings: {
      ...defaultSettings,
      birthRate: 0,
      mortality: 0,
      calfMortality: 0,
      capacity: 10000,
      openingCash: 1234,
    },
  };
}
function input(): SandboxInput {
  return {
    purchases: [
      { owner: "a", quantity: 2, unitPrice: 1000 },
      { owner: "b", quantity: 1, unitPrice: 1500 },
      { owner: "c", quantity: 3, unitPrice: 2000 },
    ],
    cowAgeMonths: 36,
    cowWeight: 400,
    pregnant: false,
    bull: {
      enabled: true,
      quantity: 1,
      price: 900,
      ageMonths: 36,
      weight: 600,
      split: "proportional",
      breeder: true,
    },
    monthlyPerHead: 100,
    fixedMonthly: 900,
    years: 5,
  };
}
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
test("sequential purchases reconcile personal capital, ownership and one shared physical bull", () => {
  const f = farm(),
    before = JSON.stringify(f),
    result = simulateInvestment(f, input(), now);
  assert.deepEqual(
    result.stages.map((s) => s.heads),
    [3, 9, 10],
  );
  assert.deepEqual(
    result.stages.map((s) => s.capital),
    [0, 9500, 10400],
  );
  const end = result.stages[2];
  assert.deepEqual(
    end.people.map((p) => p.bullInvestment),
    [400, 200, 300],
  );
  near(
    end.people.reduce((n, p) => n + p.heads, 0),
    10,
  );
  near(
    end.people.reduce((n, p) => n + p.share, 0),
    1,
  );
  near(
    end.people.reduce((n, p) => n + p.investment, 0),
    end.capital,
  );
  near(
    end.people.reduce((n, p) => n + p.monthly, 0),
    1900,
  );
  assert.equal(JSON.stringify(f), before);
  for (const stage of result.stages) {
    assert.equal(stage.plan.total[0].cash, 1234);
    for (const row of stage.plan.total)
      near(
        Object.values(stage.plan.byOwner).reduce(
          (n, rows) => n + rows.find((r) => r.year === row.year)!.herd,
          0,
        ),
        row.herd,
      );
  }
});
test("equal sharing includes zero-stock investors and closes indivisible cents exactly", () => {
  const config = input();
  config.bull.split = "equal";
  config.bull.price = 1000;
  config.purchases = config.purchases.map((p) => ({ ...p, quantity: 0 }));
  const end = simulateInvestment(farm(), config, now).stages[2];
  assert.deepEqual(
    end.people.map((p) => p.bullInvestment),
    [333.34, 333.33, 333.33],
  );
  near(
    end.people.reduce((n, p) => n + p.bullInvestment, 0),
    1000,
  );
  assert.ok(end.people[2].heads > 0);
  near(
    end.people.reduce((n, p) => n + p.bullShare, 0),
    1,
  );
});
test("breeding bull stays while a fattening bull sells at the configured age", () => {
  const config = input();
  config.purchases = config.purchases.map((p) => ({ ...p, quantity: 0 }));
  const breeder = simulateInvestment(farm(), config, now).stages[2];
  const sum = (year: number) =>
    breeder.plan.cohortsByYear[year]
      .filter((c) => c.id.startsWith("simulation-shared-bull"))
      .reduce((n, c) => n + c.count, 0);
  near(sum(2026), 1);
  near(sum(2031), 1);
  assert.equal(breeder.plan.total[0].inferredHead, 0);
  const fattening = simulateInvestment(
    farm(),
    { ...config, bull: { ...config.bull, breeder: false } },
    now,
  ).stages[2];
  assert.ok(
    !fattening.plan.cohortsByYear[2027].some((c) =>
      c.id.startsWith("simulation-shared-bull"),
    ),
  );
  const crowded = farm();
  crowded.settings.capacity = 1;
  const tight = simulateInvestment(crowded, config, now).stages[2];
  near(
    tight.plan.cohortsByYear[2027]
      .filter((c) => c.breeder)
      .reduce((n, c) => n + c.count, 0),
    1,
  );
});
test("startup with no cattle still allocates fixed maintenance and future contributions", () => {
  const f = farm();
  f.animals = [];
  f.settings.openingCash = 0;
  const config = input();
  config.purchases = [];
  config.bull.split = "equal";
  const result = simulateInvestment(f, config, now);
  near(
    result.stages[0].people.reduce((n, p) => n + p.monthly, 0),
    900,
  );
  near(
    result.stages[0].people.reduce((n, p) => n + p.futureContributions, 0),
    result.stages[0].plan.total
      .slice(1)
      .reduce((n, r) => n + r.contribution, 0),
  );
  near(result.stages[2].heads, 1);
  assert.throws(() =>
    simulateInvestment(
      f,
      { ...config, bull: { ...config.bull, split: "proportional" } },
      now,
    ),
  );
});
test("invalid quantities, prices, participant duplicates and horizons cannot produce a result", () => {
  const f = farm(),
    config = input();
  for (const purchases of [
    [{ owner: "a", quantity: -1, unitPrice: 100 }],
    [{ owner: "a", quantity: 1.5, unitPrice: 100 }],
    [{ owner: "a", quantity: 1, unitPrice: 0 }],
    [{ owner: "unknown", quantity: 1, unitPrice: 100 }],
    [config.purchases[0], config.purchases[0]],
  ])
    assert.throws(() => simulateInvestment(f, { ...config, purchases }, now));
  assert.throws(() => simulateInvestment(f, { ...config, years: NaN }, now));
  assert.throws(() =>
    simulateInvestment(
      f,
      { ...config, bull: { ...config.bull, price: 0 } },
      now,
    ),
  );
  const without = simulateInvestment(
    f,
    { ...config, bull: { ...config.bull, enabled: false } },
    now,
  );
  near(without.bullCost, 0);
  near(without.stages[2].heads, 9);
});

test("multiple shared bulls reconcile cost, ownership, maintenance, capacity and future cohorts", () => {
  const config = input();
  config.bull.quantity = 3;
  const f = farm();
  f.settings.capacity = 11;
  const result = simulateInvestment(f, config, now);
  const end = result.stages[2];
  assert.equal(result.bullQuantity, 3);
  assert.equal(result.bullCost, 2700);
  assert.equal(end.capital, 12200);
  assert.equal(end.heads, 12);
  assert.equal(end.monthly, 2100);
  assert.equal(end.excess, 1);
  assert.equal(result.projectedCapacityPressure, 1);
  assert.deepEqual(
    end.people.map((p) => p.bullInvestment),
    [1200, 600, 900],
  );
  near(
    end.people.reduce((n, p) => n + p.heads, 0),
    12,
  );
  near(
    end.people.reduce((n, p) => n + p.monthly, 0),
    2100,
  );
  for (const year of [2026, 2031])
    near(
      end.plan.cohortsByYear[year]
        .filter((c) => c.id.startsWith("simulation-shared-bull"))
        .reduce((n, c) => n + c.count, 0),
      3,
    );
  config.bull.quantity = 2;
  config.bull.price = 1000;
  config.bull.split = "equal";
  const equal = simulateInvestment(farm(), config, now).stages[2];
  assert.deepEqual(
    equal.people.map((p) => p.bullInvestment),
    [666.67, 666.67, 666.66],
  );
  near(
    equal.people.reduce((n, p) => n + p.heads - p.afterCows, 0),
    2,
  );
});

test("shared bull quantities must be positive whole numbers within the limit", () => {
  const config = input();
  for (const quantity of [0, -1, 1.5, NaN, Infinity, 501])
    assert.throws(() =>
      simulateInvestment(
        farm(),
        { ...config, bull: { ...config.bull, quantity } },
        now,
      ),
    );
  const disabled = simulateInvestment(
    farm(),
    { ...config, bull: { ...config.bull, enabled: false, quantity: 90 } },
    now,
  );
  assert.equal(disabled.bullQuantity, 0);
  assert.equal(disabled.bullCost, 0);
  assert.equal(disabled.stages[2].heads, 9);
});

test("annual sale settings belong only to the test and invalid policies are rejected", () => {
  const f = farm(),
    config = input();
  const before = JSON.stringify(f);
  config.sales = {
    capacity: 7,
    calfPrice: 450,
    heiferPrice: 370,
    retainedPercent: 10,
    minimumArrobas: 6,
    arrobaBasis: "carcass",
    dailyGain: 0.5,
  };
  const result = simulateInvestment(f, config, now);
  assert.equal(result.settings.capacity, 7);
  assert.equal(JSON.stringify(f), before);
  for (const change of [
    { capacity: 0 },
    { capacity: 1.5 },
    { retainedPercent: 101 },
    { calfPrice: 0 },
    { heiferPrice: NaN },
    { minimumArrobas: 5 },
    { dailyGain: 0 },
  ])
    assert.throws(() =>
      simulateInvestment(
        f,
        { ...config, sales: { ...config.sales!, ...change } },
        now,
      ),
    );
});

test("same owner can buy separate 6@ and 10@ lots with independent reproduction and costs", () => {
  const f = farm();
  f.animals = [];
  f.settings.birthRate = 100;
  const config = input();
  config.bull.enabled = false;
  config.purchases = [
    {
      id: "young",
      owner: "a",
      quantity: 5,
      unitPrice: 2700,
      ageMonths: 7,
      weight: 180,
      breedingWeightKg: 300,
      pregnant: false,
    },
    {
      id: "ready",
      owner: "a",
      quantity: 10,
      unitPrice: 4500,
      ageMonths: 18,
      weight: 300,
      breedingWeightKg: 300,
      pregnant: false,
    },
  ];
  config.sales = {
    capacity: 1000,
    calfPrice: 450,
    heiferPrice: 370,
    retainedPercent: 10,
    minimumArrobas: 6,
    arrobaBasis: "carcass",
    dailyGain: 0.5,
  };
  const before = JSON.stringify(config);
  const result = simulateInvestment(f, config, now);
  assert.equal(result.quantity, 15);
  assert.equal(result.cowsCost, 58500);
  const stage = result.stages[1];
  assert.equal(stage.people[0].added, 15);
  assert.equal(stage.people[0].cowsInvestment, 58500);
  const initial = stage.plan.cohortsByYear[2026];
  assert.equal(new Set(initial.map((c) => c.id)).size, 15);
  assert.equal(initial.filter((c) => c.ageMonths === 7).length, 5);
  assert.equal(initial.filter((c) => c.ageMonths === 18).length, 10);
  const youngIds = initial.filter((c) => c.ageMonths === 7).map((c) => c.id);
  const readyIds = initial.filter((c) => c.ageMonths === 18).map((c) => c.id);
  near(stage.plan.total[1].births, 10);
  assert.ok(
    !stage.plan.cohortsByYear[2027].some(
      (c) => c.motherId && youngIds.includes(c.motherId),
    ),
  );
  assert.ok(
    stage.plan.cohortsByYear[2027].some(
      (c) => c.motherId && readyIds.includes(c.motherId),
    ),
  );
  assert.ok(
    stage.plan.cohortsByYear[2028].some(
      (c) => c.motherId && youngIds.includes(c.motherId),
    ),
  );
  for (const year of [2027, 2028, 2029])
    near(
      stage.plan.cohortsByYear[year]
        .filter((c) => youngIds.includes(c.id) || readyIds.includes(c.id))
        .reduce((n, c) => n + c.count, 0),
      15,
    );
  assert.equal(JSON.stringify(config), before);
  near(result.stages[0].plan.total[1].births, 0);
});
test("lot breeding weight overrides generic maturity, while pregnancy bypasses weight waiting", () => {
  const f = farm();
  f.animals = [];
  f.settings.birthRate = 100;
  f.settings.maturityMonths = 36;
  const config = input();
  config.bull.enabled = false;
  config.purchases = [
    {
      id: "one",
      owner: "a",
      quantity: 1,
      unitPrice: 2700,
      ageMonths: 7,
      weight: 180,
      breedingWeightKg: 300,
      pregnant: false,
    },
  ];
  config.sales = {
    capacity: 1000,
    calfPrice: 450,
    heiferPrice: 370,
    retainedPercent: 10,
    minimumArrobas: 6,
    arrobaBasis: "carcass",
    dailyGain: 0.5,
  };
  near(simulateInvestment(f, config, now).stages[1].plan.total[1].births, 0);
  config.purchases[0].breedingWeightKg = 180;
  near(simulateInvestment(f, config, now).stages[1].plan.total[1].births, 1);
  config.purchases[0].breedingWeightKg = 300;
  config.purchases[0].pregnant = true;
  near(simulateInvestment(f, config, now).stages[1].plan.total[1].births, 1);
});
test("lot identifiers and independent weights and ages are validated", () => {
  const config = input();
  const lot = {
    id: "first",
    owner: "a",
    quantity: 1,
    unitPrice: 1000,
    ageMonths: 7,
    weight: 180,
    breedingWeightKg: 300,
  };
  for (const patch of [
    { ageMonths: 0 },
    { ageMonths: 1.5 },
    { weight: 0 },
    { weight: NaN },
    { breedingWeightKg: 0 },
    { breedingWeightKg: 451 },
  ])
    assert.throws(() =>
      simulateInvestment(
        farm(),
        { ...config, purchases: [{ ...lot, ...patch }] },
        now,
      ),
    );
  assert.throws(() =>
    simulateInvestment(
      farm(),
      { ...config, purchases: [lot, { ...lot, owner: "b" }] },
      now,
    ),
  );
});
