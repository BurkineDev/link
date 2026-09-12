/** Forme publique d'un reversement (snake_case, comme le reste des API). */
export function serializePayout(payout: {
  id: string;
  amount: unknown;
  currency: string;
  status: string;
  provider: string;
  reference: string | null;
  note: string | null;
  destination: unknown;
  periodStart: Date | null;
  periodEnd: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: payout.id,
    amount: Number(payout.amount),
    currency: payout.currency,
    status: payout.status,
    provider: payout.provider,
    reference: payout.reference,
    note: payout.note,
    destination: payout.destination ?? null,
    period_start: payout.periodStart?.toISOString() ?? null,
    period_end: payout.periodEnd?.toISOString() ?? null,
    paid_at: payout.paidAt?.toISOString() ?? null,
    created_at: payout.createdAt.toISOString(),
  };
}
