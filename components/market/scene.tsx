const FOREST = "#4a6a3e";
const FOREST_DARK = "#3a5530";
const SAGE = "#9db58a";
const GOLD = "#c9a24a";

// A forest-green shopping bag with a price tag, for the Market banner.
export function MarketScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 8 260 182" className={className} role="img" aria-label="A shopping bag">
      <ellipse cx="150" cy="176" rx="82" ry="9" fill="#cfd9bb" opacity=".8" />
      <path d="M0 176q60-40 130-14t130-30v58H0z" fill="#dbe4c8" opacity=".7" />
      <g transform="rotate(-18 70 110)">
        <rect x="42" y="82" width="62" height="50" rx="9" fill={SAGE} />
        <circle cx="56" cy="96" r="4.5" fill="#f3f6ea" />
        <path d="M70 112h22M81 101v22" stroke="#f3f6ea" strokeWidth="5" strokeLinecap="round" />
        <path d="M56 96q-20-14-34-8" fill="none" stroke={SAGE} strokeWidth="2" />
      </g>
      <path d="M118 66q0-46 36-46t36 46" fill="none" stroke={FOREST_DARK} strokeWidth="7" strokeLinecap="round" />
      <path d="M104 66h100l12 104H92z" fill={FOREST} />
      <path d="M104 66h100l3 24H101z" fill={FOREST_DARK} opacity=".35" />
      <path d="M154 108c-10-14-30-12-30 4s20 16 30 4c10 12 30 10 30-4s-20-18-30-4z" fill="none" stroke="#f3f6ea" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      {[[20, 36, 1.1], [222, 30, 1], [236, 96, 0.8]].map(([x, y, k], i) => (
        <path key={i} d={`M${x} ${y - 7 * k}l${1.8 * k} ${5.2 * k} ${5.2 * k} ${1.8 * k}-${5.2 * k} ${1.8 * k}-${1.8 * k} ${5.2 * k}-${1.8 * k}-${5.2 * k}-${5.2 * k}-${1.8 * k} ${5.2 * k}-${1.8 * k}z`} fill={i === 1 ? GOLD : FOREST} opacity=".85" />
      ))}
    </svg>
  );
}
