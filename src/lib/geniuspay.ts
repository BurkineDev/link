/**
 * Client Genius Pay (https://geniuspay.ci/docs/api).
 *
 * Rail Mobile Money (Wave, Orange Money, MTN MoMo, Moov, M-Pesa…) :
 * abonnements prépayés et boosts des vendeurs ; ventes acheteurs si le mode
 * En ligne est actif (voir @/lib/payments/online-checkout). Stripe porte la
 * carte.
 *
 * Server-only — ne jamais importer depuis un Client Component.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

// Hôte documenté. `pay.genius.ci` sert la même API — vérifié, réponses
// identiques — mais c'est un alias que la documentation ne mentionne nulle
// part : en dépendre par défaut, c'est parier sur un domaine qui peut
// disparaître sans préavis, au milieu de l'encaissement.
const DEFAULT_BASE_URL = "https://geniuspay.ci/api/v1/merchant";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface GeniusPayConfig {
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  baseUrl: string;
}

/** Resolve config from environment variables. Throws if unset. */
export function getGeniusPayConfig(): GeniusPayConfig {
  const apiKey = process.env.GENIUSPAY_API_KEY;
  const apiSecret = process.env.GENIUSPAY_API_SECRET;
  const webhookSecret = process.env.GENIUSPAY_WEBHOOK_SECRET;
  const baseUrl = process.env.GENIUSPAY_BASE_URL ?? DEFAULT_BASE_URL;

  if (!apiKey || !apiSecret || !webhookSecret) {
    throw new Error(
      "Missing GENIUSPAY_API_KEY, GENIUSPAY_API_SECRET or GENIUSPAY_WEBHOOK_SECRET environment variables.",
    );
  }

  return { apiKey, apiSecret, webhookSecret, baseUrl };
}

export function isGeniusPayConfigured(): boolean {
  return (
    !!process.env.GENIUSPAY_API_KEY &&
    !!process.env.GENIUSPAY_API_SECRET &&
    !!process.env.GENIUSPAY_WEBHOOK_SECRET
  );
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GeniusPayStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "refunded"
  | "expired";

export interface CreatePaymentInput {
  amount: number;          // integer in XOF
  currency?: string;       // default XOF
  description?: string;
  customer: {
    name?: string;
    email?: string;
    phone?: string;
    country?: string;      // ISO2 (e.g. "CI")
  };
  /**
   * Omit to show the Genius Pay checkout page (recommended — lets the buyer
   * pick their Mobile Money provider). Set to a specific rail to skip ahead.
   */
  payment_method?:
    | "wave"
    | "orange_money"
    | "mtn_money"
    | "moov_money"
    | "airtel_money"
    | "pawapay"
    | "paystack"
    | "card";
  /** Explicit PawaPay provider code (e.g. "ORANGE_CIV"). */
  mmo_provider?: string;
  success_url?: string;
  error_url?: string;
  metadata?: Record<string, string | number | null>;
}

export interface CreatePaymentResponse {
  id: number;
  reference: string;          // MTX-XXXXXXXXXX
  amount: number;
  currency: string;
  fees: number;
  net_amount: number;
  status: GeniusPayStatus;
  checkout_url?: string;      // present when no payment_method specified
  payment_url?: string;       // direct provider URL
  gateway?: string;
  environment: "sandbox" | "live";
  metadata?: Record<string, string | number | null>;
  expires_at?: string;
}

export interface FetchPaymentResponse extends CreatePaymentResponse {
  payment_method?: string;
  payment_provider?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  created_at: string;
  completed_at?: string | null;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

class GeniusPayError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "GeniusPayError";
  }
}

