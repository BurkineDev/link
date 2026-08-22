import { toast } from "sonner";

/**
 * Fetches a server-generated image and hands it to the user.
 *
 * On mobile, the native share sheet puts Instagram/TikTok/WhatsApp one tap
 * away; anywhere the browser can't share files, the image downloads instead.
 * Used by the story buttons in Marketing → Partage and on each product card.
 */
export async function shareGeneratedImage(
  path: string,
  filename: string,
): Promise<void> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`image ${res.status}`);
  const blob = await res.blob();
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    // A dismissed share sheet is not an error.
    await navigator.share({ files: [file] }).catch(() => {});
    return;
  }

  const href = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
  toast.info("Image téléchargée — poste-la depuis ton téléphone.");
}

/** Same fetch, but always downloads — for the explicit download button. */
export async function downloadGeneratedImage(
  path: string,
  filename: string,
): Promise<void> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`image ${res.status}`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}
