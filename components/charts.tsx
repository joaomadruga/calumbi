"use client";
import { useId, useState } from "react";
import { type Projection, decimal } from "@/lib/model";
export function ShareChart({
  shares,
}: {
  shares: { id: string; name: string; count: number; color: string }[];
}) {
  const total = shares.reduce((v, s) => v + s.count, 0);
  let offset = 0;
  const r = 74,
    c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 230 190"
      className="share-chart"
      role="img"
      aria-label={shares.map((s) => `${s.name}: ${s.count} cabeças`).join(", ")}
    >
      <circle
        cx="115"
        cy="95"
        r={r}
        fill="none"
        stroke="#f0f3e9"
        strokeWidth="17"
      />
      {shares
        .filter((s) => s.count > 0)
        .map((s) => {
          const length = (s.count / (total || 1)) * c;
          const start = offset;
          offset += length;
          return (
            <circle
              key={s.id}
              cx="115"
              cy="95"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="17"
              strokeDasharray={`${Math.max(0, length - 4)} ${c - Math.max(0, length - 4)}`}
              strokeDashoffset={-start}
              transform="rotate(-90 115 95)"
            >
              <title>
                {s.name}: {decimal((s.count / (total || 1)) * 100)}%
              </title>
            </circle>
          );
        })}
    </svg>
  );
}
export function HerdChart({
  data,
  compact = false,
  fibonacci = false,
}: {
  data: Projection[];
  compact?: boolean;
  fibonacci?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const [hover, setHover] = useState<number | null>(null);
  const width = 700,
    height = compact ? 210 : 320,
    left = 45,
    right = 25,
    top = 25,
    bottom = 35,
    plotW = width - left - right,
    plotH = height - top - bottom;
  const ceiling = Math.max(
    10,
    ...data.map((d) => Math.max(d.herd, fibonacci ? d.fibonacci : 0)),
  );
  const max = Math.ceil(ceiling / 5 / 10) * 10 * 5;
  const x = (i: number) => left + (i / (data.length - 1 || 1)) * plotW;
  const y = (n: number) => top + (1 - n / max) * plotH;
  const points = (key: "herd" | "fibonacci") =>
    data.map((d, i) => `${x(i)},${y(d[key])}`).join(" ");
  const area = `M${left} ${top + plotH} L${data.map((d, i) => `${x(i)} ${y(d.herd)}`).join(" L")} L${x(data.length - 1)} ${top + plotH} Z`;
  const selected = hover === null ? null : data[hover];
  return (
    <div className={`native-chart ${compact ? "compact" : ""}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Projeção de ${data[0]?.herd ?? 0} para ${decimal(data.at(-1)?.herd ?? 0)} cabeças em ${data.at(-1)?.year}. ${fibonacci ? "Comparação matemática de Fibonacci habilitada." : ""}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#779765" stopOpacity=".2" />
            <stop offset="100%" stopColor="#779765" stopOpacity=".015" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => {
          const n = (max * i) / 4;
          return (
            <g key={i}>
              <line
                x1={left}
                y1={y(n)}
                x2={width - right}
                y2={y(n)}
                stroke="#e9eee1"
                strokeDasharray="3 5"
              />
              <text
                x={left - 12}
                y={y(n) + 4}
                textAnchor="end"
                fill="#9aa78e"
                fontSize="10"
              >
                {n >= 1000 ? `${decimal(n / 1000)}k` : decimal(n, 0)}
              </text>
            </g>
          );
        })}
        <path d={area} fill={`url(#${id})`} />
        <polyline
          points={points("herd")}
          fill="none"
          stroke="#779465"
          strokeWidth="2.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {fibonacci && (
          <polyline
            points={points("fibonacci")}
            fill="none"
            stroke="#bc8b54"
            strokeWidth="2"
            strokeDasharray="6 5"
          />
        )}
        {data.map((d, i) => (
          <g key={d.year}>
            {(data.length < 12 || i % 2 === 0) && (
              <text
                x={x(i)}
                y={height - 10}
                fill="#9aa78e"
                fontSize="10"
                textAnchor="middle"
              >
                {d.year}
              </text>
            )}
            <rect
              x={x(i) - plotW / (data.length - 1 || 1) / 2}
              y={top}
              width={plotW / (data.length - 1 || 1)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          </g>
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={top}
              y2={top + plotH}
              stroke="#b9c5aa"
              strokeDasharray="4 3"
            />
            <circle
              cx={x(hover)}
              cy={y(data[hover].herd)}
              r="4"
              fill="#426239"
              stroke="white"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
      {selected && (
        <div
          className="chart-tooltip"
          style={{
            left: `${Math.min(75, Math.max(10, (hover! / (data.length - 1)) * 100))}%`,
          }}
        >
          <strong>{selected.year}</strong>
          <span>Rebanho: {decimal(selected.herd)} cabeças</span>
          {fibonacci && <span>Fibonacci: {decimal(selected.fibonacci)}</span>}
        </div>
      )}
    </div>
  );
}
