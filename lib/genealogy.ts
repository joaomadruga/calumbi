import type { ProjectedCohort } from "./model.ts";
import type { CowNode } from "./cow-nodes.ts";
import { cowStage } from "./cow-nodes.ts";
export type GenealogyNode = CowNode & {
  motherId?: string;
  label: string;
  historical: boolean;
  projected: boolean;
  birthEstimated: boolean;
};
/** Add only ancestors needed by the living herd, never future animals or guessed mothers. */
export function genealogyNodes(
  history: Record<number, ProjectedCohort[]>,
  year: number,
  owner: string,
  adultMonths = 36,
): GenealogyNode[] {
  const known = new Map<string, { cohort: ProjectedCohort; year: number }>();
  for (const value of Object.keys(history)
    .map(Number)
    .filter((y) => y <= year)
    .sort((a, b) => a - b))
    for (const c of history[value])
      if (c.owner === owner) known.set(c.id, { cohort: c, year: value });
  const live = new Map(
    (history[year] ?? [])
      .filter((c) => c.owner === owner && c.count > 1e-9)
      .map((c) => [c.id, c]),
  );
  const needed = new Set(live.keys());
  for (const id of needed) {
    const mother = known.get(id)?.cohort.motherId;
    if (mother && known.has(mother)) needed.add(mother);
  }
  return [...needed].flatMap((id) => {
    const record = known.get(id);
    if (!record) return [];
    const c = record.cohort,
      historical = !live.has(id);
    const age = c.ageMonths;
    return [
      {
        id: `${id}:0`,
        sourceIds: [id],
        owner,
        sex: c.sex,
        stage: cowStage(age, adultMonths),
        count: historical ? 0 : c.count,
        minAge: age,
        maxAge: age,
        birthYear: c.birthYear,
        unit: 1,
        historical,
        projected: !c.animalId,
        birthEstimated: !!c.birthEstimated,
        motherId: c.motherId && needed.has(c.motherId) ? c.motherId : undefined,
        label:
          c.tag ||
          (c.animalId
            ? `ID ${c.animalId.slice(0, 8)}`
            : c.sex === "F"
              ? `Fêmea · ${c.count < 0.001 ? "<0,001" : c.count.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}`
              : `Macho · ${c.count < 0.001 ? "<0,001" : c.count.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}`),
      },
    ];
  });
}
/** Show the selected animal's descendants and the ancestor path leading to it. */
export function familyIds(
  nodes: GenealogyNode[],
  source: string | null,
): Set<string> {
  const byId = new Map(nodes.map((n) => [n.sourceIds[0], n]));
  if (!source) return new Set(byId.keys());
  if (!byId.has(source)) return new Set();
  const result = new Set([source]);
  const descendants = [source];
  for (let i = 0; i < descendants.length; i++)
    for (const node of nodes)
      if (node.motherId === descendants[i] && !result.has(node.sourceIds[0])) {
        result.add(node.sourceIds[0]);
        descendants.push(node.sourceIds[0]);
      }
  let parent = byId.get(source)?.motherId;
  while (parent && !result.has(parent)) {
    result.add(parent);
    parent = byId.get(parent)?.motherId;
  }
  return result;
}
export function genealogyLayout(
  nodes: GenealogyNode[],
  gap = 110,
): Map<string, { x: number; y: number; tier: number }> {
  const byId = new Map(nodes.map((n) => [n.sourceIds[0], n]));
  const children = new Map<string, GenealogyNode[]>();
  for (const n of nodes)
    if (n.motherId && byId.has(n.motherId))
      children.set(n.motherId, [...(children.get(n.motherId) ?? []), n]);
  const sort = (a: GenealogyNode, b: GenealogyNode) =>
    (a.birthYear ?? 0) - (b.birthYear ?? 0) || a.id.localeCompare(b.id);
  for (const list of children.values()) list.sort(sort);
  const points = new Map<string, { x: number; y: number; tier: number }>();
  const visiting = new Set<string>();
  let cursor = 0;
  function place(node: GenealogyNode, depth: number): number {
    const id = node.sourceIds[0];
    if (points.has(id)) return points.get(id)!.x;
    if (visiting.has(id)) return cursor;
    visiting.add(id);
    const positions = (children.get(id) ?? [])
      .filter((c) => !visiting.has(c.sourceIds[0]))
      .map((c) => place(c, depth + 1));
    const x = positions.length
      ? (positions[0] + positions.at(-1)!) / 2
      : cursor++ * gap;
    points.set(id, { x, y: depth * 130, tier: depth });
    visiting.delete(id);
    return x;
  }
  const roots = nodes
    .filter((n) => !n.motherId || !byId.has(n.motherId))
    .sort(sort);
  for (const root of roots) {
    place(root, 0);
    cursor += 0.5;
  }
  for (const node of nodes) if (!points.has(node.sourceIds[0])) place(node, 0);
  // Pack independent families into rows, rather than one enormous horizontal forest.
  let rowX = 0,
    rowY = 0,
    rowHeight = 0;
  for (const root of roots) {
    const ids = familyIds(nodes, root.sourceIds[0]);
    const family = [...ids].map((id) => points.get(id)!).filter(Boolean);
    if (!family.length) continue;
    const minX = Math.min(...family.map((p) => p.x)),
      maxX = Math.max(...family.map((p) => p.x));
    const minY = Math.min(...family.map((p) => p.y)),
      maxY = Math.max(...family.map((p) => p.y));
    const width = maxX - minX + gap,
      height = maxY - minY + 120;
    if (rowX && rowX + width > 850) {
      rowX = 0;
      rowY += rowHeight + 70;
      rowHeight = 0;
    }
    for (const id of ids) {
      const p = points.get(id);
      if (p)
        points.set(id, { ...p, x: rowX + p.x - minX, y: rowY + p.y - minY });
    }
    rowX += width + 35;
    rowHeight = Math.max(rowHeight, height);
  }
  const xs = [...points.values()].map((p) => p.x);
  const mid = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
  return new Map(
    [...points].map(([id, point]) => [id, { ...point, x: point.x - mid }]),
  );
}

export function paginateFamilies(
  nodes: GenealogyNode[],
  owner: string | null,
  page: number,
  size = 6,
) {
  const grouped = new Map<string, GenealogyNode[]>();
  for (const node of nodes)
    if (!node.motherId && (!owner || node.owner === owner))
      grouped.set(node.owner, [...(grouped.get(node.owner) ?? []), node]);
  const groups = [...grouped.values()];
  const roots = Array.from(
    { length: Math.max(0, ...groups.map((g) => g.length)) },
    (_, i) => groups.flatMap((g) => (g[i] ? [g[i]] : [])),
  ).flat();
  const pageCount = Math.max(1, Math.ceil(roots.length / size));
  const currentPage = Math.max(0, Math.min(page, pageCount - 1));
  const pageRoots = roots.slice(currentPage * size, (currentPage + 1) * size);
  const ids = new Set(
    pageRoots.flatMap((root) => [...familyIds(nodes, root.sourceIds[0])]),
  );
  return { roots, pageCount, currentPage, ids };
}
