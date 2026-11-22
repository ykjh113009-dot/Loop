// The big infinity ribbon on the sign-in page. Drawn as a vector so it stays
// sharp on every screen. Two thin outline loops sit behind it for the
// "connected and continuous" feel.
const LOOP =
  "M200 100C240 40 340 40 340 100C340 160 240 160 200 100C160 40 60 40 60 100C60 160 160 160 200 100Z";

export function LoopRibbon() {
  return (
    <svg className="lp-ribbon" viewBox="0 0 400 200" aria-hidden="true" focusable="false">
      <path
        d={LOOP}
        transform="translate(200 100) scale(2.25) translate(-200 -100)"
        fill="none"
        stroke="#4D725B"
        strokeOpacity="0.55"
        strokeWidth="1.3"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={LOOP}
        transform="translate(200 100) scale(1.55) translate(-200 -100)"
        fill="none"
        stroke="#4D725B"
        strokeOpacity="0.7"
        strokeWidth="1.3"
        vectorEffect="non-scaling-stroke"
      />
      <path d={LOOP} fill="none" stroke="#4D725B" strokeWidth="40" strokeLinejoin="round" />
    </svg>
  );
}
