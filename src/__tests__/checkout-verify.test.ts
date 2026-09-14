/**
 * P0 — GET /api/checkout/verify?session_id=xxx
 * TC-13 through TC-20
 */

import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mutable mock state
//
// La fixture reste en snake_case ; `toRow` la traduit en ligne Prisma
// complète (dates, décimaux) pour que `serializeOrder` puisse la relire.
// ---------------------------------------------------------------------------

let _order: Record<string, unknown> | null = BASE_ORDER_DEFAULT();

function BASE_ORDER_DEFAULT() {
  return {
    id: "order-001",
    shop_id: "shop-001",
    total_amount: 5000,
    currency: "XOF",
    payment_status: "pending",
    status: "pending",
    items: [],
    buyer_name: "Kofi",
    buyer_email: "kofi@example.com",
  };
}

const toRow = (o: Record<string, unknown>) => ({
  id: o.id,
  shopId: o.shop_id,
  customerId: null,
  buyerEmail: o.buyer_email,
  buyerName: o.buyer_name,
  buyerPhone: null,
  status: o.status,
  paymentStatus: o.payment_status,
  paymentProvider: o.payment_provider ?? "stripe",
  paymentRef: "cs_test_123",
  totalAmount: o.total_amount,
  shippingAmount: 0,
  currency: o.currency,
  items: o.items,
  shippingAddress: null,
  notes: null,
  promoCode: null,
  discountAmount: 0,
  trackingToken: "tok-001",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
});

let _downloads: Array<{ token: string; fileName: string | null; expiresAt: Date | null }> = [];

