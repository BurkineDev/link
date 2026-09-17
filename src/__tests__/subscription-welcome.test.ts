/**
 * Page « Bienvenue » après paiement d'un abonnement : la partie pure
 * (plan attendu vs plan effectif) et la route de statut qu'elle interroge
 * en attendant le webhook.
 */
import { NextRequest } from "next/server";
import { planArrived, parseExpectedPlan, parseVia, WELCOME_POLL_MS, WELCOME_TIMEOUT_MS } from "@/lib/plans/welcome";

let _user: { id: string } | null = { id: "u1" };
let _sub: Record<string, unknown> | null = null;
jest.mock("@/lib/prisma", () => ({
  prisma: {
    creatorSubscription: { findUnique: jest.fn(async () => _sub) },
    shop: { findFirst: jest.fn(async () => ({ _count: { products: 2 } })) },
    subscriptionPayment: { findFirst: jest.fn(async () => ({ reference: "MTX-TEST-1" })) },
  },
}));
jest.mock("@/lib/auth", () => ({ getCurrentUser: jest.fn(async () => _user), requireUser: jest.fn(async () => _user ?? { id: "u1" }) }));

import { GET } from "@/app/api/subscription/status/route";

describe("planArrived", () => {
  test("seul le plan attendu, exactement, vaut « arrivé »", () => {
    expect(planArrived("starter", "starter")).toBe(true);
    expect(planArrived("pro", "pro")).toBe(true);
  });
  test("moins que le plan attendu : pas encore", () => {
    expect(planArrived("pro", "starter")).toBe(false);
    expect(planArrived("starter", "free")).toBe(false);
  });
  test("Pro actif qui achète Starter : on attend la rétrogradation par le webhook", () => {
    expect(planArrived("starter", "pro")).toBe(false);
  });
});

describe("paramètres de l'URL de retour", () => {
  test("seuls starter et pro sont des achats", () => {
    expect(parseExpectedPlan("pro")).toBe("pro");
    expect(parseExpectedPlan(["starter"])).toBe("starter");
    expect(parseExpectedPlan("free")).toBeNull();
    expect(parseExpectedPlan(undefined)).toBeNull();
  });
  test("via : carte, sinon Mobile Money", () => {
    expect(parseVia("carte")).toBe("carte");
    expect(parseVia("mobile-money")).toBe("mobile-money");
    expect(parseVia(undefined)).toBe("mobile-money");
  });
  test("l'attente reste bornée", () => {
    expect(WELCOME_POLL_MS).toBeGreaterThanOrEqual(2_000);
    expect(WELCOME_TIMEOUT_MS).toBeLessThanOrEqual(3 * 60_000);
  });
});

describe("GET /api/subscription/status", () => {
  const call = () => GET();

  test("non connecté : 401", async () => {
    _user = null;
    expect((await call()).status).toBe(401);
    _user = { id: "u1" };
  });

  test("sans abonnement : plan effectif Découverte", async () => {
    _sub = null;
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ effective_plan: "free", plan: null, status: null, current_period_end: null });
  });

  test("abonnement prépayé actif : plan effectif = plan", async () => {
    const end = new Date(Date.now() + 20 * 86_400_000);
    _sub = { plan: "pro", status: "active", provider: "geniuspay", currentPeriodEnd: end, cancelAtPeriodEnd: false };
    const body = await (await call()).json();
    expect(body).toMatchObject({ effective_plan: "pro", plan: "pro", provider: "geniuspay", current_period_end: end.toISOString() });
  });

  test("abonnement prépayé expiré : retombe en Découverte, sans cacher la ligne", async () => {
    _sub = { plan: "starter", status: "active", provider: "geniuspay", currentPeriodEnd: new Date(Date.now() - 86_400_000), cancelAtPeriodEnd: false };
    const body = await (await call()).json();
    expect(body.effective_plan).toBe("free");
    expect(body.plan).toBe("starter");
  });
});

// ---------------------------------------------------------------------------
// La page serveur : sans contexte d'achat et sans plan payant, on va aux
// Tarifs plutôt que d'afficher un sablier qui n'attend rien.
// ---------------------------------------------------------------------------

jest.mock("next/navigation", () => ({
  redirect: jest.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

describe("page /dashboard/abonnement (serveur)", () => {
  test("sans ?plan et en Découverte : redirection vers /pricing", async () => {
    _sub = null;
    const mod = await import("@/app/(dashboard)/dashboard/abonnement/page");
    await expect(mod.default({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT:/pricing");
  });

  test("sans ?plan mais plan payant actif : la page se rend (pas de redirection)", async () => {
    _sub = { plan: "pro", status: "active", provider: "geniuspay", currentPeriodEnd: new Date(Date.now() + 86_400_000), cancelAtPeriodEnd: false };
    const mod = await import("@/app/(dashboard)/dashboard/abonnement/page");
    const element = await mod.default({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });

  test("retour Mobile Money : la référence du paiement en attente est transmise", async () => {
    _sub = null;
    const mod = await import("@/app/(dashboard)/dashboard/abonnement/page");
    const element = (await mod.default({ searchParams: Promise.resolve({ plan: "starter", via: "mobile-money" }) })) as { props: { reference: string | null; expected: string } };
    expect(element.props.expected).toBe("starter");
    expect(element.props.reference).toBe("MTX-TEST-1");
  });
});
