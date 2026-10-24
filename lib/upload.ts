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
