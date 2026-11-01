// Soft decorative leaves for the welcome banner and the sidebar. Pure decoration.
const LEAF = "M0 0C14-26 46-38 74-30 66-2 34 14 0 0Z";

export function Sprig({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 150" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sprig-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a9ba88" />
          <stop offset="1" stopColor="#6f8c55" />
        </linearGradient>
        <linearGradient id="sprig-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c3d1a6" />
          <stop offset="1" stopColor="#8da56e" />
        </linearGradient>
      </defs>
      <path d="M80 150C78 118 80 82 90 40" fill="none" stroke="#7d9862" strokeWidth="3" strokeLinecap="round" />
      <g transform="translate(80 128) rotate(-62)"><path d={LEAF} fill="url(#sprig-b)" /></g>
      <g transform="translate(82 104) rotate(-20) scale(1.05)"><path d={LEAF} fill="url(#sprig-a)" /></g>
      <g transform="translate(79 112) rotate(-168) scale(0.9)"><path d={LEAF} fill="url(#sprig-b)" /></g>
      <g transform="translate(84 80) rotate(-155) scale(0.95)"><path d={LEAF} fill="url(#sprig-a)" /></g>
      <g transform="translate(88 58) rotate(-70) scale(0.8)"><path d={LEAF} fill="url(#sprig-b)" /></g>
      <g transform="translate(90 42) rotate(-98) scale(0.7)"><path d={LEAF} fill="url(#sprig-a)" /></g>
    </svg>
  );
}

export function Leaves({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" className={className} aria-hidden="true" focusable="false">
      <g opacity="0.55">
        <g transform="translate(8 150) rotate(-52) scale(1.8)"><path d={LEAF} fill="#cfdcb4" /></g>
        <g transform="translate(40 156) rotate(-30) scale(1.5)"><path d={LEAF} fill="#bccb9c" /></g>
        <g transform="translate(70 158) rotate(-8) scale(1.2)"><path d={LEAF} fill="#d6e1bd" /></g>
      </g>
    </svg>
  );
}
