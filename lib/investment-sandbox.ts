import {
  active,
  normalizeSettings,
  type Farm,
  type Animal,
  type ProjectionInference,
} from "./model.ts";
import { birthFromAge } from "./animal-age.ts";
import { projectFromPurchases } from "./inferred-projection.ts";
export type SandboxInput = {
  purchases: { owner: string; quantity: number; unitPrice: number }[];
  cowAgeMonths: number;
  cowWeight: number;
  pregnant: boolean;
  bull: {
    enabled: boolean;
    price: number;
    ageMonths: number;
    weight: number;
    split: "equal" | "proportional";
    breeder: boolean;
  };
  monthlyPerHead: number;
  fixedMonthly: number;
  years: number;
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
    if (seen.has(p.owner) || !farm.investors.some((i) => i.id === p.owner))
      throw new Error("Participante inválido ou repetido.");
    seen.add(p.owner);
    number(p.quantity, "a quantidade", 0, 500);
    if (!Number.isInteger(p.quantity))
      throw new Error("A quantidade precisa ser inteira.");
    number(p.unitPrice, "o preço das vacas", p.quantity ? 0.01 : 0);
    cowsCost += (p.quantity * Math.round(p.unitPrice * 100)) / 100;
    quantity += p.quantity;
  }
  if (quantity > 1000) throw new Error("Simule até 1.000 vacas por vez.");
  if (input.bull.enabled) {
    number(input.bull.price, "o preço do boi", 0.01);
    number(input.bull.ageMonths, "a idade do boi", 1, 240);
    if (!Number.isInteger(input.bull.ageMonths))
      throw new Error("Use meses inteiros para o boi.");
    number(input.bull.weight, "o peso do boi", 0, 1500);
    if (!["equal", "proportional"].includes(input.bull.split))
      throw new Error("Rateio inválido.");
  }
  const settings = {
    ...normalizeSettings(farm.settings),
    monthlyPerHead: input.monthlyPerHead,
    fixedMonthly: input.fixedMonthly,
  };
  const date = now.toISOString().slice(0, 10);
  const additions: Animal[] = input.purchases.flatMap((p) =>
    Array.from({ length: p.quantity }, (_, i) => ({
      id: `simulation-cow-${p.owner}-${i}`,
      tag: "",
      sex: "F" as const,
      born: birthFromAge(input.cowAgeMonths, date),
      weight: input.cowWeight,
      owner: p.owner,
      status: "ativo" as const,
      details: {
        birthSource: "estimated" as const,
        estimatedMonths: input.cowAgeMonths,
        ageReferenceDate: date,
        acquiredAt: date,
        reproductiveStatus: input.pregnant
          ? ("pregnant" as const)
          : ("unknown" as const),
      },
    })),
  );
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
    const purchase = input.purchases.find((a) => a.owner === p.id);
    const added = purchase?.quantity ?? 0;
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
      afterBull: afterCows + bullShare,
      cowsInvestment:
        (added * Math.round((purchase?.unitPrice ?? 0) * 100)) / 100,
      bullInvestment: input.bull.enabled ? input.bull.price * bullShare : 0,
    };
  });
  const bullCost = input.bull.enabled
    ? Math.round(input.bull.price * 100) / 100
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
          tag: "Cota do boi",
          owner: p.id,
          sex: "M",
          ageMonths: input.bull.ageMonths,
          birthYear: Number(
            birthFromAge(input.bull.ageMonths, date).slice(0, 4),
          ),
          count: p.bullShare,
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
        ? "Vacas + boi compartilhado"
        : "Resultado do teste",
      animals: [...farm.animals, ...additions],
      extra: seeds,
      heads: afterCowHeads + (input.bull.enabled ? 1 : 0),
      capital: cowsCost + bullCost,
    },
  ].map((stage) => {
    const plan = projectFromPurchases(
      { ...farm, settings, animals: stage.animals },
      input.years,
      now,
      { 2023: 24, 2025: 36 },
      stage.extra,
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
    quantity,
    total: cowsCost + bullCost,
    settings,
    projectedCapacityPressure: Math.max(
      0,
      stages[0].plan.total[0].herd +
        quantity +
        (input.bull.enabled ? 1 : 0) -
        settings.capacity,
    ),
  };
}
