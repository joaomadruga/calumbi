"use client";
import { useState } from "react";
import { type Animal } from "@/lib/model";
import { Maximize2, Minus, Plus, MapPin, Sprout } from "lucide-react";
const areas = [
  {
    name: "Rebanho Nelore",
    label: "Calumbi",
    d: "M170 85 L650 156 L488 489 L30 373 Z",
    x: 320,
    y: 240,
    color: "#b5c89b",
  },
];
export default function FarmMap({
  animals,
  onSelect,
}: {
  animals: Animal[];
  onSelect: (name: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  return (
    <div className="farm-map">
      <div className="map-top">
        <span className="map-chip">
          <span className="live-dot" /> VISÃO DA PROPRIEDADE
        </span>
        <span className="map-location">
          <MapPin size={13} /> Agreste, PE
        </span>
      </div>
      <svg
        viewBox="0 0 760 545"
        role="img"
        aria-label="Vista ilustrativa da Fazenda Calumbi"
        className="landscape"
      >
        <defs>
          <pattern
            id="grass"
            width="29"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="m4 10 2-4 2 4m13 10 2-4 2 4"
              stroke="#789565"
              strokeWidth=".7"
              fill="none"
              opacity=".3"
            />
          </pattern>
          <filter id="shadow">
            <feDropShadow
              dx="0"
              dy="5"
              stdDeviation="7"
              floodColor="#42523b"
              floodOpacity=".12"
            />
          </filter>
          <g id="tree">
            <ellipse
              cx="3"
              cy="9"
              rx="13"
              ry="5"
              fill="#52683d"
              opacity=".14"
            />
            <path d="M0 0v10" stroke="#7c7759" strokeWidth="3" />
            <ellipse cy="-4" rx="12" ry="15" fill="#7d9a64" />
            <ellipse cx="-4" cy="-7" rx="9" ry="12" fill="#94ad7c" />
          </g>
          <g id="cow">
            <ellipse
              cx="0"
              cy="0"
              rx="9"
              ry="4.8"
              fill="#f8f5e9"
              stroke="#7d846d"
              strokeWidth=".7"
            />
            <path d="m-5 3-1 4m9-4 1 4" stroke="#727965" strokeWidth="1.4" />
            <path
              d="m8-2 4-1 2 4-5 2"
              fill="#f6f3e9"
              stroke="#7d846d"
              strokeWidth=".7"
            />
            <path
              d="m11-3 0-2m2 3 2-1M-9 0l-3 3"
              fill="none"
              stroke="#727965"
              strokeWidth="1"
            />
          </g>
        </defs>
        <rect width="760" height="545" fill="#edf0e3" />
        <path
          d="M0 60Q220 20 340 80T760 75M0 470Q180 420 350 500T760 460"
          stroke="#e4e9d9"
          strokeWidth="55"
          fill="none"
        />
        <g
          transform={`translate(${380 * (1 - zoom)} ${272 * (1 - zoom)}) scale(${zoom})`}
        >
          <path
            d="M35 405 485 525 702 118"
            stroke="#ddd6bb"
            strokeWidth="20"
            fill="none"
          />
          <path
            d="M35 405 485 525 702 118"
            stroke="#f5eedb"
            strokeWidth="13"
            fill="none"
          />
          {areas.map((p) => (
            <g
              key={p.name}
              tabIndex={0}
              role="button"
              aria-label={`Ver rebanho: ${animals.length} animais`}
              onClick={() => onSelect("Todos")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect("Todos");
                }
              }}
              className="farm-area"
            >
              <path
                d={p.d}
                fill={p.color}
                stroke={true ? "#4a6845" : "#f7f7e9"}
                strokeWidth={true ? 3 : 4}
              />
              <path d={p.d} fill="url(#grass)" />
              {Array.from(
                {
                  length: Math.min(animals.length, 12),
                },
                (_, i) => (
                  <use
                    key={i}
                    href="#cow"
                    transform={`translate(${p.x - 52 + (i % 4) * 30 + (i % 2) * 5} ${p.y + 12 + Math.floor(i / 4) * 23}) scale(0.85)`}
                  />
                ),
              )}
              <g transform={`translate(${p.x - 52} ${p.y - 25})`}>
                <rect
                  width="118"
                  height="28"
                  rx="6"
                  fill="#f9faf1"
                  opacity=".93"
                />
                <text
                  x="10"
                  y="18"
                  fontSize="10"
                  fill="#3b5342"
                  fontWeight="600"
                >
                  {p.label} · {p.name}
                </text>
              </g>
            </g>
          ))}
          <path
            d="M661 305Q713 332 697 382T729 470"
            fill="none"
            stroke="#adc7c3"
            strokeWidth="19"
          />
          <path
            d="M663 305Q713 332 698 382T729 470"
            fill="none"
            stroke="#c3d8d1"
            strokeWidth="12"
          />
          {[
            [90, 148],
            [106, 123],
            [126, 100],
            [159, 65],
            [225, 72],
            [285, 82],
            [357, 95],
            [460, 102],
            [535, 119],
            [601, 130],
            [645, 216],
            [622, 262],
            [593, 319],
            [561, 387],
            [532, 444],
            [275, 475],
            [198, 450],
            [121, 431],
            [60, 331],
            [74, 285],
            [47, 362],
            [640, 423],
            [668, 450],
            [702, 250],
            [720, 198],
          ].map(([x, y], i) => (
            <use
              key={i}
              href="#tree"
              transform={`translate(${x} ${y}) scale(${0.7 + (i % 3) * 0.15})`}
            />
          ))}
          <g transform="translate(606 77)" filter="url(#shadow)">
            <path d="m-19 5 43 10v32L-19 36Z" fill="#efe7d2" />
            <path d="m24 15 20-13v31L24 47Z" fill="#d5c9aa" />
            <path d="m-24 5 22-22L48 0 24 18Z" fill="#aa7455" />
            <path d="m-2-17 22-9L48 0" fill="#bd8e67" />
            <path d="m-5 39 0-20 12 3v20" fill="#a59370" />
          </g>
          <g transform="translate(604 500)">
            <circle r="19" fill="#f8f9f1" />
            <path d="m0-12-5 17 5-3 5 3Z" fill="#4e6753" />
            <text x="-3" y="-25" fontSize="10" fill="#536b56">
              N
            </text>
          </g>
        </g>
      </svg>
      <div className="map-bottom">
        <button className="herd-map-summary" onClick={() => onSelect("Todos")}>
          <span className="map-pin-icon">
            <Sprout size={19} />
          </span>
          <span>
            <strong>Rebanho Nelore</strong>
            <small>
              {animals.length} animais · Ver rebanho <span>↗</span>
            </small>
          </span>
        </button>
        <div className="map-zoom">
          <button
            aria-label="Diminuir zoom"
            onClick={() => setZoom(Math.max(0.8, zoom - 0.1))}
          >
            <Minus size={15} />
          </button>
          <button
            aria-label="Aumentar zoom"
            onClick={() => setZoom(Math.min(1.4, zoom + 0.1))}
          >
            <Plus size={15} />
          </button>
          <button aria-label="Restaurar mapa" onClick={() => setZoom(1)}>
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
      <span className="map-disclaimer">
        Representação ilustrativa · sem georreferenciamento
      </span>
    </div>
  );
}
