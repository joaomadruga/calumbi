export type Animal = {
  id: string;
  tag: string;
  sex: "F" | "M";
  born: string;
  weight: number;
  owner: string;
  status: "ativo" | "vendido" | "morto";
};
export type Movement = {
  id: string;
  date: string;
  kind: "cadastro" | "compra" | "venda" | "morte" | "transferencia" | "edicao";
  animalId: string;
  tag: string;
  fromOwner: string;
  toOwner: string;
  amount: number;
  note: string;
};
export type Investor = { id: string; name: string; color: string };
export type Transaction = {
  id: string;
  date: string;
  kind: "despesa" | "receita" | "aporte";
  category: string;
  description: string;
  amount: number;
  investor: string;
};
export type Settings = {
  name: string;
  location: string;
  arroba: number;
  yield: number;
  birthRate: number;
  mortality: number;
  calfMortality: number;
  maturityMonths: number;
  saleMonths: number;
  cullMonths: number;
  capacity: number;
  monthlyPerHead: number;
  fixedMonthly: number;
  inflation: number;
  reserveMonths: number;
  openingCash: number;
  femaleRetention: number;
};
export type Farm = {
  animals: Animal[];
  investors: Investor[];
  transactions: Transaction[];
  settings: Settings;
  movements?: Movement[];
};
export const money = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
export const decimal = (n: number, digits = 1) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
export const active = (f: Farm) =>
  f.animals.filter((a) => a.status === "ativo");
export const ageMonths = (born: string, now = new Date()) =>
  Math.max(
    0,
    (now.getFullYear() - new Date(born + "T12:00:00").getFullYear()) * 12 +
      now.getMonth() -
      new Date(born + "T12:00:00").getMonth(),
  );
export const animalValue = (weight: number, s: Settings) =>
  ((weight * s.yield) / 100 / 15) * s.arroba;
export const category = (a: Animal, now = new Date()) =>
  ageMonths(a.born, now) < 12
    ? "Bezerros"
    : a.sex === "F"
      ? ageMonths(a.born, now) >= 36
        ? "Matrizes"
        : "Novilhas"
      : "Machos";
export function summary(f: Farm, now = new Date()) {
  const herd = active(f),
    s = f.settings;
  const value = herd.reduce((v, a) => v + animalValue(a.weight, s), 0);
  const monthly = s.fixedMonthly + herd.length * s.monthlyPerHead;
  const deathReserve =
    herd.reduce(
      (v, a) =>
        v +
        (animalValue(a.weight, s) *
          (ageMonths(a.born, now) < 12 ? s.calfMortality : s.mortality)) /
          100,
      0,
    ) / 12;
  const cash =
    s.openingCash +
    f.transactions.reduce(
      (v, t) => v + (t.kind === "despesa" ? -t.amount : t.amount),
      0,
    );
  const shares = f.investors.map((i) => {
    const count = herd.filter((a) => a.owner === i.id).length;
    const share = herd.length ? count / herd.length : 0;
    return {
      ...i,
      count,
      share,
      value: value * share,
      monthly: (monthly + deathReserve) * share,
    };
  });
  return {
    herd,
    value,
    monthly,
    deathReserve,
    cash,
    shares,
    reserveTarget: monthly * s.reserveMonths,
  };
}
export type Projection = {
  year: number;
  herd: number;
  births: number;
  deaths: number;
  sales: number;
  revenue: number;
  costs: number;
  reserve: number;
  contribution: number;
  value: number;
  cash: number;
  fibonacci: number;
};
export type ProjectedCohort = {
  id: string;
  owner: string;
  sex: "F" | "M";
  ageMonths: number;
  birthYear: number;
  count: number;
  animalId?: string;
  tag?: string;
};

export function project(f: Farm, years = 10, now = new Date()): Projection[] {
  return projectOwnership(f, years, now).total;
}

