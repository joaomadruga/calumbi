"use client";
import { useCallback, useMemo, useState } from "react";
import {
  FlaskConical,
  ArrowRight,
  RotateCcw,
  ShoppingCart,
} from "lucide-react";
import { active, decimal, type Farm } from "@/lib/model";
import {
  simulateInvestment,
  type SandboxInput,
} from "@/lib/investment-sandbox";
import WeightField from "./weight-field";
const cash = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const colors = ["#a8b6a3", "#bc8b54", "#38564a"];
export default function InvestmentSandbox({ farm }: { farm: Farm }) {
  const defaults = (): SandboxInput => ({
    purchases: farm.investors.map((p) => ({
      owner: p.id,
      quantity: 0,
      unitPrice: 0,
    })),
    cowAgeMonths: 36,
    cowWeight: 0,
    pregnant: false,
    bull: {
      enabled: false,
      price: 0,
      ageMonths: 36,
      weight: 0,
      split: "proportional",
      breeder: true,
    },
    monthlyPerHead: farm.settings.monthlyPerHead,
    fixedMonthly: farm.settings.fixedMonthly,
    years: 5,
  });
  const [draft, setDraft] = useState<SandboxInput>(defaults);
  const [applied, setApplied] = useState<SandboxInput | null>(null);
  const [revision, setRevision] = useState(0);
  const [stageId, setStageId] = useState("bull");
  const [owner, setOwner] = useState("all");
  const cowWeight = useCallback(
    (kg: number) =>
      setDraft((p) => (p.cowWeight === kg ? p : { ...p, cowWeight: kg })),
    [],
  );
  const bullWeight = useCallback(
    (kg: number) =>
      setDraft((p) =>
        p.bull.weight === kg ? p : { ...p, bull: { ...p.bull, weight: kg } },
      ),
    [],
  );
  const calculation = useMemo(() => {
    if (!applied) return { result: null, error: "" };
    try {
      return { result: simulateInvestment(farm, applied), error: "" };
    } catch (e) {
      return {
        result: null,
        error: e instanceof Error ? e.message : "Revise os dados do teste.",
      };
    }
  }, [farm, applied]);
  const { result, error } = calculation;
  const selected =
    result?.stages.find((s) => s.id === stageId) ?? result?.stages.at(-1);
  const dirty = applied && JSON.stringify(applied) !== JSON.stringify(draft);
  const setPurchase = (
    id: string,
    key: "quantity" | "unitPrice",
    value: number,
  ) =>
    setDraft((p) => ({
      ...p,
      purchases: p.purchases.map((row) =>
        row.owner === id ? { ...row, [key]: value } : row,
      ),
    }));
  const bull = (key: string, value: number | string | boolean) =>
    setDraft((p) => ({ ...p, bull: { ...p.bull, [key]: value } }));
  return (
    <div className="investment-sandbox">
      <div className="section-callout">
        <FlaskConical size={26} />
        <div>
          <strong>Experimente antes de investir.</strong>
          <p>
            Monte compras por integrante e compare o custo antes e depois. Nada
            neste teste altera animais, premissas ou caixa da fazenda.
          </p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(structuredClone(draft));
        }}
      >
        <section className="card sandbox-card">
          <span className="section-eyebrow">
            1 · VACAS PARA CADA PARTICIPANTE
          </span>
          <h2>Quem quer comprar mais gado?</h2>
          <p className="muted">
            Informe a quantidade e o preço negociado por vaca. Use zero para
            quem não for comprar.
          </p>
          <div className="sandbox-orders">
            {draft.purchases.map((row) => {
              const p = farm.investors.find((p) => p.id === row.owner)!;
              return (
                <div className="sandbox-order" key={p.id}>
                  <div className="sandbox-person">
                    <i style={{ background: p.color }} />
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {active(farm).filter((a) => a.owner === p.id).length}{" "}
                        animais cadastrados hoje
                      </small>
                    </span>
                  </div>
                  <label className="field">
                    <span>Quantas vacas?</span>
                    <input
                      aria-label={`Quantidade de vacas para ${p.name}`}
                      type="number"
                      min="0"
                      max="500"
                      step="1"
                      required
                      value={row.quantity}
                      onChange={(e) =>
                        setPurchase(p.id, "quantity", Number(e.target.value))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Preço por vaca (R$)</span>
                    <input
                      aria-label={`Preço por vaca para ${p.name}`}
                      type="number"
                      min={row.quantity ? ".01" : "0"}
                      max="100000000"
                      step=".01"
                      required
                      value={row.unitPrice || ""}
                      placeholder="Valor negociado"
                      onChange={(e) =>
                        setPurchase(p.id, "unitPrice", Number(e.target.value))
                      }
                      disabled={!row.quantity}
                    />
                  </label>
                  <strong className="sandbox-order-total">
                    {cash(row.quantity * row.unitPrice)}
                  </strong>
                </div>
              );
            })}
          </div>
          {!farm.investors.length && (
            <p className="form-note">
              Cadastre participantes na aba Participantes para começar.
            </p>
          )}
          <div className="sandbox-form-grid">
            <label className="field">
              <span>Idade das vacas na compra (meses)</span>
              <input
                type="number"
                min="12"
                max="180"
                step="1"
                required
                value={draft.cowAgeMonths}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    cowAgeMonths: Number(e.target.value),
                  }))
                }
              />
            </label>
            <WeightField
              key={`cow-${revision}`}
              initialKg={draft.cowWeight}
              yieldPercent={farm.settings.yield}
              onWeightChange={cowWeight}
            />
            <label className="sandbox-check">
              <input
                type="checkbox"
                checked={draft.pregnant}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, pregnant: e.target.checked }))
                }
              />
              <span>
                As vacas já chegam prenhas
                <small>
                  A fase da gestação é desconhecida; considera-se o prazo
                  completo configurado.
                </small>
              </span>
            </label>
          </div>
        </section>
        <section className="card sandbox-card">
          <span className="section-eyebrow">2 · UM BOI COMPARTILHADO</span>
          <h2>E se todo mundo comprasse junto?</h2>
          <label className="sandbox-check">
            <input
              type="checkbox"
              checked={draft.bull.enabled}
              onChange={(e) => bull("enabled", e.target.checked)}
            />
            <span>
              Adicionar um boi ao teste
              <small>
                Uma cabeça na fazenda, com frações pertencentes a cada
                integrante.
              </small>
            </span>
          </label>
          {draft.bull.enabled && (
            <div className="sandbox-form-grid">
              <label className="field">
                <span>Preço total do boi (R$)</span>
                <input
                  type="number"
                  min=".01"
                  max="100000000"
                  step=".01"
                  required
                  value={draft.bull.price || ""}
                  onChange={(e) => bull("price", Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Como dividir a compra?</span>
                <select
                  value={draft.bull.split}
                  onChange={(e) => bull("split", e.target.value)}
                >
                  <option value="proportional">
                    Pelas cotas após comprar as vacas
                  </option>
                  <option value="equal">
                    Igualmente entre todos os participantes
                  </option>
                </select>
              </label>
              <label className="field">
                <span>Finalidade</span>
                <select
                  value={draft.bull.breeder ? "breeder" : "fattening"}
                  onChange={(e) =>
                    bull("breeder", e.target.value === "breeder")
                  }
                >
                  <option value="breeder">
                    Reprodutor — permanece na fazenda
                  </option>
                  <option value="fattening">
                    Engorda — venda na idade configurada
                  </option>
                </select>
              </label>
              <label className="field">
                <span>Idade do boi (meses)</span>
                <input
                  type="number"
                  min="1"
                  max="240"
                  step="1"
                  required
                  value={draft.bull.ageMonths}
                  onChange={(e) => bull("ageMonths", Number(e.target.value))}
                />
              </label>
              <WeightField
                key={`bull-${revision}`}
                initialKg={draft.bull.weight}
                yieldPercent={farm.settings.yield}
                onWeightChange={bullWeight}
              />
            </div>
          )}
          <p className="form-note">
            A compra do touro entra nas cotas e nos custos. A natalidade
            continua usando as premissas da fazenda; não há aumento automático
            da fertilidade.
          </p>
        </section>
        <section className="card sandbox-card">
          <span className="section-eyebrow">3 · TEMPO E MANUTENÇÃO</span>
          <h2>Quanto custa sustentar a decisão?</h2>
          <div className="sandbox-form-grid">
            <label className="field">
              <span>Custo mensal por cabeça (R$)</span>
              <input
                type="number"
                min="0"
                max="100000000"
                step=".01"
                required
                value={draft.monthlyPerHead}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    monthlyPerHead: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Custo fixo mensal da fazenda (R$)</span>
              <input
                type="number"
                min="0"
                max="100000000"
                step=".01"
                required
                value={draft.fixedMonthly}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    fixedMonthly: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Projetar por</span>
              <select
                value={draft.years}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, years: Number(e.target.value) }))
                }
              >
                {[1, 3, 5, 10, 15].map((y) => (
                  <option key={y} value={y}>
                    {y} {y === 1 ? "ano" : "anos"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="form-note">
            Os custos começam com as premissas cadastradas. Alterá-los aqui
            afeta somente este teste. A compra considera novos aportes dos
            participantes, sem usar o caixa atual.
          </p>
          <div className="sandbox-form-actions">
            <button
              className="button primary"
              disabled={!farm.investors.length}
            >
              <ShoppingCart size={16} />
              {applied ? "Recalcular teste" : "Calcular teste"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setDraft(defaults());
                setApplied(null);
                setRevision((r) => r + 1);
              }}
            >
              <RotateCcw size={15} /> Limpar
            </button>
            {dirty && (
              <span role="status">
                Dados alterados: recalcule para atualizar o resultado.
              </span>
            )}
          </div>
        </section>
      </form>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {result && selected && applied && (
        <section className="sandbox-results" aria-label="Resultado do teste">
          <div className="sandbox-result-heading">
            <span className="section-eyebrow">COMPARE AS ETAPAS</span>
            <h2>O investimento, pessoa por pessoa.</h2>
            <p>
              Selecione uma etapa para ver o rateio. Os números abaixo usam o
              último teste calculado.
            </p>
          </div>
          <div className="sandbox-stages">
            {result.stages.map((stage, i) => (
              <button
                key={stage.id}
                className={`card sandbox-stage ${selected.id === stage.id ? "selected" : ""}`}
                aria-pressed={selected.id === stage.id}
                onClick={() => setStageId(stage.id)}
              >
                <span>
                  {i + 1} · {stage.label}
                </span>
                <strong>
                  {decimal(stage.heads, 2)} <small>cabeças</small>
                </strong>
                <span>
                  Compra: <b>{cash(stage.capital)}</b>
                </span>
                <span>
                  Manutenção: <b>{cash(stage.monthly)}/mês</b>
                </span>
                {i < 2 && (
                  <ArrowRight className="sandbox-step-arrow" size={18} />
                )}
              </button>
            ))}
          </div>
          {selected.excess > 0 && (
            <div className="error-banner" role="status">
              Esta etapa excede a capacidade da fazenda em{" "}
              {decimal(selected.excess)} cabeças. A projeção aplica vendas para
              respeitar a lotação; a compra não foi executada.
            </div>
          )}
          {selected.excess === 0 &&
            result.projectedCapacityPressure > 0 &&
            selected.capital > 0 && (
              <p className="sandbox-capacity-note">
                A inferência de crias já ocupa parte da lotação. A compra pode
                antecipar vendas simuladas em vez de aumentar o estoque final;
                compare as curvas abaixo. Capacidade atual:{" "}
                {farm.settings.capacity} cabeças.
              </p>
            )}
          <section className="card sandbox-card">
            <span className="section-eyebrow">
              {selected.label.toUpperCase()}
            </span>
            <h2>Quem paga quanto?</h2>
            <div
              className="sandbox-share-bar"
              aria-label="Participação após esta etapa"
            >
              {selected.people
                .filter((p) => p.share > 0)
                .map((p) => (
                  <span
                    key={p.id}
                    style={{ width: `${p.share * 100}%`, background: p.color }}
                    title={`${p.name}: ${decimal(p.share * 100, 2)}%`}
                  />
                ))}
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Participante / cota</th>
                    <th>Compra das vacas</th>
                    <th>Compra do boi</th>
                    <th>Capital inicial</th>
                    <th>Manutenção / mês</th>
                    <th>Aportes futuros ({applied.years} anos)</th>
                    <th>Capital + aportes</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.people.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <small className="sandbox-table-sub">
                          {decimal(p.heads, 2)} cabeças ·{" "}
                          {decimal(p.share * 100, 2)}%
                          {selected.id === "bull" && p.bullShare > 0
                            ? ` · ${decimal(p.bullShare * 100, 2)}% do boi`
                            : ""}
                        </small>
                      </td>
                      <td>
                        {cash(
                          selected.id === "baseline" ? 0 : p.cowsInvestment,
                        )}
                      </td>
                      <td>
                        {cash(selected.id === "bull" ? p.bullInvestment : 0)}
                      </td>
                      <td>
                        <strong>{cash(p.investment)}</strong>
                      </td>
                      <td>{cash(p.monthly)}</td>
                      <td>{cash(p.futureContributions)}</td>
                      <td>
                        <strong>{cash(p.totalCapital)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    <td>
                      {cash(selected.id === "baseline" ? 0 : result.cowsCost)}
                    </td>
                    <td>
                      {cash(selected.id === "bull" ? result.bullCost : 0)}
                    </td>
                    <td>{cash(selected.capital)}</td>
                    <td>{cash(selected.monthly)}</td>
                    <td>
                      {cash(
                        selected.people.reduce(
                          (n, p) => n + p.futureContributions,
                          0,
                        ),
                      )}
                    </td>
                    <td>
                      {cash(
                        selected.people.reduce((n, p) => n + p.totalCapital, 0),
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="form-note">
              Cotas e custo mensal usam os animais cadastrados mais as compras
              do teste, incluindo a fração do boi. Sem rebanho, o custo fixo é
              dividido igualmente. O rateio da compra ajusta os centavos para
              fechar o total. Aportes futuros consideram custos, receitas
              projetadas, perdas e reserva; são adicionais ao capital da compra.
              Pesos não informados deixam a avaliação por arroba incompleta.
            </p>
          </section>
          <section className="card sandbox-card">
            <div className="sandbox-chart-heading">
              <div>
                <span className="section-eyebrow">EFEITO NO REBANHO</span>
                <h2>Como cada decisão muda o futuro?</h2>
              </div>
              <label className="field">
                <span>Comparar para</span>
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                >
                  <option value="all">Toda a fazenda</option>
                  {farm.investors.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Comparison result={result} owner={owner} />
            <p className="form-note">
              A curva usa a mesma inferência de crias da aba Projeções. Por isso
              o estoque simulado pode ser maior que o número cadastrado nas
              etapas acima. Nada é cadastrado nem gravado na planilha.
            </p>
          </section>
        </section>
      )}
    </div>
  );
}
function Comparison({
  result,
  owner,
}: {
  result: ReturnType<typeof simulateInvestment>;
  owner: string;
}) {
  const series = result.stages.map((s) => ({
    label: s.label,
    data: owner === "all" ? s.plan.total : (s.plan.byOwner[owner] ?? []),
  }));
  const max = Math.max(1, ...series.flatMap((s) => s.data.map((p) => p.herd)));
  const x = (i: number) =>
    40 + (i / Math.max(1, series[0].data.length - 1)) * 640;
  const y = (n: number) => 174 - (n / max) * 140;
  return (
    <>
      <div className="sandbox-chart-legend">
        {series.map((s, i) => (
          <span key={s.label}>
            <i style={{ background: colors[i] }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        className="sandbox-chart"
        viewBox="0 0 720 210"
        role="img"
        aria-label="Comparação do rebanho projetado nas três etapas"
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="40"
              y1={y(max * t)}
              x2="680"
              y2={y(max * t)}
              stroke="#e7e9df"
            />
            <text x="32" y={y(max * t) + 4} textAnchor="end">
              {decimal(max * t, 0)}
            </text>
          </g>
        ))}
        {series.map((s, i) => (
          <g key={s.label}>
            <path
              d={s.data
                .map((p, j) => `${j ? "L" : "M"}${x(j)},${y(p.herd)}`)
                .join(" ")}
              stroke={colors[i]}
              strokeWidth="3"
              fill="none"
            />
            {s.data.map((p, j) => (
              <circle
                key={p.year}
                cx={x(j)}
                cy={y(p.herd)}
                r="3.5"
                fill={colors[i]}
              >
                <title>
                  {s.label} · {p.year}: {decimal(p.herd, 2)} cabeças
                </title>
              </circle>
            ))}
          </g>
        ))}
        {series[0].data.map((p, i) => (
          <text key={p.year} x={x(i)} y="198" textAnchor="middle">
            {p.year}
          </text>
        ))}
      </svg>
      <details className="sandbox-annual">
        <summary>Ver comparação ano a ano</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ano</th>
                {series.map((s) => (
                  <th key={s.label}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series[0].data.map((row, i) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  {series.map((s) => (
                    <td key={s.label}>
                      {decimal(s.data[i]?.herd ?? 0, 2)} cabeças
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