async function request<T>(
  path: string,
  options: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<T> {
  const config = getGeniusPayConfig();
  const url = `${config.baseUrl}${path}`;

  const res = await fetch(url, {
    method: options.method,
    headers: {
      "X-API-Key": config.apiKey,
      "X-API-Secret": config.apiSecret,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    // Un prestataire qui pend ne doit pas bloquer une caisse ni le cron
    // (cinquante appels séquentiels) jusqu'au plafond de la plateforme.
    signal: AbortSignal.timeout(15_000),
  });

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string };
  };

  if (!res.ok || !json.success || !json.data) {
    throw new GeniusPayError(
      json.error?.message ?? `Genius Pay request failed (${res.status})`,
      res.status,
      json.error?.code,
    );
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a payment. Returns a CreatePaymentResponse — redirect the buyer to
 * `checkout_url` (multi-provider page) or `payment_url` (direct).
 */
export function createPayment(input: CreatePaymentInput) {
  return request<CreatePaymentResponse>("/payments", {
    method: "POST",
    body: input,
  });
}

/** Fetch the live status of a payment by its reference. */
export function fetchPayment(reference: string) {
  return request<FetchPaymentResponse>(
    `/payments/${encodeURIComponent(reference)}`,
  );
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Vérifie un webhook Genius Pay entrant.
 *
 * La documentation marchande (« Sécurité des webhooks », septembre 2026)
 * signe le CORPS BRUT seul : `HMAC-SHA256(rawBody, secret)`, en-têtes
 * `X-GeniusPay-Signature` / `X-GeniusPay-Timestamp` / `X-GeniusPay-Event`.
 * Une version antérieure signait `timestamp + "." + rawBody` avec des
 * en-têtes `X-Webhook-*` : c'est ce que ce code attendait, et les deux
 * seuls webhooks réels reçus (15 septembre 2026, `payment.initiated`) ont
 * été rejetés en 401 — sans webhook accepté, aucun abonnement prépayé ni
 * boost Mobile Money n'est crédité.
 *
 * On accepte donc les deux schémas, en comparaison à temps constant, et
 * l'horodatage n'est contrôlé que s'il est fourni (la référence PHP de la
 * doc n'en envoie pas) : l'idempotence des traitements (déjà payé → rien)
 * couvre le rejeu. `rawBody` DOIT être les octets exacts reçus
 * (`await request.text()` avant tout parsing).
 */
export function verifyWebhookSignature(args: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  webhookSecret?: string;
  toleranceSeconds?: number;
}): boolean {
  const { rawBody, timestamp } = args;
  const signature = args.signature?.trim().toLowerCase() ?? "";
  if (!signature) return false;

  if (timestamp) {
    const raw = Number(timestamp);
    if (!Number.isFinite(raw)) return false;
    // Secondes ou millisecondes : la doc dit « Timestamp Unix » sans préciser.
    const ts = raw > 1e12 ? raw / 1000 : raw;
    const tolerance = args.toleranceSeconds ?? 300;
    if (Math.abs(Date.now() / 1000 - ts) > tolerance) return false;
  }

  const secret =
    args.webhookSecret ??
    process.env.GENIUSPAY_WEBHOOK_SECRET ??
    "";
  if (!secret) return false;

  const candidates = [rawBody];
  if (timestamp) candidates.push(`${timestamp}.${rawBody}`);
  const provided = Buffer.from(signature);
  return candidates.some((message) => {
    const expected = Buffer.from(createHmac("sha256", secret).update(message).digest("hex"));
    if (expected.length !== provided.length) return false;
    try {
      return timingSafeEqual(expected, provided);
    } catch {
      return false;
    }
  });
}

// ---------------------------------------------------------------------------
// Status mapping → our internal payment_status enum
// ---------------------------------------------------------------------------

import type { PaymentStatus } from "@/lib/types/database";

export function mapStatusToPaymentStatus(s: GeniusPayStatus): PaymentStatus {
  switch (s) {
    case "completed":
      return "paid";
    case "refunded":
      return "refunded";
    case "failed":
    case "cancelled":
    case "expired":
      return "failed";
    case "pending":
    case "processing":
    default:
      return "pending";
  }
}
