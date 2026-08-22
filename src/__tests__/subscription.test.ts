/**
 * Unit tests for the subscription plan helpers.
 *
 * Verifies the new 3-tier model (Découverte / Starter / Pro) and the
 * boost catalogue gating.
 */

import {
  BOOSTS,
  PLAN_LIMITS,
  PLAN_PRICES,
  getBoost,
  getEffectivePlan,
  getPrepaidPrice,
  isPrepaidMonths,
  prepaidSavingsPercent,
  PREPAID_CURRENCY,
  PREPAID_MONTHS,
  getStripePriceId,
  isUpgrade,
} from "@/lib/subscription";

describe("PLAN_LIMITS", () => {
  it("caps free at 5 products with 5% commission", () => {
    expect(PLAN_LIMITS.free.maxProducts).toBe(5);
    expect(PLAN_LIMITS.free.commissionRate).toBe(0.05);
    expect(PLAN_LIMITS.free.label).toBe("Découverte");
  });

  it("gives Starter 20 products with 3% commission", () => {
    expect(PLAN_LIMITS.starter.maxProducts).toBe(20);
    expect(PLAN_LIMITS.starter.commissionRate).toBe(0.03);
  });

  it("gives Pro unlimited products with 0% commission", () => {
    expect(PLAN_LIMITS.pro.maxProducts).toBe(Infinity);
    expect(PLAN_LIMITS.pro.commissionRate).toBe(0);
  });
});

describe("PLAN_PRICES (CAD cents)", () => {
  it("prices Starter at 4,99 CAD/month and 49 CAD/year", () => {
    expect(PLAN_PRICES.starter.month).toBe(499);
    expect(PLAN_PRICES.starter.year).toBe(4_900);
  });

  it("prices Pro at 9,99 CAD/month and 59 CAD/year (~50% off yearly)", () => {
    expect(PLAN_PRICES.pro.month).toBe(999);
    expect(PLAN_PRICES.pro.year).toBe(5_900);
    expect(PLAN_PRICES.pro.year).toBeLessThan(PLAN_PRICES.pro.month * 12);
  });

  it("keeps Discovery free for both intervals", () => {
    expect(PLAN_PRICES.free.month).toBe(0);
    expect(PLAN_PRICES.free.year).toBe(0);
  });
});

describe("getEffectivePlan", () => {
  it("returns 'free' when subscription is null", () => {
    expect(getEffectivePlan(null)).toBe("free");
    expect(getEffectivePlan(undefined)).toBe("free");
  });

  it("returns the paid plan when status is active", () => {
    expect(
      getEffectivePlan({ plan: "starter", status: "active" }),
    ).toBe("starter");
    expect(
      getEffectivePlan({ plan: "pro", status: "active" }),
    ).toBe("pro");
  });

  it("returns the paid plan during trialing", () => {
    expect(
      getEffectivePlan({ plan: "pro", status: "trialing" }),
    ).toBe("pro");
  });

  it("downgrades to free when subscription is cancelled or past_due", () => {
    expect(
      getEffectivePlan({ plan: "pro", status: "cancelled" }),
    ).toBe("free");
    expect(
      getEffectivePlan({ plan: "starter", status: "past_due" }),
    ).toBe("free");
    expect(
      getEffectivePlan({ plan: "pro", status: "incomplete" }),
    ).toBe("free");
  });

  it("leaves free alone regardless of status", () => {
    expect(
      getEffectivePlan({ plan: "free", status: "active" }),
    ).toBe("free");
  });
});

describe("getEffectivePlan — abonnement payé d'avance", () => {
  const NOW = new Date("2026-06-15T12:00:00Z");
  const future = "2026-07-15T12:00:00Z";
  const past = "2026-06-14T12:00:00Z";

  it("accorde le plan tant que la période court", () => {
    expect(
      getEffectivePlan(
        {
          plan: "pro",
          status: "active",
          provider: "geniuspay",
          current_period_end: future,
        },
        NOW,
      ),
    ).toBe("pro");
  });

  it("retire le plan dès que la période est passée", () => {
    // Le cœur du sujet : personne d'extérieur ne vient éteindre un abonnement
    // prépayé. Sans cette règle, un mois acheté vaudrait à vie.
    expect(
      getEffectivePlan(
        {
          plan: "pro",
          status: "active",
          provider: "geniuspay",
          current_period_end: past,
        },
        NOW,
      ),
    ).toBe("free");
  });

  it("retire le plan à l'instant exact de l'expiration", () => {
    expect(
      getEffectivePlan(
        {
          plan: "starter",
          status: "active",
          provider: "geniuspay",
          current_period_end: NOW.toISOString(),
        },
        NOW,
      ),
    ).toBe("free");
  });

  it("refuse un abonnement prépayé sans période — rien n'a été encaissé", () => {
    expect(
      getEffectivePlan(
        {
          plan: "pro",
          status: "active",
          provider: "geniuspay",
          current_period_end: null,
        },
        NOW,
      ),
    ).toBe("free");
  });

  it("refuse une date illisible plutôt que d'accorder le plan", () => {
    expect(
      getEffectivePlan(
        {
          plan: "pro",
          status: "active",
          provider: "geniuspay",
          current_period_end: "pas-une-date",
        },
        NOW,
      ),
    ).toBe("free");
  });

  it("ne fait pas expirer un abonnement Stripe sur la date", () => {
    // Stripe renouvelle et prévient : appliquer la date ferait clignoter le
    // plan d'un client à jour dès qu'un webhook a une seconde de retard.
    expect(
      getEffectivePlan(
        {
          plan: "pro",
          status: "active",
          provider: "stripe",
          current_period_end: past,
        },
        NOW,
      ),
    ).toBe("pro");
  });

  it("traite un abonnement sans provider comme du Stripe (héritage)", () => {
    expect(
      getEffectivePlan(
        { plan: "pro", status: "active", current_period_end: past },
        NOW,
      ),
    ).toBe("pro");
  });

  it("un statut inactif l'emporte, même avec une période valide", () => {
    expect(
      getEffectivePlan(
        {
          plan: "pro",
          status: "cancelled",
          provider: "geniuspay",
          current_period_end: future,
        },
        NOW,
      ),
    ).toBe("free");
  });
});

