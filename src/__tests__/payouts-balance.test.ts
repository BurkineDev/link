/**
 * Solde reversable dérivé du registre (src/lib/payouts/balance.ts).
 */

import { computeBalance, type LedgerRow } from "@/lib/payouts/balance";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-12T12:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

const net = (amount: number, provider: string, daysAgo: number): LedgerRow => ({
  type: "seller_net",
  amount,
  currency: "XOF",
  provider,
  createdAt: ago(daysAgo),
});

describe("computeBalance", () => {
  test("Mobile Money mûrit à 2 jours, carte à 7 jours", () => {
    const b = computeBalance(
      [net(10_000, "geniuspay", 3), net(5_000, "geniuspay", 1), net(20_000, "stripe", 6), net(7_000, "stripe", 8)],
      [],
      "XOF",
      NOW,
    );
    expect(b.available).toBe(17_000);
    expect(b.maturing).toBe(25_000);
    expect(b.nextMaturityAt).toEqual(new Date(ago(1).getTime() + 2 * DAY));
  });

  test("un reversement versé (ligne payout négative) réduit le disponible", () => {
    const b = computeBalance(
      [
        net(10_000, "geniuspay", 10),
        { type: "payout", amount: -6_000, currency: "XOF", provider: "wave", createdAt: ago(2) },
      ],
      [],
      "XOF",
      NOW,
    );
    expect(b.available).toBe(4_000);
    expect(b.paidOut).toBe(6_000);
  });

  test("une demande ouverte réserve la somme ; une demande refusée ne compte plus", () => {
    const rows = [net(10_000, "geniuspay", 10)];
    expect(computeBalance(rows, [{ amount: 10_000, currency: "XOF", status: "requested" }], "XOF", NOW).available).toBe(0);
    expect(computeBalance(rows, [{ amount: 10_000, currency: "XOF", status: "processing" }], "XOF", NOW).reserved).toBe(10_000);
    expect(computeBalance(rows, [{ amount: 10_000, currency: "XOF", status: "failed" }], "XOF", NOW).available).toBe(10_000);
  });

  test("ignore les lignes d'une autre devise et les autres types (brut, commission)", () => {
    const b = computeBalance(
      [
        net(10_000, "geniuspay", 10),
        { type: "gross", amount: 10_526, currency: "XOF", provider: "geniuspay", createdAt: ago(10) },
        { type: "platform_fee", amount: -526, currency: "XOF", provider: "geniuspay", createdAt: ago(10) },
        { ...net(99, "geniuspay", 10), currency: "USD" },
      ],
      [],
      "XOF",
      NOW,
    );
    expect(b.available).toBe(10_000);
  });

  test("ne descend jamais sous zéro et arrondit au centime", () => {
    const b = computeBalance(
      [
        { type: "seller_net", amount: 10.1, currency: "USD", provider: "stripe", createdAt: ago(30) },
        { type: "seller_net", amount: 0.2, currency: "USD", provider: "stripe", createdAt: ago(30) },
        { type: "payout", amount: -10.3, currency: "USD", provider: "bank", createdAt: ago(1) },
      ],
      [],
      "USD",
      NOW,
    );
    expect(b.available).toBe(0);
    expect(b.paidOut).toBe(10.3);
  });

  test("un prestataire inconnu prend le délai le plus long", () => {
    const b = computeBalance([net(1_000, "autre", 5)], [], "XOF", NOW);
    expect(b.available).toBe(0);
    expect(b.maturing).toBe(1_000);
  });

  test("oldestUnpaidAt n'est renseigné que s'il reste quelque chose à verser", () => {
    const paidAll = computeBalance(
      [net(1_000, "geniuspay", 10), { type: "payout", amount: -1_000, currency: "XOF", provider: "wave", createdAt: ago(1) }],
      [],
      "XOF",
      NOW,
    );
    expect(paidAll.oldestUnpaidAt).toBeNull();
    const pending = computeBalance([net(1_000, "geniuspay", 10), net(500, "geniuspay", 4)], [], "XOF", NOW);
    expect(pending.oldestUnpaidAt).toEqual(ago(10));
  });
});
