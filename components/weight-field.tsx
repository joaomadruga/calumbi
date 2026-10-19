"use client";
import { useState, useEffect } from "react";
import { weightInKg, weightLabel, type WeightUnit } from "@/lib/weight";
export default function WeightField({
  initialKg = 0,
  initialUnit = "kg",
  required = false,
  label,
  yieldPercent,
  onWeightChange,
}: {
  initialKg?: number;
  initialUnit?: WeightUnit;
  required?: boolean;
  label?: string;
  yieldPercent: number;
  onWeightChange?: (kg: number) => void;
}) {
  const [value, setValue] = useState(
    initialKg
      ? String(
          Number(
            (initialUnit === "kg"
              ? initialKg
              : initialUnit === "arroba-vivo"
                ? initialKg / 15
                : (initialKg * yieldPercent) / 100 / 15
            ).toFixed(6),
          ),
        )
      : "",
  );
  const [unit, setUnit] = useState<WeightUnit>(initialUnit);
  const kg =
    value && Number.isFinite(Number(value)) && Number(value) > 0
      ? weightInKg(Number(value), unit, yieldPercent)
      : 0;
  useEffect(() => {
    onWeightChange?.(kg);
  }, [kg, onWeightChange]);
  return (
    <label className="field weight-field">
      <span>
        {label ?? (required ? "Peso por animal" : "Peso por animal (opcional)")}
      </span>
      <select
        aria-label="Unidade e tipo de peso"
        value={unit}
        onChange={(e) => {
          const next = e.target.value as WeightUnit;
          if (value)
            setValue(
              String(
                Number(
                  (next === "kg"
                    ? kg
                    : next === "arroba-vivo"
                      ? kg / 15
                      : (kg * yieldPercent) / 100 / 15
                  ).toFixed(6),
                ),
              ),
            );
          setUnit(next);
        }}
      >
        <option value="kg">kg de peso vivo</option>
        <option value="arroba-vivo">@ de peso vivo (15 kg)</option>
        <option value="arroba-carcaca">@ de carcaça (estimativa)</option>
      </select>
      <input
        aria-label="Peso por animal"
        type="number"
        required={required}
        min="0.001"
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <input type="hidden" name="weight" value={kg || ""} />
      <small>
        {weightLabel(kg, yieldPercent)}. Carcaça estimada com rendimento de{" "}
        {yieldPercent}%. 1 @ = 15 kg do tipo escolhido.
      </small>
    </label>
  );
}
