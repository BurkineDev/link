/* Offline audit probes. Uses real application functions with in-memory service
 * doubles. No .env loading, database access, emails or payment requests.
 * Run: node scripts/audit-repro.cjs
 * confirmed=true means the undesirable behavior was reproduced, not corrected.
 */
const path = require("node:path");
const Module = require("node:module");
const root = path.resolve(__dirname, "..");
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "CommonJS", moduleResolution: "node", jsx: "react-jsx",
});
require("ts-node/register/transpile-only");

const doubles = {};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  if (Object.hasOwn(doubles, request)) return doubles[request];
  if (request.includes("prisma/generated/client/client")) {
    return { Prisma: { Decimal: Number } };
  }
  return originalLoad.call(this,
    request.startsWith("@/") ? path.join(root, "src", request.slice(2)) : request,
    parent, isMain);
};
global.fetch = async () => { throw new Error("Network disabled in audit probes"); };

const results = [];
function record(id, confirmed, evidence) { results.push({ id, confirmed, evidence }); }
const id = "11111111-1111-4111-8111-111111111111";
const shopId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";
const date = new Date("2026-09-11T00:00:00Z");
const product = {
  id: productId, shopId, name: "Audit fictif", slug: "audit-fictif",
  description: null, price: 1000.2, comparePrice: null, currency: "XOF",
  images: [], categoryId: null, isPublished: true, isDigital: true,
  stockQuantity: null, hasVariants: false,
  metadata: { download_url: "https://example.test/private-paid-file.pdf" },
  createdAt: date, updatedAt: date,
};
const order = {
  id, shopId, customerId: null, buyerEmail: "audit@example.test",
  buyerName: "Audit fictif", buyerPhone: "+2250700000000",
  status: "cancelled", paymentStatus: "failed", paymentProvider: "geniuspay",
  paymentRef: "AUDIT-REF", totalAmount: 1000.2, shippingAmount: 0,
  currency: "XOF", items: [], shippingAddress: null, notes: null,
  promoCode: null, discountAmount: 0, trackingToken: productId,
  createdAt: date, updatedAt: date,
};

