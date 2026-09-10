import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildShopObjectKey, getR2PublicUrl, putR2Object } from "@/lib/storage/r2";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * POST /api/upload — dépose une image sur R2 et renvoie son URL publique.
 *
 * Champs du formulaire : `file` (obligatoire), `folder` (identifiant de la
 * boutique ; par défaut celui de l'utilisateur). Une boutique fournie doit
 * appartenir à l'appelant — sinon n'importe qui rangerait ses fichiers dans
 * le dossier d'un autre vendeur.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const folderInput = formData.get("folder");
  const folder = typeof folderInput === "string" && folderInput ? folderInput : user.id;

  if (!file) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (max 5 Mo)" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Format non supporté. Utilisez JPEG, PNG, WebP ou GIF" },
      { status: 400 }
    );
  }

  if (folder !== user.id) {
    const owned = await prisma.shop.findFirst({
      where: { id: folder, ownerId: user.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }
  }

  const key = buildShopObjectKey(folder, file.name);

  try {
    await putR2Object({
      key,
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
    });
  } catch (error) {
    console.error("[api/upload] storage error", error);
    return NextResponse.json({ error: "Échec de l'upload" }, { status: 500 });
  }

  return NextResponse.json({ url: getR2PublicUrl(key), path: key }, { status: 201 });
}
