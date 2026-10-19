"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  Wallet,
  ArrowLeft,
  Network,
  GitFork,
} from "lucide-react";
import {
  type Projection,
  type ProjectedCohort,
  decimal,
  money,
} from "@/lib/model";
import CowGlyph from "./cow-glyph";
import {
  type NetworkView,
  ownerPosition,
  cowPosition,
  focusViewport,
} from "@/lib/network-layout";
import { makeCowNodes, cowStageLabel, cowAgeLabel } from "@/lib/cow-nodes";

type Participant = { id: string; name: string; color: string; share: number };
const palette = [
  "#719da1",
  "#e6a35e",
  "#d78199",
  "#858bd0",
  "#83b49a",
  "#78a9d1",
  "#b49ac5",
  "#c1b65f",
];
const center = { x: 500, y: 340 };
function TinyCow() {
  return (
    <svg
      viewBox="0 0 52 36"
      fill="currentColor"
      width="17"
      height="13"
      aria-hidden="true"
    >
      <path d="M9 12c1-4 5-6 8-5l3 3h12c2-2 3-5 6-5l3 4 5 2 3 5-2 5-7-1-3-4-2 3-1 11h-4l-1-9H17l-1 9h-4l-1-11-2-4-2 4-3-1 2-9 3-1Zm30-5-2-5 4 3 3-1-1 5-4-2Z" />
    </svg>
  );
}

