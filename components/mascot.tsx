// Loop's golden retriever. One drawing, three moods, so every celebration and empty state feels like the same friend.
export type DogMood = "happy" | "sympathetic" | "waiting" | "celebrate";

export function LoopDog({ mood = "happy", className = "w-44" }: { mood?: DogMood; className?: string }) {
  const ink = "#3a2a22";
  return (
    <svg viewBox="0 0 240 230" className={className} role="img" aria-label={mood === "happy" || mood === "celebrate" ? "Loop dog smiling" : mood === "sympathetic" ? "Loop dog looking understanding" : "Loop dog waiting patiently"}>
      {/* ears */}
      <ellipse cx="60" cy="100" rx="29" ry="52" transform="rotate(16 60 100)" fill="#c98b4a" />
      <ellipse cx="180" cy="100" rx="29" ry="52" transform="rotate(-16 180 100)" fill="#c98b4a" />
      {/* head */}
      <ellipse cx="120" cy="108" rx="68" ry="62" fill="#efbb78" />
      <ellipse cx="120" cy="116" rx="30" ry="46" fill="#f7d6a4" />
      {/* body */}
      <ellipse cx="120" cy="208" rx="54" ry="30" fill="#efbb78" />
      {mood === "celebrate" ? (
        <g fill="#efbb78" stroke="#c98b4a" strokeWidth="2">
          <ellipse cx="62" cy="170" rx="14" ry="36" transform="rotate(-38 62 170)" />
          <ellipse cx="178" cy="170" rx="14" ry="36" transform="rotate(38 178 170)" />
          <circle cx="40" cy="132" r="17" />
          <circle cx="200" cy="132" r="17" />
          <path d="M32 126v8M40 123v11M48 126v8M192 126v8M200 123v11M208 126v8" stroke="#c98b4a" strokeLinecap="round" fill="none" />
        </g>
      ) : (
        <g fill="#efbb78" stroke="#c98b4a" strokeWidth="2">
          <ellipse cx="84" cy="206" rx="27" ry="19" />
          <ellipse cx="156" cy="206" rx="27" ry="19" />
        </g>
      )}
      {mood !== "celebrate" && (
        <g stroke="#c98b4a" strokeWidth="2" strokeLinecap="round">
          <path d="M75 198v10M85 196v12M95 198v10" />
          <path d="M145 198v10M155 196v12M165 198v10" />
        </g>
      )}
      {/* the Loop bandana */}
      <path d="M78 164q42 26 84 0l-12 34q-30 14-60 0z" fill="#466237" />
      <path d="M104 182c-6-6-14 0-8 6s12 0 18-6 12-12 18-6 0 12-8 6-12-12-20-6z" transform="translate(-1 2)" fill="none" stroke="#fdfaef" strokeWidth="3" strokeLinecap="round" />
      {/* cheeks */}
      <ellipse cx="82" cy="128" rx="11" ry="7" fill="#f2a28c" opacity=".45" />
      <ellipse cx="158" cy="128" rx="11" ry="7" fill="#f2a28c" opacity=".45" />
      {/* muzzle */}
      <ellipse cx="120" cy="138" rx="34" ry="25" fill="#fbe9ca" />
      {(mood === "happy" || mood === "celebrate") && <path d="M108 150q12 26 24 0z" fill="#ef8f8f" />}
      <path d="M105 124q15-11 30 0q-2 14-15 16q-13-2-15-16z" fill={ink} />
      <ellipse cx="114" cy="126" rx="4" ry="2" fill="#fff" opacity=".35" />
      <g stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d="M120 140v7" />
        {(mood === "happy" || mood === "celebrate") && <path d="M101 148q19 16 38 0" />}
        {mood === "sympathetic" && <path d="M106 156q14-10 28 0" />}
        {mood === "waiting" && <path d="M108 152q12 6 24 0" />}
      </g>
      {/* eyes and brows */}
      {mood === "happy" || mood === "celebrate" ? (
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
