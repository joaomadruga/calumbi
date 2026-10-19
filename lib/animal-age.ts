// Approximate reference, not an individual age diagnosis. Nelore weight depends on management.
// Embrapa: https://www.alice.cnptia.embrapa.br/handle/doc/325931
const growth = [
  [30, 0],
  [181.3, 205],
  [244.51, 365],
  [327.54, 550],
];
export function suggestAgeMonths(kg: number): number | null {
  if (!Number.isFinite(kg) || kg < 30 || kg > 327.54) return null;
  for (let i = 1; i < growth.length; i++) {
    const [low, start] = growth[i - 1],
      [high, end] = growth[i];
    if (kg <= high)
      return Math.round(
        (start + ((kg - low) / (high - low)) * (end - start)) / (365.25 / 12),
      );
  }
  return null;
}
export function birthFromAge(months: number, reference: string): string {
  if (
    !Number.isInteger(months) ||
    months < 0 ||
    months > 360 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(reference)
  )
    return "";
  const [year, month, day] = reference.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 - months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return first.toISOString().slice(0, 10);
}
