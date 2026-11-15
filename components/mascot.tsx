// Loop's golden retriever. One drawing, three moods, so every celebration and empty state feels like the same friend.
export type DogMood = "happy" | "sympathetic" | "waiting";

export function LoopDog({ mood = "happy", className = "w-44" }: { mood?: DogMood; className?: string }) {
  const ink = "#3a2a22";
  return (
    <svg viewBox="0 0 240 230" className={className} role="img" aria-label={mood === "happy" ? "Loop dog smiling" : mood === "sympathetic" ? "Loop dog looking understanding" : "Loop dog waiting patiently"}>
      {/* ears */}
      <ellipse cx="60" cy="100" rx="29" ry="52" transform="rotate(16 60 100)" fill="#c98b4a" />
      <ellipse cx="180" cy="100" rx="29" ry="52" transform="rotate(-16 180 100)" fill="#c98b4a" />
      {/* head */}
      <ellipse cx="120" cy="108" rx="68" ry="62" fill="#efbb78" />
      <ellipse cx="120" cy="116" rx="30" ry="46" fill="#f7d6a4" />
      {/* paws */}
      <g fill="#efbb78" stroke="#c98b4a" strokeWidth="2">
        <ellipse cx="84" cy="206" rx="27" ry="19" />
        <ellipse cx="156" cy="206" rx="27" ry="19" />
      </g>
      <g stroke="#c98b4a" strokeWidth="2" strokeLinecap="round">
        <path d="M75 198v10M85 196v12M95 198v10" />
        <path d="M145 198v10M155 196v12M165 198v10" />
      </g>
      {/* cheeks */}
      <ellipse cx="82" cy="128" rx="11" ry="7" fill="#f2a28c" opacity=".45" />
      <ellipse cx="158" cy="128" rx="11" ry="7" fill="#f2a28c" opacity=".45" />
      {/* muzzle */}
      <ellipse cx="120" cy="138" rx="34" ry="25" fill="#fbe9ca" />
      {mood === "happy" && <path d="M108 150q12 26 24 0z" fill="#ef8f8f" />}
      <path d="M105 124q15-11 30 0q-2 14-15 16q-13-2-15-16z" fill={ink} />
      <ellipse cx="114" cy="126" rx="4" ry="2" fill="#fff" opacity=".35" />
      <g stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d="M120 140v7" />
        {mood === "happy" && <path d="M101 148q19 16 38 0" />}
        {mood === "sympathetic" && <path d="M106 156q14-10 28 0" />}
        {mood === "waiting" && <path d="M108 152q12 6 24 0" />}
      </g>
      {/* eyes and brows */}
      {mood === "happy" ? (
        <g stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M80 100q12-14 24 0" />
          <path d="M136 100q12-14 24 0" />
        </g>
      ) : (
        <g>
          <ellipse cx="92" cy="104" rx="8" ry="10" fill={ink} />
          <ellipse cx="148" cy="104" rx="8" ry="10" fill={ink} />
          <circle cx="95" cy="100" r="3" fill="#fff" />
          <circle cx="151" cy="100" r="3" fill="#fff" />
          <g stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none">
            {mood === "sympathetic" ? (
              <>
                <path d="M80 86l22-8" />
                <path d="M160 86l-22-8" />
              </>
            ) : (
              <>
                <path d="M82 84q10-6 20-2" />
                <path d="M158 84q-10-6-20-2" />
              </>
            )}
          </g>
        </g>
      )}
      {mood === "waiting" && (
        <g fill="#99ab78">
          <circle cx="200" cy="40" r="5" />
          <circle cx="216" cy="28" r="7" />
          <circle cx="206" cy="12" r="3" opacity=".6" />
        </g>
      )}
    </svg>
  );
}
