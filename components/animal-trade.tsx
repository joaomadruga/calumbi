"use client";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowLeftRight,
  Banknote,
  Check,
  Search,
  Tag,
  Users,
} from "lucide-react";
import {
  type Farm,
  type Animal,
  active,
  animalValue,
  money,
} from "@/lib/model";

import WeightField from "./weight-field";
import { weightLabel } from "@/lib/weight";
type Props = {
  farm: Farm;
  kind: "purchase" | "sale" | "transfer";
  initialAnimal?: Animal | null;
  busy: boolean;
  onSave: (input: unknown) => Promise<void>;
};
const today = () => new Date().toISOString().slice(0, 10);
export default function AnimalTrade({
  farm,
  kind,
  initialAnimal,
  busy,
  onSave,
}: Props) {
  const animals = active(farm);
  const [animalId, setAnimalId] = useState(
    initialAnimal?.status === "ativo" ? initialAnimal.id : "",
  );
  const [search, setSearch] = useState("");
  const selected = animals.find((a) => a.id === animalId);
  const [amount, setAmount] = useState(
    initialAnimal
      ? String(Math.round(animalValue(initialAnimal.weight, farm.settings)))
      : "",
  );
  const ownerName = (id: string) =>
    farm.investors.find((p) => p.id === id)?.name ?? "Participante";
  const suggestedTag = `CL-${String(Math.max(0, ...farm.animals.map((a) => (/^CL-\d+$/.test(a.tag) ? Number(a.tag.slice(3)) : 0))) + 1).padStart(3, "0")}`;
  const visible = animals.filter(
    (a) =>
      a.id === animalId ||
      `${a.tag || `ID ${a.id.slice(0, 8)}`} ${a.id} ${ownerName(a.owner)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    if (kind === "purchase")
      void onSave({
        type: "purchase",
        data: {
          ...values,
          weight: Number(values.weight),
          amount: Number(values.amount),
        },
      });
    else if (selected && kind === "sale")
      void onSave({
        type: "status",
        data: {
          id: selected.id,
          owner: selected.owner,
          status: "vendido",
          amount: Number(values.amount),
          date: values.date,
        },
      });
    else if (selected)
      void onSave({
        type: "transfer",
        data: {
          id: selected.id,
          fromOwner: selected.owner,
          toOwner: values.toOwner,
          date: values.date,
        },
      });
  }
  return (
    <form className="animal-trade-form" onSubmit={submit}>
      {kind === "purchase" ? (
        <>
          <div className="trade-intro">
            <Banknote size={20} />
            <p>
              Cadastre o animal e registre a despesa de compra em uma única
              operação. O novo proprietário já fica vinculado ao ID.
            </p>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Brinco / identificação (opcional)</span>
              <input name="tag" placeholder={suggestedTag} maxLength={30} />
            </label>
            <label className="field">
              <span>Sexo</span>
              <select name="sex">
                <option value="F">Fêmea</option>
                <option value="M">Macho</option>
              </select>
            </label>
            <label className="field">
              <span>Nascimento</span>
              <input name="born" type="date" max={today()} required />
            </label>
            <WeightField yieldPercent={farm.settings.yield} />
            <label className="field">
              <span>Proprietário do animal</span>
              <select name="owner" required defaultValue="">
                <option value="">Selecione o integrante</option>
                {farm.investors.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      ) : (
        <>
          <div className="search-field trade-search">
            <Search size={16} />
            <input
              placeholder="Buscar por brinco, ID ou proprietário…"
              aria-label="Buscar animal para movimentação"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="field">
            <span>Qual animal?</span>
            <select
              required
              value={animalId}
              onChange={(e) => {
                setAnimalId(e.target.value);
                const a = animals.find((a) => a.id === e.target.value);
                setAmount(
                  a
                    ? String(Math.round(animalValue(a.weight, farm.settings)))
                    : "",
                );
              }}
            >
              <option value="">Selecione um animal ativo</option>
              {visible.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tag || `ID ${a.id.slice(0, 8)}`} · {ownerName(a.owner)} ·{" "}
                  {weightLabel(a.weight, farm.settings.yield)}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <div className="trade-animal-summary">
              <span className="animal-icon">
                <Tag size={19} />
              </span>
              <div>
                <strong>
                  {selected.tag || `ID ${selected.id.slice(0, 8)}`}
                </strong>
                <span>Proprietário: {ownerName(selected.owner)}</span>
                <code>ID: {selected.id}</code>
              </div>
            </div>
          )}
        </>
      )}
      {kind === "transfer" ? (
        <>
          <label className="field">
            <span>Quem vai receber o animal?</span>
            <select name="toOwner" required defaultValue="">
              <option value="">Selecione outro integrante</option>
              {farm.investors
                .filter((p) => p.id !== selected?.owner)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="trade-intro">
            <ArrowLeftRight size={20} />
            <p>
              O animal mantém o mesmo ID. A transferência atualiza as cotas e as
              projeções dos dois integrantes, sem alterar o caixa da fazenda.
            </p>
          </div>
        </>
      ) : (
        <label className="field">
          <span>
            {kind === "purchase"
              ? "Valor da compra (R$)"
              : "Valor combinado da venda (R$)"}
          </span>
          {kind === "sale" ? (
            <input
              name="amount"
              type="number"
              min=".01"
              step=".01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          ) : (
            <input name="amount" type="number" min=".01" step=".01" required />
          )}
          {kind === "sale" && selected && (
            <small>
              Referência estimada:{" "}
              {money(animalValue(selected.weight, farm.settings))}. Ajuste para
              o preço negociado.
            </small>
          )}
        </label>
      )}
      <label className="field">
        <span>
          Data da{" "}
          {kind === "purchase"
            ? "compra"
            : kind === "sale"
              ? "venda"
              : "transferência"}
        </span>
        <input
          name="date"
          type="date"
          defaultValue={today()}
          min={selected?.born}
          max={today()}
          required
        />
      </label>
      {kind === "sale" && (
        <p className="form-note">
          Ao confirmar, o animal sai do rebanho ativo e a receita entra no
          caixa, vinculada ao proprietário atual. Não é necessário lançar a
          receita novamente.
        </p>
      )}
      {kind === "purchase" && (
        <p className="form-note">
          A compra é uma despesa do caixa da fazenda. Se o integrante enviar
          dinheiro para financiá-la, registre também o aporte correspondente.
        </p>
      )}
      <button
        className="button primary form-submit"
        disabled={busy || (kind !== "purchase" && !selected)}
      >
        <Check size={16} />
        {busy
          ? "Salvando…"
          : kind === "purchase"
            ? "Registrar compra"
            : kind === "sale"
              ? "Confirmar venda"
              : "Confirmar transferência"}
      </button>
    </form>
  );
}

export function AnimalHistory({
  farm,
  animal,
}: {
  farm: Farm;
  animal: Animal;
}) {
  const movements = [...(farm.movements ?? [])]
    .filter((m) => m.animalId === animal.id)
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date));
  const names = (id: string) =>
    farm.investors.find((p) => p.id === id)?.name ?? "Fora da fazenda";
  const labels = {
    cadastro: "Cadastro",
    edicao: "Edição",
    compra: "Compra",
    venda: "Venda",
    morte: "Morte",
    transferencia: "Transferência",
  };
  return (
    <section className="animal-history">
      <span className="section-eyebrow">HISTÓRICO DESTE ANIMAL</span>
      {movements.length ? (
        <ol>
          {movements.map((m) => (
            <li key={m.id}>
              <span className={`movement-kind ${m.kind}`}>
                <ArrowRight size={13} />
              </span>
              <div>
                <strong>
                  {labels[m.kind]}
                  <small>
                    {new Date(m.date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </small>
                </strong>
                <p>
                  {m.kind === "edicao"
                    ? m.note
                    : `${names(m.fromOwner)} → ${names(m.toOwner)}`}
                  {m.amount > 0 && <span> · {money(m.amount)}</span>}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="form-note">
          Os próximos movimentos deste animal aparecerão aqui. Os registros
          antigos não têm histórico anterior.
        </p>
      )}
    </section>
  );
}
