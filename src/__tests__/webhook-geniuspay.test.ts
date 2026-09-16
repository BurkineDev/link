import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocking DB, verifyWebhookSignature, and notifySellerOfPaidOrder
//
// La fixture de commande reste en snake_case ; `toOrder` la traduit en ligne
// Prisma. Les appels à `settlePaidOrder` / `cancelUnpaidOrder` et la mise à
// jour de la commande sont capturés sous leur ancienne forme (`p_*`,
// `payment_ref`) pour que les assertions existantes restent valables.
// ---------------------------------------------------------------------------

let _order: Record<string, unknown> | null = null;
let _orderError: unknown = null;
let _updateResult: unknown = null;
let _updateError: unknown = null;
let _rpcResult: unknown = null;
let _rpcError: unknown = null;

const toOrder = (o: Record<string, unknown>) => ({
  id: o.id,
  totalAmount: o.total_amount,
  currency: o.currency,
  paymentStatus: o.payment_status,
});

const mockPrisma = {
  order: {
    findUnique: jest.fn(async () => {
      if (_orderError) throw _orderError;
      return _order ? toOrder(_order) : null;
    }),
    update: jest.fn(async (args: { data: { paymentRef?: unknown; paymentProvider?: unknown } }) => {
      _updateResult = {
        payment_ref: args.data.paymentRef,
        payment_provider: args.data.paymentProvider,
      };
      if (_updateError) throw _updateError;
      return {};
    }),
  },
  subscriptionPayment: { updateMany: jest.fn(async () => ({ count: 0 })) },
  boostPurchase: { updateMany: jest.fn(async () => ({ count: 0 })) },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockRecordRefund = jest.fn<Promise<unknown>, unknown[]>(async () => ({ recorded: true, clawback: 9500, refundedTotal: 10000, full: true }));
jest.mock("@/lib/db/orders", () => ({
  recordOrderRefund: (...args: unknown[]) => mockRecordRefund(...args),
  settlePaidOrder: jest.fn(async (orderId: string, ref: string, provider: string) => {
    if (_rpcError) throw _rpcError;
    _rpcResult = { p_order_id: orderId, p_payment_ref: ref, p_payment_provider: provider };
    return { settled: true };
  }),
  cancelUnpaidOrder: jest.fn(async (orderId: string, ref: string, provider: string) => {
    if (_rpcError) throw _rpcError;
    _rpcResult = { p_order_id: orderId, p_payment_ref: ref, p_payment_provider: provider };
    return { cancelled: true };
  }),
}));

jest.mock("@/lib/db/subscriptions", () => ({
  applySubscriptionPayment: jest.fn(async () => ({ applied: true })),
  applyBoostPayment: jest.fn(async () => ({ applied: true })),
}));

let _verifyResult = true;
// true : vérificateur réel, pour rejouer le chemin complet en-têtes → HMAC.
let _verifyReal = false;
jest.mock("@/lib/geniuspay", () => {
  const original = jest.requireActual("@/lib/geniuspay");
  return {
    ...original,
    verifyWebhookSignature: jest.fn((args: unknown) =>
      _verifyReal ? original.verifyWebhookSignature(args) : _verifyResult,
    ),
  };
});

const mockNotifySellerOfPaidOrder = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/order-notifications", () => ({
  notifyPaidOrder: mockNotifySellerOfPaidOrder,
}));

// Alertes fondateur : on vérifie ce qui est signalé, pas l'envoi lui-même.
const mockOps = { critical: jest.fn(), warning: jest.fn(), info: jest.fn() };
jest.mock("@/lib/ops/events", () => ({ ops: mockOps, recordOpsEvent: jest.fn(), recordOpsEventAfterResponse: jest.fn() }));

import { POST } from "@/app/api/webhooks/geniuspay/route";
import { verifyWebhookSignature } from "@/lib/geniuspay";
import { applySubscriptionPayment } from "@/lib/db/subscriptions";
import { createHmac } from "node:crypto";

