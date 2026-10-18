import type { CowStage } from "@/lib/cow-nodes";

/** SVG geometry only: its parent controls size in graph units, never CSS pixels. */
export default function CowGlyph({
  stage = "adult",
  color = "#779b8a",
}: {
  stage?: CowStage;
  color?: string;
}) {
  const baby = stage === "newborn",
    adult = stage === "adult";
  return (
    <g
      className={`network-cow-glyph ${stage}`}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse
        cx="27"
        cy="38"
        rx={baby ? 17 : 22}
        ry="2.4"
        fill={color}
        opacity=".12"
      />
      <g className="network-cow-body">
        <path
          d="M9 20Q1 15 3 28"
          className="network-cow-tail"
          stroke={color}
          strokeWidth="2"
        />
        <path
          d={
            adult
              ? "M9 16Q10 8 17 11Q21 2 27 11H37L42 19 38 30H12Z"
              : "M11 17Q10 11 19 12H36L40 20 36 29H13Z"
          }
          fill={baby ? "#fff8ec" : "#fffdf5"}
          stroke={color}
          strokeWidth="1.5"
        />
        <path
          d="M14 27v9m8-7v7m10-7 1 7m5-10 2 10"
          stroke={color}
          strokeWidth={baby ? "2" : "2.5"}
        />
        <path
          d={
            baby
              ? "M34 14Q34 6 43 8Q51 9 50 19L47 26Q41 30 35 23Z"
              : "M35 14Q35 5 43 6Q51 7 50 18L47 25Q41 29 36 22Z"
          }
          fill="#fffaf0"
          stroke={color}
          strokeWidth="1.5"
        />
        <path
          d="m36 12-7-4q-3 6 7 9m12-6 7-4q3 6-5 9"
          fill={baby ? "#f1cbbf" : "#e2e9d7"}
          stroke={color}
          strokeWidth="1.2"
        />
        {!baby && (
          <path
            d={adult ? "M38 7 36 1l6 4m5 2 3-6-6 4" : "m39 7-1-3m8 3 2-3"}
            stroke={color}
            strokeWidth="1.6"
          />
        )}
        <ellipse
          cx="44"
          cy="23"
          rx="7.5"
          ry="4.5"
          fill={baby ? "#edc4b6" : "#d7dfcc"}
        />
        <path d="m41 23 .2 .3m5-.3 .2 .3" stroke={color} strokeWidth="1.8" />
        <g className="network-cow-eyes" fill="#465847">
          <ellipse cx="39" cy="16" rx="1.1" ry="1.6" />
          <ellipse cx="48" cy="16" rx="1.1" ry="1.6" />
        </g>
        {baby && <circle cx="37" cy="21" r="2" fill="#e9b8a8" opacity=".6" />}
      </g>
    </g>
  );
}
