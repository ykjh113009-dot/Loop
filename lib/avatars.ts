// The illustrated avatars students can choose from (files in public/avatars).
export const AVATARS = Array.from({ length: 12 }, (_, i) => `a${String(i + 1).padStart(2, "0")}`);

// "a05" is an illustration. "u:<student id>:<version>" means the student uploaded a photo: it is served
// through /api/avatar, which checks that you are signed in to the same school (photos are private).
const PHOTO = /^u:([0-9a-f-]{36}):(\d+)$/;

export const avatarSrc = (id: string) => {
  const photo = PHOTO.exec(id);
  if (photo) return `/api/avatar/${photo[1]}?v=${photo[2]}`;
  return `/avatars/${AVATARS.includes(id) ? id : "a01"}.svg`;
};
