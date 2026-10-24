// Shrinks a photo to at most 1080px and ~100KB before upload, to save data.
// Runs in the browser.
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1080 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const toBlob = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  // Some iPhones can't make WebP files; fall back to JPEG.
  const webp = await toBlob("image/webp", 0.72);
  if (webp && webp.type === "image/webp") return webp;
  return (await toBlob("image/jpeg", 0.75))!;
}
