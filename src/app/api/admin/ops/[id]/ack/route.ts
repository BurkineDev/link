import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/admin";
import { acknowledgeOpsEvent } from "@/lib/ops/events";

// POST /api/admin/ops/[id]/ack — marquer une alerte traitée (équipe).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Réservé à l'équipe." }, { status: 403 });
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Alerte introuvable." }, { status: 404 });
  }
  const done = await acknowledgeOpsEvent(id, user.email);
  if (!done) return NextResponse.json({ error: "Alerte introuvable ou déjà traitée." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
