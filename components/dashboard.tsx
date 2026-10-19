"use client";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  LayoutDashboard,
  Fence,
  TrendingUp,
  Users,
  Wallet,
  Settings2,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  ArrowRight,
  ChevronDown,
  Sprout,
  MapPin,
  PanelLeftClose,
  Menu,
  X,
  Search,
  Download,
  Check,
  RefreshCw,
  ExternalLink,
  Leaf,
  ShieldCheck,
  CircleHelp,
  LogOut,
  AlertTriangle,
  Database,
  CalendarDays,
  Heart,
  Banknote,
  Scale,
  Activity,
  SlidersHorizontal,
  Video,
  ArrowLeftRight,
  ShoppingCart,
} from "lucide-react";
import { ShareChart, HerdChart } from "./charts";
import {
  type Farm,
  type Settings,
  type Animal,
  type Transaction,
  active,
  summary,
  project,
  projectOwnership,
  demoFarm,
  money,
  decimal,
  category,
  ageMonths,
  animalValue,
} from "@/lib/model";
import { applyAction, validateAction } from "@/lib/actions";
import WeightField from "./weight-field";
import AnimalEditor from "./animal-editor";
import { weightLabel } from "@/lib/weight";
import FarmMap from "./farm-map";
import CalumbiMark from "./calumbi-mark";
import CorralCamera from "./corral-camera";
import HerdEvolution from "./herd-evolution";
import AnimalTrade, { AnimalHistory } from "./animal-trade";
import { useRouter } from "next/navigation";
const navigation = [
  { id: "overview", name: "Visão geral", icon: LayoutDashboard },
  { id: "herd", name: "Meu rebanho", icon: Fence },
  { id: "projection", name: "Projeções", icon: TrendingUp },
  { id: "investors", name: "Participantes", icon: Users },
  { id: "finance", name: "Financeiro", icon: Wallet },
  { id: "curral", name: "Câmera do curral", icon: Video },
];
const today = () => new Date().toISOString().slice(0, 10);
const initialSettings = { ...demoFarm().settings };
const titles: Record<string, [string, string]> = {
  overview: [
    "Uma visão de hoje. Um plano para o futuro.",
    "Acompanhe sua fazenda, cuide do rebanho e faça seu investimento crescer.",
  ],
  herd: [
    "Cada animal conta uma história.",
    "Gerencie o rebanho Nelore, a propriedade de cada cabeça e as movimentações.",
  ],
  projection: [
    "O futuro começa nas decisões de hoje.",
    "Simule o crescimento do rebanho e o capital necessário para sustentá-lo.",
  ],
  investors: [
    "Uma fazenda. Muitas mãos.",
    "Participação no rebanho e rateio proporcional dos custos de manutenção.",
  ],
  finance: [
    "Saúde financeira, da porteira para dentro.",
    "Acompanhe o caixa e prepare a fazenda para os próximos ciclos.",
  ],
  curral: [
    "Um olhar sobre o curral, de onde você estiver.",
    "Um espaço para a futura câmera da Fazenda Calumbi.",
  ],
  settings: [
    "Sua fazenda, suas premissas.",
    "Ajuste os parâmetros que orientam as projeções e o planejamento.",
  ],
};
export default function Dashboard({
  initialTab = "overview",
}: {
  initialTab?: string;
}) {
  const router = useRouter();
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const [farm, setFarm] = useState<Farm | null>(null),
    [mode, setMode] = useState<"loading" | "demo" | "sheets">("loading"),
    [tab, setTab] = useState(initialTab),
    [modal, setModal] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [login, setLogin] = useState(false),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("Todos"),
    [herdOwner, setHerdOwner] = useState("all"),
    [years, setYears] = useState(5),
    [fib, setFib] = useState(false),
    [scenario, setScenario] = useState("base"),
    [projectionOwner, setProjectionOwner] = useState("all"),
    [draft, setDraft] = useState<Settings>(initialSettings),
    [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/farm", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        if (data.login) {
          setFarm(null);
          window.location.replace("/login");
          return;
        }
        throw new Error(data.error);
      }
      if (data.mode === "demo") {
        let saved: Farm | undefined;
        try {
          const raw =
            localStorage.getItem("calumbi-demo-v1") ??
            localStorage.getItem("boa-vista-demo-v1");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (
              Array.isArray(parsed.animals) &&
              Array.isArray(parsed.investors) &&
              Array.isArray(parsed.transactions) &&
              parsed.settings
            )
              saved = parsed;
          }
        } catch {}
        const next = saved ?? demoFarm();
        if (next.settings.name === "Fazenda Boa Vista")
          next.settings.name = "Fazenda Calumbi";
        try {
          localStorage.setItem("calumbi-demo-v1", JSON.stringify(next));
        } catch {
          // Still allow exploring the demo if browser storage is unavailable.
        }
        setFarm(next);
        setDraft(next.settings);
        setMode("demo");
      } else {
        setFarm(data.farm);
        setDraft(data.farm.settings);
        setMode("sheets");
        setLogin(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na conexão.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,a[href],[tabindex="0"]',
        ) ?? [],
      );
    const timer = setTimeout(() => {
      const preferred = dialog?.querySelector<HTMLElement>("input,select");
      (preferred ?? focusables()[0])?.focus();
    }, 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setModal(null);
      if (event.key === "Tab") {
        const all = focusables();
        const first = all[0],
          last = all.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", keydown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [modal, busy]);
  const stats = useMemo(() => (farm ? summary(farm) : null), [farm]);
  const projectionPlan = useMemo(() => {
    if (!farm) return { total: [], byOwner: {}, cohortsByYear: {} };
    const s = { ...farm.settings };
    if (scenario === "dry") {
      s.birthRate *= 0.8;
      s.monthlyPerHead *= 1.35;
      s.arroba *= 0.9;
      s.calfMortality = Math.min(100, s.calfMortality * 1.5);
    }
    if (scenario === "good") {
      s.birthRate = Math.min(95, s.birthRate * 1.1);
      s.arroba *= 1.1;
    }
    return projectOwnership({ ...farm, settings: s }, years);
  }, [farm, years, scenario]);
  const projection = projectionPlan.total;
  const shownProjection =
    projectionOwner === "all"
      ? projection
      : (projectionPlan.byOwner[projectionOwner] ?? projection);
  const projectedPerson = farm?.investors.find((p) => p.id === projectionOwner);
  const selectedFinal = shownProjection.at(-1);
  function go(id: string) {
    setTab(id);
    router.push(
      id === "curral"
        ? "/curral"
        : id === "overview"
          ? "/"
          : `/?section=${encodeURIComponent(id)}`,
      { scroll: false },
    );
    setMenu(false);
    setError("");
  }
  async function save(input: unknown) {
    if (!farm) return;
    setBusy(true);
    setError("");
    try {
      const action = validateAction(input, farm);
      if (mode === "demo") {
        const next = applyAction(farm, action);
        localStorage.setItem("calumbi-demo-v1", JSON.stringify(next));
        setFarm(next);
        setDraft(next.settings);
      } else {
        const response = await fetch("/api/farm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        const refresh = await fetch("/api/farm", { cache: "no-store" });
        const data = await refresh.json();
        if (!refresh.ok)
          throw new Error(
            "Registro enviado. Falha ao atualizar a tela; recarregue antes de repetir.",
          );
        setFarm(data.farm);
        setDraft(data.farm.settings);
      }
      setModal(null);
      setToast(
        mode === "demo"
          ? "Salvo na demonstração deste navegador."
          : "Salvo no Google Sheets.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  function handleForm(e: FormEvent<HTMLFormElement>, type: string) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (type === "animal")
      data.weight = Number(data.weight) as unknown as string;
    if (type === "transaction" || type === "status")
      data.amount = Number(data.amount || 0) as unknown as string;
    if (type === "status") {
      data.id = selectedAnimal!.id;
      data.owner = selectedAnimal!.owner;
    }
    if (type === "animal") {
      const quantity = Number(data.quantity || 1);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
        setError("Escolha uma quantidade entre 1 e 500.");
        return;
      }
      const tag = String(data.tag || "").trim();
      void save({
        type: "animals",
        data: {
          animals: Array.from({ length: quantity }, (_, i) => ({
            ...data,
            tag: tag && quantity > 1 ? `${tag}-${i + 1}` : tag,
          })),
        },
      });
      return;
    }
    void save({ type, data });
  }
  function exportCSV() {
    if (!farm) return;
    const data =
      tab === "projection"
        ? shownProjection
        : tab === "finance"
          ? farm.transactions
          : tab === "investors"
            ? stats!.shares
            : farm.animals;
    const keys = Object.keys(data[0] ?? {});
    const escape = (v: unknown) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@-]/, "'" + "$&")
        .replaceAll('"', '""') +
      '"';
    const csv =
      "\uFEFF" +
      [
        keys.map(escape).join(";"),
        ...data.map((r) =>
          keys.map((k) => escape(r[k as keyof typeof r])).join(";"),
        ),
      ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `calumbi-${tab}-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("Arquivo CSV exportado.");
  }
  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const password = new FormData(e.currentTarget).get("password");
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao entrar.");
    } finally {
      setBusy(false);
    }
  }
  const final = projection.at(-1);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("overview");
          }}
        >
          <span className="brand-icon">
            <CalumbiMark size={34} />
          </span>
          <span>
            calumbi<small>FAZENDA · AGRESTE</small>
          </span>
        </a>
        <div className="farm-selector">
          <div className="farm-monogram">FC</div>
          <span>
            <strong>{farm?.settings.name ?? "Sua fazenda"}</strong>
            <small>Nelore · Pecuária de corte</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <span className="nav-label">ESPAÇO DA FAZENDA</span>
        <nav>
          {navigation.map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={19} />
              {n.name}
              {n.id === "herd" && (
                <span className="nav-count">{stats?.herd.length ?? "—"}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="long-term">
            <Leaf size={23} />
            <strong>Crescer com raízes.</strong>
            <p>
              Boas decisões hoje.
              <br />
              Uma fazenda viva amanhã.
            </p>
            <button onClick={() => go("projection")}>
              Planejar o futuro <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`settings-link ${tab === "settings" ? "active" : ""}`}
            onClick={() => go("settings")}
          >
            <Settings2 size={18} /> Configurações
          </button>
          <button className="profile" onClick={() => go("investors")}>
            <span className="avatar">FC</span>
            <span>
              <strong>Minha fazenda</strong>
              <small>Visão dos investidores</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-scrim"
          onClick={() => setMenu(false)}
          aria-label="Fechar menu"
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMenu(!menu)}
              aria-label="Abrir menu"
            >
              <Menu size={21} />
            </button>
            <Sprout size={16} />
            <span>Minha fazenda</span>
            <span className="slash">/</span>
            <strong>
              {navigation.find((n) => n.id === tab)?.name ?? "Configurações"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className={`sync-badge ${mode === "demo" ? "demo" : ""}`}>
              <span />
              {mode === "loading"
                ? "Conectando"
                : mode === "demo"
                  ? "Modo demonstração"
                  : "Google Sheets conectado"}
            </span>
            <button
              className="icon-button"
              onClick={() => void load()}
              aria-label="Atualizar dados"
              disabled={busy}
            >
              <RefreshCw size={17} className={busy ? "spinning" : ""} />
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              onClick={() => setModal("help")}
              aria-label="Sobre a plataforma"
            >
              <CircleHelp size={19} />
            </button>
            {farm && (
              <button
                className="icon-button"
                aria-label="Sair"
                onClick={async () => {
                  await fetch("/api/session", { method: "DELETE" });
                  setFarm(null);
                  window.location.replace("/login");
                }}
              >
                <LogOut size={18} />
              </button>
            )}
            <span className="avatar small">FC</span>
          </div>
        </header>
        <main>
          <div className="page-eyebrow">
            <span className="live-dot" />{" "}
            {farm?.settings.location ?? "AGRESTE · PERNAMBUCO"}{" "}
            <span className="eyebrow-line" /> GESTÃO COM PROPÓSITO
          </div>
          <div className="page-heading">
            <div>
              <h1>
                {tab === "overview"
                  ? "Seu patrimônio tem vida."
                  : (navigation.find((n) => n.id === tab)?.name ??
                    "Configurações")}
              </h1>
              <p>{titles[tab][tab === "overview" ? 1 : 0]}</p>
            </div>
            {tab !== "curral" && (
              <div className="heading-actions">
                <button
                  className="button secondary"
                  onClick={exportCSV}
                  disabled={!farm}
                >
                  <Download size={15} />
                  <span>Exportar</span>
                </button>
                {tab === "herd" && (
                  <button
                    className="button secondary"
                    disabled={!farm}
                    onClick={() => {
                      setSelectedAnimal(null);
                      setModal("purchase");
                    }}
                  >
                    <ShoppingCart size={15} /> Comprar gado
                  </button>
                )}
                <button
                  className="button primary"
                  disabled={!farm}
                  onClick={() =>
                    setModal(
                      tab === "herd"
                        ? "animal"
                        : tab === "investors"
                          ? "investor"
                          : "transaction",
                    )
                  }
                >
                  <Plus size={17} />
                  {tab === "herd"
                    ? "Adicionar animal"
                    : tab === "investors"
                      ? "Adicionar pessoa"
                      : "Novo lançamento"}
                </button>
              </div>
            )}
          </div>
          {mode === "demo" && (
            <div className="demo-strip">
              <span>
                <span className="demo-dot" /> Você está explorando uma fazenda
                de exemplo. Seus registros ficam neste navegador.
              </span>
              <button onClick={() => go("settings")}>
                Conectar minha planilha <ArrowRight size={14} />
              </button>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Fechar aviso">
                <X size={15} />
              </button>
            </div>
          )}
          {!farm ? (
            <div className="empty-state">
              <Sprout size={42} />
              <h2>
                {login
                  ? "Bem-vindo à sua fazenda."
                  : busy
                    ? "Preparando sua visão da fazenda…"
                    : "Vamos conectar sua fazenda."}
              </h2>
              <p>
                {login
                  ? "Entre com a senha compartilhada da fazenda para acessar os dados."
                  : "Verifique as configurações da planilha para continuar."}
              </p>
              {login ? (
                <form onSubmit={signIn} className="login-form">
                  <input
                    type="password"
                    name="password"
                    placeholder="Senha da fazenda"
                    aria-label="Senha da fazenda"
                    required
                  />
                  <button className="button primary" disabled={busy}>
                    Entrar <ArrowRight size={16} />
                  </button>
                </form>
              ) : (
                <button className="button primary" onClick={() => void load()}>
                  Tentar novamente
                </button>
              )}
            </div>
          ) : (
            stats && (
              <>
                {tab === "overview" && (
                  <>
                    <div className="metrics-grid">
                      <Metric
                        label="PATRIMÔNIO DO REBANHO"
                        value={money(stats.value)}
                        icon={<Wallet size={19} />}
                        sub={
                          <>
                            <span className="positive">Ativo estimado</span>
                            <span>peso × rendimento × arroba</span>
                          </>
                        }
                      />
                      <Metric
                        label="ANIMAIS NA FAZENDA"
                        value={
                          <>
                            {stats.herd.length}
                            <span className="metric-unit">cabeças</span>
                          </>
                        }
                        icon={<Fence size={19} />}
                        sub={
                          <>
                            <span className="positive">
                              {
                                stats.herd.filter(
                                  (a) => category(a) === "Matrizes",
                                ).length
                              }{" "}
                              matrizes
                            </span>
                            <span>
                              Máximo: {farm.settings.capacity} cabeças ·{" "}
                              {Math.max(
                                0,
                                farm.settings.capacity - stats.herd.length,
                              )}{" "}
                              vagas
                            </span>
                          </>
                        }
                      />
                      <Metric
                        label="MANUTENÇÃO MENSAL"
                        value={money(stats.monthly)}
                        icon={<Banknote size={19} />}
                        sub={
                          <>
                            <span>
                              + {money(stats.deathReserve)} de reserva para
                              perdas
                            </span>
                          </>
                        }
                      />
                      <Metric
                        label="CAIXA DISPONÍVEL"
                        value={money(stats.cash)}
                        icon={<ShieldCheck size={19} />}
                        sub={
                          <>
                            <span
                              className={
                                stats.cash >= stats.reserveTarget
                                  ? "positive"
                                  : "warning"
                              }
                            >
                              {stats.monthly
                                ? decimal(stats.cash / stats.monthly)
                                : "—"}{" "}
                              meses de cobertura
                            </span>
                            <span>
                              meta: {farm.settings.reserveMonths} meses
                            </span>
                          </>
                        }
                      />
                    </div>
                    <div className="overview-main">
                      <section className="card map-card">
                        <CardHeading
                          eyebrow="UM OLHAR SOBRE A TERRA"
                          title="Sua fazenda, de perto."
                          right={
                            <span className="soft-badge">
                              <span className="live-dot" /> {stats.herd.length}{" "}
                              animais
                            </span>
                          }
                        />
                        <FarmMap
                          animals={stats.herd}
                          onSelect={(p) => {
                            setFilter(p);
                            go("herd");
                          }}
                        />
                        <p className="form-note">
                          Criação de Nelore com foco na venda dos bezerros.
                        </p>
                      </section>
                      <section className="card investor-card">
                        <CardHeading
                          eyebrow="CRESCEMOS JUNTOS"
                          title="Quem faz parte."
                          right={
                            <button
                              className="icon-button"
                              onClick={() => go("investors")}
                              aria-label="Ver participantes"
                            >
                              <ArrowUpRight size={19} />
                            </button>
                          }
                        />
                        <div className="donut-wrap">
                          <ShareChart shares={stats.shares} />
                          <div className="donut-center">
                            <strong>{stats.shares.length}</strong>
                            <small>participantes</small>
                          </div>
                        </div>
                        <div className="investor-list">
                          {stats.shares.map((s) => (
                            <div className="investor-row" key={s.id}>
                              <span
                                className="investor-dot"
                                style={{ background: s.color }}
                              />
                              <span>
                                {s.name}
                                <small>{s.count} cabeças</small>
                              </span>
                              <strong>
                                {decimal(s.share * 100)}
                                <small>%</small>
                              </strong>
                            </div>
                          ))}
                        </div>
                        <button
                          className="card-footer-button"
                          onClick={() => go("investors")}
                        >
                          Ver participação e rateio <ArrowRight size={15} />
                        </button>
                      </section>
                    </div>
                    <div className="overview-bottom">
                      <section className="card growth-card">
                        <CardHeading
                          eyebrow="UM FUTURO PARA CULTIVAR"
                          title="O próximo capítulo do rebanho."
                          right={
                            <button
                              className="text-button"
                              onClick={() => go("projection")}
                            >
                              Explorar projeções <ArrowUpRight size={15} />
                            </button>
                          }
                        />
                        <div className="growth-summary">
                          <strong>
                            {decimal(final?.herd ?? 0, 0)}{" "}
                            <span>cabeças em {final?.year}</span>
                          </strong>
                          <span className="soft-badge">
                            Cenário base · {years} anos
                          </span>
                        </div>
                        <ProjectionChart data={projection} compact />
                        <div className="chart-footnote">
                          <span className="live-dot" /> Estimativa com
                          natalidade, mortalidade e vendas. Ajustável à
                          realidade da fazenda.
                        </div>
                      </section>
                      <section className="future-card">
                        <div className="future-icon">
                          <Sprout size={28} />
                        </div>
                        <span className="page-eyebrow">
                          PENSAR ALÉM DA PRÓXIMA SAFRA
                        </span>
                        <h2>
                          Um rebanho saudável.
                          <br />
                          Um investimento
                          <br />
                          <em>que se sustenta.</em>
                        </h2>
                        <p>
                          Antecipe os custos, prepare uma reserva e saiba quanto
                          cada pessoa precisa investir.
                        </p>
                        <button onClick={() => go("projection")}>
                          Planejar os próximos anos <ArrowUpRight size={17} />
                        </button>
                        <div className="contours" />
                      </section>
                    </div>
                    <section className="card movements-card">
                      <CardHeading
                        eyebrow="O DIA A DIA DA FAZENDA"
                        title="Últimas movimentações."
                        right={
                          <button
                            className="text-button"
                            onClick={() => go("finance")}
                          >
                            Ver financeiro <ArrowUpRight size={15} />
                          </button>
                        }
                      />
                      <Transactions
                        transactions={farm.transactions.slice(-4).reverse()}
                        investors={farm.investors}
                      />
                    </section>
                  </>
                )}
                {tab === "herd" && (
                  <>
                    <div className="metrics-grid">
                      {["Matrizes", "Novilhas", "Bezerros", "Machos"].map(
                        (c, i) => (
                          <Metric
                            key={c}
                            label={c.toUpperCase()}
                            value={
                              stats.herd.filter((a) => category(a) === c).length
                            }
                            icon={
                              i === 0 ? (
                                <Heart size={19} />
                              ) : (
                                <Fence size={19} />
                              )
                            }
                            sub={
                              <span>
                                {
                                  [
                                    "Fêmeas a partir de 36 meses",
                                    "Fêmeas de 12 a 35 meses",
                                    "Machos e fêmeas até 11 meses",
                                    "Machos a partir de 12 meses",
                                  ][i]
                                }
                              </span>
                            }
                          />
                        ),
                      )}
                    </div>
                    <section className="card">
                      <CardHeading
                        eyebrow="RASTREABILIDADE E PATRIMÔNIO"
                        title="Rebanho Nelore"
                        right={
                          <span className="soft-badge">
                            {stats.herd.length} ativos / máximo{" "}
                            {farm.settings.capacity} · {farm.animals.length}{" "}
                            registros
                          </span>
                        }
                      />
                      <div className="table-toolbar">
                        <div className="search-field">
                          <Search size={17} />
                          <input
                            aria-label="Buscar animal"
                            placeholder="Buscar brinco, ID ou participante…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                        <select
                          aria-label="Filtrar rebanho"
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                        >
                          {[
                            "Todos",
                            "Matrizes",
                            "Novilhas",
                            "Bezerros",
                            "Machos",

                            "Histórico",
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                        <select
                          aria-label="Filtrar por participante"
                          value={herdOwner}
                          onChange={(e) => setHerdOwner(e.target.value)}
                        >
                          <option value="all">Todos os participantes</option>
                          {farm.investors.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="button secondary"
                          onClick={() => {
                            setSearch("");
                            setFilter("Todos");
                            setHerdOwner("all");
                          }}
                        >
                          Limpar filtros
                        </button>
                      </div>
                      <div className="herd-quick-actions">
                        <span>
                          Compras, vendas e transferências atualizam o rebanho,
                          as cotas e o histórico.
                        </span>
                        <button
                          className="button primary"
                          disabled={!stats.herd.length}
                          onClick={() => {
                            setSelectedAnimal(null);
                            setModal("sale");
                          }}
                        >
                          <Banknote size={15} /> Vender gado
                        </button>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Animal</th>
                              <th>Categoria</th>
                              <th>Idade / peso vivo</th>
                              <th>Participante</th>
                              <th>Valor estimado</th>
                              <th>Situação</th>
                              <th>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {farm.animals
                              .filter(
                                (a) =>
                                  (filter === "Histórico"
                                    ? a.status !== "ativo"
                                    : a.status === "ativo") &&
                                  (filter === "Todos" ||
                                    filter === "Histórico" ||
                                    category(a) === filter) &&
                                  (herdOwner === "all" ||
                                    a.owner === herdOwner) &&
                                  `${a.tag || `ID ${a.id.slice(0, 8)}`} ${a.id} ${farm.investors.find((i) => i.id === a.owner)?.name ?? ""}`
                                    .toLowerCase()
                                    .includes(search.toLowerCase()),
                              )
                              .map((a) => (
                                <tr key={a.id}>
                                  <td>
                                    <button
                                      className="animal-link"
                                      onClick={() => {
                                        setSelectedAnimal(a);
                                        setModal("detail");
                                      }}
                                    >
                                      <span className="animal-icon">
                                        <Fence size={18} />
                                      </span>
                                      <span>
                                        <strong>
                                          {a.tag || `ID ${a.id.slice(0, 8)}`}
                                        </strong>
                                        <small
                                          className="animal-short-id"
                                          title={a.id}
                                        >
                                          ID {a.id.slice(0, 8)}
                                        </small>
                                      </span>
                                    </button>
                                  </td>
                                  <td>{category(a)}</td>
                                  <td>
                                    {ageMonths(a.born)} meses{" "}
                                    <span className="muted">
                                      /{" "}
                                      {weightLabel(
                                        a.weight,
                                        farm.settings.yield,
                                      )}
                                    </span>
                                  </td>
                                  <td>
                                    {farm.investors.find(
                                      (i) => i.id === a.owner,
                                    )?.name ?? "Sem vínculo"}
                                  </td>
                                  <td>
                                    {money(
                                      animalValue(a.weight, farm.settings),
                                    )}
                                  </td>
                                  <td>
                                    <span
                                      className={`status-pill ${a.status === "ativo" ? "" : "neutral"}`}
                                    >
                                      {a.status}
                                    </span>
                                  </td>
                                  <td>
                                    {a.status === "ativo" ? (
                                      <div className="animal-row-actions">
                                        <button
                                          onClick={() => {
                                            setSelectedAnimal(a);
                                            setModal("editAnimal");
                                          }}
                                        >
                                          Editar
                                        </button>
                                        <button
                                          onClick={() => {
                                            setSelectedAnimal(a);
                                            setModal("sale");
                                          }}
                                        >
                                          <Banknote size={13} /> Vender
                                        </button>
                                        <button
                                          onClick={() => {
                                            setSelectedAnimal(a);
                                            setModal("transfer");
                                          }}
                                          aria-label={`Transferir ${a.tag || `ID ${a.id.slice(0, 8)}`}`}
                                        >
                                          <ArrowLeftRight size={13} />{" "}
                                          Transferir
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="muted">Encerrado</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      {!farm.animals.length && (
                        <Empty text="Adicione o primeiro animal e comece a acompanhar o rebanho." />
                      )}
                      <div className="table-footnote">
                        Valor de referência em carcaça equivalente, sem
                        diferenciação por categoria, genética ou praça. Não
                        substitui uma avaliação de compra ou venda.
                      </div>
                    </section>
                  </>
                )}
                {tab === "investors" && (
                  <>
                    <div className="section-callout">
                      <Users size={25} />
                      <div>
                        <strong>Participação que acompanha o rebanho.</strong>
                        <p>
                          O percentual de cada pessoa é o número de animais
                          ativos dela dividido pelo total. Os custos são
                          rateados nessa proporção; vendas e mortes atualizam as
                          cotas.
                        </p>
                      </div>
                    </div>
                    <div className="investors-grid">
                      {stats.shares.map((s) => (
                        <section className="card person-card" key={s.id}>
                          <div className="person-header">
                            <span
                              className="person-avatar"
                              style={{ background: s.color }}
                            >
                              {s.name
                                .split(" ")
                                .map((x) => x[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <span className="soft-badge">
                              {s.count} cabeças
                            </span>
                          </div>
                          <h2>{s.name}</h2>
                          <div className="person-percentage">
                            {decimal(s.share * 100)}
                            <small>%</small>
                          </div>
                          <div className="progress-track">
                            <span
                              style={{
                                width: `${s.share * 100}%`,
                                background: s.color,
                              }}
                            />
                          </div>
                          <dl>
                            <div>
                              <dt>Patrimônio proporcional¹</dt>
                              <dd>{money(s.value)}</dd>
                            </div>
                            <div>
                              <dt>Rateio mensal + reserva</dt>
                              <dd>{money(s.monthly)}</dd>
                            </div>
                            <div>
                              <dt>Aportes registrados</dt>
                              <dd>
                                {money(
                                  farm.transactions
                                    .filter(
                                      (t) =>
                                        t.kind === "aporte" &&
                                        t.investor === s.id,
                                    )
                                    .reduce((v, t) => v + t.amount, 0),
                                )}
                              </dd>
                            </div>
                          </dl>
                          <button
                            className="person-projection-button"
                            onClick={() => {
                              setProjectionOwner(s.id);
                              go("projection");
                            }}
                          >
                            <TrendingUp size={14} /> Ver evolução dos seus
                            animais <ArrowUpRight size={14} />
                          </button>
                          <button
                            className="card-footer-button"
                            onClick={() => {
                              setSearch(s.name);
                              setFilter("Todos");
                              go("herd");
                            }}
                          >
                            Ver animais <ArrowRight size={15} />
                          </button>
                        </section>
                      ))}
                    </div>
                    {!stats.shares.length && (
                      <Empty text="Cadastre os participantes antes de adicionar os animais." />
                    )}
                    <section className="card">
                      <CardHeading
                        eyebrow="PLANEJAMENTO COMPARTILHADO"
                        title="Aportes projetados por participante"
                        right={
                          <button
                            className="text-button"
                            onClick={() => go("projection")}
                          >
                            Ajustar simulação <ArrowUpRight size={15} />
                          </button>
                        }
                      />
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Participante</th>
                              <th>Cota atual</th>
                              {projection.slice(1, 6).map((r) => (
                                <th key={r.year}>{r.year}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {stats.shares.map((s) => (
                              <tr key={s.id}>
                                <td>{s.name}</td>
                                <td>{decimal(s.share * 100)}%</td>
                                {projection.slice(1, 6).map((r) => (
                                  <td key={r.year}>
                                    {money(
                                      projectionPlan.byOwner[s.id]?.find(
                                        (row) => row.year === r.year,
                                      )?.contribution ?? 0,
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="table-footnote">
                        ¹ Rateio do valor total pela quantidade de cabeças.
                        Aportes futuros são rateados pelo rebanho médio de cada
                        ano. As crias projetadas seguem o proprietário da
                        matriz; nascimentos reais devem ser cadastrados.
                      </div>
                    </section>
                  </>
                )}
                {tab === "projection" && (
                  <>
                    <div className="projection-controls">
                      <div>
                        <SlidersHorizontal size={18} />
                        <strong>Simule o seu cenário</strong>
                      </div>
                      <select
                        value={scenario}
                        onChange={(e) => setScenario(e.target.value)}
                        aria-label="Cenário"
                      >
                        <option value="base">
                          Base · premissas da fazenda
                        </option>
                        <option value="dry">
                          Seca · custo +35%, arroba −10%
                        </option>
                        <option value="good">Favorável · arroba +10%</option>
                      </select>
                      <div className="segmented">
                        {[5, 10, 15].map((y) => (
                          <button
                            key={y}
                            className={years === y ? "selected" : ""}
                            onClick={() => setYears(y)}
                          >
                            {y} anos
                          </button>
                        ))}
                      </div>
                      <button
                        className="text-button"
                        onClick={() => go("settings")}
                      >
                        Editar premissas <Settings2 size={15} />
                      </button>
                    </div>
                    <div className="projection-owner-panel">
                      <label>
                        <Users size={17} />
                        <span>De quem você quer ver o futuro?</span>
                        <select
                          aria-label="Participante da projeção"
                          value={projectionOwner}
                          onChange={(e) => setProjectionOwner(e.target.value)}
                        >
                          <option value="all">Toda a fazenda</option>
                          {farm.investors.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ·{" "}
                              {stats.shares.find((s) => s.id === p.id)?.count ??
                                0}{" "}
                              animais hoje
                            </option>
                          ))}
                        </select>
                      </label>
                      <p>
                        {projectedPerson
                          ? `A projeção usa os animais de ${projectedPerson.name}, considerando sexo, idade e as futuras crias das suas matrizes.`
                          : "Veja o rebanho completo ou acompanhe os animais e as crias projetadas de um integrante."}
                      </p>
                    </div>
                    <HerdEvolution
                      key={projectionOwner}
                      data={shownProjection}
                      capacity={farm.settings.capacity}
                      participants={
                        projectionOwner === "all"
                          ? stats.shares
                          : stats.shares.filter((p) => p.id === projectionOwner)
                      }
                      ownerName={projectedPerson?.name}
                      participantData={projectionPlan.byOwner}
                      cohortData={projectionPlan.cohortsByYear}
                      adultMonths={farm.settings.maturityMonths}
                      onResetScope={() => setProjectionOwner("all")}
                      fibonacci={fib}
                    />
                    <label className="checkbox-label herd-fibonacci-toggle">
                      <input
                        type="checkbox"
                        checked={fib}
                        onChange={(e) => setFib(e.target.checked)}
                      />{" "}
                      Comparar também com a hipótese de Fibonacci
                    </label>
                    <div className="metrics-grid">
                      <Metric
                        label={`REBANHO EM ${selectedFinal?.year}`}
                        value={`${decimal(selectedFinal?.herd ?? 0, 0)} cabeças`}
                        icon={<Fence size={19} />}
                        sub={
                          <span>
                            Capacidade compartilhada: {farm.settings.capacity}{" "}
                            cabeças
                          </span>
                        }
                      />
                      <Metric
                        label="PATRIMÔNIO PROJETADO"
                        value={money(selectedFinal?.value ?? 0)}
                        icon={<TrendingUp size={19} />}
                        sub={
                          <span>
                            Valor nominal · arroba do cenário constante
                          </span>
                        }
                      />
                      <Metric
                        label={`APORTES EM ${years} ANOS`}
                        value={money(
                          shownProjection.reduce(
                            (n, r) => n + r.contribution,
                            0,
                          ),
                        )}
                        icon={<Wallet size={19} />}
                        sub={
                          <span>
                            Inclui formação de reserva e déficit de caixa
                          </span>
                        }
                      />
                      <Metric
                        label="MORTES ESPERADAS NO PERÍODO"
                        value={decimal(
                          shownProjection.reduce((n, r) => n + r.deaths, 0),
                        )}
                        icon={<Heart size={19} />}
                        sub={
                          <span>
                            Valores fracionários são expectativas estatísticas
                          </span>
                        }
                      />
                    </div>
                    <div className="section-callout">
                      <ShieldCheck size={26} />
                      <div>
                        <strong>
                          O crescimento precisa caber no pasto e no caixa.
                        </strong>
                        <p>
                          Machos são vendidos na idade configurada, fêmeas são
                          descartadas ao fim da vida produtiva e excedentes à
                          capacidade são vendidos. A reserva cobre{" "}
                          {farm.settings.reserveMonths} meses de operação mais o
                          valor estimado das perdas do ano.
                        </p>
                      </div>
                    </div>
                    <details className="projection-ledger">
                      <summary>
                        <span>
                          <strong>Ver os números de cada ano</strong>
                          <small>
                            Rebanho, nascimentos, vendas, caixa e aportes em
                            tabela.
                          </small>
                        </span>
                        <ChevronDown size={18} />
                      </summary>
                      <section className="card">
                        <CardHeading
                          eyebrow="DA PROJEÇÃO AO PLANEJAMENTO"
                          title="O que cada ano pede."
                          right={
                            <button className="text-button" onClick={exportCSV}>
                              Exportar cenário <Download size={15} />
                            </button>
                          }
                        />
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Ano</th>
                                <th>Rebanho</th>
                                <th>Nascimentos</th>
                                <th>Mortes</th>
                                <th>Vendas (cab.)</th>
                                <th>Receita</th>
                                <th>Custos</th>
                                <th>Aporte necessário</th>
                                <th>Caixa final</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shownProjection.slice(1).map((r) => (
                                <tr key={r.year}>
                                  <td>
                                    <strong>{r.year}</strong>
                                  </td>
                                  <td>{decimal(r.herd)}</td>
                                  <td className="positive">
                                    +{decimal(r.births)}
                                  </td>
                                  <td>{decimal(r.deaths)}</td>
                                  <td>{decimal(r.sales)}</td>
                                  <td>{money(r.revenue)}</td>
                                  <td>{money(r.costs)}</td>
                                  <td>
                                    <strong
                                      className={
                                        r.contribution ? "warning" : "positive"
                                      }
                                    >
                                      {money(r.contribution)}
                                    </strong>
                                  </td>
                                  <td>{money(r.cash)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="table-footnote">
                          Simulação nominal, sem impostos, financiamento ou
                          valorização da terra. Custos sofrem inflação de{" "}
                          {farm.settings.inflation}% a.a. Veja a metodologia nas
                          configurações.
                        </div>
                      </section>
                    </details>
                  </>
                )}
                {tab === "finance" && (
                  <>
                    <div className="metrics-grid">
                      <Metric
                        label="CAIXA DISPONÍVEL"
                        value={money(stats.cash)}
                        icon={<Wallet size={19} />}
                        sub={<span>Saldo inicial + entradas − despesas</span>}
                      />
                      <Metric
                        label="CUSTO OPERACIONAL / MÊS"
                        value={money(stats.monthly)}
                        icon={<Banknote size={19} />}
                        sub={
                          <span>
                            {money(farm.settings.fixedMonthly)} fixos +{" "}
                            {money(farm.settings.monthlyPerHead)}/cabeça
                          </span>
                        }
                      />
                      <Metric
                        label="RESERVA OPERACIONAL ALVO"
                        value={money(stats.reserveTarget)}
                        icon={<ShieldCheck size={19} />}
                        sub={
                          <span>
                            {farm.settings.reserveMonths} meses de operação
                          </span>
                        }
                      />
                      <Metric
                        label="RESERVA ANUAL PARA PERDAS"
                        value={money(stats.deathReserve * 12)}
                        icon={<Heart size={19} />}
                        sub={
                          <span>
                            Estimativa de mortalidade × valor dos animais
                          </span>
                        }
                      />
                    </div>
                    <div className="finance-grid">
                      <section className="card reserve-card">
                        <CardHeading
                          eyebrow="FÔLEGO PARA O FUTURO"
                          title="Como está a sua reserva?"
                        />
                        <div className="reserve-value">
                          {stats.reserveTarget
                            ? decimal(
                                (stats.cash / stats.reserveTarget) * 100,
                                0,
                              )
                            : "100"}
                          <small>% da meta</small>
                        </div>
                        <div className="progress-track">
                          <span
                            style={{
                              width: `${Math.max(0, Math.min(100, stats.reserveTarget ? (stats.cash / stats.reserveTarget) * 100 : 100))}%`,
                            }}
                          />
                        </div>
                        <p>
                          {stats.cash >= stats.reserveTarget
                            ? "A reserva operacional está coberta nas premissas atuais."
                            : `Faltam ${money(stats.reserveTarget - stats.cash)} para completar a reserva operacional.`}
                        </p>
                        <button
                          className="text-button"
                          onClick={() => go("projection")}
                        >
                          Ver necessidade futura de capital{" "}
                          <ArrowRight size={15} />
                        </button>
                      </section>
                      <section className="card">
                        <CardHeading
                          eyebrow="DIVIDIR PARA SUSTENTAR"
                          title="Rateio mensal estimado"
                        />
                        <div className="rateio-list">
                          {stats.shares.map((s) => (
                            <div key={s.id}>
                              <span
                                className="investor-dot"
                                style={{ background: s.color }}
                              />
                              <span>
                                {s.name}
                                <small>
                                  {decimal(s.share * 100)}% do rebanho
                                </small>
                              </span>
                              <strong>{money(s.monthly)}</strong>
                            </div>
                          ))}
                        </div>
                        <div className="table-footnote">
                          Operação mensal + reserva estimada para mortalidade. O
                          aporte efetivo depende das receitas e do caixa.
                        </div>
                      </section>
                    </div>
                    <section className="card">
                      <CardHeading
                        eyebrow="TRANSPARÊNCIA EM CADA MOVIMENTO"
                        title="Livro de caixa"
                        right={
                          <button
                            className="text-button"
                            onClick={() => setModal("transaction")}
                          >
                            <Plus size={16} /> Novo lançamento
                          </button>
                        }
                      />
                      <Transactions
                        transactions={[...farm.transactions].sort((a, b) =>
                          b.date.localeCompare(a.date),
                        )}
                        investors={farm.investors}
                      />
                    </section>
                  </>
                )}
                {tab === "curral" && <CorralCamera />}
                {tab === "settings" && (
                  <>
                    <section className="card connection-card">
                      <div className="connection-icon">
                        <Database size={26} />
                      </div>
                      <div>
                        <span className="section-eyebrow">
                          DADOS SIMPLES, CONTROLE SEU
                        </span>
                        <h2>O Google Sheets é a sua base.</h2>
                        <p>
                          {mode === "sheets"
                            ? "Leituras e lançamentos passam pela sua planilha. As credenciais ficam somente no servidor."
                            : "Configure sua conta de serviço para guardar o rebanho, os participantes e o financeiro em uma planilha privada."}
                        </p>
                        <div className="connection-steps">
                          <span>
                            <b>1</b> Crie a planilha e ative a API Sheets
                          </span>
                          <span>
                            <b>2</b> Configure .env.local e compartilhe com a
                            conta de serviço
                          </span>
                          <span>
                            <b>3</b> Execute npm run sheets:init e reinicie o
                            app
                          </span>
                        </div>
                        <a
                          href="https://console.cloud.google.com/apis/library/sheets.googleapis.com"
                          target="_blank"
                          rel="noreferrer"
                          className="text-button"
                        >
                          Abrir Google Cloud <ExternalLink size={14} />
                        </a>
                        <p className="muted">
                          Instruções detalhadas no README do projeto. Nenhuma
                          credencial deve ser inserida na planilha ou no
                          navegador.
                        </p>
                      </div>
                    </section>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void save({ type: "settings", data: draft });
                      }}
                    >
                      <section className="card settings-card">
                        <CardHeading
                          eyebrow="PREMISSAS DA PROPRIEDADE"
                          title="A realidade da sua fazenda"
                        />
                        <div className="settings-fields">
                          <Field label="Nome da fazenda">
                            <input
                              required
                              value={draft.name}
                              onChange={(e) =>
                                setDraft({ ...draft, name: e.target.value })
                              }
                            />
                          </Field>
                          <Field label="Localização">
                            <input
                              required
                              value={draft.location}
                              onChange={(e) =>
                                setDraft({ ...draft, location: e.target.value })
                              }
                            />
                          </Field>
                          {(
                            [
                              {
                                key: "arroba",
                                label: "Arroba de referência (R$)",
                                note: "Premissa local informada por você, não cotação ao vivo.",
                              },
                              {
                                key: "yield",
                                label: "Rendimento de carcaça (%)",
                                note: "Peso vivo × rendimento ÷ 15 kg × R$/@.",
                              },
                              {
                                key: "birthRate",
                                label: "Natalidade anual por matriz (%)",
                                note: "Proporção das matrizes aptas que geram uma cria no ano.",
                              },
                              {
                                key: "mortality",
                                label: "Mortalidade anual de adultos (%)",
                              },
                              {
                                key: "calfMortality",
                                label: "Mortalidade de bezerros (%)",
                              },
                              {
                                key: "femaleRetention",
                                label: "Retenção de fêmeas nascidas (%)",
                              },
                              {
                                key: "maturityMonths",
                                label: "Entrada na reprodução (meses)",
                              },
                              {
                                key: "saleMonths",
                                label: "Venda dos machos (meses)",
                              },
                              {
                                key: "cullMonths",
                                label: "Descarte das matrizes (meses)",
                              },
                              {
                                key: "capacity",
                                label: "Capacidade máxima (cabeças)",
                              },
                              {
                                key: "monthlyPerHead",
                                label: "Custo mensal por cabeça (R$)",
                              },
                              {
                                key: "fixedMonthly",
                                label: "Custo fixo mensal (R$)",
                              },
                              {
                                key: "inflation",
                                label: "Inflação anual dos custos (%)",
                              },
                              {
                                key: "reserveMonths",
                                label: "Reserva de operação (meses)",
                              },
                              {
                                key: "openingCash",
                                label: "Saldo de caixa inicial (R$)",
                              },
                            ] as {
                              key: Exclude<keyof Settings, "name" | "location">;
                              label: string;
                              note?: string;
                            }[]
                          ).map((field) => (
                            <Field
                              key={field.key}
                              label={field.label}
                              note={field.note}
                            >
                              <input
                                required
                                type="number"
                                min="0"
                                step="any"
                                value={draft[field.key]}
                                onChange={(e) =>
                                  setDraft({
                                    ...draft,
                                    [field.key]: Number(e.target.value),
                                  })
                                }
                              />
                            </Field>
                          ))}
                        </div>
                        <div className="settings-save">
                          <span>
                            As alterações recalculam todos os cenários.
                          </span>
                          <button className="button primary" disabled={busy}>
                            <Check size={16} /> Salvar premissas
                          </button>
                        </div>
                      </section>
                    </form>
                    <section className="card methodology">
                      <CardHeading
                        eyebrow="CLAREZA PARA TOMAR DECISÕES"
                        title="De onde vêm os números?"
                      />
                      <p>
                        <strong>Arroba.</strong> R$ 375 é o ponto médio da faixa
                        de R$ 350 a R$ 400 que você informou. A pesquisa não
                        confirmou uma cotação atual específica do Agreste
                        pernambucano. Consulte compradores locais e ajuste a
                        premissa;{" "}
                        <a
                          href="https://www.scotconsultoria.com.br/cotacoes/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Scot Consultoria ↗
                        </a>{" "}
                        é uma referência de mercado, sem integração automática.
                      </p>
                      <p>
                        <strong>Reprodução.</strong> Modelo anual simplificado
                        por idade, com proporção de sexos de 50%. Fêmeas
                        elegíveis no início do ano geram crias conforme a
                        natalidade. Novas fêmeas entram na reprodução após a
                        maturidade configurada. O modelo não acompanha gestação
                        individual. A{" "}
                        <a
                          href="https://cloud.cnpgc.embrapa.br/sac/2012/04/02/qual-e-a-duracao-da-gestacao-e-qual-o-intervalo-medio-entre-partos-em-gado-de-corte/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Embrapa ↗
                        </a>{" "}
                        descreve a influência do manejo nos intervalos entre
                        partos. Os percentuais iniciais são hipóteses de
                        demonstração.
                      </p>
                      <p>
                        <strong>Caixa e reposição.</strong> O caixa começa com o
                        saldo inicial mais os lançamentos. A projeção soma
                        vendas, subtrai custos inflacionados e calcula o aporte
                        para atingir a reserva. As fêmeas retidas repõem e
                        ampliam as matrizes; não há compra automática de
                        reposição. O valor das mortes compõe uma reserva
                        prudencial de perdas.
                      </p>
                      <p>
                        <strong>Pesos e capacidade.</strong> Os animais
                        existentes ganham 90 kg por ano até 450 kg nas fêmeas e
                        550 kg nos machos. As crias entram com 120 kg. São
                        simplificações: bezerros vendidos por excesso de lotação
                        ou retenção não têm preço comercial específico, e o
                        indicador de patrimônio usa equivalência de carcaça.
                      </p>
                      <p>
                        <strong>Fibonacci.</strong> Curva normalizada ao tamanho
                        inicial do rebanho, apenas para comparar uma hipótese
                        matemática. Não participa dos aportes financeiros.
                      </p>
                      <p>
                        <strong>Participação.</strong> Cada cabeça ativa
                        representa uma unidade. Cotas e rateios variam quando um
                        animal entra, é vendido ou morre. O patrimônio
                        proporcional distribui o valor total por cabeça; isso
                        pode diferir do valor de mercado individual dos animais
                        de cada participante.
                      </p>
                    </section>
                  </>
                )}
              </>
            )
          )}
          <footer className="page-footer">
            <span>
              <CalumbiMark size={19} /> calumbi <span>·</span> Cuidar hoje.
              Colher amanhã.
            </span>
            <span>Feito para a vida no campo.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!busy) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Fechar"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            <span className="section-eyebrow">FAZENDA CALUMBI</span>
            <h2 id="modal-title">
              {
                (
                  {
                    editAnimal: "Editar animal.",
                    animal: "Adicionar animais ao rebanho.",
                    investor: "Mais uma pessoa para crescer junto.",
                    transaction: "Registrar movimentação.",
                    detail:
                      selectedAnimal?.tag ||
                      `ID ${selectedAnimal?.id.slice(0, 8)}`,
                    status: "Registrar morte do animal.",
                    purchase: "Comprar e vincular um animal.",
                    sale: "Vender um animal do rebanho.",
                    transfer: "Trocar o proprietário do animal.",
                    help: "Sua fazenda, com visão de futuro.",
                  } as Record<string, string | undefined>
                )[modal]
              }
            </h2>
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            {(modal === "purchase" ||
              modal === "sale" ||
              modal === "transfer") &&
              farm && (
                <AnimalTrade
                  key={`${modal}-${selectedAnimal?.id ?? "any"}`}
                  kind={modal}
                  farm={farm}
                  initialAnimal={selectedAnimal}
                  busy={busy}
                  onSave={save}
                />
              )}
            {modal === "editAnimal" && selectedAnimal && farm && (
              <AnimalEditor
                key={selectedAnimal.id}
                animal={selectedAnimal}
                farm={farm}
                busy={busy}
                onSave={save}
              />
            )}
            {modal === "animal" && (
              <form onSubmit={(e) => handleForm(e, "animal")}>
                <div className="form-grid">
                  <Field label="Quantidade de animais">
                    <input
                      name="quantity"
                      type="number"
                      min="1"
                      max="500"
                      defaultValue="1"
                      required
                    />
                    <small>
                      Os animais terão o mesmo sexo, nascimento, participante.
                      Cada um recebe um ID único.
                    </small>
                  </Field>
                  <Field label="Brinco / identificação (opcional)">
                    <input
                      name="tag"
                      placeholder="Ex.: CL. Em lote: CL-1, CL-2…"
                      maxLength={30}
                    />
                  </Field>
                  <Field label="Sexo">
                    <select name="sex">
                      <option value="F">Fêmea</option>
                      <option value="M">Macho</option>
                    </select>
                  </Field>
                  <Field label="Nascimento">
                    <input name="born" type="date" max={today()} required />
                  </Field>
                  <WeightField yieldPercent={farm?.settings.yield ?? 50} />
                  <Field label="Participante">
                    <select name="owner" required>
                      <option value="">Selecione</option>
                      {farm?.investors.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <p className="form-note">
                  Sem peso informado, o animal não entra na estimativa de valor
                  por arroba. Novas crias devem ser registradas com o
                  participante proprietário. Para uma compra, use “Comprar
                  gado”: o animal e a despesa são registrados juntos.
                </p>
                <Submit busy={busy} />
              </form>
            )}
            {modal === "investor" && (
              <form onSubmit={(e) => handleForm(e, "investor")}>
                <Field label="Nome completo">
                  <input
                    name="name"
                    required
                    placeholder="Nome do participante"
                    maxLength={100}
                  />
                </Field>
                <p className="form-note">
                  A participação será calculada automaticamente a partir dos
                  animais vinculados a essa pessoa.
                </p>
                <Submit busy={busy} />
              </form>
            )}
            {modal === "transaction" && (
              <form onSubmit={(e) => handleForm(e, "transaction")}>
                <div className="form-grid">
                  <Field label="Tipo">
                    <select name="kind">
                      <option value="despesa">Despesa</option>
                      <option value="receita">Receita</option>
                      <option value="aporte">Aporte</option>
                    </select>
                  </Field>
                  <Field label="Valor (R$)">
                    <input
                      name="amount"
                      type="number"
                      min=".01"
                      step=".01"
                      required
                    />
                  </Field>
                  <Field label="Data">
                    <input
                      type="date"
                      name="date"
                      defaultValue={today()}
                      required
                    />
                  </Field>
                  <Field label="Categoria">
                    <select name="category">
                      {[
                        "Nutrição",
                        "Sanidade",
                        "Mão de obra",
                        "Infraestrutura",
                        "Compra de gado",
                        "Venda de gado",
                        "Aporte",
                        "Outros",
                      ].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Descrição">
                  <input
                    name="description"
                    required
                    placeholder="Ex.: Suplementação mineral de outubro"
                    maxLength={150}
                  />
                </Field>
                <Field label="Participante (obrigatório em aportes)">
                  <select name="investor">
                    <option value="">Fazenda / despesa compartilhada</option>
                    {farm?.investors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Submit busy={busy} />
              </form>
            )}
            {modal === "detail" && selectedAnimal && farm && (
              <>
                <div className="animal-detail">
                  <span className="detail-animal">
                    <Fence size={60} />
                  </span>
                  <dl>
                    <div>
                      <dt>Categoria</dt>
                      <dd>
                        {category(selectedAnimal)} ·{" "}
                        {selectedAnimal.sex === "F" ? "Fêmea" : "Macho"}
                      </dd>
                    </div>
                    <div>
                      <dt>Nascimento</dt>
                      <dd>
                        {new Date(
                          selectedAnimal.born + "T12:00:00",
                        ).toLocaleDateString("pt-BR")}
                      </dd>
                    </div>
                    <div>
                      <dt>Peso vivo</dt>
                      <dd>
                        {weightLabel(
                          selectedAnimal.weight,
                          farm.settings.yield,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Participante</dt>
                      <dd>
                        {
                          farm.investors.find(
                            (i) => i.id === selectedAnimal.owner,
                          )?.name
                        }
                      </dd>
                    </div>
                    <div>
                      <dt>Valor estimado</dt>
                      <dd>
                        {money(
                          animalValue(selectedAnimal.weight, farm.settings),
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Situação</dt>
                      <dd>{selectedAnimal.status}</dd>
                    </div>
                  </dl>
                </div>
                <div className="animal-permanent-id">
                  <span>ID permanente deste animal</span>
                  <code>{selectedAnimal.id}</code>
                </div>
                {selectedAnimal.status === "ativo" && (
                  <div className="animal-detail-actions">
                    <button
                      className="button primary"
                      onClick={() => setModal("sale")}
                    >
                      <Banknote size={15} /> Vender
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setModal("transfer")}
                    >
                      <ArrowLeftRight size={15} /> Transferir
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setModal("status")}
                    >
                      Registrar morte
                    </button>
                  </div>
                )}
                <AnimalHistory farm={farm} animal={selectedAnimal} />
              </>
            )}
            {modal === "status" && selectedAnimal && (
              <form onSubmit={(e) => handleForm(e, "status")}>
                <input type="hidden" name="status" value="morto" />
                <p className="form-note">
                  A baixa de {selectedAnimal.tag} mantém o ID e o histórico,
                  atualiza as cotas e retira o animal do rebanho ativo. Não gera
                  movimentação de caixa.
                </p>
                <Field label="Data da morte">
                  <input
                    type="date"
                    name="date"
                    defaultValue={today()}
                    min={selectedAnimal.born}
                    max={today()}
                    required
                  />
                </Field>
                <Submit busy={busy} />
              </form>
            )}
            {modal === "help" && (
              <>
                <p className="help-text">
                  Calumbi reúne o rebanho Nelore, o patrimônio compartilhado e o
                  planejamento da fazenda. Comece cadastrando os participantes,
                  depois os animais e as movimentações financeiras.
                </p>
                <p className="help-text">
                  Nas projeções, explore cenários para antecipar os aportes
                  necessários. As premissas podem ser ajustadas em
                  Configurações.
                </p>
                <button
                  className="button primary"
                  onClick={() => {
                    setModal(null);
                    go("settings");
                  }}
                >
                  Ver configurações e metodologia <ArrowRight size={16} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  sub: ReactNode;
}) {
  return (
    <section className="metric card">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{sub}</div>
    </section>
  );
}
function CardHeading({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="card-heading">
      <div>
        <span className="section-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {right}
    </div>
  );
}
function ProjectionChart({
  data,
  compact = false,
  fibonacci = false,
}: {
  data: ReturnType<typeof project>;
  compact?: boolean;
  fibonacci?: boolean;
}) {
  return (
    <div className="projection-chart">
      <HerdChart data={data} compact={compact} fibonacci={fibonacci} />
    </div>
  );
}
function Transactions({
  transactions,
  investors,
}: {
  transactions: Transaction[];
  investors: Farm["investors"];
}) {
  return !transactions.length ? (
    <Empty text="O livro de caixa está pronto para o primeiro lançamento." />
  ) : (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Movimentação</th>
            <th>Categoria</th>
            <th>Data</th>
            <th>Responsável</th>
            <th className="align-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td>
                <div className="transaction-title">
                  <span
                    className={`transaction-icon ${t.kind === "despesa" ? "out" : "in"}`}
                  >
                    {t.kind === "despesa" ? (
                      <ArrowUpRight size={17} />
                    ) : (
                      <ArrowDownLeft size={17} />
                    )}
                  </span>
                  <span>
                    <strong>{t.description}</strong>
                    <small>
                      {t.kind === "aporte"
                        ? "Aporte de participante"
                        : t.kind === "despesa"
                          ? "Saída de caixa"
                          : "Entrada de caixa"}
                    </small>
                  </span>
                </div>
              </td>
              <td>
                <span className="soft-badge">{t.category}</span>
              </td>
              <td>
                {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
              </td>
              <td>
                {investors.find((i) => i.id === t.investor)?.name ?? "Fazenda"}
              </td>
              <td
                className={`align-right ${t.kind === "despesa" ? "" : "positive"}`}
              >
                <strong>
                  {t.kind === "despesa" ? "−" : "+"} {money(t.amount)}
                </strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Field({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {note && <small>{note}</small>}
    </label>
  );
}
function Submit({ busy }: { busy: boolean }) {
  return (
    <button className="button primary form-submit" disabled={busy}>
      {busy ? (
        <RefreshCw size={16} className="spinning" />
      ) : (
        <Check size={16} />
      )}{" "}
      {busy ? "Salvando…" : "Salvar registro"}
    </button>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty-inline">
      <Leaf size={25} />
      <p>{text}</p>
    </div>
  );
}