async function main() {
  const { getAppLinkDestination } = require(path.join(root, "src/lib/links/app-link.ts"));
  for (const [probe, url] of [
    ["LINK-MALFORMED", "https://instagram.com/%ZZ"],
    ["LINK-WHATSAPP", "https://wa.me/message/ABCDEF123"],
    ["LINK-TELEGRAM", "https://t.me/c/123456/42"],
  ]) {
    try {
      const destination = getAppLinkDestination(url);
      record(probe, destination.nativeUrl === "whatsapp://send" ||
        destination.nativeUrl === "tg://resolve?domain=c&post=123456", destination);
    } catch (error) { record(probe, true, { url, exception: error.message }); }
  }

  const { serializeProduct } = require(path.join(root, "src/lib/db/serialize.ts"));
  const publicProduct = serializeProduct(product);
  record("PUBLIC-DOWNLOAD", Boolean(publicProduct.metadata?.download_url), {
    publicMetadata: publicProduct.metadata,
    boundary: "Public shop/product pages pass serializeProduct output to client components",
  });

  const validation = require(path.join(root, "src/lib/validations/product.ts"));
  const productInput = { name: "Produit test", slug: "produit-test", price: 1000.2,
    currency: "XOF", is_digital: true, is_published: true };
  record("DIGITAL-WITHOUT-FILE", validation.createProductSchema.safeParse(productInput).success,
    { input: productInput });

  const updates = [];
  const tx = {
    $queryRaw: async () => [{ id }],
    order: {
      findUniqueOrThrow: async () => ({ id, status: "pending", paymentStatus: "pending", shop: { ownerId: "seller" } }),
      update: async (args) => { updates.push(args.data); return args.data; },
    },
    orderStatusEvent: { create: async (args) => args.data },
  };
  const db = { $transaction: async (fn) => fn(tx) };
  doubles["@/lib/prisma"] = { prisma: db };
  const orders = require(path.join(root, "src/lib/db/orders.ts"));
  await orders.transitionOrderStatus({ orderId: id, status: "cancelled", actorId: "seller" });
  record("CANCEL-RESERVATION", updates[0]?.status === "cancelled" && !updates[0]?.paymentStatus,
    { writes: [...updates], note: "Cancellation returns success with no stock/promo release or payment-state change" });
  updates.length = 0;
  const confirmed = await orders.transitionOrderStatus({ orderId: id, status: "confirmed", actorId: "seller" });
  record("CONFIRM-UNPAID", confirmed.updated, { result: confirmed, writes: [...updates] });

  db.order = { findUnique: async () => order };
  db.shop = { findUnique: async () => ({ name: "Audit", slug: "audit", whatsappNumber: null }) };
  doubles["@/lib/db/orders"] = {
    settlePaidOrder: async () => ({ settled: false, reason: "not_pending" }),
    cancelUnpaidOrder: async () => ({ cancelled: false, reason: "already_settled" }),
  };
  const notifications = [];
  doubles["@/lib/order-notifications"] = {
    notifyPaidOrder: async () => { notifications.push("buyer+seller"); },
    notifySellerOfPaidOrder: async () => { notifications.push("seller"); },
  };
  const paymentsCreated = [];
  doubles["@/lib/geniuspay"] = {
    isGeniusPayConfigured: () => true,
    fetchPayment: async () => ({ amount: 1000.2, currency: "XOF", status: "completed", reference: "AUDIT-REF" }),
    mapStatusToPaymentStatus: (s) => s === "completed" ? "paid" : "pending",
    createPayment: async (input) => {
      paymentsCreated.push(input);
      return { reference: "AUDIT-REF", checkout_url: "https://example.test/checkout" };
    },
  };
  const verify = require(path.join(root, "src/app/api/checkout/verify/route.ts"));
  const response = await verify.GET(new Request(`http://localhost/api/checkout/verify?provider=geniuspay&order=${id}`));
  const verified = await response.json();
  record("VERIFY-FALSE-SUCCESS", verified.order?.payment_status === "paid", {
    stored: { paymentStatus: order.paymentStatus, status: order.status },
    settlement: { settled: false, reason: "not_pending" },
    response: { httpStatus: response.status, paymentStatus: verified.order?.payment_status },
  });

  let reservations = 0;
  const createdOrders = [];
  Object.assign(db, {
    shop: { findUnique: async () => ({ id: shopId, currency: "XOF", name: "Audit",
      slug: "audit", ownerId: "seller", isPublished: true, shippingEnabled: false }) },
    product: { findMany: async () => [product] },
    creatorSubscription: { findUnique: async () => null },
    order: {
      create: async (args) => { createdOrders.push(args.data); return { id }; },
      update: async () => ({}),
    },
  });
  doubles["@/lib/db/stock"] = {
    reserveStock: async () => { reservations++; return { ok: true }; },
    releaseStock: async () => undefined,
  };
  doubles["@/lib/db/promo"] = {};
  const checkout = require(path.join(root, "src/app/api/checkout/route.ts"));
  const payload = { shopId, buyerDetails: { full_name: "Audit fictif", email: "audit@example.test", phone: "+2250700000000" },
    shippingAddress: null, items: [{ product_id: productId, quantity: 1, unit_price: 1000.2 }],
    paymentMethod: { type: "mobile_money" }, currency: "XOF" };
  const statuses = [];
  for (let i = 0; i < 2; i++) {
    const res = await checkout.POST(new Request("http://localhost/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "same-attempt" },
      body: JSON.stringify(payload),
    }));
    statuses.push(res.status);
  }
  record("CHECKOUT-DUPLICATE", createdOrders.length === 2 && reservations === 2,
    { statuses, ordersCreated: createdOrders.length, reservations, paymentRequests: paymentsCreated.length });
  record("AMOUNT-ROUNDING", paymentsCreated[0]?.amount < createdOrders[0]?.totalAmount,
    { storedTotal: createdOrders[0]?.totalAmount, requestedAmount: paymentsCreated[0]?.amount,
      consequence: "A completed payment of requestedAmount fails the >= storedTotal settlement guard" });

  console.log(JSON.stringify({ kind: "offline probes, not live integration tests", results }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
