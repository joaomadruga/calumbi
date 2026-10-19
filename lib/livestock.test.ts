import test from "node:test";
import assert from "node:assert/strict";
import {
  type Farm,
  type Animal,
  type Projection,
  defaultSettings,
  summary,
  projectOwnership,
  demoFarm,
} from "./model.ts";
import { validateAction, applyAction } from "./actions.ts";
import { buildWriteRequests, headers } from "./sheets.ts";
const today = new Date().toISOString().slice(0, 10);
const now = new Date("2026-10-18T12:00:00Z");
const cow = (id: string, owner = "a", sex: "F" | "M" = "F"): Animal => ({
  id,
  tag: `CL-${id}`,
  sex,
  born: "2022-01-01",
  weight: 400,
  owner,

  status: "ativo",
});
const farm = (): Farm => ({
  animals: [cow("1"), cow("2", "b", "M")],
  investors: [
    { id: "a", name: "Ana", color: "#123" },
    { id: "b", name: "Bruno", color: "#456" },
  ],
  transactions: [],
  settings: { ...defaultSettings, openingCash: 5000 },
});
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const purchase = (f: Farm) =>
  validateAction(
    {
      type: "purchase",
      data: {
        tag: "CL-003",
        sex: "F",
        born: "2023-01-01",
        weight: 350,
        owner: "a",

        date: today,
        amount: 4200,
      },
    },
    f,
  );

