"use client";

import { useState } from "react";
import { Glyph, PICKABLE } from "@/components/glyph";

// Pick an icon for a club, house, group or challenge. The value sent to the server is the same key it always was,
// so nothing in the database changes; it only shows as a Loop line icon instead of an emoji.
export function IconPicker({ name = "emoji", defaultValue = "⭐", label = "Icon" }: { name?: string; defaultValue?: string; label?: string }) {
  const [value, setValue] = useState(defaultValue);
  const keys: string[] = PICKABLE.includes(value as never) ? [...PICKABLE] : [value, ...PICKABLE];
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      <input type="hidden" name={name} value={value} />
      {keys.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => setValue(k)}
          className="opt size-10 rounded-xl p-0 text-xl" aria-label={k}>
          <Glyph e={k} strokeWidth={1.7} />
        </button>
      ))}
    </div>
  );
}
