import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeDigitalDownload } from "@/lib/db/tracking";
import { createR2DownloadUrl } from "@/lib/storage/r2";

const tokenSchema = z.string().uuid();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const parsed = tokenSchema.safeParse((await params).token);
  if (!parsed.success) {
    return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof consumeDigitalDownload>>;
  try {
    result = await consumeDigitalDownload(parsed.data);
  } catch (error) {
    console.error("[download] consume error", error);
    return NextResponse.json({ error: "Téléchargement indisponible." }, { status: 500 });
  }

  if (!result.ok) {
    const status =
      result.reason === "not_found"
        ? 404
        : result.reason === "not_paid"
          ? 403
          : 410;
    const message =
      result.reason === "limit_reached"
        ? "La limite de téléchargements est atteinte."
        : result.reason === "expired"
          ? "Ce lien de téléchargement a expiré."
          : "Téléchargement introuvable.";
    return NextResponse.json({ error: message }, { status });
  }

  // Compatibilité avec les produits numériques créés avant R2.
  if (/^https:\/\//i.test(result.file_key)) {
    return NextResponse.redirect(result.file_key, 307);
  }

  try {
    const signedUrl = await createR2DownloadUrl(result.file_key);
    return NextResponse.redirect(signedUrl, 307);
  } catch (downloadError) {
    console.error("[download] R2 signing error", downloadError);
    return NextResponse.json({ error: "Fichier momentanément indisponible." }, { status: 503 });
  }
}
