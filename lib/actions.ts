import {
  type Farm,
  type Animal,
  type Investor,
  type Settings,
  type Transaction,
  type Movement,
  defaultSettings,
} from "./model.ts";
export type Action =
  | { type: "animals"; data: { animals: Animal[] }; movements: Movement[] }
  | { type: "animal"; data: Animal; movement: Movement }
  | {
      type: "purchase";
      data: { animal: Animal; amount: number; date: string };
      movement: Movement;
      transaction: Transaction;
    }
  | {
      type: "transfer";
      data: { id: string; fromOwner: string; toOwner: string; date: string };
      movement: Movement;
    }
  | { type: "investor"; data: Investor }
  | { type: "transaction"; data: Transaction }
  | { type: "settings"; data: Settings }
  | {
      type: "status";
      data: {
        id: string;
        owner: string;
        status: "vendido" | "morto";
        amount: number;
        date: string;
      };
      movement: Movement;
      transaction?: Transaction;
    };
const fail = (m: string): never => {
  throw new Error(m);
};
function text(v: unknown, label: string) {
  if (typeof v !== "string" || !v.trim() || v.length > 150)
    return fail(`${label} inválido.`);
  return v.trim();
}
function number(v: unknown, label: string, min = 0, max = 1e9) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    return fail(`${label} inválido.`);
  return v;
}
function date(v: unknown) {
  const s = text(v, "Data");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    Number.isNaN(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    return fail("Data inválida.");
  return s;
}
export function validateAction(input: unknown, f: Farm): Action {
  if (!input || typeof input !== "object") return fail("Registro inválido.");
  const { type, data } = input as {
    type: string;
    data: Record<string, unknown>;
  };
  if (!data || typeof data !== "object") return fail("Dados inválidos.");
  if (type === "settings") {
    const s = { ...defaultSettings };
    s.name = text(data.name, "Nome");
    s.location = text(data.location, "Localização");
    for (const key of Object.keys(s) as (keyof Settings)[]) {
      if (key === "name" || key === "location") continue;
      const max = [
        "yield",
        "birthRate",
        "mortality",
        "calfMortality",
        "femaleRetention",
        "inflation",
      ].includes(key)
        ? 100
        : key === "capacity"
          ? 10000
          : 1e8;
      s[key] = number(data[key], key, 0, max);
    }
    if (
      !s.arroba ||
      !s.yield ||
      !s.capacity ||
      !s.maturityMonths ||
      !s.saleMonths ||
      s.cullMonths <= s.maturityMonths
    )
      return fail("Revise preços, capacidade e idades de reprodução/descarte.");
    return { type, data: s };
  }
  if (type === "animals") {
    const entries = data.animals;
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 500)
      return fail("Cadastre entre 1 e 500 animais por lote.");
    let next = f;
    const animals: Animal[] = [];
    const movements: Movement[] = [];
    for (const entry of entries) {
      const action = validateAction({ type: "animal", data: entry }, next);
      if (action.type !== "animal") return fail("Animal inválido.");
      animals.push(action.data);
      movements.push(action.movement);
      next = applyAction(next, action);
    }
    return { type, data: { animals }, movements };
  }
  if (type === "animal" || type === "purchase") {
    const info =
      type === "purchase" && data.animal && typeof data.animal === "object"
        ? (data.animal as Record<string, unknown>)
        : data;
    const a: Animal = {
      id: crypto.randomUUID(),
      tag:
        info.tag === undefined || info.tag === null || info.tag === ""
          ? ""
          : text(info.tag, "Brinco"),
      sex:
        info.sex === "F"
          ? "F"
          : info.sex === "M"
            ? "M"
            : fail("Sexo inválido."),
      born: date(info.born),
      weight:
        info.weight === undefined || info.weight === null || info.weight === ""
          ? 0
          : number(info.weight, "Peso", 0, 1500),
      owner: text(info.owner, "Participante"),
      paddock: text(info.paddock, "Piquete"),
      status: "ativo",
    };
    if (new Date(a.born) > new Date())
      return fail("Nascimento não pode estar no futuro.");
    if (
      a.tag &&
      f.animals.some((x) => x.tag.toLowerCase() === a.tag.toLowerCase())
    )
      return fail("Esse brinco já existe.");
    if (!f.investors.some((i) => i.id === a.owner))
      return fail("Participante não encontrado.");
    if (!["Maternidade", "Recria", "Bezerreiro", "Engorda"].includes(a.paddock))
      return fail("Piquete inválido.");
    const when =
      type === "purchase"
        ? date(data.date)
        : new Date().toISOString().slice(0, 10);
    if (when < a.born || when > new Date().toISOString().slice(0, 10))
      return fail("Data de entrada inválida para este animal.");
    const amount =
      type === "purchase" ? number(data.amount, "Valor de compra", 0.01) : 0;
    const movement: Movement = {
      id: crypto.randomUUID(),
      date: when,
      kind: type === "purchase" ? "compra" : "cadastro",
      animalId: a.id,
      tag: a.tag,
      fromOwner: "",
      toOwner: a.owner,
      amount,
      note: type === "purchase" ? "Compra externa" : "Cadastro do animal",
    };
    if (type === "purchase")
      return {
        type,
        data: { animal: a, amount, date: when },
        movement,
        transaction: {
          id: crypto.randomUUID(),
          date: when,
          kind: "despesa",
          category: "Compra de gado",
          description: `Compra ${a.tag}`,
          amount,
          investor: a.owner,
        },
      };
    return { type, data: a, movement };
  }
  if (type === "investor") {
    const colors = ["#38564a", "#bc8b54", "#829c80", "#b6bfa9", "#8b87a5"];
    return {
      type,
      data: {
        id: crypto.randomUUID(),
        name: text(data.name, "Nome"),
        color: colors[f.investors.length % colors.length],
      },
    };
  }
  if (type === "transaction") {
    if (!["despesa", "receita", "aporte"].includes(String(data.kind)))
      return fail("Tipo inválido.");
    const investor = typeof data.investor === "string" ? data.investor : "";
    if (data.kind === "aporte" && !f.investors.some((i) => i.id === investor))
      return fail("Selecione o participante do aporte.");
    return {
      type,
      data: {
        id: crypto.randomUUID(),
        date: date(data.date),
        kind: data.kind as Transaction["kind"],
        category: text(data.category, "Categoria"),
        description: text(data.description, "Descrição"),
        amount: number(data.amount, "Valor", 0.01),
        investor,
      },
    };
  }
  if (type === "transfer" || type === "status") {
    const animal = f.animals.find(
      (a) => a.id === data.id && a.status === "ativo",
    );
    if (!animal) return fail("Animal não está ativo. Atualize o rebanho.");
    const when = date(data.date);
    if (when < animal.born || when > new Date().toISOString().slice(0, 10))
      return fail("A data deve estar entre o nascimento e hoje.");
    const expectedOwner =
      type === "transfer"
        ? text(data.fromOwner, "Proprietário atual")
        : typeof data.owner === "string"
          ? data.owner
          : animal.owner;
    if (animal.owner !== expectedOwner)
      return fail(
        "O proprietário mudou. Atualize os dados antes de continuar.",
      );
    if (type === "transfer") {
      const toOwner = text(data.toOwner, "Novo proprietário");
      if (toOwner === animal.owner)
        return fail("Escolha outro participante para receber o animal.");
      if (!f.investors.some((i) => i.id === toOwner))
        return fail("Participante de destino não encontrado.");
      return {
        type,
        data: { id: animal.id, fromOwner: animal.owner, toOwner, date: when },
        movement: {
          id: crypto.randomUUID(),
          date: when,
          kind: "transferencia",
          animalId: animal.id,
          tag: animal.tag,
          fromOwner: animal.owner,
          toOwner,
          amount: 0,
          note: "Transferência entre integrantes, sem entrada ou saída do caixa da fazenda",
        },
      };
    }
    if (data.status !== "morto" && data.status !== "vendido")
      return fail("Situação inválida.");
    const amount =
      data.status === "vendido"
        ? number(data.amount, "Valor de venda", 0.01)
        : 0;
    const transaction: Transaction | undefined =
      data.status === "vendido"
        ? {
            id: crypto.randomUUID(),
            date: when,
            kind: "receita",
            category: "Venda de gado",
            description: `Venda ${animal.tag}`,
            amount,
            investor: animal.owner,
          }
        : undefined;
    return {
      type,
      data: {
        id: animal.id,
        owner: animal.owner,
        status: data.status,
        amount,
        date: when,
      },
      movement: {
        id: crypto.randomUUID(),
        date: when,
        kind: data.status === "vendido" ? "venda" : "morte",
        animalId: animal.id,
        tag: animal.tag,
        fromOwner: animal.owner,
        toOwner: "",
        amount,
        note: data.status === "vendido" ? "Venda externa" : "Baixa por morte",
      },
      transaction,
    };
  }
  return fail("Operação desconhecida.");
}
export function applyAction(f: Farm, a: Action): Farm {
  if (a.type === "investor")
    return { ...f, investors: [...f.investors, a.data] };
  if (a.type === "transaction")
    return { ...f, transactions: [...f.transactions, a.data] };
  if (a.type === "settings") return { ...f, settings: a.data };
  if (a.type === "animals")
    return {
      ...f,
      animals: [...f.animals, ...a.data.animals],
      movements: [...(f.movements ?? []), ...a.movements],
    };
  const movements = [...(f.movements ?? []), a.movement];
  if (a.type === "animal")
    return { ...f, animals: [...f.animals, a.data], movements };
  if (a.type === "purchase")
    return {
      ...f,
      animals: [...f.animals, a.data.animal],
      transactions: [...f.transactions, a.transaction],
      movements,
    };
  const animal = f.animals.find(
    (x) => x.id === a.data.id && x.status === "ativo",
  );
  if (!animal) return fail("Animal não está ativo.");
  if (a.type === "transfer") {
    if (animal.owner !== a.data.fromOwner)
      return fail("O proprietário já foi alterado.");
    return {
      ...f,
      animals: f.animals.map((x) =>
        x.id === animal.id ? { ...x, owner: a.data.toOwner } : x,
      ),
      movements,
    };
  }
  if (animal.owner !== a.data.owner)
    return fail("O proprietário já foi alterado.");
  return {
    ...f,
    animals: f.animals.map((x) =>
      x.id === animal.id ? { ...x, status: a.data.status } : x,
    ),
    transactions: a.transaction
      ? [...f.transactions, a.transaction]
      : f.transactions,
    movements,
  };
}
