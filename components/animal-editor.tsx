"use client";
import type { Animal, Farm } from "@/lib/model";
import AnimalBioFields from "./animal-bio-fields";
export default function AnimalEditor({
  animal,
  farm,
  busy,
  onSave,
}: {
  animal: Animal;
  farm: Farm;
  busy: boolean;
  onSave: (input: unknown) => Promise<void>;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(e.currentTarget));
        void onSave({
          type: "editAnimal",
          data: {
            ...values,
            id: animal.id,
            owner: animal.owner,
            weight: Number(values.weight || 0),
            previous: animal,
          },
        });
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>Brinco / identificação (opcional)</span>
          <input name="tag" defaultValue={animal.tag} maxLength={30} />
        </label>
        <label className="field">
          <span>Sexo</span>
          <select name="sex" defaultValue={animal.sex}>
            <option value="F">Fêmea</option>
            <option value="M">Macho</option>
          </select>
        </label>
        <AnimalBioFields animal={animal} yieldPercent={farm.settings.yield} />
      </div>
      <p className="form-note">
        ID permanente: {animal.id}. Proprietário:{" "}
        {farm.investors.find((i) => i.id === animal.owner)?.name}. Para trocar o
        proprietário, use Transferir. A edição fica registrada no histórico.
      </p>
      <button className="button primary form-submit" disabled={busy}>
        {busy ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}
