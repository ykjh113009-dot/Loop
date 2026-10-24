// The illustrated avatars students can choose from (files in public/avatars).
export const AVATARS = Array.from({ length: 12 }, (_, i) => `a${String(i + 1).padStart(2, "0")}`);

export const avatarSrc = (id: string) => `/avatars/${AVATARS.includes(id) ? id : "a01"}.svg`;
