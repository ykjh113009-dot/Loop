"use client";

import { useState } from "react";
import { AVATARS, avatarSrc } from "@/lib/avatars";

type Interest = { id: number; name: string; emoji: string };

// Avatar picker, interest tags and bio, shared by the welcome and edit screens.
export function ProfileFields({
  interests,
  defaultAvatar = "a01",
  defaultBio = "",
  defaultInterests = [],
}: {
  interests: Interest[];
  defaultAvatar?: string;
  defaultBio?: string;
  defaultInterests?: number[];
}) {
  const [avatar, setAvatar] = useState(defaultAvatar);
  const [picked, setPicked] = useState<number[]>(defaultInterests);
  const [bio, setBio] = useState(defaultBio);

  const toggle = (id: number) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 10 ? p : [...p, id]));

  return (
    <>
      <fieldset>
        <legend className="label">Choose your avatar</legend>
        <input type="hidden" name="avatar" value={avatar} />
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map((id) => (
            <button
              type="button"
              key={id}
              onClick={() => setAvatar(id)}
              aria-pressed={avatar === id}
              aria-label={`Avatar ${id}`}
              className={`rounded-full p-0.5 ring-2 transition ${avatar === id ? "ring-brand-600" : "ring-transparent"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarSrc(id)} alt="" className="aspect-square w-full rounded-full" />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">What are you into? <span className="font-normal text-black/45">(up to 10)</span></legend>
        {picked.map((id) => (
          <input key={id} type="hidden" name="interest" value={id} />
        ))}
        <div className="flex flex-wrap gap-2">
          {interests.map((i) => {
            const on = picked.includes(i.id);
            return (
              <button
                type="button"
                key={i.id}
                onClick={() => toggle(i.id)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  on ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-black/10 bg-white text-black/70"
                }`}
              >
                {i.emoji} {i.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="bio" className="label">
          About you <span className="font-normal text-black/45">(optional)</span>
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={2}
          maxLength={200}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="e.g. I love football and I'm learning guitar"
          className="input resize-none"
        />
        <p className="mt-1 text-xs text-black/45">
          Don&apos;t share your phone number, address or other private details.
        </p>
      </div>
    </>
  );
}
