import type { ProjectedCohort } from "./model.ts";
export type CowStage = "newborn" | "young" | "adult";
export type CowNode = {
  id: string;
  owner: string;
  sex: "F" | "M";
  stage: CowStage;
  count: number;
  minAge: number;
  maxAge: number;
  birthYear: number | null;
  sourceIds: string[];
  unit: number;
};
export function cowStage(ageMonths: number, adultMonths = 36): CowStage {
  return ageMonths < 12
    ? "newborn"
    : ageMonths < Math.max(12, adultMonths)
      ? "young"
      : "adult";
}
export function cowStageLabel(stage: CowStage, sex: "F" | "M" = "F") {
  return stage === "newborn"
    ? sex === "F"
      ? "Recém-nascida"
      : "Recém-nascido"
    : stage === "young"
      ? sex === "F"
        ? "Jovem · novilha"
        : "Jovem · garrote"
      : sex === "F"
        ? "Adulta"
        : "Adulto";
}
export function cowAgeLabel(min: number, max = min) {
  const label = (n: number) =>
    n < 12
      ? `${n} ${n === 1 ? "mês" : "meses"}`
      : `${Math.floor(n / 12)} ${Math.floor(n / 12) === 1 ? "ano" : "anos"}${n % 12 ? ` e ${n % 12} meses` : ""}`;
  return min === max ? label(min) : `${label(min)} a ${label(max)}`;
}

// Never mix life stages to meet the drawing budget. Counts are expectations,
// so the final animal symbol can represent a fractional surviving group.
export function makeCowNodes(
  cohorts: ProjectedCohort[],
  adultMonths = 36,
  minimumUnit = 1,
  budget = 30,
): CowNode[] {
  const valid = cohorts.filter((c) => c.count > 1e-9);
  function group(byYear: boolean) {
    const groups = new Map<string, Omit<CowNode, "unit">>();
    for (const c of valid) {
      const stage = cowStage(c.ageMonths, adultMonths),
        key = `${c.owner}-${byYear ? c.birthYear : "all"}-${c.sex}-${stage}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count += c.count;
        existing.minAge = Math.min(existing.minAge, c.ageMonths);
        existing.maxAge = Math.max(existing.maxAge, c.ageMonths);
        existing.sourceIds.push(c.id);
      } else
        groups.set(key, {
          id: key,
          owner: c.owner,
          sex: c.sex,
          stage,
          count: c.count,
          minAge: c.ageMonths,
          maxAge: c.ageMonths,
          birthYear: byYear ? c.birthYear : null,
          sourceIds: [c.id],
        });
    }
    return [...groups.values()].sort(
      (a, b) => a.minAge - b.minAge || a.id.localeCompare(b.id),
    );
  }
  let groups = group(true);
  if (groups.length > budget) groups = group(false);
  let unit = Math.max(1, minimumUnit);
  const required = () =>
    groups.reduce((n, g) => n + Math.ceil(g.count / unit - 1e-9), 0);
  while (required() > Math.max(budget, groups.length)) unit += 1;
  return groups.flatMap((g) =>
    Array.from({ length: Math.ceil(g.count / unit - 1e-9) }, (_, i) => ({
      ...g,
      id: `${g.id}:${i}`,
      count: Math.min(unit, Math.max(0, g.count - i * unit)),
      unit,
    })),
  );
}
