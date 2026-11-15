// A short, quiet burst of confetti. Hidden for people who ask their device for less motion.
const COLORS = ["#99ab78", "#466237", "#dce9ef", "#e8c36a", "#f0a58f", "#8fb7d3"];

export function Confetti() {
  const pieces = Array.from({ length: 26 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 9) * 0.18,
    size: 6 + ((i * 5) % 7),
    color: COLORS[i % COLORS.length],
    round: i % 3 === 0,
    dur: 2.6 + (i % 5) * 0.35,
  }));
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
      <style>{`@keyframes loop-confetti{0%{transform:translateY(-12vh) rotate(0);opacity:0}12%{opacity:1}100%{transform:translateY(105vh) rotate(540deg);opacity:0}}`}</style>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{ left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 1.8, background: p.color, borderRadius: p.round ? "50%" : 2, animation: `loop-confetti ${p.dur}s ${p.delay}s ease-in 1 both` }}
          className="absolute top-0"
        />
      ))}
    </div>
  );
}
