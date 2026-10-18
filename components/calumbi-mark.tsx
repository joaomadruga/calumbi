export default function CalumbiMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M30.5 10.5A14 14 0 1 0 30.5 29.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="25" cy="12" r="3" fill="currentColor" opacity=".65" />
      <path
        d="M10 25c7-7 14-7 22-3M12 29c7-5 13-5 19-2M18 21v-6m0 3c-4 0-6-2-6-5 4 0 6 2 6 5Zm0-2c4 0 6-2 6-5-4 0-6 2-6 5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
