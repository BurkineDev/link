import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/admin";
import { scheduleAfterResponse } from "@/lib/after-response";
import {
  markPayoutBounced,
  markPayoutFailed,
  markPayoutPaid,
  markPayoutProcessing,
} from "@/lib/payouts/requests";
import { notifyPayoutBounced, notifyPayoutFailed, notifyPayoutPaid } from "@/lib/payouts/notifications";

/**
 * PATCH /api/admin/payouts/[id] — l'équipe fait avancer une demande :
 *   { action: "processing" }                      je m'en occupe
 *   { action: "paid", reference, note? }          transfert exécuté
 *   { action: "failed", note }                    refus motivé
 *   { action: "bounced", note }                   transfert rejeté après coup par l'opérateur
 */

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("processing") }),
  z.object({
    action: z.literal("paid"),
    reference: z.string().trim().min(3).max(80),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({ action: z.literal("failed"), note: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("bounced"), note: z.string().trim().min(3).max(500) }),
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Réservé à l'équipe" }, { status: 403 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const result =
    input.action === "paid"
      ? await markPayoutPaid(id, { reference: input.reference, note: input.note ?? null })
      : input.action === "failed"
        ? await markPayoutFailed(id, { note: input.note })
        : input.action === "bounced"
          ? await markPayoutBounced(id, { note: input.note })
          : await markPayoutProcessing(id);

  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 409;
    const message =
      result.reason === "not_found"
        ? "Demande introuvable"
        : result.reason === "reference_taken"
          ? "Cette référence de transfert est déjà utilisée par un autre reversement."
          : result.reason === "not_paid"
            ? "Seul un reversement marqué versé peut être signalé rejeté."
            : "Cette demande a déjà été traitée.";
    return NextResponse.json({ error: message, code: result.reason.toUpperCase() }, { status });
  }

  const notify =
    input.action === "paid"
      ? notifyPayoutPaid
      : input.action === "failed"
        ? notifyPayoutFailed
        : input.action === "bounced"
          ? notifyPayoutBounced
          : null;
  if (notify) {
    scheduleAfterResponse(
      () => notify(id),
      (error) => console.warn(`[payouts] ${input.action} notification failed`, error),
    );
  }

  return NextResponse.json({ ok: true, status: input.action });
}