describe("barème des périodes payées d'avance", () => {
  it("propose une durée pour chaque plan payant", () => {
    PREPAID_MONTHS.forEach((months) => {
      expect(getPrepaidPrice("starter", months)).toBeGreaterThan(0);
      expect(getPrepaidPrice("pro", months)).toBeGreaterThan(0);
    });
  });

  it("fait payer Pro plus cher que Starter, à durée égale", () => {
    PREPAID_MONTHS.forEach((months) => {
      expect(getPrepaidPrice("pro", months)).toBeGreaterThan(
        getPrepaidPrice("starter", months),
      );
    });
  });

  it("rend les longues durées plus avantageuses que le mois à mois", () => {
    expect(prepaidSavingsPercent("pro", 1)).toBe(0);
    expect(prepaidSavingsPercent("pro", 3)).toBeGreaterThan(0);
    expect(prepaidSavingsPercent("pro", 12)).toBeGreaterThan(
      prepaidSavingsPercent("pro", 3),
    );
    expect(prepaidSavingsPercent("starter", 12)).toBeGreaterThan(0);
  });

  it("n'accepte que les durées proposées", () => {
    expect(isPrepaidMonths(1)).toBe(true);
    expect(isPrepaidMonths(12)).toBe(true);
    expect(isPrepaidMonths(2)).toBe(false);
    expect(isPrepaidMonths(0)).toBe(false);
    expect(isPrepaidMonths(-1)).toBe(false);
    expect(isPrepaidMonths("3")).toBe(false);
  });

  it("facture en FCFA, la devise du Mobile Money", () => {
    expect(PREPAID_CURRENCY).toBe("XOF");
  });
});

describe("isUpgrade", () => {
  it("ranks free < starter < pro", () => {
    expect(isUpgrade("free", "starter")).toBe(true);
    expect(isUpgrade("free", "pro")).toBe(true);
    expect(isUpgrade("starter", "pro")).toBe(true);
  });

  it("returns false for downgrades and same-tier moves", () => {
    expect(isUpgrade("pro", "starter")).toBe(false);
    expect(isUpgrade("pro", "free")).toBe(false);
    expect(isUpgrade("starter", "free")).toBe(false);
    expect(isUpgrade("pro", "pro")).toBe(false);
  });
});

describe("getStripePriceId", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      STRIPE_STARTER_MONTHLY_PRICE_ID: "price_starter_m",
      STRIPE_STARTER_YEARLY_PRICE_ID: "price_starter_y",
      STRIPE_PRO_MONTHLY_PRICE_ID: "price_pro_m",
      STRIPE_PRO_YEARLY_PRICE_ID: "price_pro_y",
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("reads the right env var by plan + interval", () => {
    expect(getStripePriceId("starter", "month")).toBe("price_starter_m");
    expect(getStripePriceId("starter", "year")).toBe("price_starter_y");
    expect(getStripePriceId("pro", "month")).toBe("price_pro_m");
    expect(getStripePriceId("pro", "year")).toBe("price_pro_y");
  });

  it("returns null when the env var isn't set", () => {
    delete process.env.STRIPE_STARTER_MONTHLY_PRICE_ID;
    expect(getStripePriceId("starter", "month")).toBeNull();
  });
});

describe("BOOSTS catalogue", () => {
  it("ships Featured 24h as the only active boost", () => {
    expect(BOOSTS.featured_24h.available).toBe(true);
    expect(BOOSTS.custom_domain.available).toBe(false);
    expect(BOOSTS.premium_templates.available).toBe(false);
  });

  it("prices Featured 24h at 1,99 CAD for 24 hours", () => {
    expect(BOOSTS.featured_24h.amount).toBe(199);
    expect(BOOSTS.featured_24h.currency).toBe("CAD");
    expect(BOOSTS.featured_24h.durationHours).toBe(24);
  });

  it("getBoost looks up by type", () => {
    expect(getBoost("featured_24h")).toBe(BOOSTS.featured_24h);
    expect(getBoost("custom_domain").type).toBe("custom_domain");
  });
});
