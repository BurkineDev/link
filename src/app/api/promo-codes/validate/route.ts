import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/promo-codes/validate
 *
 * Buyer-facing endpoint — checks if a promo code is valid for a given shop
 * + order subtotal. Does NOT increment uses_count (that happens atomically
 * during /api/checkout via redeem_promo_code). Uses the admin client to
 * read the promo_codes row (owner-only RLS) — buyers aren't authenticated.
 */

const schema = z.object({
  shopId: z.string().uuid(),
  code: z.string().trim().min(2).max(30).regex(/^[A-Z0-9_-]+$/i),
  orderTotal: z.number().nonnegative(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 422 });
  }

  const { shopId, code, orderTotal } = parsed.data;
  const admin = getAdminClient();

  const { data: promo } = await admin
    .from("promo_codes")
    .select("id, code, discount_type, discount_value, min_order_amount, max_uses, uses_count, expires_at, is_active")
    .eq("shop_id", shopId)
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!promo) {
    return NextResponse.json({ ok: false, error: "Code promo introuvable." }, { status: 404 });
  }

  if (!promo.is_active) {
    return NextResponse.json({ ok: false, error: "Ce code n'est plus actif." }, { status: 400 });
  }

  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "Ce code est expiré." }, { status: 400 });
  }

  if (promo.max_uses != null && promo.uses_count >= promo.max_uses) {
    return NextResponse.json(
      { ok: false, error: "Ce code a atteint sa limite d'utilisations." },
      { status: 400 },
    );
  }

  if (promo.min_order_amount != null && orderTotal < promo.min_order_amount) {
    return NextResponse.json(
      {
        ok: false,
        error: `Le montant minimum pour ce code est ${promo.min_order_amount}.`,
      },
      { status: 400 },
    );
  }

  const discount =
    promo.discount_type === "percent"
      ? Math.round((orderTotal * Number(promo.discount_value)) / 100)
      : Math.min(Number(promo.discount_value), orderTotal);

  return NextResponse.json({
    ok: true,
    discount,
    discount_type: promo.discount_type,
    discount_value: Number(promo.discount_value),
  });
}