const mockPrisma = {
  order: {
    findUnique: jest.fn(async () => (_order ? toRow(_order) : null)),
    findFirst: jest.fn(async () => (_order ? toRow(_order) : null)),
  },
  shop: {
    findUnique: jest.fn(async () => ({
      name: "Boutique Test",
      slug: "boutique-test",
      whatsappNumber: null,
    })),
  },
  digitalDownload: {
    findMany: jest.fn(async () => _downloads),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

let _settleResult: { settled: boolean; reason?: string } = { settled: true };
jest.mock("@/lib/db/orders", () => ({
  settlePaidOrder: jest.fn(async () => _settleResult),
  cancelUnpaidOrder: jest.fn(async () => ({ cancelled: true })),
}));

// Alertes fondateur : on vérifie ce qui est signalé.
const mockOps = { critical: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock("@/lib/ops/events", () => ({ ops: mockOps, recordOpsEvent: jest.fn(), recordOpsEventAfterResponse: jest.fn() }));

const mockRetrieveSession = jest.fn();
jest.mock("@/lib/stripe", () => ({
  getStripe: () => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
    }
    return { checkout: { sessions: { retrieve: mockRetrieveSession } } };
  },
  fromStripeAmount: (amount: number | null, currency: string) => {
    if (amount === null) return null;
    return ["XAF", "XOF"].includes(currency.toUpperCase()) ? amount : amount / 100;
  },
}));

let _blockedResponse: Response | null = null;
jest.mock("@/lib/rate-limit", () => ({
  enforceLimits: jest.fn(async () => _blockedResponse),
  getClientIp: jest.fn(() => "203.0.113.7"),
}));

jest.mock("@/lib/order-notifications", () => ({
  notifyPaidOrder: jest.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/checkout/verify/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(sessionId?: string): NextRequest {
  const url = sessionId
    ? `http://localhost:3000/api/checkout/verify?session_id=${sessionId}`
    : "http://localhost:3000/api/checkout/verify";
  return new NextRequest(url);
}

function mockStripeSession(s: {
  payment_status: string;
  status: string;
  amount_total: number | null;
  currency: string;
}) {
  mockRetrieveSession.mockResolvedValueOnce({
    id: "cs_test_123",
    ...s,
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  _order = BASE_ORDER_DEFAULT();
  _blockedResponse = null;
  _settleResult = { settled: true };
  mockRetrieveSession.mockReset();
  mockOps.critical.mockClear();
  process.env.STRIPE_SECRET_KEY = "sk_test_123";
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/checkout/verify", () => {
  const SESSION_ID = "cs_test_123";

  // TC-13 — paid + montant correct → confirmation
  test("TC-13: paid session confirms order", async () => {
    mockStripeSession({ payment_status: "paid", status: "complete", amount_total: 5000, currency: "xof" });

    const res = await GET(makeRequest(SESSION_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.order.payment_status).toBe("paid");
    expect(json.order.status).toBe("confirmed");
  });

  // TC-13b — la réponse est publique : elle ne doit rien contenir de privé,
  // et doit porter le suivi + les fichiers une fois payée.
  test("TC-13b: paid response carries tracking + downloads and no private buyer data", async () => {
    _downloads = [{ token: "dl-1", fileName: "guide.pdf", expiresAt: new Date("2026-12-31T00:00:00Z") }];
    mockStripeSession({ payment_status: "paid", status: "complete", amount_total: 5000, currency: "xof" });

    const res = await GET(makeRequest(SESSION_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.order.tracking_token).toBe("tok-001");
    expect(json.order.downloads).toEqual([
      { token: "dl-1", file_name: "guide.pdf", expires_at: "2026-12-31T00:00:00.000Z" },
    ]);
    for (const privateField of ["buyer_email", "buyer_phone", "shipping_address", "notes", "payment_ref"]) {
      expect(json.order).not.toHaveProperty(privateField);
    }
  });

  test("TC-13c: an unpaid order exposes neither tracking token nor downloads", async () => {
    _order = { ...BASE_ORDER_DEFAULT(), payment_status: "pending" };
    mockStripeSession({ payment_status: "unpaid", status: "open", amount_total: 5000, currency: "xof" });

    const res = await GET(makeRequest(SESSION_ID));
    const json = await res.json();

    // Réponse 202 « en attente » : pas encore payé → rien à emporter.
    expect(res.status).toBe(202);
    expect(json.order?.tracking_token ?? null).toBeNull();
    expect(json.order?.downloads ?? []).toEqual([]);
  });

  // TC-14 — idempotence : déjà paid → Stripe non appelé
  test("TC-14: already paid order returns 200 without calling Stripe", async () => {
    _order = { ...BASE_ORDER_DEFAULT(), payment_status: "paid" };

    const res = await GET(makeRequest(SESSION_ID));

    expect(res.status).toBe(200);
    expect(mockRetrieveSession).not.toHaveBeenCalled();
  });

  // TC-15 — expired → 400
  test("TC-15: expired session returns 400", async () => {
    mockStripeSession({ payment_status: "unpaid", status: "expired", amount_total: 5000, currency: "xof" });

    const res = await GET(makeRequest(SESSION_ID));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/échoué/i);
  });

  // TC-16 — open/unpaid → 202
  test("TC-16: open unpaid session returns 202", async () => {
    mockStripeSession({ payment_status: "unpaid", status: "open", amount_total: 5000, currency: "xof" });

    const res = await GET(makeRequest(SESSION_ID));
    expect(res.status).toBe(202);
  });

  // TC-17 — paramètres manquants (ni session_id ni provider/reference)
  test("TC-17: missing verify params returns 400", async () => {
    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/manquant/i);
  });

  // TC-18 — session_id inconnu en DB
  test("TC-18: unknown session_id returns 404", async () => {
    _order = null;

    const res = await GET(makeRequest("unknown-session"));
    expect(res.status).toBe(404);
  });

  // TC-19 — montant insuffisant → ne pas confirmer
  test("TC-19: underpaid session does not confirm order", async () => {
    mockStripeSession({ payment_status: "paid", status: "complete", amount_total: 100, currency: "xof" });

    const res = await GET(makeRequest(SESSION_ID));

    if (res.status === 200) {
      const json = await res.json();
      expect(json.order?.payment_status).not.toBe("paid");
    } else {
      expect(res.status).toBe(400);
    }
  });

  // TC-20 — devise différente → ne pas confirmer
  test("TC-20: currency mismatch session does not confirm order", async () => {
    mockStripeSession({ payment_status: "paid", status: "complete", amount_total: 5000, currency: "ghs" });

    const res = await GET(makeRequest(SESSION_ID));

    if (res.status === 200) {
      const json = await res.json();
      expect(json.order?.payment_status).not.toBe("paid");
    } else {
      expect(res.status).toBe(400);
    }
  });
  test("TC-RL: rate limited request returns the 429 before reading the order", async () => {
    const { NextResponse } = jest.requireActual("next/server") as typeof import("next/server");
    _blockedResponse = NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
    mockPrisma.order.findFirst.mockClear();

    const res = await GET(makeRequest("cs_test_123"));

    expect(res.status).toBe(429);
    expect(mockPrisma.order.findFirst).not.toHaveBeenCalled();
    expect(mockRetrieveSession).not.toHaveBeenCalled();
  });
});

describe("GET /api/checkout/verify — paiement à la livraison", () => {
  const ORDER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const codRequest = (id = ORDER_ID) =>
    new NextRequest(`http://localhost:3000/api/checkout/verify?provider=cash_on_delivery&order=${id}`);

  test("montre la commande ferme, non payée, avec son suivi et sans donnée privée", async () => {
    _order = { ...BASE_ORDER_DEFAULT(), id: ORDER_ID, status: "confirmed", payment_provider: "cash_on_delivery" };
    const res = await GET(codRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.order).toMatchObject({
      id: ORDER_ID,
      status: "confirmed",
      payment_status: "pending",
      payment_provider: "cash_on_delivery",
      tracking_token: "tok-001",
      shop_name: "Boutique Test",
    });
    expect(json.order.buyer_email).toBeUndefined();
    expect(mockRetrieveSession).not.toHaveBeenCalled();
  });

  test("répond 409 pour une commande annulée ou qui n'est pas COD", async () => {
    _order = { ...BASE_ORDER_DEFAULT(), id: ORDER_ID, status: "cancelled", payment_provider: "cash_on_delivery" };
    expect((await GET(codRequest())).status).toBe(409);
    _order = { ...BASE_ORDER_DEFAULT(), id: ORDER_ID, payment_provider: "geniuspay" };
    expect((await GET(codRequest())).status).toBe(409);
  });

  test("exige un identifiant de commande bien formé, 404 si inconnue", async () => {
    expect((await GET(codRequest("nope"))).status).toBe(400);
    _order = null;
    expect((await GET(codRequest())).status).toBe(404);
  });
});

describe("GET /api/checkout/verify — paiement tardif (A03)", () => {
  test("règlement refusé (commande annulée entre-temps) : état réel, 409 LATE_PAYMENT, alerte critique", async () => {
    _settleResult = { settled: false, reason: "not_pending" };
    _order = { ...BASE_ORDER_DEFAULT(), status: "cancelled", payment_status: "failed" };
    mockStripeSession({ payment_status: "paid", status: "complete", amount_total: 5000, currency: "xof" });

    const res = await GET(makeRequest("cs_test_123"));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.code).toBe("LATE_PAYMENT");
    expect(json.order).toBeUndefined();
    expect(mockOps.critical).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "payment.late_after_cancel", dedupeKey: "webhook.late_payment:order-001" }),
    );
  });

  test("déjà payée par le webhook (already_paid) : succès idempotent, sans alerte", async () => {
    _settleResult = { settled: false, reason: "already_paid" };
    mockStripeSession({ payment_status: "paid", status: "complete", amount_total: 5000, currency: "xof" });
    const res = await GET(makeRequest("cs_test_123"));
    expect(res.status).toBe(200);
    expect((await res.json()).order.payment_status).toBe("paid");
    expect(mockOps.critical).not.toHaveBeenCalled();
  });

  test("montant inférieur : 400 AMOUNT_MISMATCH et alerte critique", async () => {
    mockStripeSession({ payment_status: "paid", status: "complete", amount_total: 1000, currency: "xof" });
    const res = await GET(makeRequest("cs_test_123"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("AMOUNT_MISMATCH");
    expect(mockOps.critical).toHaveBeenCalledWith(expect.objectContaining({ kind: "webhook.amount_mismatch" }));
  });
});
