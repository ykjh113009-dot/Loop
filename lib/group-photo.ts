import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";

// Uploads a picture for a group chat and saves it on the group. Runs in the browser; the database checks who may do this.
export async function saveGroupPhoto(schoolId: string, conversationId: string, file: File): Promise<boolean> {
  try {
    const blob = await compressImage(file);
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${schoolId}/${conversationId}/${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const up = await supabase.storage.from("group-images").upload(path, blob, { contentType: blob.type });
    if (up.error) return false;
    const { error } = await supabase.rpc("set_group_image", { p_conversation: conversationId, p_path: path });
    return !error;
  } catch {
    return false;
  }
}

export async function removeGroupPhoto(conversationId: string): Promise<boolean> {
  const { error } = await createClient().rpc("set_group_image", { p_conversation: conversationId, p_path: null as unknown as string });
  return !error;
}
