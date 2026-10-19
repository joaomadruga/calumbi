export type WeightUnit = "kg" | "arroba-vivo" | "arroba-carcaca";
export function weightInKg(
  value: number,
  unit: WeightUnit,
  yieldPercent: number,
) {
  if (!Number.isFinite(value) || value < 0) throw new Error("Peso inválido.");
  if (unit === "kg") return value;
  if (unit === "arroba-vivo") return value * 15;
  if (unit === "arroba-carcaca" && yieldPercent > 0)
    return (value * 15 * 100) / yieldPercent;
  throw new Error("Unidade de peso ou rendimento inválido.");
}
export function weightLabel(kg: number, yieldPercent: number) {
  if (!kg) return "Peso não informado";
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${fmt(kg)} kg vivo · ${fmt(kg / 15)} @ vivo · ${fmt((kg * yieldPercent) / 100 / 15)} @ carcaça estimada`;
}
