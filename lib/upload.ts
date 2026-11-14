import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";

// Compresses and uploads a photo into the student's own folder.
// Returns the stored path, or an error message.
export async function uploadPhoto(file: File, schoolId: string, userId: string): Promise<{ path?: string; error?: string }> {
  try {
    const blob = await compressImage(file);
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${schoolId}/${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from("post-images").upload(path, blob, { contentType: blob.type });
    if (error) return { error: "The photo didn't upload. Try again or continue without it." };
    return { path };
  } catch {
    return { error: "That photo can't be used. Try a different one." };
  }
}

// Proof for a challenge goes into a private folder: "<school>/<challenge>/<student>/<file>".
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const MAX_VIDEO_MB = 25;

export async function uploadProof(
  file: File,
  kind: "photo" | "video",
  ids: { schoolId: string; challengeId: string; userId: string },
): Promise<{ path?: string; error?: string }> {
  try {
    let blob: Blob = file;
    let ext = "jpg";
    if (kind === "photo") {
      blob = await compressImage(file);
      ext = blob.type === "image/webp" ? "webp" : "jpg";
    } else {
      if (!VIDEO_TYPES.includes(file.type)) return { error: "Use an MP4, WebM or MOV video." };
      if (file.size > MAX_VIDEO_MB * 1024 * 1024) return { error: `Keep the video under ${MAX_VIDEO_MB} MB.` };
      ext = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
    }
    const path = `${ids.schoolId}/${ids.challengeId}/${ids.userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from("challenge-proof").upload(path, blob, { contentType: blob.type });
    if (error) return { error: "The file didn't upload. Check your connection and try again." };
    return { path };
  } catch {
    return { error: "That file can't be used. Try a different one." };
  }
}
