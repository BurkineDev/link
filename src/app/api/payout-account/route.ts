import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { payoutAccountSchema } from "@/lib/payouts/account-schema";
import { notifyPayoutAccountChanged } from "@/lib/payouts/notifications";
import { scheduleAfterResponse } from "@/lib/after-response";

/**
 * /api/payout-account — le compte sur lequel le vendeur reçoit ses
 * reversements (un par boutique). Modifiable à tout moment ; une demande
 * déjà déposée garde la destination de l'époque (`payouts.destination`).
 */

function serialize(account: {
  provider: string;
  accountName: string;
  accountIdentifier: string;
  country: string | null;
  isVerified: boolean;
  updatedAt: Date;
}) {
  return {
    provider: account.provider,
    account_name: account.accountName,
    account_identifier: account.accountIdentifier,
    country: account.country,
    is_verified: account.isVerified,
    updated_at: account.updatedAt.toISOString(),
  };
}

async function ownedShop(userId: string) {
  return prisma.shop.findFirst({ where: { ownerId: userId }, select: { id: true, name: true } });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const shop = await ownedShop(user.id);
  if (!shop) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  const account = await prisma.payoutAccount.findUnique({ where: { shopId: shop.id } });
  return NextResponse.json({ account: account ? serialize(account) : null });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const shop = await ownedShop(user.id);
  if (!shop) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const parsed = payoutAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const previous = await prisma.payoutAccount.findUnique({
    where: { shopId: shop.id },
    select: { provider: true, accountIdentifier: true },
  });
  const changed =
    !previous ||
    previous.provider !== parsed.data.provider ||
    previous.accountIdentifier !== parsed.data.accountIdentifier;

  const account = await prisma.payoutAccount.upsert({
    where: { shopId: shop.id },
    create: { shopId: shop.id, ...parsed.data },
    // Un changement de destination repart non vérifié : c'est le premier
    // transfert qui valide. Un simple changement de nom garde l'état.
    update: { ...parsed.data, ...(changed ? { isVerified: false } : {}) },
  });

  if (changed) {
    // À l'adresse de connexion : une session volée qui détourne les
    // versements ne doit pas pouvoir passer inaperçue.
    const loginEmail = user.email;
    scheduleAfterResponse(
      () =>
        notifyPayoutAccountChanged({
          loginEmail,
          shopName: shop.name,
          previous,
          next: { provider: account.provider, accountIdentifier: account.accountIdentifier },
        }),
      (error) => console.warn("[payouts] account-changed notification failed", error),
    );
  }

  return NextResponse.json({ account: serialize(account) });
}
