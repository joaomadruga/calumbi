import test from "node:test";
import assert from "node:assert/strict";
import { birthFromAge, suggestAgeMonths } from "./animal-age.ts";
import { validateAction, applyAction } from "./actions.ts";
import { demoFarm, ageMonths, projectOwnership } from "./model.ts";
import { buildWriteRequests, readAnimalDetails, headers } from "./sheets.ts";

test("weight suggestion is approximate and limited to the reference growth range", () => {
  assert.equal(suggestAgeMonths(181.3), 7);
  assert.equal(suggestAgeMonths(244.51), 12);
  assert.equal(suggestAgeMonths(327.54), 18);
  assert.equal(suggestAgeMonths(450), null);
  assert.equal(suggestAgeMonths(0), null);
  assert.equal(suggestAgeMonths(NaN), null);
  assert.equal(birthFromAge(1, "2024-03-31"), "2024-02-29");
  assert.equal(birthFromAge(1, "2025-03-31"), "2025-02-28");
});
const input = () => {
  const f = demoFarm();
  return {
    f,
    data: {
      tag: "AGE",
      sex: "F",
      born: "2026-10-18",
      weight: 244.51,
      owner: f.investors[0].id,
      birthSource: "weight",
      estimatedMonths: 12,
      ageReferenceDate: "2026-10-18",
      ageWeightKg: 244.51,
      acquiredAt: "2026-10-01",
      reproductiveStatus: "unknown",
    },
  };
};

test("estimated birth uses age at assessment, independently of the purchase date, and ages in projections", () => {
  const { f, data } = input();
  const a = validateAction({ type: "animal", data }, f);
  assert.equal(a.type, "animal");
  if (a.type !== "animal") throw new Error("Expected animal");
  assert.equal(a.data.born, "2025-10-18");
  assert.equal(a.data.details?.acquiredAt, "2026-10-01");
  assert.equal(ageMonths(a.data.born, new Date("2027-10-18T12:00:00Z")), 24);
  const checked = validateAction(a, f);
  assert.deepEqual(checked.data, { ...a.data, id: checked.data.id });
  const next = applyAction(f, a);
  const cohorts = projectOwnership(
    next,
    1,
    new Date("2026-10-18T12:00:00Z"),
  ).cohortsByYear;
  assert.equal(
    cohorts[2026].find((c) => c.animalId === a.data.id)?.ageMonths,
    12,
  );
  assert.equal(
    cohorts[2027].find((c) => c.animalId === a.data.id)?.ageMonths,
    24,
  );
  const requests = buildWriteRequests(f, a, {
    Animais: 1,
    Movimentacoes: 2,
  }) as any[];
  const saved =
    requests[0].appendCells.rows[0].values[6].userEnteredValue.stringValue;
  assert.deepEqual(readAnimalDetails(saved), a.data.details);
  assert.equal(readAnimalDetails("Old paddock"), undefined);
  assert.equal(readAnimalDetails("null"), undefined);
  assert.equal(headers.Animais[7], "status");
});

test("manual adult age and reproductive status do not infer age from weight or pregnancy", () => {
  const { f, data } = input();
  const a = validateAction(
    {
      type: "animal",
      data: {
        ...data,
        birthSource: "estimated",
        estimatedMonths: 48,
        weight: 450,
        reproductiveStatus: "pregnant",
      },
    },
    f,
  );
  if (a.type !== "animal") throw new Error("Expected animal");
  assert.equal(a.data.born, "2022-10-18");
  assert.equal(a.data.details?.reproductiveStatus, "pregnant");
  assert.equal(a.data.details?.ageWeightKg, undefined);
  assert.throws(
    () =>
      validateAction(
        { type: "animal", data: { ...data, estimatedMonths: "" } },
        f,
      ),
    /idade/i,
  );
  assert.throws(
    () =>
      validateAction(
        {
          type: "animal",
          data: { ...data, sex: "M", reproductiveStatus: "pregnant" },
        },
        f,
      ),
    /fêmeas/,
  );
});

test("confirmed pregnancy contributes to the first annual cycle without guessing age or confirming insemination", () => {
  const { f, data } = input();
  const single = {
    ...f,
    animals: [],
    transactions: [],
    settings: { ...f.settings, mortality: 0, calfMortality: 0, birthRate: 0 },
  };
  const count = (reproductiveStatus: string) => {
    const a = validateAction(
      { type: "animal", data: { ...data, reproductiveStatus } },
      single,
    );
    return projectOwnership(
      applyAction(single, a),
      2,
      new Date("2026-10-18T12:00:00Z"),
    ).total;
  };
  assert.equal(count("pregnant")[1].births, 1);
  assert.equal(count("pregnant")[2].births, 0);
  assert.equal(count("inseminated")[1].births, 0);
});