// ---------------------------------------------------------------------------
// Fixtures & Setup
// ---------------------------------------------------------------------------

const ORDER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const REF_GP   = "GP-123456789";

function defaultOrderFixture() {
  return {
    id: ORDER_ID,
    total_amount: 10000,
    currency: "XOF",
    payment_status: "pending",
    items: [
      { product_id: "p-001", variant_id: "v-001", quantity: 2 },
    ],
  };
}

beforeEach(() => {
  _order = defaultOrderFixture();
  _orderError = null;
  _updateResult = null;
  _updateError = null;
  _rpcResult = null;
  _rpcError = null;
  _verifyResult = true;
  _verifyReal = false;
  mockNotifySellerOfPaidOrder.mockClear();
  mockRecordRefund.mockClear();
  mockOps.critical.mockClear();
  mockOps.warning.mockClear();
  mockOps.info.mockClear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/geniuspay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-signature": "sig-test-123",
      "x-webhook-timestamp": "1735587600",
      "x-webhook-event": headers["x-webhook-event"] ?? "payment.success",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "gp-evt-001",
    event: "payment.success",
    timestamp: 1735587600,
    data: {
      reference: REF_GP,
      status: "completed",
      amount: 10000,
      currency: "XOF",
      metadata: {
        orderId: ORDER_ID,
      },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/geniuspay", () => {
  test("returns 401 if webhook signature verification fails", async () => {
    _verifyResult = false;
    process.env.GENIUSPAY_WEBHOOK_SECRET = "whsec";
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(401);
    // …et le fondateur l'apprend : un secret mal collé arrête toutes les ventes.
    expect(mockOps.critical).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "webhook.signature_rejected", dedupeKey: "webhook.signature_rejected:geniuspay" }),
    );
    delete process.env.GENIUSPAY_WEBHOOK_SECRET;
  });

  test("une requête sans aucun en-tête de signature est un robot : trace, pas de réveil", async () => {
    _verifyResult = false;
    process.env.GENIUSPAY_WEBHOOK_SECRET = "whsec";
    const res = await POST(
      new NextRequest("http://localhost:3000/api/webhooks/geniuspay", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(401);
    expect(mockOps.critical).not.toHaveBeenCalled();
    expect(mockOps.warning).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: "webhook.signature_rejected:geniuspay:unsigned" }),
    );
    delete process.env.GENIUSPAY_WEBHOOK_SECRET;
  });

  test("returns 200 for webhook.test event even without details", async () => {
    const res = await POST(
      makeRequest(
        { event: "webhook.test", data: {} },
        { "x-webhook-event": "webhook.test" }
      )
    );
    expect(res.status).toBe(200);
  });

  test("returns 200 if metadata is missing orderId", async () => {
    const payload = validPayload();
    payload.data.metadata = {} as { orderId: string };
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
  });

  test("returns 200 but does not update if order is already paid", async () => {
    if (_order) _order.payment_status = "paid";
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(mockNotifySellerOfPaidOrder).not.toHaveBeenCalled();
    expect(mockOps.critical).not.toHaveBeenCalled();
  });

  test("un paiement confirmé sur une commande déjà annulée : 200 sans écriture, mais alerte critique", async () => {
    if (_order) _order.payment_status = "failed";
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(_rpcResult).toBeNull();
    expect(mockOps.critical).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "payment.late_after_cancel",
        dedupeKey: `payment.late_after_cancel:${ORDER_ID}`,
        context: expect.objectContaining({ orderId: ORDER_ID, amount: 10000 }),
      }),
    );
  });

  test("commande introuvable pour un paiement confirmé : 200 et alerte critique", async () => {
    _order = null;
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    expect(mockOps.critical).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "webhook.order_not_found", dedupeKey: `webhook.order_not_found:geniuspay:${ORDER_ID}` }),
    );
  });

  test("updates order and notifies seller on successful payment", async () => {
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(_rpcResult).toEqual({
      p_order_id: ORDER_ID,
      p_payment_ref: REF_GP,
      p_payment_provider: "geniuspay",
    });
    expect(mockNotifySellerOfPaidOrder).toHaveBeenCalledWith(ORDER_ID);
  });

  test("returns 200 but ignores update if currency mismatches", async () => {
    const payload = validPayload();
    payload.data.currency = "USD"; // Order has XOF
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
  });

  test("returns 200 but ignores update if amount is insufficient", async () => {
    const payload = validPayload();
    payload.data.amount = 5000; // Order has 10000
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    // L'acheteur a été débité d'un autre montant : à trancher à la main.
    expect(mockOps.critical).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "payment.amount_mismatch",
        dedupeKey: `payment.amount_mismatch:${ORDER_ID}`,
        context: expect.objectContaining({ received: 5000, expected: 10000 }),
      }),
    );
  });

  test("un paiement normal ne déclenche aucune alerte", async () => {
    await POST(makeRequest(validPayload()));
    expect(mockOps.critical).not.toHaveBeenCalled();
    expect(mockOps.warning).not.toHaveBeenCalled();
  });

  test("releases stock and cancels order on failed payment", async () => {
    const payload = validPayload({ event: "payment.failed" });
    payload.data.status = "failed";
    const res = await POST(
      makeRequest(payload, { "x-webhook-event": "payment.failed" })
    );

    expect(res.status).toBe(200);
    expect(_updateResult).toBeNull();
    expect(_rpcResult).toEqual({
      p_order_id: ORDER_ID,
      p_payment_ref: REF_GP,
      p_payment_provider: "geniuspay",
    });
  });

  test("updates reference and returns 200 on pending/processing states", async () => {
    const payload = validPayload({ event: "payment.initiated" });
    payload.data.status = "processing";
    const res = await POST(
      makeRequest(payload, { "x-webhook-event": "payment.initiated" })
    );

    expect(res.status).toBe(200);
    expect(_updateResult).toEqual({
      payment_ref: REF_GP,
      payment_provider: "geniuspay",
    });
  });
  // Remboursement d'une commande déjà payée : contre-passation du net vendeur.
  test("payment.refunded sur une commande payée contre-passe le net vendeur, idempotent", async () => {
    _order = { ...defaultOrderFixture(), payment_status: "paid" };
    const payload = validPayload({
      event: "payment.refunded",
      data: { reference: REF_GP, status: "refunded", amount: 10000, currency: "XOF", metadata: { orderId: ORDER_ID } },
    });

    const res = await POST(makeRequest(payload, { "x-webhook-event": "payment.refunded" }));

    expect(res.status).toBe(200);
    expect(mockRecordRefund).toHaveBeenCalledWith(ORDER_ID, {
      amount: 10000,
      reference: `${REF_GP}:refund`,
      provider: "geniuspay",
    });
    expect(_rpcResult).toBeNull(); // ni règlement ni annulation
  });

  test("payment.refunded sur une commande encore en attente ne contre-passe rien", async () => {
    const payload = validPayload({
      data: { reference: REF_GP, status: "refunded", amount: 10000, currency: "XOF", metadata: { orderId: ORDER_ID } },
    });
    const res = await POST(makeRequest(payload, { "x-webhook-event": "payment.refunded" }));
    expect(res.status).toBe(200);
    expect(mockRecordRefund).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Le chemin de l'incident du 15/09/2026 : les en-têtes doivent arriver tels
// quels au vérificateur, et le vérificateur réel doit accepter les deux
// familles. Une faute de frappe sur un nom d'en-tête ou un corps
// re-sérialisé rejetterait tout webhook réel — et donc tout revenu
// Mobile Money — sans qu'aucun autre test ne bouge.
// ---------------------------------------------------------------------------

describe("en-têtes Genius Pay transmis jusqu'au vérificateur", () => {
  const URL = "http://localhost:3000/api/webhooks/geniuspay";
  const SECRET = "whsec_route_test";
  const hmac = (msg: string, secret = SECRET) => createHmac("sha256", secret).update(msg).digest("hex");
  const fresh = () => String(Math.floor(Date.now() / 1000));
  // Octets non canoniques (espaces, retour final, comme json_encode côté PHP) :
  // seule la chaîne exacte doit signer, pas une re-sérialisation.
  const RAW_SUBSCRIPTION =
    '{"event": "payment.success", "data": {"reference": "SUB-1", "status": "completed", "amount": 5000, "currency": "XOF", "metadata": {"kind": "subscription"}}}\n';
  const post = (raw: string, headers: Record<string, string>) =>
    POST(new NextRequest(URL, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: raw }));

  beforeEach(() => {
    process.env.GENIUSPAY_WEBHOOK_SECRET = SECRET;
    (applySubscriptionPayment as jest.Mock).mockClear();
    (verifyWebhookSignature as jest.Mock).mockClear();
  });
  afterEach(() => {
    delete process.env.GENIUSPAY_WEBHOOK_SECRET;
  });

  test("X-GeniusPay-* : signature, horodatage et corps brut arrivent tels quels au vérificateur", async () => {
    const raw = JSON.stringify(validPayload());
    await post(raw, { "x-geniuspay-signature": "sig-gp", "x-geniuspay-timestamp": "1735587600", "x-geniuspay-event": "payment.success" });
    expect(verifyWebhookSignature).toHaveBeenCalledWith({ rawBody: raw, signature: "sig-gp", timestamp: "1735587600" });
  });

  test("X-Webhook-* : idem", async () => {
    const raw = JSON.stringify(validPayload());
    await post(raw, { "x-webhook-signature": "sig-wh", "x-webhook-timestamp": "1735587600", "x-webhook-event": "payment.success" });
    expect(verifyWebhookSignature).toHaveBeenCalledWith({ rawBody: raw, signature: "sig-wh", timestamp: "1735587600" });
  });

  test("X-GeniusPay-Signature vide + X-Webhook-Signature valide : c'est la valide qui compte", async () => {
    _verifyReal = true;
    const raw = RAW_SUBSCRIPTION;
    const res = await post(raw, { "x-geniuspay-signature": "", "x-webhook-signature": hmac(raw), "x-webhook-timestamp": fresh() });
    expect(res.status).toBe(200);
    expect(mockOps.warning).not.toHaveBeenCalled();
    expect(mockOps.critical).not.toHaveBeenCalled();
  });

  test("15/09/2026 : X-Webhook-Signature = HMAC(corps brut) + X-Webhook-Timestamp → 200, abonnement crédité", async () => {
    _verifyReal = true;
    const raw = RAW_SUBSCRIPTION;
    const res = await post(raw, { "x-webhook-signature": hmac(raw), "x-webhook-timestamp": fresh(), "x-webhook-event": "payment.success" });
    expect(res.status).toBe(200);
    expect(applySubscriptionPayment).toHaveBeenCalledWith("SUB-1");
    expect(mockOps.critical).not.toHaveBeenCalled();
  });

  test("doc actuelle : X-GeniusPay-Signature = HMAC(corps brut), sans horodatage → 200, abonnement crédité", async () => {
    _verifyReal = true;
    const raw = RAW_SUBSCRIPTION;
    const res = await post(raw, { "x-geniuspay-signature": hmac(raw), "x-geniuspay-event": "payment.success" });
    expect(res.status).toBe(200);
    expect(applySubscriptionPayment).toHaveBeenCalledWith("SUB-1");
  });

  test("mauvais secret → 401, rien crédité, alerte critique (signé)", async () => {
    _verifyReal = true;
    const raw = RAW_SUBSCRIPTION;
    const res = await post(raw, { "x-geniuspay-signature": hmac(raw, "autre-secret"), "x-geniuspay-event": "payment.success" });
    expect(res.status).toBe(401);
    expect(applySubscriptionPayment).not.toHaveBeenCalled();
    expect(mockOps.critical).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "webhook.signature_rejected", dedupeKey: "webhook.signature_rejected:geniuspay" }),
    );
  });
});
