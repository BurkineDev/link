import "server-only";

import { prisma } from "@/lib/prisma";
import { BALANCE_LEDGER_TYPES, computeBalance, type ShopBalance } from "./balance";
import { OPEN_PAYOUT_STATUSES } from "./config";

/**
 * Charge le registre et les demandes ouvertes d'une boutique. Accepte un
 * client transactionnel pour être appelé sous verrou.
 */
export async function loadBalance(
  shopId: string,
  currency: string,
  db: Pick<typeof prisma, "transactionLedger" | "payout"> = prisma,
  now: Date = new Date(),
): Promise<ShopBalance> {
  const [ledger, open] = await Promise.all([
    db.transactionLedger.findMany({
      where: { shopId, type: { in: [...BALANCE_LEDGER_TYPES] }, status: "posted" },
      select: { type: true, amount: true, currency: true, provider: true, createdAt: true, orderId: true },
    }),
    db.payout.findMany({
      where: { shopId, status: { in: [...OPEN_PAYOUT_STATUSES] } },
      select: { amount: true, currency: true, status: true },
    }),
  ]);

  return computeBalance(
    ledger.map((row) => ({ ...row, amount: Number(row.amount) })),
    open.map((row) => ({ ...row, amount: Number(row.amount) })),
    currency,
    now,
  );
}
