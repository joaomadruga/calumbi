import {
  active,
  normalizeSettings,
  type Farm,
  type PurchaseProjection,
  type AnnualSalePolicy,
  type Animal,
  type ProjectionInference,
} from "./model.ts";
import { birthFromAge, suggestAgeMonths } from "./animal-age.ts";
import { projectFromPurchases } from "./inferred-projection.ts";
export type SandboxPurchase = {
  id?: string;
  owner: string;
  quantity: number;
  unitPrice: number;
  weight?: number;
  pregnant?: boolean;
};
export type SandboxInput = {
  purchases: SandboxPurchase[];
  cowAgeMonths: number;
  cowWeight: number;
  pregnant: boolean;
  bull: {
    enabled: boolean;
    quantity: number;
    price: number;
    ageMonths: number;
    weight: number;
    split: "equal" | "proportional";
    breeder: boolean;
  };
  monthlyPerHead: number;
  fixedMonthly: number;
  years: number;
  sales?: AnnualSalePolicy & { capacity: number };
};
export function simulateInvestment(
  farm: Farm,
  input: SandboxInput,
  now = new Date(),
) {
  const number = (n: number, label: string, min = 0, max = 1e8) => {
    if (!Number.isFinite(n) || n < min || n > max)
      throw new Error(`Revise ${label}.`);
    return n;
  };
  if (!farm.investors.length)
    throw new Error("Cadastre pelo menos um participante para simular.");
  number(input.years, "o horizonte", 1, 15);
  if (!Number.isInteger(input.years)) throw new Error("Use anos inteiros.");
  number(input.cowAgeMonths, "a idade das vacas", 12, 180);
  if (!Number.isInteger(input.cowAgeMonths))
    throw new Error("Use meses inteiros para as vacas.");
  number(input.cowWeight, "o peso das vacas", 0, 1500);
  number(input.monthlyPerHead, "o custo mensal por cabeça");
  number(input.fixedMonthly, "o custo fixo mensal");
  const seen = new Set<string>();
  let cowsCost = 0,
    quantity = 0;
  for (const p of input.purchases) {
    const lotKey = p.id ?? p.owner;
    if (
      !lotKey ||
      seen.has(lotKey) ||
      !farm.investors.some((i) => i.id === p.owner)
    )
      throw new Error("Participante inválido ou lote repetido.");
    seen.add(lotKey);
    number(
      p.weight ?? input.cowWeight,
      "o peso de chegada do lote",
      p.quantity && p.id ? 0.01 : 0,
      1500,
    );
    number(p.quantity, "a quantidade", 0, 500);
    if (!Number.isInteger(p.quantity))
      throw new Error("A quantidade precisa ser inteira.");
    number(p.unitPrice, "o preço das vacas", p.quantity ? 0.01 : 0);
    cowsCost += (p.quantity * Math.round(p.unitPrice * 100)) / 100;
    quantity += p.quantity;
  }
  if (quantity > 1000) throw new Error("Simule até 1.000 vacas por vez.");
  if (input.bull.enabled) {
    number(input.bull.quantity, "a quantidade de bois", 1, 500);
    if (!Number.isInteger(input.bull.quantity))
      throw new Error("A quantidade de bois precisa ser inteira.");
    number(input.bull.price, "o preço do boi", 0.01);
    number(input.bull.ageMonths, "a idade do boi", 1, 240);
    if (!Number.isInteger(input.bull.ageMonths))
      throw new Error("Use meses inteiros para o boi.");
    number(input.bull.weight, "o peso do boi", 0, 1500);
    if (!["equal", "proportional"].includes(input.bull.split))
      throw new Error("Rateio inválido.");
  }
  if (input.sales) {
    number(input.sales.capacity, "a lotação máxima", 1, 100000);
    if (!Number.isInteger(input.sales.capacity))
      throw new Error("Use uma lotação inteira.");
    number(input.sales.calfPrice, "o preço do bezerro", 0.01);
    number(input.sales.heiferPrice, "o preço da novilha", 0.01);
    number(input.sales.retainedPercent, "a retenção para o caixa", 0, 100);
    number(input.sales.minimumArrobas, "o peso mínimo de venda", 6, 100);
    number(input.sales.dailyGain, "o ganho diário de peso", 0.01, 2);
    if (!["live", "carcass"].includes(input.sales.arrobaBasis))
      throw new Error("Base da arroba inválida.");
  }
  const settings = {
    ...normalizeSettings(farm.settings),
    monthlyPerHead: input.monthlyPerHead,
    fixedMonthly: input.fixedMonthly,
    ...(input.sales ? { capacity: input.sales.capacity } : {}),
  };
  const date = now.toISOString().slice(0, 10);
  // Ages are approximate display/culling inputs; first conception follows the fixed weight rule.
  const purchaseAge = (p: SandboxPurchase) =>
    p.id
      ? (suggestAgeMonths(p.weight ?? input.cowWeight) ??
        ((p.weight ?? input.cowWeight) > 327.54 ? 36 : 1))
      : input.cowAgeMonths;
  const breedingWeightKg = 15000 / settings.yield; // 10 arrobas of estimated carcass.

  const purchaseProjection: PurchaseProjection = {
    clocks: {},
    retainedFemales: [],
  };
  const additions: Animal[] = input.purchases.flatMap((p, lotIndex) =>
    Array.from({ length: p.quantity }, (_, i) => ({
      id: `simulation-cow-${p.owner}-${lotIndex}-${i}`,
      tag: "",
      sex: "F" as const,
      born: birthFromAge(purchaseAge(p), date),
      weight: p.weight ?? input.cowWeight,
      owner: p.owner,
      status: "ativo" as const,
      details: {
        birthSource: p.id ? ("weight" as const) : ("estimated" as const),
        estimatedMonths: purchaseAge(p),
        ageReferenceDate: date,
        acquiredAt: date,
        reproductiveStatus:
          (p.pregnant ?? input.pregnant)
            ? ("pregnant" as const)
            : ("unknown" as const),
      },
    })),
  );
  input.purchases.forEach((p, lotIndex) => {
    if (!p.id) return;
    for (let i = 0; i < p.quantity; i++) {
      const id = `simulation-cow-${p.owner}-${lotIndex}-${i}`;
      const waitDays =
        (p.pregnant ?? input.pregnant)
          ? 0
          : Math.max(0, breedingWeightKg - (p.weight ?? input.cowWeight)) /
            (input.sales?.dailyGain ?? 90 / 365.25);
      purchaseProjection.clocks[id] = waitDays + settings.gestationDays;
      purchaseProjection.retainedFemales.push(id);
    }
  });
  const bullQuantity = input.bull.enabled ? input.bull.quantity : 0;
  const originalHeads = active(farm).length;
  const afterCowHeads = originalHeads + additions.length;
  if (
    input.bull.enabled &&
    input.bull.split === "proportional" &&
    !afterCowHeads
  )
    throw new Error(
      "Sem rebanho para o rateio proporcional: escolha divisão igual ou adicione vacas.",
    );
  const ownership = farm.investors.map((p) => {
    const before = active(farm).filter((a) => a.owner === p.id).length;
    const purchases = input.purchases.filter((a) => a.owner === p.id);
    const added = purchases.reduce((n, a) => n + a.quantity, 0);
    const afterCows = before + added;
    const bullShare = input.bull.enabled
      ? input.bull.split === "equal"
        ? 1 / farm.investors.length
        : afterCows / afterCowHeads
      : 0;
    return {
      ...p,
      before,
      added,
      afterCows,
      bullShare,
      afterBull: afterCows + bullQuantity * bullShare,
      cowsInvestment:
        purchases.reduce(
          (n, a) => n + a.quantity * Math.round(a.unitPrice * 100),
          0,
        ) / 100,
      bullInvestment: 0,
    };
  });
  const bullCost = input.bull.enabled
    ? (bullQuantity * Math.round(input.bull.price * 100)) / 100
    : 0;
  // Allocate whole cents by largest remainder so the displayed shares close exactly.
  const cents = Math.round(bullCost * 100);
  const allocation = ownership.map((p) => ({
    p,
    cents: Math.floor(cents * p.bullShare),
    remainder: (cents * p.bullShare) % 1,
  }));
  let remaining = cents - allocation.reduce((n, a) => n + a.cents, 0);
  allocation.sort(
    (a, b) => b.remainder - a.remainder || a.p.id.localeCompare(b.p.id),
  );
  for (const entry of allocation) {
    if (remaining > 0) {
      entry.cents++;
      remaining--;
    }
    entry.p.bullInvestment = entry.cents / 100;
  }
  const seeds: ProjectionInference["seeds"] = input.bull.enabled
    ? ownership
        .filter((p) => p.bullShare > 0)
        .map((p) => ({
          id: `simulation-shared-bull-${p.id}`,
          tag: bullQuantity === 1 ? "Cota do boi" : "Cota dos bois",
          owner: p.id,
          sex: "M",
          ageMonths: input.bull.ageMonths,
          birthYear: Number(
            birthFromAge(input.bull.ageMonths, date).slice(0, 4),
          ),
          count: bullQuantity * p.bullShare,
          weight: input.bull.weight,
          breeder: input.bull.breeder,
          inferred: false,
        }))
    : [];
  // Purchases are funded by the participants: report their capital separately, with zero change to real cash.
  const stages = [
    {
      id: "baseline",
      label: "Hoje",
      animals: farm.animals,
      extra: [] as ProjectionInference["seeds"],
      heads: originalHeads,
      capital: 0,
    },
    {
      id: "cows",
      label: "Após comprar vacas",
      animals: [...farm.animals, ...additions],
      extra: [] as ProjectionInference["seeds"],
      heads: afterCowHeads,
      capital: cowsCost,
    },
    {
      id: "bull",
      label: input.bull.enabled
        ? bullQuantity === 1
          ? "Vacas + boi compartilhado"
          : "Vacas + bois compartilhados"
        : "Resultado do teste",
      animals: [...farm.animals, ...additions],
      extra: seeds,
      heads: afterCowHeads + bullQuantity,
      capital: cowsCost + bullCost,
    },
  ].map((stage) => {
    const plan = projectFromPurchases(
      { ...farm, settings, animals: stage.animals },
      input.years,
      now,
      { 2023: 24, 2025: 36 },
      stage.extra,
      input.sales,
      stage.id === "baseline" ? undefined : purchaseProjection,
    );
    return {
      id: stage.id,
      label: stage.label,
      heads: stage.heads,
      capital: stage.capital,
      monthly: settings.fixedMonthly + stage.heads * settings.monthlyPerHead,
      excess: Math.max(0, stage.heads - settings.capacity),
      plan,
      people: ownership.map((p) => {
        const heads =
          stage.id === "baseline"
            ? p.before
            : stage.id === "cows"
              ? p.afterCows
              : p.afterBull;
        const share = stage.heads ? heads / stage.heads : 0;
        const investment =
          stage.id === "baseline"
            ? 0
            : p.cowsInvestment + (stage.id === "bull" ? p.bullInvestment : 0);
        const contributions = (plan.byOwner[p.id] ?? [])
          .slice(1)
          .reduce((n, r) => n + r.contribution, 0);
        return {
          ...p,
          heads,
          share,
          investment,
          monthly:
            (settings.fixedMonthly + stage.heads * settings.monthlyPerHead) *
            (stage.heads ? share : 1 / ownership.length),
          futureContributions: contributions,
          totalCapital: investment + contributions,
          projectedHeads: plan.byOwner[p.id]?.at(-1)?.herd ?? 0,
        };
      }),
    };
  });
  return {
    stages,
    cowsCost,
    bullCost,
    bullQuantity,
    quantity,
    total: cowsCost + bullCost,
    settings,
    projectedCapacityPressure: Math.max(
      0,
      stages[0].plan.total[0].herd +
        quantity +
        bullQuantity -
        settings.capacity,
    ),
  };
}
