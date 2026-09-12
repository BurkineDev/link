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
  paymentProvider: "stripe",
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

jest.mock("@/lib/db/orders", () => ({
  settlePaidOrder: jest.fn(async () => ({ settled: true })),
  cancelUnpaidOrder: jest.fn(async () => ({ cancelled: true })),
}));

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
  mockRetrieveSession.mockReset();
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
