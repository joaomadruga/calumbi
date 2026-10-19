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
  readableViewport,
  zoomAt,
} from "@/lib/network-layout";
import {
  genealogyNodes,
  familyIds,
  genealogyLayout,
  paginateFamilies,
} from "@/lib/genealogy";
import { cowStageLabel, cowAgeLabel } from "@/lib/cow-nodes";

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
  actual = false,
}: {
  actual?: boolean;
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
  const [page, setPage] = useState(0);
  const [viewportScale, setViewportScale] = useState(1);
  const [wheeling, setWheeling] = useState(false);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
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
  const cowGroups = useMemo(
    () =>
      Object.fromEntries(
        participants.map((person) => [
          person.id,
          genealogyNodes(
            cohortData ?? {},
            snapshot?.year ?? 0,
            person.id,
            adultMonths,
          ),
        ]),
      ),
    [cohortData, snapshot?.year, participants, adultMonths],
  );
  const allNodes = Object.values(cowGroups).flat();
  const {
    roots,
    pageCount,
    currentPage,
    ids: pageIds,
  } = paginateFamilies(allNodes, focusedOwner, page);
  const visibleFamily = selectedSource
    ? familyIds(allNodes, selectedSource)
    : pageIds;
  const treeLayouts = Object.fromEntries(
    participants.map((person) => [
      person.id,
      genealogyLayout(
        (cowGroups[person.id] ?? []).filter((n) =>
          visibleFamily.has(n.sourceIds[0]),
        ),
      ),
    ]),
  );
  const branchWidths = Object.fromEntries(
    participants.map((person) => {
      const xs = [...treeLayouts[person.id].values()].map((p) => p.x);
      return [
        person.id,
        xs.length ? Math.max(...xs) - Math.min(...xs) + 150 : 150,
      ];
    }),
  );
  const visiblePeople = participants.filter(
    (p) =>
      (!focusedOwner || p.id === focusedOwner) &&
      (!roots.length ||
        (cowGroups[p.id] ?? []).some((n) => visibleFamily.has(n.sourceIds[0]))),
  );
  const visibleOwners = new Set(visiblePeople.map((p) => p.id));
  let panelX = 0,
    panelY = 0,
    panelHeight = 0;
  const panelPositions = new Map<string, { x: number; y: number }>();
  for (const person of visiblePeople) {
    const width = branchWidths[person.id];
    const height =
      Math.max(0, ...[...treeLayouts[person.id].values()].map((p) => p.y)) +
      260;
    if (panelX && panelX + width > 1000) {
      panelX = 0;
      panelY += panelHeight + 80;
      panelHeight = 0;
    }
    panelPositions.set(person.id, { x: panelX + width / 2, y: panelY });
    panelX += width + 100;
    panelHeight = Math.max(panelHeight, height);
  }
  const panelCenter = panelPositions.size
    ? (Math.min(...[...panelPositions.values()].map((p) => p.x)) +
        Math.max(...[...panelPositions.values()].map((p) => p.x))) /
      2
    : 0;
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
    if (view === "top-down" && (!focusedOwner || focusedOwner === person.id)) {
      const position = panelPositions.get(person.id);
      branch.x = 500 + (position?.x ?? 0) - panelCenter;
      branch.y = (focusedOwner ? 150 : 245) + (position?.y ?? 0);
    }
    const animalNodes = (cowGroups[person.id] ?? []).filter((n) =>
      visibleFamily.has(n.sourceIds[0]),
    );
    const leaves = animalNodes.map((animal, n) => ({
      ...cowPosition(
        n,
        animalNodes.length,
        branch,
        angle,
        view,
        focusedOwner === person.id,
      ),
      ...(view === "top-down"
        ? {
            x:
              branch.x +
              (treeLayouts[person.id].get(animal.sourceIds[0])?.x ?? 0),
            y:
              branch.y +
              135 +
              (treeLayouts[person.id].get(animal.sourceIds[0])?.y ?? 0),
            tier: treeLayouts[person.id].get(animal.sourceIds[0])?.tier ?? 0,
          }
        : {}),
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
  const cameraPoints = focusedBranch
    ? [focusedBranch.branch, ...focusedBranch.leaves]
    : [
        ...branches
          .filter((b) => visibleOwners.has(b.person.id))
          .flatMap((b) => [b.branch, ...b.leaves]),
        { x: 500, y: view === "top-down" ? 85 : 340 },
      ];
  const camera = readableViewport(
    cameraPoints,
    0.95 / viewportScale,
    1.6 / viewportScale,
  );
  useEffect(() => {
    cameraRef.current = camera;
    setZoom(camera.zoom);
    setPan(camera.pan);
  }, [
    focusedOwner,
    currentPage,
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
  useEffect(() => {
    cameraRef.current = { zoom, pan };
  }, [zoom, pan]);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(() => {
      const rect = svg.getBoundingClientRect();
      if (rect.width && rect.height)
        setViewportScale(Math.min(rect.width / 1000, rect.height / 680));
    });
    observer.observe(svg);
    function wheel(event: WheelEvent) {
      event.preventDefault();
      const matrix = svg!.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      );
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 680 : 1);
      const next = zoomAt(
        cameraRef.current,
        cameraRef.current.zoom *
          Math.exp(-Math.max(-120, Math.min(120, delta)) * 0.003),
        point,
      );
      cameraRef.current = next;
      setZoom(next.zoom);
      setPan(next.pan);
      setWheeling(true);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => setWheeling(false), 120);
    }
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => {
      observer.disconnect();
      svg.removeEventListener("wheel", wheel);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
    };
  }, [!!snapshot]);
  const changeZoom = (factor: number) => {
    const next = zoomAt(cameraRef.current, cameraRef.current.zoom * factor, {
      x: 500,
      y: 340,
    });
    cameraRef.current = next;
    setZoom(next.zoom);
    setPan(next.pan);
  };
  if (!snapshot || !current) return null;
  const choose = (next: number) => {
    setPlaying(false);
    setYear(data[next].year);
  };
  const focusOn = (owner: string | null) => {
    setFocusedOwner(owner);
    setPage(0);
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
    const limitX = Math.max(
      1000,
      ...cameraPoints.map((p) => Math.abs(p.x - 500) * zoom + 500),
    );
    const limitY = Math.max(
      680,
      ...cameraPoints.map((p) => Math.abs(p.y - 340) * zoom + 340),
    );
    setPan({
      x: Math.max(
        -limitX,
        Math.min(limitX, initial.panX + (event.clientX - initial.x) / ratio),
      ),
      y: Math.max(
        -limitY,
        Math.min(limitY, initial.panY + (event.clientY - initial.y) / ratio),
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
            {actual
              ? "OS ANIMAIS DA FAZENDA HOJE"
              : "CADA ANIMAL, UMA PARTE DO FUTURO"}
          </span>
          <h2>
            {actual
              ? "Seu rebanho, de perto."
              : ownerName
                ? `A família de ${ownerName.split(" ")[0]}.`
                : "A árvore das próximas gerações."}
          </h2>
          <p>
            {actual
              ? "Somente animais ativos cadastrados, organizados por participante. Clique para aproximar e ver a idade."
              : "Mães acima, crias abaixo. Acompanhe as famílias e o ano de nascimento de cada geração."}
          </p>
        </div>
        {!actual && (
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
        )}
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
            <GitFork size={14} />{" "}
            {actual ? "Por participante" : "Árvore genealógica"}
          </button>
        </div>
        <select
          aria-label={
            actual ? "Filtrar animal cadastrado" : "Filtrar família pela matriz"
          }
          value={selectedSource ?? ""}
          onChange={(e) => {
            const source = e.target.value;
            setSelectedSource(source || null);
            setSelectedPart(0);
            const mother = Object.values(cowGroups)
              .flat()
              .find((n) => n.sourceIds[0] === source);
            if (mother) setFocusedOwner(mother.owner);
            setFocusRevision((v) => v + 1);
          }}
        >
          <option value="">
            {actual ? "Todos os animais" : "Todas as famílias"}
          </option>
          {Object.values(cowGroups)
            .flat()
            .filter(
              (n) =>
                (actual || n.sex === "F") &&
                !n.motherId &&
                (!focusedOwner || n.owner === focusedOwner),
            )
            .map((n) => (
              <option key={n.id} value={n.sourceIds[0]}>
                {participants.find((p) => p.id === n.owner)?.name} · {n.label} ·{" "}
                {n.birthYear}
              </option>
            ))}
          {!actual &&
            selectedCow &&
            (selectedCow.motherId || selectedCow.sex === "M") && (
              <option value={selectedSource!}>
                {selectedCow.label} · {selectedCow.birthYear}
              </option>
            )}
        </select>
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
      {!selectedSource && roots.length > 0 && (
        <div className="genealogy-navigation">
          <span>
            {actual ? "Animais" : "Famílias"} {currentPage * 6 + 1}–
            {Math.min((currentPage + 1) * 6, roots.length)} de {roots.length} ·
            role para ampliar, arraste para explorar
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Famílias anteriores"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {currentPage + 1} / {pageCount}
            </span>
            <button
              className="icon-button"
              aria-label="Próximas famílias"
              disabled={currentPage === pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
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
                ? snapshot.inferred
                  ? "Base inferida até hoje"
                  : "Hoje"
                : `+${index} ${index === 1 ? "ano" : "anos"}`}
            </span>
          </div>
        </div>
        <svg
          className={`radial-canvas ${view === "radial" ? "network-radial" : "network-hierarchy"} ${dragging ? "is-dragging" : ""} ${wheeling ? "is-wheeling" : ""}`}
          viewBox="0 0 1000 680"
          ref={svgRef}
          tabIndex={0}
          aria-keyshortcuts="+ - 0"
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "+" || e.key === "=") {
              e.preventDefault();
              changeZoom(1.25);
            }
            if (e.key === "-") {
              e.preventDefault();
              changeZoom(1 / 1.25);
            }
            if (e.key === "0") {
              e.preventDefault();
              cameraRef.current = camera;
              setZoom(camera.zoom);
              setPan(camera.pan);
            }
          }}
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
              .filter((b) => visibleOwners.has(b.person.id))
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
                    {leaves.map((leaf, n) => {
                      const mother = leaves.find((candidate) =>
                        candidate.animal.sourceIds.includes(
                          leaf.animal.motherId ?? "",
                        ),
                      );
                      const parent = mother ?? branch;
                      return (
                        <g key={leaf.animal.id}>
                          <path
                            d={
                              view === "top-down"
                                ? `M${parent.x},${parent.y + (mother ? 58 : 95)} V${(parent.y + (mother ? 58 : 95) + leaf.y - 19) / 2} H${leaf.x} V${leaf.y - 19}`
                                : `M${parent.x},${parent.y} L${leaf.x},${leaf.y}`
                            }
                            className={
                              mother
                                ? "genealogy-mother-link"
                                : "genealogy-owner-link"
                            }
                          >
                            <title>
                              {mother
                                ? `${mother.animal.label} → ${leaf.animal.label} · nascimento ${leaf.animal.birthYear} (projeção)`
                                : "Vínculo com o participante; mãe não informada"}
                            </title>
                          </path>
                          <g
                            transform={`translate(${leaf.x} ${leaf.y})`}
                            data-network-node="true"
                            className={`radial-cow-node ${leaf.animal.historical ? "genealogy-historical" : ""} ${selectedCow?.id === leaf.animal.id ? "is-chosen" : ""}`}
                            role="button"
                            tabIndex={0}
                            aria-label={`${leaf.animal.label}, nascimento ${leaf.animal.birthYear}, mãe ${mother?.animal.label ?? "não informada"}, ${leaf.animal.historical ? "somente ancestral histórico, fora do rebanho, " : ""}${cowStageLabel(leaf.animal.stage, leaf.animal.sex)}, ${cowAgeLabel(leaf.animal.minAge, leaf.animal.maxAge)}, ${decimal(leaf.animal.count)} cabeças de ${person.name}`}
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
                              className="genealogy-cow-name"
                              y="24"
                              textAnchor="middle"
                            >
                              {leaf.animal.label.length > 18
                                ? `${leaf.animal.label.slice(0, 17)}…`
                                : leaf.animal.label}
                            </text>
                            <text
                              className="genealogy-birth-year"
                              y="39"
                              textAnchor="middle"
                            >
                              {leaf.animal.historical
                                ? "Ancestral · "
                                : leaf.animal.inferred
                                  ? "Inferido "
                                  : leaf.animal.projected
                                    ? "Prev. "
                                    : leaf.animal.birthEstimated
                                      ? "Nasc. ≈ "
                                      : "Nasc. "}
                              {leaf.animal.birthYear}
                            </text>
                            <text
                              className={`radial-cow-age ${leaf.animal.stage}`}
                              y="53"
                              textAnchor="middle"
                            >
                              {leaf.animal.historical
                                ? "Fora do rebanho"
                                : cowAgeLabel(leaf.animal.minAge)}
                            </text>
                            <title>
                              {leaf.animal.label} · mãe:{" "}
                              {mother?.animal.label ?? "não informada"} ·{" "}
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
                    {
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
                    }
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
            <TinyCow /> Role para ampliar · arraste para mover ·{" "}
            {Math.round(zoom * viewportScale * 100)}%
          </span>
          <div className="radial-zoom">
            <button
              aria-label="Diminuir zoom do grafo"
              disabled={zoom <= 0.05}
              onClick={() => changeZoom(1 / 1.25)}
            >
              <Minus size={15} />
            </button>
            <button
              aria-label="Aumentar zoom do grafo"
              disabled={zoom >= 8}
              onClick={() => changeZoom(1.25)}
            >
              <Plus size={15} />
            </button>
            <button
              aria-label="Restaurar enquadramento legível"
              title="Restaurar visão"
              onClick={() => {
                setZoom(camera.zoom);
                setPan(camera.pan);
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
        <small>
          {actual
            ? "Clique num animal para aproximar."
            : "Clique numa vaquinha para aproximar sua família."}
        </small>
      </div>
      {!actual && (
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
              <span>Ano {snapshot.year}</span>
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
      )}
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
            <strong>
              {selectedCow.label} ·{" "}
              {cowStageLabel(selectedCow.stage, selectedCow.sex)}
            </strong>
            <span>
              {cowAgeLabel(selectedCow.minAge, selectedCow.maxAge)} em{" "}
              {snapshot.year}
              {selectedCow.birthYear
                ? ` · nascimento em ${selectedCow.birthYear}`
                : ""}
            </span>
          </div>
          <span>
            {selectedCow.historical
              ? "Ancestral fora do rebanho atual"
              : actual
                ? `${decimal(selectedCow.count)} animal cadastrado`
                : `${decimal(selectedCow.count)} cabeças esperadas`}
          </span>
          {!actual && (
            <p>
              Mãe:{" "}
              {Object.values(cowGroups)
                .flat()
                .find((n) => n.sourceIds.includes(selectedCow.motherId ?? ""))
                ?.label ?? "não informada"}
              . O ramo mostra as ancestrais e descendentes projetadas.
              Ancestrais fora do rebanho aparecem apagadas para preservar o
              parentesco, sem entrar nas contagens.
            </p>
          )}
        </div>
      )}
      {fibonacci && (
        <div className="radial-fibonacci">
          Hipótese matemática de Fibonacci em {snapshot.year}:{" "}
          <strong>{decimal(current.fibonacci, 0)} cabeças</strong>. Não
          participa dos aportes.
        </div>
      )}
      {!actual && (
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
                  ? current.inferred
                    ? "BASE SIMULADA ATÉ HOJE"
                    : "A FAZENDA DE HOJE"
                  : "O QUE ESTE ANO PEDE"}
            </span>
            <h3>
              {current.year}
              <span> · {decimal(current.herd)} cabeças</span>
            </h3>
            <p>
              {index === 0
                ? current.inferred
                  ? `Base simulada até hoje: inclui ${decimal(current.inferredHead ?? 0)} crias esperadas desde as compras, sem cadastrá-las como gado real. ${decimal(current.births)} nascimentos inferidos neste ano até hoje. O caixa parte do saldo real atual.`
                  : "A posição atual da fazenda, antes dos próximos ciclos de criação."
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
              <strong>
                {money(index === 0 ? current.cash : current.costs)}
              </strong>
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
                      <small>
                        {decimal(person.share * 100)}% da cota atual
                      </small>
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
      )}
      <div className="chart-footnote">
        {actual ? (
          "Esta visão mostra apenas os animais ativos cadastrados. Não inclui crias inferidas, nascimentos futuros, vendas simuladas ou parentesco não informado."
        ) : (
          <>
            Inferência desde as datas de compra cadastradas: os nascimentos
            anteriores a hoje são estimados, não registros reais. Não são
            gravados animais nem receitas passadas. Árvore materna projetada:
            cada cria fica ligada à mãe usada na simulação. Para os animais já
            cadastrados, a mãe não foi informada e nenhum parentesco é
            inventado. Valores fracionários são expectativas de nascimento e
            sobrevivência. Ancestrais apagadas não fazem parte do rebanho atual.
            Capacidade compartilhada: {capacity} cabeças. Custos e aportes são
            rateados pelo rebanho médio de cada ano.
          </>
        )}
      </div>
    </section>
  );
}
