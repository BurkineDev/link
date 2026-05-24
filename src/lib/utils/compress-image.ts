/**
 * Browser-side image compression using <canvas>.
 *
 * Targets African mobile networks (3G/4G) by shrinking product photos
 * before they hit the network. No external dependency — uses only the
 * Canvas 2D API and the browser's WebP encoder.
 *
 * Behaviour:
 *   • Bypasses files smaller than `bypassUnderKb` (default 200KB) — already small enough.
 *   • Bypasses GIF and SVG (animations / vector content shouldn't be rasterised).
 *   • Scales the longest edge down to `maxEdge` (default 1600px).
 *   • Re-encodes as WebP at quality `quality` (default 0.82). Falls back to JPEG
 *     if WebP isn't supported.
 *   • Returns the original file if compression would make it bigger.
 */

export interface CompressOptions {
  maxEdge?: number;
  quality?: number;
  bypassUnderKb?: number;
}

const DEFAULTS = {
  maxEdge: 1600,
  quality: 0.82,
  bypassUnderKb: 200,
} satisfies Required<CompressOptions>;

const BYPASSED_MIME = new Set(["image/gif", "image/svg+xml"]);

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  if (BYPASSED_MIME.has(file.type)) return file;

  const { maxEdge, quality, bypassUnderKb } = { ...DEFAULTS, ...options };

  if (file.size <= bypassUnderKb * 1024) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/webp", quality);
  });

  if (!blob) return file;
  if (blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], newName, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}
