// Small vector scenes for page banners and empty states. Soft sage, cream and forest green, like the rest of Loop.
const FOREST = "#4d725b";
const SAGE = "#a7c4aa";
const SOFT = "#dde6cc";
const SKY = "#cfe2ea";
const CREAM = "#fdfaef";
const SAND = "#efe2c8";
const GOLD = "#f2b632";

function Sparkle({ x, y, s = 1, fill = GOLD }: { x: number; y: number; s?: number; fill?: string }) {
  return <path d={`M${x} ${y - 7 * s}l${1.8 * s} ${5.2 * s} ${5.2 * s} ${1.8 * s}-${5.2 * s} ${1.8 * s}-${1.8 * s} ${5.2 * s}-${1.8 * s}-${5.2 * s}-${5.2 * s}-${1.8 * s} ${5.2 * s}-${1.8 * s}z`} fill={fill} opacity=".9" />;
}

export function CampusScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 160" className={className} role="img" aria-label="School campus">
      <path d="M0 160V118q60-22 130-8t130-6q60 4 100 16v40z" fill={SOFT} />
      <path d="M0 160v-20q90-14 180-6t180-4v30z" fill={SAGE} opacity=".6" />
      <rect x="104" y="64" width="152" height="68" rx="3" fill={SAND} />
      <path d="M96 66 180 38l84 28z" fill="#c9b894" />
      <rect x="164" y="18" width="32" height="46" rx="2" fill={SAND} />
      <path d="M160 20 180 6l20 14z" fill={FOREST} />
      <circle cx="180" cy="36" r="9.5" fill={CREAM} stroke={FOREST} strokeWidth="2" />
      <path d="M180 30v6l4 2" stroke={FOREST} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {[116, 136, 206, 226].map((x) => <rect key={x} x={x} y="78" width="14" height="22" rx="2" fill={SKY} />)}
      {[116, 136, 206, 226].map((x) => <rect key={`b${x}`} x={x} y="106" width="14" height="18" rx="2" fill={SKY} />)}
      <rect x="168" y="92" width="24" height="40" rx="12" fill={FOREST} />
      <circle cx="52" cy="108" r="24" fill={SAGE} /><circle cx="36" cy="120" r="16" fill={FOREST} opacity=".7" /><rect x="50" y="118" width="5" height="22" fill="#8b6b45" />
      <circle cx="312" cy="106" r="26" fill={SAGE} /><circle cx="332" cy="122" r="16" fill={FOREST} opacity=".7" /><rect x="310" y="120" width="5" height="22" fill="#8b6b45" />
      <Sparkle x={86} y={40} s={1.1} /><Sparkle x={284} y={34} s={0.9} />
    </svg>
  );
}

export function BooksScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 150" className={className} role="img" aria-label="Books">
      <ellipse cx="130" cy="136" rx="108" ry="10" fill={SOFT} />
      <rect x="40" y="96" width="120" height="30" rx="5" fill={FOREST} /><rect x="48" y="104" width="104" height="4" rx="2" fill={SOFT} opacity=".7" />
      <rect x="54" y="66" width="110" height="30" rx="5" fill={SAGE} /><rect x="62" y="74" width="94" height="4" rx="2" fill={CREAM} opacity=".7" />
      <rect x="34" y="40" width="104" height="26" rx="5" fill="#8fb7d3" /><rect x="42" y="47" width="88" height="4" rx="2" fill={CREAM} opacity=".7" />
      <path d="M176 126V74q22-12 44-2v52q-22-10-44 2z" fill={CREAM} stroke={FOREST} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M220 72q22-10 40 2v50q-18-10-40 2z" fill="#f5efdc" stroke={FOREST} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M186 90q14-5 26 0M186 100q14-5 26 0M228 90q12-4 24 0" stroke={SAGE} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M150 30 170 20 190 30 170 40z" fill={FOREST} /><path d="M158 36v10q12 7 24 0V36" fill={FOREST} opacity=".8" /><path d="M190 30v14" stroke={GOLD} strokeWidth="2.2" />
      <Sparkle x={236} y={34} s={1.2} /><Sparkle x={24} y={26} s={0.9} />
    </svg>
  );
}

export function GiftScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-label="A gift">
      <ellipse cx="100" cy="136" rx="74" ry="9" fill={SOFT} />
      <rect x="52" y="64" width="96" height="68" rx="8" fill="#f6e6c5" stroke={FOREST} strokeWidth="2.4" />
      <rect x="44" y="50" width="112" height="22" rx="7" fill={SAGE} stroke={FOREST} strokeWidth="2.4" />
      <rect x="92" y="50" width="16" height="82" fill={FOREST} opacity=".85" />
      <path d="M100 50c-8-22-34-24-34-10 0 10 22 10 34 10zM100 50c8-22 34-24 34-10 0 10-22 10-34 10z" fill={CREAM} stroke={FOREST} strokeWidth="2.4" strokeLinejoin="round" />
      <Sparkle x={34} y={40} s={1.3} /><Sparkle x={170} y={34} s={1.1} /><Sparkle x={160} y={96} s={0.8} fill={SAGE} /><Sparkle x={26} y={96} s={0.8} fill={SAGE} />
    </svg>
  );
}

export function CommunityScene({ className = "" }: { className?: string }) {
  const people: [number, string, string][] = [[70, "#efbb78", FOREST], [125, "#c98b4a", SAGE], [180, "#f3d9b8", "#8fb7d3"], [235, "#e0a96d", FOREST]];
  return (
    <svg viewBox="0 0 310 150" className={className} role="img" aria-label="Friends together">
      <path d="M0 150v-26q80-26 160-10t150-6v42z" fill={SOFT} />
      {people.map(([x, skin, shirt], i) => (
        <g key={x} transform={`translate(0 ${i % 2 ? 6 : 0})`}>
          <path d={`M${x - 30} 150v-22q0-26 30-26t30 26v22z`} fill={shirt} />
          <circle cx={x} cy="68" r="21" fill={skin} />
          <path d={`M${x - 21} 64q4-22 21-22t21 22q-8-10-21-10t-21 10z`} fill="#5b3d28" opacity={i === 2 ? 0.55 : 1} />
          <circle cx={x - 7} cy="70" r="2" fill="#3a2a22" /><circle cx={x + 7} cy="70" r="2" fill="#3a2a22" />
          <path d={`M${x - 6} 78q6 5 12 0`} stroke="#3a2a22" strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      ))}
      <path d="M152 30c-6-12-24-6-18 8 4 9 18 16 18 16s14-7 18-16c6-14-12-20-18-8z" fill="#f0a58f" opacity=".95" />
      <Sparkle x={36} y={34} /><Sparkle x={282} y={44} s={1.2} />
    </svg>
  );
}

export type SceneName = "campus" | "books" | "gift" | "community";
export function Scene({ name, className }: { name: SceneName; className?: string }) {
  return name === "campus" ? <CampusScene className={className} /> : name === "books" ? <BooksScene className={className} /> : name === "gift" ? <GiftScene className={className} /> : <CommunityScene className={className} />;
}