export default function HerdEvolution({
  data,
  capacity,
  participants,
  fibonacci = false,
  ownerName,
  participantData,
  cohortData,
  adultMonths = 36,
  onResetScope,
}: {
  data: Projection[];
  capacity: number;
  participants: Participant[];
  fibonacci?: boolean;
  ownerName?: string;
  participantData?: Record<string, Projection[]>;
  cohortData?: Record<number, ProjectedCohort[]>;
  adultMonths?: number;
  onResetScope?: () => void;
}) {
  const [year, setYear] = useState(data[0]?.year ?? 0);
  const [playing, setPlaying] = useState(false);
  const [focusedOwner, setFocusedOwner] = useState<string | null>(
    participants.length === 1 ? participants[0].id : null,
  );
  const [view, setView] = useState<NetworkView>("top-down");
  const [zoom, setZoom] = useState(1);
  const [selectedPart, setSelectedPart] = useState(0);
  const [focusRevision, setFocusRevision] = useState(0);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const index = Math.max(
    0,
    data.findIndex((row) => row.year === year),
  );
  const snapshot = data[index];
  const current =
    (focusedOwner
      ? participantData?.[focusedOwner]?.find(
          (row) => row.year === snapshot?.year,
        )
      : null) ?? snapshot;
  const detailName =
    participants.find((p) => p.id === focusedOwner)?.name ?? ownerName;
  const detailParticipants = focusedOwner
    ? participants.filter((p) => p.id === focusedOwner)
    : participants;
  const ownerIds = Object.keys(participantData ?? {});
  const maxBranch = Math.max(
    1,
    ...participants.flatMap((person) =>
      (participantData?.[person.id] ?? []).map((row) => row.herd),
    ),
  );
  const unit = useMemo(() => {
    let scale = 1;
    for (const cohorts of Object.values(cohortData ?? {}))
      for (const person of participants) {
        const nodes = makeCowNodes(
          cohorts.filter((c) => c.owner === person.id),
          adultMonths,
        );
        scale = Math.max(scale, nodes[0]?.unit ?? 1);
      }
    return scale;
  }, [cohortData, participants, adultMonths]);
  const cowGroups = Object.fromEntries(
    participants.map((person) => [
      person.id,
      makeCowNodes(
        (cohortData?.[snapshot?.year ?? 0] ?? []).filter(
          (c) => c.owner === person.id,
        ),
        adultMonths,
        unit,
      ),
    ]),
  );
  const selectedCow = selectedSource
    ? Object.values(cowGroups)
        .flat()
        .find(
          (node) =>
            node.sourceIds.includes(selectedSource) &&
            Number(node.id.split(":").at(-1)) === selectedPart,
        )
    : null;
  const colorFor = (person: Participant, position: number) =>
    palette[
      Math.max(0, ownerIds.length ? ownerIds.indexOf(person.id) : position) %
        palette.length
    ];
  const branches = participants.map((person, position) => {
    const row = participantData?.[person.id]?.find(
      (r) => r.year === snapshot?.year,
    );
    const count =
      row?.herd ??
      (ownerName
        ? (snapshot?.herd ?? 0)
        : (snapshot?.herd ?? 0) * person.share);
    const angle =
      participants.length === 1
        ? -0.55
        : -Math.PI * 0.75 + (position * Math.PI * 2) / participants.length;
    const branch = ownerPosition(
      position,
      participants.length,
      view,
      focusedOwner === person.id,
    );
    const animalNodes = cowGroups[person.id] ?? [];
    const leaves = animalNodes.map((animal, n) => ({
      ...cowPosition(
        n,
        animalNodes.length,
        branch,
        angle,
        view,
        focusedOwner === person.id,
      ),
      animal,
    }));
    return {
      person,
      position,
      count,
      branch,
      color: colorFor(person, position),
      radius: 23 + Math.min(18, Math.sqrt(Math.max(0, count) / maxBranch) * 18),
      leaves,
    };
  });
  const focusedBranch = branches.find(
    (branch) => branch.person.id === focusedOwner,
  );
  const focusedLeaf = selectedSource
    ? focusedBranch?.leaves.find(
        (leaf) =>
          leaf.animal.sourceIds.includes(selectedSource) &&
          Number(leaf.animal.id.split(":").at(-1)) === selectedPart,
      )
    : undefined;
  const cameraPoints = selectedSource
    ? focusedLeaf
      ? [focusedLeaf]
      : []
    : focusedBranch
      ? [focusedBranch.branch, ...focusedBranch.leaves]
      : [];
  const camera = focusViewport(cameraPoints, selectedSource ? 2.5 : 1.8);
  useEffect(() => {
    if (!focusedOwner) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    setZoom(camera.zoom);
    setPan(camera.pan);
  }, [
    focusedOwner,
    selectedSource,
    selectedPart,
    focusRevision,
    view,
    camera.zoom,
    camera.pan.x,
    camera.pan.y,
  ]);
  useEffect(() => {
    if (!playing) return;
    if (index >= data.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setYear(data[index + 1].year), 1900);
    return () => clearTimeout(timer);
  }, [playing, index, data]);
  if (!snapshot || !current) return null;
  const choose = (next: number) => {
    setPlaying(false);
    setYear(data[next].year);
  };
  const focusOn = (owner: string | null) => {
    setFocusedOwner(owner);
    setSelectedSource(null);
    setFocusRevision((value) => value + 1);
  };
  const beginDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (
      event.button !== 0 ||
      (event.target as Element).closest("[data-network-node]")
    )
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setDragging(true);
  };
  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    const initial = drag.current,
      rect = event.currentTarget.getBoundingClientRect();
    if (
      !initial ||
      initial.id !== event.pointerId ||
      !rect.width ||
      !rect.height
    )
      return;
    const ratio = Math.min(rect.width / 1000, rect.height / 680);
    setPan({
      x: Math.max(
        -1000,
        Math.min(1000, initial.panX + (event.clientX - initial.x) / ratio),
      ),
      y: Math.max(
        -680,
        Math.min(680, initial.panY + (event.clientY - initial.y) / ratio),
      ),
    });
  };
  const stopDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  return (
    <section className="card herd-evolution radial-evolution">
      <div className="card-heading herd-evolution-heading">
        <div>
          <span className="section-eyebrow">
            CADA ANIMAL, UMA PARTE DO FUTURO
          </span>
          <h2>
            {ownerName
              ? `A rede de ${ownerName.split(" ")[0]}.`
              : "O futuro da Calumbi, conectado."}
          </h2>
          <p>
            Explore os ramos de cada integrante e veja o rebanho ganhar novos
            nós ao longo dos anos.
          </p>
        </div>
        <button
          className={`button ${playing ? "secondary" : "primary"}`}
          aria-pressed={playing}
          onClick={() => {
            if (index === data.length - 1) setYear(data[0].year);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}{" "}
          {playing ? "Pausar" : "Ver evolução"}
        </button>
      </div>
      <div className="network-view-toolbar">
        <div
          className="network-view-switch"
          role="group"
          aria-label="Organização do grafo"
        >
          <button
            className={view === "radial" ? "active" : ""}
            aria-pressed={view === "radial"}
            onClick={() => setView("radial")}
          >
            <Network size={14} /> Radial
          </button>
          <button
            className={view === "top-down" ? "active" : ""}
            aria-pressed={view === "top-down"}
            onClick={() => setView("top-down")}
          >
            <GitFork size={14} /> De cima para baixo
          </button>
        </div>
        {focusedOwner ? (
          <div className="network-focus-breadcrumb">
            <button
              onClick={() => {
                if (ownerName && onResetScope) onResetScope();
                else focusOn(null);
              }}
            >
              <ArrowLeft size={13} /> Todos os integrantes
            </button>
            {selectedSource && (
              <button onClick={() => focusOn(focusedOwner)}>
                Rebanho de {detailName?.split(" ")[0]}
              </button>
            )}
          </div>
        ) : (
          <span>Clique em um integrante para aproximar e isolar.</span>
        )}
      </div>
      <div
        className={`radial-canvas-shell ${view === "top-down" ? "network-top-down" : ""}`}
      >
        <div className="radial-canvas-top">
          <span>
            <span
              className={playing ? "network-live is-playing" : "network-live"}
            />
            {playing ? "EVOLUÇÃO EM MOVIMENTO" : "MAPA DO REBANHO"}
          </span>
          <div className="radial-year-stamp">
            <strong>{snapshot.year}</strong>
            <span>
              {index === 0
                ? "Hoje"
                : `+${index} ${index === 1 ? "ano" : "anos"}`}
            </span>
          </div>
        </div>
        <svg
          className={`radial-canvas ${view === "radial" ? "network-radial" : "network-hierarchy"} ${dragging ? "is-dragging" : ""}`}
          viewBox="0 0 1000 680"
          ref={svgRef}
          role="group"
          aria-label={`Rede do rebanho em ${snapshot.year}: ${decimal(snapshot.herd)} cabeças. Selecione um integrante para ver os detalhes.`}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onLostPointerCapture={stopDrag}
        >
          <g
            className="network-camera"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) translate(500px, 340px) scale(${zoom}) translate(-500px, -340px)`,
            }}
          >
            {branches
              .filter((b) => !focusedOwner || b.person.id === focusedOwner)
              .map(({ person, count, branch, color, radius, leaves }) => {
                return (
                  <g
                    key={person.id}
                    className="radial-branch"
                    style={{ color }}
                  >
                    {!focusedOwner && (
                      <line
                        x1={center.x}
                        y1={view === "top-down" ? 85 : center.y}
                        x2={branch.x}
                        y2={branch.y}
                        className="radial-trunk"
                      />
                    )}
                    {leaves
                      .filter(
                        (leaf) =>
                          !selectedSource || leaf.animal.id === selectedCow?.id,
                      )
                      .map((leaf, n) => {
                        const parents = leaves.filter(
                          (candidate) => candidate.tier === leaf.tier - 1,
                        );
                        const parent =
                          leaf.tier === 0
                            ? branch
                            : parents.reduce(
                                (best, candidate) =>
                                  Math.hypot(
                                    candidate.x - leaf.x,
                                    candidate.y - leaf.y,
                                  ) <
                                  Math.hypot(best.x - leaf.x, best.y - leaf.y)
                                    ? candidate
                                    : best,
                                parents[0] ?? branch,
                              );
                        return (
                          <g key={leaf.animal.id}>
                            {!selectedSource && (
                              <line
                                x1={view === "top-down" ? branch.x : parent.x}
                                y1={view === "top-down" ? branch.y : parent.y}
                                x2={leaf.x}
                                y2={leaf.y}
                                className="radial-twig"
                              />
                            )}
                            <g
                              transform={`translate(${leaf.x} ${leaf.y})`}
                              data-network-node="true"
                              className={`radial-cow-node ${selectedCow?.id === leaf.animal.id ? "is-chosen" : ""}`}
                              role="button"
                              tabIndex={0}
                              aria-label={`${cowStageLabel(leaf.animal.stage, leaf.animal.sex)}, ${cowAgeLabel(leaf.animal.minAge, leaf.animal.maxAge)}, ${decimal(leaf.animal.count)} cabeças de ${person.name}`}
                              onClick={() => {
                                setSelectedSource(leaf.animal.sourceIds[0]);
                                setSelectedPart(
                                  Number(leaf.animal.id.split(":").at(-1)),
                                );
                                setFocusedOwner(person.id);
                                setFocusRevision((value) => value + 1);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelectedSource(leaf.animal.sourceIds[0]);
                                  setSelectedPart(
                                    Number(leaf.animal.id.split(":").at(-1)),
                                  );
                                  setFocusedOwner(person.id);
                                  setFocusRevision((value) => value + 1);
                                }
                              }}
                            >
                              <ellipse
                                className="radial-cow-focus"
                                cy="1"
                                rx="21"
                                ry="24"
                              />
                              <g
                                className="radial-cow-float"
                                style={{ animationDelay: `${n * 0.13}s` }}
                              >
                                <g
                                  transform={`translate(${-28 * (leaf.animal.stage === "newborn" ? 0.45 : leaf.animal.stage === "young" ? 0.53 : 0.6)} ${-20 * (leaf.animal.stage === "newborn" ? 0.45 : leaf.animal.stage === "young" ? 0.53 : 0.6)}) scale(${leaf.animal.stage === "newborn" ? 0.45 : leaf.animal.stage === "young" ? 0.53 : 0.6})`}
                                >
                                  <CowGlyph
                                    stage={leaf.animal.stage}
                                    color={color}
                                  />
                                </g>
                              </g>
                              <text
                                className={`radial-cow-age ${leaf.animal.stage}`}
                                y="22"
                                textAnchor="middle"
                              >
                                {leaf.animal.stage === "newborn"
                                  ? "Bebê"
                                  : leaf.animal.minAge === leaf.animal.maxAge
                                    ? `${Math.floor(leaf.animal.minAge / 12)}a`
                                    : `${Math.floor(leaf.animal.minAge / 12)}–${Math.floor(leaf.animal.maxAge / 12)}a`}
                              </text>
                              <title>
                                {person.name} ·{" "}
                                {cowStageLabel(
                                  leaf.animal.stage,
                                  leaf.animal.sex,
                                )}{" "}
                                ·{" "}
                                {cowAgeLabel(
                                  leaf.animal.minAge,
                                  leaf.animal.maxAge,
                                )}{" "}
                                · {decimal(leaf.animal.count)} cabeças.{" "}
                                {leaf.animal.birthYear
                                  ? `Nascidas em ${leaf.animal.birthYear}.`
                                  : ""}
                              </title>
                            </g>
                          </g>
                        );
                      })}
                    {!selectedSource && (
                      <g
                        transform={`translate(${branch.x} ${branch.y})`}
                        className={`radial-owner ${focusedOwner === person.id ? "is-focused" : ""}`}
                        data-network-node="true"
                        role="button"
                        tabIndex={0}
                        aria-pressed={focusedOwner === person.id}
                        aria-label={`${person.name}, ${decimal(count)} cabeças em ${snapshot.year}. Ver detalhes.`}
                        onClick={() => focusOn(person.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            focusOn(person.id);
                          }
                        }}
                      >
                        <circle className="radial-owner-ring" r={radius + 7} />
                        <circle
                          r={radius}
                          fill={color}
                          opacity={count > 0 ? 1 : 0.28}
                        />
                        <text
                          className="radial-owner-count"
                          textAnchor="middle"
                          y="6"
                        >
                          {decimal(count, 0)}
                        </text>
                        <text
                          className="radial-owner-name"
                          textAnchor="middle"
                          y={radius + 25}
                        >
                          {person.name}
                        </text>
                        <text
                          className="radial-owner-subtitle"
                          textAnchor="middle"
                          y={radius + 42}
                        >
                          {decimal(count)} cabeças
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            {!focusedOwner && (
              <g
                transform={
                  view === "top-down"
                    ? "translate(500 85)"
                    : "translate(500 340)"
                }
                className="radial-root"
                role="button"
                data-network-node="true"
                tabIndex={0}
                aria-label={`Ver total: ${decimal(snapshot.herd)} cabeças em ${snapshot.year}`}
                onClick={() => focusOn(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    focusOn(null);
                  }
                }}
              >
                <circle className="radial-root-pulse" r="64" />
                <circle className="radial-root-ring" r="65" />
                <circle r="56" fill="#8587cf" />
                <g
                  transform="translate(-24 -29) scale(.9)"
                  className="radial-root-glyph"
                >
                  <CowGlyph color="#65708b" />
                </g>
                <text y="34" textAnchor="middle" className="radial-root-count">
                  {decimal(snapshot.herd, 0)}
                </text>
                <text y="88" textAnchor="middle" className="radial-root-label">
                  {ownerName ? ownerName.toUpperCase() : "FAZENDA CALUMBI"}
                </text>
                <text
                  y="107"
                  textAnchor="middle"
                  className="radial-root-subtitle"
                >
                  {decimal(snapshot.herd)} cabeças · {snapshot.year}
                </text>
              </g>
            )}
          </g>
        </svg>
        {selectedSource && !selectedCow && (
          <div className="network-empty-focus">
            <strong>Este animal ou grupo saiu da projeção.</strong>
            <p>
              Não há sobreviventes deste grupo no rebanho em {snapshot.year}.
            </p>
            <button onClick={() => focusOn(focusedOwner)}>
              Voltar ao rebanho do integrante
            </button>
          </div>
        )}
        <div className="radial-canvas-bottom">
          <span>
            <TinyCow /> Cada vaquinha representa até {decimal(unit)}{" "}
            {unit === 1 ? "animal" : "animais"}
          </span>
          <div className="radial-zoom">
            <button
              aria-label="Diminuir zoom do grafo"
              disabled={zoom <= 0.7}
              onClick={() => setZoom(Math.max(0.7, zoom - 0.2))}
            >
              <Minus size={15} />
            </button>
            <button
              aria-label="Aumentar zoom do grafo"
              disabled={zoom >= 2.5}
              onClick={() => setZoom(Math.min(2.5, zoom + 0.2))}
            >
              <Plus size={15} />
            </button>
            <button
              aria-label={
                focusedOwner ? "Enquadrar seleção" : "Enquadrar todo o grafo"
              }
              onClick={() => {
                if (focusedOwner) {
                  setZoom(camera.zoom);
                  setPan(camera.pan);
                } else {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }
              }}
            >
              <Maximize2 size={15} />
            </button>
          </div>
        </div>
      </div>
      <div className="cow-life-legend">
        <span>
          <i className="newborn" /> Recém-nascida · até 11 meses
        </span>
        {adultMonths > 12 && (
          <span>
            <i className="young" /> Jovem · 12 a {adultMonths - 1} meses
          </span>
        )}
        <span>
          <i className="adult" /> Adulta · {Math.max(12, adultMonths)}+ meses
        </span>
        <small>Clique numa vaquinha para ver a idade.</small>
      </div>
      <div className="radial-time-control">
        <button
          className="icon-button"
          aria-label="Ano anterior"
          disabled={index === 0}
          onClick={() => choose(index - 1)}
        >
          <ChevronLeft size={19} />
        </button>
        <div>
          <label htmlFor="herd-year-range">
            {data[0].year}
            <span>Deslize para explorar os anos</span>
            {data.at(-1)?.year}
          </label>
          <input
            id="herd-year-range"
            type="range"
            min="0"
            max={Math.max(0, data.length - 1)}
            step="1"
            value={index}
            aria-label="Ano da projeção"
            aria-valuetext={`${snapshot.year}: ${decimal(snapshot.herd)} cabeças`}
            onChange={(e) => choose(Number(e.target.value))}
          />
        </div>
        <button
          className="icon-button"
          aria-label="Próximo ano"
          disabled={index === data.length - 1}
          onClick={() => choose(index + 1)}
        >
          <ChevronRight size={19} />
        </button>
      </div>
      <div className="radial-people-legend">
        <button
          className={!focusedOwner ? "is-active" : ""}
          aria-pressed={!focusedOwner}
          onClick={() => {
            if (ownerName && onResetScope) onResetScope();
            else focusOn(null);
          }}
        >
          Todos
        </button>
        {participants.map((person, position) => (
          <button
            key={person.id}
            className={focusedOwner === person.id ? "is-active" : ""}
            aria-pressed={focusedOwner === person.id}
            onClick={() => focusOn(person.id)}
          >
            <i style={{ background: colorFor(person, position) }} />
            {person.name}
            <strong>
              {decimal(
                participantData?.[person.id]?.find(
                  (row) => row.year === snapshot.year,
                )?.herd ?? 0,
              )}
            </strong>
          </button>
        ))}
      </div>
      {selectedCow && (
        <div className="cow-age-inspector" aria-live="polite">
          <div>
            <strong>{cowStageLabel(selectedCow.stage, selectedCow.sex)}</strong>
            <span>
              {cowAgeLabel(selectedCow.minAge, selectedCow.maxAge)} em{" "}
              {snapshot.year}
              {selectedCow.birthYear
                ? ` · nascimento em ${selectedCow.birthYear}`
                : ""}
            </span>
          </div>
          <span>{decimal(selectedCow.count)} cabeças representadas</span>
          <p>
            Ao avançar um ano, a idade aumenta 12 meses. Animais vendidos,
            descartados ou sem sobrevivência projetada deixam a rede.
          </p>
        </div>
      )}
      {fibonacci && (
        <div className="radial-fibonacci">
          Hipótese matemática de Fibonacci em {snapshot.year}:{" "}
          <strong>{decimal(current.fibonacci, 0)} cabeças</strong>. Não
          participa dos aportes.
        </div>
      )}
      <div
        className="herd-year-detail"
        key={`${current.year}-${focusedOwner ?? "farm"}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="herd-detail-intro">
          <span className="section-eyebrow">
            {detailName
              ? `REBANHO DE ${detailName.toUpperCase()}`
              : index === 0
                ? "A FAZENDA DE HOJE"
                : "O QUE ESTE ANO PEDE"}
          </span>
          <h3>
            {current.year}
            <span> · {decimal(current.herd)} cabeças</span>
          </h3>
          <p>
            {index === 0
              ? "A posição atual da fazenda, antes dos próximos ciclos de criação."
              : `${decimal(current.births)} nascimentos, ${decimal(current.deaths)} mortes e ${decimal(current.sales)} vendas e descartes no ano.`}
          </p>
        </div>
        <div className="herd-detail-numbers">
          <div>
            <span>Patrimônio estimado</span>
            <strong>{money(current.value)}</strong>
          </div>
          <div>
            <span>
              {index === 0
                ? detailName
                  ? "Parcela do caixa comum"
                  : "Caixa disponível"
                : "Custo de manter no ano"}
            </span>
            <strong>{money(index === 0 ? current.cash : current.costs)}</strong>
          </div>
          <div>
            <span>Aporte necessário no ano</span>
            <strong
              className={current.contribution > 0 ? "warning" : "positive"}
            >
              {money(current.contribution)}
            </strong>
          </div>
        </div>
        {index > 0 && detailParticipants.length > 0 && (
          <div className="herd-detail-shares">
            <span>
              <Wallet size={13} /> Como fica para cada pessoa
            </span>
            <div>
              {detailParticipants.map((person) => (
                <span key={person.id}>
                  <i style={{ background: person.color }} />
                  <span>
                    {person.name}
                    <small>{decimal(person.share * 100)}% da cota atual</small>
                  </span>
                  <strong>
                    {money(
                      participantData?.[person.id]?.find(
                        (row) => row.year === current.year,
                      )?.contribution ?? current.contribution * person.share,
                    )}
                  </strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="chart-footnote">
        Núcleo: rebanho total. Ramos: integrantes. Nós menores: grupos de
        animais projetados, sem representar parentesco real. A rede muda com os
        nascimentos, mortes e vendas. Capacidade compartilhada: {capacity}{" "}
        cabeças. Custos e aportes são rateados pelo rebanho médio de cada ano.
      </div>
    </section>
  );
}