/** One shared herd simulation. Every cohort retains its owner's identity. */
export function projectOwnership(
  f: Farm,
  years = 10,
  now = new Date(),
): {
  total: Projection[];
  byOwner: Record<string, Projection[]>;
  cohortsByYear: Record<number, ProjectedCohort[]>;
} {
  const s = f.settings,
    base = summary(f, now);
  let cash = base.cash;
  type Cohort = {
    id: string;
    animalId?: string;
    tag?: string;
    sex: "F" | "M";
    age: number;
    birthYear: number;
    count: number;
    weight: number;
    owner: string;
  };
  let cohorts: Cohort[] = active(f).map((a) => ({
    id: a.id,
    animalId: a.id,
    tag: a.tag,
    birthYear: Number(a.born.slice(0, 4)),
    sex: a.sex,
    age: ageMonths(a.born, now),
    count: 1,
    weight: a.weight,
    owner: a.owner,
  }));
  const cohortsByYear: Record<number, ProjectedCohort[]> = {};
  const saveCohorts = (year: number) => {
    cohortsByYear[year] = cohorts
      .filter((c) => c.count > 1e-9)
      .map((c) => ({
        id: c.id,
        owner: c.owner,
        sex: c.sex,
        ageMonths: c.age,
        birthYear: c.birthYear,
        count: c.count,
        ...(c.animalId ? { animalId: c.animalId, tag: c.tag } : {}),
      }));
  };
  saveCohorts(now.getFullYear());
  const owners = [
    ...new Set([
      ...f.investors.map((i) => i.id),
      ...cohorts.map((c) => c.owner),
    ]),
  ];
  const empty = (year: number): Projection => ({
    year,
    herd: 0,
    births: 0,
    deaths: 0,
    sales: 0,
    revenue: 0,
    costs: 0,
    reserve: 0,
    contribution: 0,
    value: 0,
    cash: 0,
    fibonacci: 0,
  });
  const total: Projection[] = [
    {
      ...empty(now.getFullYear()),
      herd: cohorts.length,
      reserve: base.reserveTarget,
      value: base.value,
      cash,
      fibonacci: cohorts.length,
    },
  ];
  const byOwner: Record<string, Projection[]> = Object.fromEntries(
    owners.map((owner) => {
      const animals = active(f).filter((a) => a.owner === owner),
        share = base.herd.length ? animals.length / base.herd.length : 0;
      return [
        owner,
        [
          {
            ...empty(now.getFullYear()),
            herd: animals.length,
            value: animals.reduce((n, a) => n + animalValue(a.weight, s), 0),
            cash: cash * share,
            reserve: base.reserveTarget * share,
            fibonacci: animals.length,
          },
        ],
      ];
    }),
  );
  let fibA = 1,
    fibB = 1;
  for (let y = 1; y <= years; y++) {
    const year = now.getFullYear() + y;
    const rows: Record<string, Projection> = Object.fromEntries(
      owners.map((owner) => [owner, empty(year)]),
    );
    const starts = Object.fromEntries(
      owners.map((owner) => [
        owner,
        cohorts
          .filter((c) => c.owner === owner)
          .reduce((n, c) => n + c.count, 0),
      ]),
    );
    const losses: Record<string, number> = Object.fromEntries(
      owners.map((owner) => [owner, 0]),
    );
    for (const c of cohorts)
      if (c.sex === "F" && c.age >= s.maturityMonths && c.age < s.cullMonths)
        rows[c.owner].births += (c.count * s.birthRate) / 100;
    cohorts = cohorts.map((c) => {
      const died =
        (c.count * (c.age < 12 ? s.calfMortality : s.mortality)) / 100;
      rows[c.owner].deaths += died;
      losses[c.owner] += died * animalValue(c.weight, s);
      return {
        ...c,
        count: c.count - died,
        age: c.age + 12,
        weight: Math.max(
          c.weight,
          Math.min(c.sex === "F" ? 450 : 550, c.weight + 90),
        ),
      };
    });
    cohorts = cohorts.filter((c) => {
      if (
        (c.sex === "M" && c.age >= s.saleMonths) ||
        (c.sex === "F" && c.age >= s.cullMonths)
      ) {
        rows[c.owner].sales += c.count;
        rows[c.owner].revenue += c.count * animalValue(c.weight, s);
        return false;
      }
      return true;
    });
    for (const owner of owners) {
      const dead = (rows[owner].births * s.calfMortality) / 100;
      rows[owner].deaths += dead;
      losses[owner] += dead * animalValue(120, s);
      const females = (rows[owner].births - dead) / 2,
        retained = (females * s.femaleRetention) / 100;
      rows[owner].sales += females - retained;
      rows[owner].revenue += (females - retained) * animalValue(180, s);
      cohorts.push(
        {
          id: `projected-${owner}-${year}-F`,
          birthYear: year,
          sex: "F",
          age: 0,
          count: retained,
          weight: 120,
          owner,
        },
        {
          id: `projected-${owner}-${year}-M`,
          birthYear: year,
          sex: "M",
          age: 0,
          count: females,
          weight: 120,
          owner,
        },
      );
    }
    // Sell the youngest cohorts first, proportionally across owners of the same
    // age. Investor ordering must never decide who loses stock at capacity.
    let excess = Math.max(
      0,
      cohorts.reduce((n, c) => n + c.count, 0) - s.capacity,
    );
    for (const age of [...new Set(cohorts.map((c) => c.age))].sort(
      (a, b) => a - b,
    )) {
      if (excess <= 1e-9) break;
      const group = cohorts.filter((c) => c.age === age),
        count = group.reduce((n, c) => n + c.count, 0),
        take = Math.min(excess, count);
      if (!count) continue;
      for (const c of group) {
        const sold = (take * c.count) / count;
        c.count -= sold;
        rows[c.owner].sales += sold;
        rows[c.owner].revenue += sold * animalValue(c.weight, s);
      }
      excess -= take;
    }
    for (const c of cohorts) {
      rows[c.owner].herd += c.count;
      rows[c.owner].value += c.count * animalValue(c.weight, s);
    }
    const start = Object.values(starts).reduce((n, v) => n + v, 0),
      herd = Object.values(rows).reduce((n, r) => n + r.herd, 0);
    const inflation = (1 + s.inflation / 100) ** (y - 1);
    const costs =
      (s.fixedMonthly * 12 + ((start + herd) / 2) * s.monthlyPerHead * 12) *
      inflation;
    const loss = Object.values(losses).reduce((n, v) => n + v, 0);
    const reserve =
      (s.fixedMonthly + herd * s.monthlyPerHead) * s.reserveMonths * inflation +
      loss;
    const revenue = Object.values(rows).reduce((n, r) => n + r.revenue, 0);
    const contribution = Math.max(0, reserve - (cash + revenue - costs));
    cash += revenue - costs + contribution;
    if (y > 1) {
      const next = fibA + fibB;
      fibA = fibB;
      fibB = next;
    }
    for (const owner of owners) {
      const row = rows[owner];
      const initialShare = base.herd.length
        ? byOwner[owner][0].herd / base.herd.length
        : 0;
      const averageShare =
        start + herd
          ? (starts[owner] + row.herd) / (start + herd)
          : initialShare;
      const closingShare = herd ? row.herd / herd : averageShare;
      row.costs = costs * averageShare;
      row.reserve =
        (s.fixedMonthly * closingShare + row.herd * s.monthlyPerHead) *
          s.reserveMonths *
          inflation +
        losses[owner];
      row.contribution = contribution * averageShare;
      row.cash = cash * closingShare;
      row.fibonacci = byOwner[owner][0].herd * fibB;
      byOwner[owner].push(row);
    }
    saveCohorts(year);
    total.push({
      year,
      herd,
      births: Object.values(rows).reduce((n, r) => n + r.births, 0),
      deaths: Object.values(rows).reduce((n, r) => n + r.deaths, 0),
      sales: Object.values(rows).reduce((n, r) => n + r.sales, 0),
      revenue,
      costs,
      reserve,
      contribution,
      value: Object.values(rows).reduce((n, r) => n + r.value, 0),
      cash,
      fibonacci: base.herd.length * fibB,
    });
  }
  return { total, byOwner, cohortsByYear };
}
export const defaultSettings: Settings = {
  name: "Fazenda Calumbi",
  location: "Agreste · Pernambuco",
  arroba: 375,
  yield: 50,
  birthRate: 78,
  mortality: 2,
  calfMortality: 5,
  maturityMonths: 36,
  saleMonths: 30,
  cullMonths: 120,
  capacity: 120,
  monthlyPerHead: 0,
  fixedMonthly: 0,
  inflation: 5,
  reserveMonths: 6,
  openingCash: 0,
  femaleRetention: 90,
};
export function demoFarm(): Farm {
  const now = new Date();
  const born = (m: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 15);
    return d.toISOString().slice(0, 10);
  };
  const investors = [
    { id: "joao", name: "João Madruga", color: "#38564a" },
    { id: "ana", name: "Ana Oliveira", color: "#bc8b54" },
    { id: "pedro", name: "Pedro Santos", color: "#829c80" },
    { id: "maria", name: "Maria Santos", color: "#b6bfa9" },
  ];
  const animals: Animal[] = Array.from({ length: 48 }, (_, i) => ({
    id: `demo-${i}`,
    tag: `CL-${String(i + 1).padStart(3, "0")}`,
    sex: i < 36 ? "F" : "M",
    born: born(
      i < 26
        ? 42 + (i % 35)
        : i < 36
          ? 14 + (i % 14)
          : i < 42
            ? 4 + (i % 6)
            : 16 + (i % 12),
    ),
    weight:
      i < 26
        ? 390 + (i % 6) * 10
        : i < 36
          ? 220 + (i % 5) * 15
          : i < 42
            ? 100 + (i % 4) * 20
            : 300 + (i % 6) * 15,
    owner: i < 20 ? "joao" : i < 34 ? "ana" : i < 42 ? "pedro" : "maria",
    status: "ativo",
  }));
  const day = new Date().toISOString().slice(0, 10);
  return {
    animals,
    investors,
    settings: {
      ...defaultSettings,
      monthlyPerHead: 85,
      fixedMonthly: 1800,
      openingCash: 42000,
    },
    transactions: [
      {
        id: "t1",
        date: day,
        kind: "despesa",
        category: "Nutrição",
        description: "Suplementação mineral do rebanho",
        amount: 1240,
        investor: "",
      },
      {
        id: "t2",
        date: day,
        kind: "despesa",
        category: "Sanidade",
        description: "Vacinas e manejo sanitário",
        amount: 680,
        investor: "",
      },
      {
        id: "t3",
        date: day,
        kind: "aporte",
        category: "Aporte",
        description: "Aporte de manutenção · João",
        amount: 2450,
        investor: "joao",
      },
    ],
  };
}