test("purchase creates a unique owned animal, an expense and a linked history event together", () => {
  const f = farm(),
    action = purchase(f),
    next = applyAction(f, action),
    animal = next.animals.at(-1)!;
  assert.equal(animal.owner, "a");
  assert.equal(new Set(next.animals.map((a) => a.id)).size, 3);
  assert.equal(summary(next).cash, 800);
  assert.equal(next.transactions.at(-1)?.investor, "a");
  assert.equal(next.movements?.at(-1)?.animalId, animal.id);
  assert.equal(next.movements?.at(-1)?.kind, "compra");
  assert.throws(() => purchase(next));
  const normalized = validateAction(JSON.parse(JSON.stringify(action)), f);
  assert.equal(normalized.type, "purchase");
});
test("transfers preserve animal ID, tag, herd size, and farm cash while updating shares and audit trail", () => {
  const f = farm(),
    action = validateAction(
      {
        type: "transfer",
        data: { id: "1", fromOwner: "a", toOwner: "b", date: today },
      },
      f,
    ),
    next = applyAction(f, action);
  assert.equal(next.animals[0].id, "1");
  assert.equal(next.animals[0].tag, "CL-1");
  assert.equal(next.animals[0].owner, "b");
  assert.equal(summary(next).cash, summary(f).cash);
  assert.equal(summary(next).herd.length, 2);
  assert.equal(summary(next).shares[0].share, 0);
  assert.equal(summary(next).shares[1].share, 1);
  assert.equal(next.movements?.at(-1)?.fromOwner, "a");
  assert.equal(next.movements?.at(-1)?.toOwner, "b");
  assert.throws(() =>
    validateAction(
      {
        type: "transfer",
        data: { id: "1", fromOwner: "a", toOwner: "b", date: today },
      },
      next,
    ),
  );
  assert.throws(() => applyAction(next, action));
});
test("invalid destination, same-owner transfer, inactive animal and stale sale owner are rejected", () => {
  const f = farm();
  for (const toOwner of ["a", "missing"])
    assert.throws(() =>
      validateAction(
        {
          type: "transfer",
          data: { id: "1", fromOwner: "a", toOwner, date: today },
        },
        f,
      ),
    );
  assert.throws(() =>
    validateAction(
      {
        type: "status",
        data: {
          id: "1",
          owner: "b",
          status: "vendido",
          amount: 5000,
          date: today,
        },
      },
      f,
    ),
  );
  f.animals[0].status = "morto";
  assert.throws(() =>
    validateAction(
      {
        type: "transfer",
        data: { id: "1", fromOwner: "a", toOwner: "b", date: today },
      },
      f,
    ),
  );
});
test("selling a transferred animal credits its current owner and preserves the same ID in history", () => {
  let f = farm();
  f = applyAction(
    f,
    validateAction(
      {
        type: "transfer",
        data: { id: "1", fromOwner: "a", toOwner: "b", date: today },
      },
      f,
    ),
  );
  const sale = validateAction(
      {
        type: "status",
        data: {
          id: "1",
          owner: "b",
          status: "vendido",
          amount: 5500,
          date: today,
        },
      },
      f,
    ),
    next = applyAction(f, sale);
  assert.equal(summary(next).cash, 10500);
  assert.equal(next.transactions[0].investor, "b");
  assert.equal(next.movements?.at(-1)?.animalId, "1");
  assert.equal(next.movements?.at(-1)?.fromOwner, "b");
  assert.throws(() => applyAction(next, sale));
});
test("individual projections use actual sex, age and ownership rather than flat percentages", () => {
  const f = farm(),
    plan = projectOwnership(f, 5, now);
  assert.ok(plan.byOwner.a[1].births > 0);
  assert.equal(plan.byOwner.b[1].births, 0);
  assert.equal(plan.byOwner.b[1].herd, 0);
  assert.ok(plan.byOwner.a[2].herd > 0);
  const moved = applyAction(
    f,
    validateAction(
      {
        type: "transfer",
        data: { id: "1", fromOwner: "a", toOwner: "b", date: today },
      },
      f,
    ),
  );
  const after = projectOwnership(moved, 5, now);
  assert.equal(after.byOwner.a[1].births, 0);
  assert.ok(after.byOwner.b[1].births > 0);
});
test("individual annual herd balances and totals reconcile with the shared farm simulation", () => {
  const plan = projectOwnership(demoFarm(), 15, now);
  const fields: (keyof Projection)[] = [
    "herd",
    "births",
    "deaths",
    "sales",
    "revenue",
    "costs",
    "reserve",
    "contribution",
    "value",
    "cash",
    "fibonacci",
  ];
  for (let i = 0; i < plan.total.length; i++) {
    for (const key of fields)
      close(
        Object.values(plan.byOwner).reduce((n, rows) => n + rows[i][key], 0),
        plan.total[i][key],
      );
    if (i)
      for (const rows of Object.values(plan.byOwner))
        close(
          rows[i].herd,
          rows[i - 1].herd + rows[i].births - rows[i].deaths - rows[i].sales,
        );
  }
});
test("capacity sales are fair across owners regardless of their order in the investor list", () => {
  const f = farm();
  f.animals = [cow("1"), cow("2", "b")];
  f.settings = {
    ...f.settings,
    capacity: 2,
    birthRate: 100,
    mortality: 0,
    calfMortality: 0,
    femaleRetention: 100,
  };
  const first = projectOwnership(f, 2, now);
  const second = projectOwnership(
    { ...f, investors: [...f.investors].reverse() },
    2,
    now,
  );
  for (const owner of ["a", "b"])
    for (let i = 1; i < first.total.length; i++) {
      close(first.byOwner[owner][i].herd, second.byOwner[owner][i].herd);
      close(first.byOwner[owner][i].sales, second.byOwner[owner][i].sales);
    }
  close(first.byOwner.a[1].herd, 1);
  close(first.byOwner.b[1].herd, 1);
});
test("Sheets purchase batches animal, expense and movement; missing audit tab is created without deleting data", () => {
  const f = farm(),
    a = purchase(f);
  const requests = buildWriteRequests(f, a, {
    Animais: 0,
    Participantes: 1,
    Lancamentos: 2,
    Configuracoes: 3,
  }) as any[];
  assert.equal(requests.filter((r) => r.addSheet).length, 1);
  assert.ok(requests.some((r) => r.appendCells?.sheetId === 0));
  assert.ok(requests.some((r) => r.appendCells?.sheetId === 2));
  assert.equal(requests.filter((r) => r.appendCells?.sheetId === 4).length, 2);
  assert.equal(
    requests.some((r) => r.deleteSheet),
    false,
  );
});
test("Sheets updates the physical sorted row by ID and logs transfer without a cash transaction", () => {
  const f = farm(),
    a = validateAction(
      {
        type: "transfer",
        data: { id: "1", fromOwner: "a", toOwner: "b", date: today },
      },
      f,
    );
  const row = (x: Animal) =>
    headers.Animais.map((key) => x[key as keyof Animal]);
  const raw = [headers.Animais, [], row(f.animals[1]), row(f.animals[0])];
  const ids = {
    Animais: 0,
    Participantes: 1,
    Lancamentos: 2,
    Configuracoes: 3,
    Movimentacoes: 4,
  };
  const requests = buildWriteRequests(f, a, ids, raw) as any[];
  const update = requests.find((r) => r.updateCells).updateCells;
  assert.equal(update.start.rowIndex, 3);
  assert.equal(update.start.columnIndex, 5);
  assert.equal(update.rows[0].values[0].userEnteredValue.stringValue, "b");
  assert.ok(requests.some((r) => r.appendCells?.sheetId === 4));
  assert.equal(
    requests.some((r) => r.appendCells?.sheetId === 2),
    false,
  );
  raw[3][5] = "b";
  assert.throws(() => buildWriteRequests(f, a, ids, raw));
});

