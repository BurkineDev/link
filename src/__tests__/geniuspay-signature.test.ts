/**
 * Signature des webhooks Genius Pay : la doc marchande signe le corps brut
 * seul (en-têtes X-GeniusPay-*) ; l'ancien schéma timestamp.corps reste
 * accepté. Sans ça, aucun abonnement prépayé n'est crédité (15/09/2026 :
 * deux webhooks réels rejetés en 401).
 */
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "@/lib/geniuspay";

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ event: "payment.success", data: { transaction: { reference: "MTX-1" } } });
const hmac = (message: string, secret = SECRET) => createHmac("sha256", secret).update(message).digest("hex");
const nowSeconds = () => String(Math.floor(Date.now() / 1000));

describe("verifyWebhookSignature", () => {
  test("schéma documenté : HMAC du corps brut, avec horodatage en secondes", () => {
    const timestamp = nowSeconds();
    expect(verifyWebhookSignature({ rawBody: BODY, signature: hmac(BODY), timestamp, webhookSecret: SECRET })).toBe(true);
  });

  test("schéma documenté sans horodatage (référence PHP) : accepté", () => {
    expect(verifyWebhookSignature({ rawBody: BODY, signature: hmac(BODY), timestamp: null, webhookSecret: SECRET })).toBe(true);
  });

  test("horodatage en millisecondes : accepté", () => {
    const timestamp = String(Date.now());
    expect(verifyWebhookSignature({ rawBody: BODY, signature: hmac(BODY), timestamp, webhookSecret: SECRET })).toBe(true);
  });

  test("ancien schéma timestamp.corps : toujours accepté", () => {
    const timestamp = nowSeconds();
    expect(verifyWebhookSignature({ rawBody: BODY, signature: hmac(`${timestamp}.${BODY}`), timestamp, webhookSecret: SECRET })).toBe(true);
  });

  test("signature en majuscules ou avec espaces : normalisée", () => {
    expect(verifyWebhookSignature({ rawBody: BODY, signature: ` ${hmac(BODY).toUpperCase()} `, timestamp: null, webhookSecret: SECRET })).toBe(true);
  });

  test("mauvais secret, corps modifié, signature vide ou absente : refusés", () => {
    expect(verifyWebhookSignature({ rawBody: BODY, signature: hmac(BODY, "autre"), timestamp: null, webhookSecret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ rawBody: BODY + " ", signature: hmac(BODY), timestamp: null, webhookSecret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ rawBody: BODY, signature: "", timestamp: null, webhookSecret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ rawBody: BODY, signature: null, timestamp: nowSeconds(), webhookSecret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ rawBody: BODY, signature: "abc", timestamp: null, webhookSecret: SECRET })).toBe(false);
  });

  test("horodatage fourni mais hors fenêtre ou illisible : refusé, même signature juste", () => {
    const old = String(Math.floor(Date.now() / 1000) - 600);
    expect(verifyWebhookSignature({ rawBody: BODY, signature: hmac(BODY), timestamp: old, webhookSecret: SECRET })).toBe(false);
    const future = String(Math.floor(Date.now() / 1000) + 600);
    expect(verifyWebhookSignature({ rawBody: BODY, signature: hmac(BODY), timestamp: future, webhookSecret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ rawBody: BODY, signature: hmac(BODY), timestamp: "hier", webhookSecret: SECRET })).toBe(false);
  });

  test("secret absent : refusé", () => {
    const saved = process.env.GENIUSPAY_WEBHOOK_SECRET;
    delete process.env.GENIUSPAY_WEBHOOK_SECRET;
    expect(verifyWebhookSignature({ rawBody: BODY, signature: hmac(BODY), timestamp: null })).toBe(false);
    if (saved !== undefined) process.env.GENIUSPAY_WEBHOOK_SECRET = saved;
  });
});

describe("probeWebhookSignatureScheme (diagnostic, noms seulement)", () => {
  const saved = { w: process.env.GENIUSPAY_WEBHOOK_SECRET, a: process.env.GENIUSPAY_API_SECRET };
  beforeEach(() => {
    process.env.GENIUSPAY_WEBHOOK_SECRET = SECRET;
    process.env.GENIUSPAY_API_SECRET = "sk_api_secret";
  });
  afterEach(() => {
    if (saved.w === undefined) delete process.env.GENIUSPAY_WEBHOOK_SECRET; else process.env.GENIUSPAY_WEBHOOK_SECRET = saved.w;
    if (saved.a === undefined) delete process.env.GENIUSPAY_API_SECRET; else process.env.GENIUSPAY_API_SECRET = saved.a;
  });

  test("nomme le schéma qui aurait accepté la requête", async () => {
    const { probeWebhookSignatureScheme } = await import("@/lib/geniuspay");
    const ts = nowSeconds();
    expect(probeWebhookSignatureScheme({ rawBody: BODY, signature: hmac(BODY), timestamp: ts })).toBe("webhook:raw:hex");
    expect(probeWebhookSignatureScheme({ rawBody: BODY, signature: hmac(`${ts}${BODY}`), timestamp: ts })).toBe("webhook:ts+raw:hex");
    expect(probeWebhookSignatureScheme({ rawBody: BODY, signature: hmac(BODY, "sk_api_secret"), timestamp: ts })).toBe("api:raw:hex");
    const b64 = createHmac("sha256", SECRET).update(BODY).digest("base64");
    expect(probeWebhookSignatureScheme({ rawBody: BODY, signature: b64, timestamp: null })).toBe("webhook:raw:base64");
  });

  test("secret inconnu : null (aucun nom inventé)", async () => {
    const { probeWebhookSignatureScheme } = await import("@/lib/geniuspay");
    expect(probeWebhookSignatureScheme({ rawBody: BODY, signature: hmac(BODY, "autre"), timestamp: null })).toBeNull();
    expect(probeWebhookSignatureScheme({ rawBody: BODY, signature: null, timestamp: null })).toBeNull();
  });
});
