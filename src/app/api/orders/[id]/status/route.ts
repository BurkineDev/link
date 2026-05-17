import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]),
});

// PATCH /api/orders/[id]/status — update order status (shop owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 422 });
  }

  // Verify the order belongs to a shop owned by this user via the shop_id
  const { data: orderData } = await supabase
    .from("orders")
    .select("id, shop_id")
    .eq("id", id)
    .maybeSingle();

  if (!orderData) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  // Verify shop ownership
  const { data: shopData } = await supabase
    .from("shops")
    .select("id")
    .eq("id", orderData.shop_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!shopData) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ order: updated });
}
