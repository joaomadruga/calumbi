"use client";
import { useState } from "react";
import type { Animal } from "@/lib/model";
import { birthFromAge, suggestAgeMonths } from "@/lib/animal-age";
import WeightField from "./weight-field";
const today = () => new Date().toISOString().slice(0, 10);
export default function AnimalBioFields({
  animal,
  yieldPercent,
  showArrival = true,
}: {
  animal?: Animal;
  yieldPercent: number;
  showArrival?: boolean;
}) {
  const [source, setSource] = useState<"known" | "estimated" | "weight">(
    animal?.details?.birthSource ?? "estimated",
  );
  const [months, setMonths] = useState(
    animal?.details ? String(animal.details.estimatedMonths ?? "") : "",
  );
  const [reference, setReference] = useState(
    animal?.details?.ageReferenceDate ?? today(),
  );
  const [born, setBorn] = useState(animal?.born ?? "");
  const [ageWeight, setAgeWeight] = useState(animal?.details?.ageWeightKg ?? 0);
  const [weight, setWeight] = useState(animal?.weight ?? 0);
  const suggestion = suggestAgeMonths(weight);
  const estimatedBorn =
    months !== "" && reference ? birthFromAge(Number(months), reference) : "";
  return (
    <>
      <WeightField
        initialKg={animal?.weight}
        yieldPercent={yieldPercent}
        onWeightChange={setWeight}
      />
      <label className="field">
        <span>Como você sabe a idade?</span>
        <select
          value={source === "known" ? "known" : "estimated"}
          onChange={(e) => setSource(e.target.value as "known" | "estimated")}
        >
          <option value="estimated">
            Não sei o nascimento — idade aproximada
          </option>
          <option value="known">Sei a data real de nascimento</option>
        </select>
      </label>
      {source === "known" ? (
        <label className="field">
          <span>Data real de nascimento</span>
          <input
            name="born"
            type="date"
            value={born}
            onChange={(e) => setBorn(e.target.value)}
            max={today()}
            required
          />
          <small>Informe o nascimento, não o dia da compra.</small>
        </label>
      ) : (
        <>
          <label className="field">
            <span>Idade aproximada na avaliação (meses)</span>
            <input
              name="estimatedMonths"
              type="number"
              min="0"
              max="360"
              step="1"
              value={months}
              onChange={(e) => {
                setMonths(e.target.value);
                setSource("estimated");
              }}
              required
            />
            <button
              className="button secondary"
              type="button"
              disabled={suggestion === null}
              onClick={() => {
                setMonths(String(suggestion));
                setAgeWeight(weight);
                setSource("weight");
              }}
            >
              Sugerir idade pelo peso
              {suggestion !== null ? `: cerca de ${suggestion} meses` : ""}
            </button>
            <small>
              {source === "weight" ? "Sugestão aplicada. " : ""}Referência
              aproximada para jovens entre 30 e 328 kg vivos. Para adultos,
              informe a idade estimada pelo vendedor ou avaliação dentária. O
              peso não confirma idade nem prenhez.{" "}
              <a
                href="https://www.alice.cnptia.embrapa.br/handle/doc/325931"
                target="_blank"
                rel="noreferrer"
              >
                Referência Embrapa
              </a>
              .
            </small>
          </label>
          <label className="field">
            <span>Data da avaliação da idade</span>
            <input
              name="ageReferenceDate"
              type="date"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              max={today()}
              required
            />
            <small>A idade avançará com o tempo a partir desta data.</small>
          </label>
          <input type="hidden" name="born" value={estimatedBorn} />
        </>
      )}
      <input type="hidden" name="birthSource" value={source} />
      {source === "weight" && (
        <input type="hidden" name="ageWeightKg" value={ageWeight} />
      )}
      {showArrival && (
        <label className="field">
          <span>Data da compra / entrada (opcional)</span>
          <input
            name="acquiredAt"
            type="date"
            defaultValue={animal?.details?.acquiredAt ?? ""}
            max={today()}
          />
          <small>Independente da idade e do nascimento.</small>
        </label>
      )}
      <label className="field">
        <span>Situação reprodutiva (fêmeas)</span>
        <select
          name="reproductiveStatus"
          defaultValue={animal?.details?.reproductiveStatus ?? "unknown"}
        >
          <option value="unknown">Não informada</option>
          <option value="pregnant">Prenhez confirmada</option>
          <option value="inseminated">
            Inseminada / coberta, sem confirmação
          </option>
          <option value="not-pregnant">Não prenhe</option>
        </select>
        <small>
          Prenhez confirmada entra como nascimento esperado dentro do tempo de
          gestação configurado. Como a fase da gestação não é informada, a
          projeção assume uma gestação inteira a partir de hoje. Inseminação sem
          confirmação não garante nascimento. Não altera a idade.
        </small>
      </label>
      {animal && !animal.details && (
        <p className="form-note">
          Registro antigo: a data salva pode ser a compra. Se for o caso,
          preencha a data de entrada e corrija a idade aqui. Nenhum registro
          antigo será convertido automaticamente.
        </p>
      )}
    </>
  );
}
