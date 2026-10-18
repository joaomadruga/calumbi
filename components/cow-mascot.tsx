export default function CowMascot() {
  return (
    <svg className="cow-mascot" viewBox="0 0 240 160" aria-hidden="true">
      <ellipse
        className="mascot-ground"
        cx="121"
        cy="140"
        rx="83"
        ry="10"
        fill="#d6e2c3"
      />
      <g className="mascot-cow">
        <path
          d="M52 84C30 73 29 94 23 107"
          fill="none"
          stroke="#a8b895"
          strokeWidth="5"
          strokeLinecap="round"
          className="mascot-tail"
        />
        <path
          d="M59 94 57 131Q59 139 67 136L74 103M136 101 141 133Q148 141 153 132L155 94"
          fill="#d7dccb"
          stroke="#8e9f7b"
          strokeWidth="2"
        />
        <path
          d="M48 79Q45 58 65 54Q79 28 95 53L141 55Q160 60 161 81L152 108Q121 116 86 106L69 108Q47 103 48 79Z"
          fill="#f6f3e5"
          stroke="#8e9f7b"
          strokeWidth="2"
        />
        <path
          d="m74 103-2 32q4 7 11 1l5-29m41 0 2 28q5 7 12 0l2-27"
          fill="#f6f3e5"
          stroke="#8e9f7b"
          strokeWidth="2"
        />
        <path
          d="M143 63Q145 35 169 39Q190 42 190 68L183 92Q172 110 155 94Z"
          fill="#f8f5e9"
          stroke="#8e9f7b"
          strokeWidth="2"
        />
        <path
          className="mascot-ear"
          d="M147 55Q126 40 125 54Q133 70 148 64m38-10q20-16 25-4-4 17-23 15"
          fill="#e9e9d8"
          stroke="#8e9f7b"
          strokeWidth="2"
        />
        <path
          d="M154 41q-10-12-5-16 3 11 11 13m17 2q11-11 8-17-2 11-12 15"
          fill="#c5cbb3"
          stroke="#8e9f7b"
          strokeWidth="2"
        />
        <ellipse cx="170" cy="85" rx="19" ry="12" fill="#dddaca" />
        <ellipse cx="162" cy="85" rx="2.2" ry="3" fill="#8d907e" />
        <ellipse cx="179" cy="85" rx="2.2" ry="3" fill="#8d907e" />
        <g className="mascot-eyes">
          <circle cx="158" cy="65" r="3" fill="#42543d" />
          <circle cx="182" cy="65" r="3" fill="#42543d" />
          <circle cx="159" cy="64" r=".8" fill="white" />
          <circle cx="183" cy="64" r=".8" fill="white" />
        </g>
        <path
          d="M166 95q5 3 10-1"
          fill="none"
          stroke="#979884"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>
      <g
        className="mascot-grass"
        stroke="#9ab47d"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="m32 140-3-8m3 8 4-10m166 12 2-9m-2 9-4-6" />
      </g>
    </svg>
  );
}