test("Sheets sale plans status, receipt and audit event in one batch and rejects an already sold row", () => {
  const f = farm(),
    a = validateAction(
      {
        type: "status",
        data: {
          id: "1",
          owner: "a",
          status: "vendido",
          amount: 5100,
          date: today,
        },
      },
      f,
    );
  const raw = [
    headers.Animais,
    headers.Animais.map((k) => f.animals[0][k as keyof Animal]),
  ];
  const ids = {
    Animais: 0,
    Participantes: 1,
    Lancamentos: 2,
    Configuracoes: 3,
    Movimentacoes: 4,
  };
  const requests = buildWriteRequests(f, a, ids, raw) as any[];
  assert.equal(requests.length, 3);
  assert.equal(requests[0].updateCells.start.columnIndex, 7);
  assert.equal(requests[1].appendCells.sheetId, 2);
  assert.equal(requests[2].appendCells.sheetId, 4);
  raw[1][7] = "vendido";
  assert.throws(() => buildWriteRequests(f, a, ids, raw));
});

test("batch registration creates 90 independent animals without tags or weights and revalidates", () => {
  const f = farm();
  const input = {
    type: "animals",
    data: {
      animals: Array.from({ length: 90 }, () => ({
        sex: "F",
        born: "2025-01-01",
        owner: "a",
      })),
    },
  };
  const validated = validateAction(input, f);
  const action = validateAction(validated, f);
  assert.equal(action.type, "animals");
  if (action.type !== "animals") throw new Error("Expected batch");
  assert.equal(new Set(action.data.animals.map((a) => a.id)).size, 90);
  assert.ok(action.data.animals.every((a) => a.weight === 0 && a.tag === ""));
  const next = applyAction(f, action);
  assert.equal(next.animals.length, 92);
  assert.equal(next.movements?.length, 90);
  assert.equal(summary(next).cash, summary(f).cash);
  const requests = buildWriteRequests(f, action, {
    Animais: 1,
    Participantes: 2,
    Lancamentos: 3,
    Configuracoes: 4,
  }) as any[];
  assert.equal(requests.filter((r) => r.addSheet).length, 1);
  assert.equal(requests.filter((r) => r.appendCells?.sheetId === 1).length, 90);
  assert.equal(requests.filter((r) => r.appendCells?.sheetId === 5).length, 91);
});

test("batch validation rejects invalid quantities and duplicate tags before writing", () => {
  const f = farm();
  for (const animals of [[], Array(501).fill({})])
    assert.throws(() =>
      validateAction({ type: "animals", data: { animals } }, f),
    );
  const animal = {
    sex: "F",
    born: "2025-01-01",
    owner: "a",

    tag: "repeat",
  };
  assert.throws(
    () =>
      validateAction(
        { type: "animals", data: { animals: [animal, animal] } },
        f,
      ),
    /brinco/,
  );
  assert.throws(
    () =>
      validateAction({ type: "animal", data: { ...animal, weight: -1 } }, f),
    /Peso/,
  );
});

test("editing preserves identity, owner, status and cash while recording history", () => {
  const f = farm();
  const original = f.animals[0];
  const action = validateAction(
    {
      type: "editAnimal",
      data: { ...original, tag: "Updated", weight: 480, previous: original },
    },
    f,
  );
  const validated = validateAction(action, f);
  assert.equal(validated.type, "editAnimal");
  const next = applyAction(f, validated);
  assert.equal(next.animals.length, f.animals.length);
  assert.equal(next.animals[0].id, original.id);
  assert.equal(next.animals[0].owner, original.owner);
  assert.equal(next.animals[0].weight, 480);
  assert.equal(summary(next).cash, summary(f).cash);
  assert.equal(next.movements?.[0].kind, "edicao");
  const raw = [
    headers.Animais,
    [],
    [
      original.id,
      original.tag,
      original.sex,
      original.born,
      original.weight,
      original.owner,
      "Old area",
      original.status,
    ],
  ];
  const requests = buildWriteRequests(
    f,
    validated,
    { Animais: 1, Movimentacoes: 2 },
    raw,
  ) as any[];
  assert.equal(requests[0].updateCells.start.rowIndex, 2);
  assert.equal(requests[0].updateCells.start.columnIndex, 1);
  assert.equal(requests[0].updateCells.rows[0].values.length, 4);
  raw[2][4] = 999;
  assert.throws(() =>
    buildWriteRequests(f, validated, { Animais: 1, Movimentacoes: 2 }, raw),
  );
  assert.throws(() => applyAction(next, validated));
});

test("editing rejects duplicate tags, owner changes, stale data and inactive animals", () => {
  const f = farm(),
    original = f.animals[0];
  const edit = (data: object, current = f) =>
    validateAction(
      {
        type: "editAnimal",
        data: { ...original, previous: original, ...data },
      },
      current,
    );
  assert.throws(() => edit({ tag: f.animals[1].tag }), /brinco/);
  assert.throws(() => edit({ owner: "b" }), /Transferir/);
  assert.throws(
    () => edit({ previous: { ...original, weight: 999 } }),
    /alterado/,
  );
  assert.throws(
    () => edit({}, { ...f, animals: [{ ...original, status: "vendido" }] }),
    /ativo/,
  );
  const action = edit({ tag: "", weight: 0 });
  assert.equal(action.type, "editAnimal");
  if (action.type === "editAnimal") assert.equal(action.data.weight, 0);
});
