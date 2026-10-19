import { birthFromAge } from "./animal-age.ts";
import {
  active,
  ageMonths,
  normalizeSettings,
  projectOwnership,
  type Farm,
  type AnnualSalePolicy,
  type ProjectedCohort,
  type ProjectionInference,
} from "./model.ts";
const day = 86400000,
  month = (365.25 / 12) * day;
type Virtual = {
  id: string;
  motherId: string;
  owner: string;
  sex: "F" | "M";
  born: number;
  count: number;
  nextDue: number;
};
/** Hypothetical births since acquisition. This never writes or adds real registered animals. */
export function projectFromPurchases(
  input: Farm,
  years = 10,
  now = new Date(),
  purchaseAges: Record<number, number> = {},
  additionalSeeds: ProjectionInference["seeds"] = [],
  salePolicy?: AnnualSalePolicy,
) {
  // Farm-specific purchase memories are optional and affect only the simulation.
  const f: Farm = {
    ...input,
    animals: input.animals.map((a) => {
      if (a.details) return a;
      const purchase = input.movements?.find(
        (m) => m.animalId === a.id && m.kind === "compra",
      );
      const entry = purchase?.date ?? a.born;
      const months = purchaseAges[Number(entry.slice(0, 4))];
      if (months === undefined) return a;
      const born =
        purchase && a.born !== entry ? a.born : birthFromAge(months, entry);
      return {
        ...a,
        born,
        details: {
          birthSource: "estimated",
          estimatedMonths: months,
          ageReferenceDate: entry,
          acquiredAt: entry,
          reproductiveStatus: "unknown",
        },
      };
    }),
  };
  const s = normalizeSettings(f.settings),
    end = now.getTime();
  const cycle = (s.postpartumDays + s.gestationDays) * day;
  const virtual: Virtual[] = [];
  const clocks: Record<string, number> = {};
  const entries = new Map<string, number>();
  const birthsByOwner: Record<string, number> = {};
  const queue: { id: string; owner: string; due: number; virtual?: Virtual }[] =
    [];
  const surviving = (c: Virtual, date: number) => {
    const age = (date - c.born) / month;
    if (
      age < 0 ||
      (c.sex === "M" && age >= s.saleMonths) ||
      (c.sex === "F" && age >= s.cullMonths)
    )
      return 0;
    return (
      c.count *
      (1 - s.calfMortality / 100) ** (Math.min(age, 12) / 12) *
      (1 - s.mortality / 100) ** (Math.max(0, age - 12) / 12)
    );
  };
  for (const a of active(f)) {
    const purchase = f.movements
      ?.filter((m) => m.animalId === a.id && m.kind === "compra")
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const date = a.details?.acquiredAt || purchase?.date;
    if (!date) continue; // Never pretend a birth date was a purchase date.
    const entry = Date.parse(`${date}T12:00:00Z`);
    if (!Number.isFinite(entry) || entry >= end) continue;
    entries.set(a.id, entry);
    if (a.sex !== "F") continue;
    const born = Date.parse(`${a.born}T12:00:00Z`);
    const conception = Math.max(entry, born + s.maturityMonths * month);
    queue.push({
      id: a.id,
      owner: a.owner,
      due: conception + s.gestationDays * day,
    });
  }
  let iterations = 0;
  while (queue.length) {
    queue.sort((a, b) => a.due - b.due || a.id.localeCompare(b.id));
    const mother = queue.shift()!;
    if (mother.due > end) {
      clocks[mother.id] = (mother.due - end) / day;
      continue;
    }
    if (++iterations > 100000)
      throw new Error(
        "Histórico muito extenso para inferir. Revise as datas de compra e premissas.",
      );
    const count = mother.virtual ? surviving(mother.virtual, mother.due) : 1;
    // Registered mothers are known to be alive today; only inferred descendants undergo past losses.
    const births = (count * s.birthRate) / 100;
    if (births > 1e-9) {
      if (new Date(mother.due).getUTCFullYear() === now.getFullYear())
        birthsByOwner[mother.owner] =
          (birthsByOwner[mother.owner] ?? 0) + births;
      for (const sex of ["F", "M"] as const) {
        const retained = sex === "F" ? s.femaleRetention / 100 : 1;
        const child: Virtual = {
          id: `inferred-${mother.id}-${Math.round(mother.due / day)}-${sex}`,
          motherId: mother.id,
          owner: mother.owner,
          sex,
          born: mother.due,
          count: (births / 2) * (1 - s.calfMortality / 100) * retained,
          nextDue:
            mother.due + s.maturityMonths * month + s.gestationDays * day,
        };
        if (child.count <= 1e-9) continue;
        virtual.push(child);
        if (sex === "F")
          queue.push({
            id: child.id,
            owner: child.owner,
            due: child.nextDue,
            virtual: child,
          });
      }
    }
    mother.due += cycle;
    queue.push(mother);
  }
  function snapshot(date: number): ProjectedCohort[] {
    const real = active(f)
      .filter((a) => (entries.get(a.id) ?? end) <= date)
      .map((a) => ({
        id: a.id,
        animalId: a.id,
        tag: a.tag,
        owner: a.owner,
        sex: a.sex,
        ageMonths: ageMonths(a.born, new Date(date)),
        birthYear: Number(a.born.slice(0, 4)),
        count: 1,
        birthEstimated: !!a.details && a.details.birthSource !== "known",
      }));
    const inferred = virtual.flatMap((c) => {
      const count = surviving(c, date);
      return count > 1e-9
        ? [
            {
              id: c.id,
              motherId: c.motherId,
              owner: c.owner,
              sex: c.sex,
              ageMonths: Math.floor((date - c.born) / month),
              birthYear: new Date(c.born).getUTCFullYear(),
              count,
              inferred: true,
            },
          ]
        : [];
    });
    return [...real, ...inferred];
  }
  const seeds: ProjectionInference["seeds"] = snapshot(end)
    .filter((c) => c.inferred)
    .map((c) => ({
      ...c,
      weight: Math.min(c.sex === "F" ? 450 : 550, 30 + c.ageMonths * 7.5),
    }));
  seeds.push(...additionalSeeds);
  let excess = Math.max(
    0,
    active(f).length + seeds.reduce((n, c) => n + c.count, 0) - s.capacity,
  );
  // Capacity sales are hypothetical; never remove a known registered animal from today's baseline.
  for (const age of [
    ...new Set(
      seeds.filter((c) => c.inferred !== false).map((c) => c.ageMonths),
    ),
  ].sort((a, b) => a - b)) {
    const group = seeds.filter(
        (c) => c.inferred !== false && c.ageMonths === age,
      ),
      count = group.reduce((n, c) => n + c.count, 0);
    const take = salePolicy ? 0 : Math.min(excess, count);
    if (count) for (const c of group) c.count *= 1 - take / count;
    excess -= take;
  }
  // Keep the live cash ledger as today's baseline: inferred past sales never create real cash.
  const plan = projectOwnership(
    f,
    years,
    now,
    {
      seeds,
      clocks,
      birthsByOwner,
    },
    salePolicy,
  );
  const first = Math.min(
    now.getFullYear(),
    ...[...entries.values()].map((date) => new Date(date).getUTCFullYear()),
  );
  for (let year = first; year < now.getFullYear(); year++)
    plan.cohortsByYear[year] = snapshot(Date.UTC(year, 11, 31, 23, 59, 59));
  return plan;
}
