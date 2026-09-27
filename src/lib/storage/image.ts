import sharp from "sharp";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export async function validateImage(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES)
    throw new Error("Choose an image under 5 MB.");
  const formats: Record<string, string> = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
  };
  if (!formats[mime]) throw new Error("Choose a JPEG, PNG or WebP image.");
  const image = sharp(bytes, { limitInputPixels: 40_000_000, animated: false });
  const metadata = await image.metadata();
  if (metadata.format !== formats[mime] || (metadata.pages ?? 1) > 1)
    throw new Error("The image format does not match its file type.");
  return image
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
}
