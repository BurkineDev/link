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

describe("PLAN_PRICES", () => {
  it("prices Starter at 2000/month and 20000/year", () => {
    expect(PLAN_PRICES.starter.month).toBe(2_000);
    expect(PLAN_PRICES.starter.year).toBe(20_000);
  });

  it("prices Pro at 5000/month and 30000/year (50% off yearly)", () => {
    expect(PLAN_PRICES.pro.month).toBe(5_000);
    expect(PLAN_PRICES.pro.year).toBe(30_000);
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

  it("prices Featured 24h at 500 XOF for 24 hours", () => {
    expect(BOOSTS.featured_24h.amount).toBe(500);
    expect(BOOSTS.featured_24h.currency).toBe("XOF");
    expect(BOOSTS.featured_24h.durationHours).toBe(24);
  });

  it("getBoost looks up by type", () => {
    expect(getBoost("featured_24h")).toBe(BOOSTS.featured_24h);
    expect(getBoost("custom_domain").type).toBe("custom_domain");
  });
});
