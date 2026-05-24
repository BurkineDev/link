import Stripe from "stripe";

const ZERO_DECIMAL_CURRENCIES = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
  }

  return new Stripe(secretKey);
}

export function toStripeAmount(amount: number, currency: string) {
  const normalizedCurrency = currency.toUpperCase();
  const multiplier = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency) ? 1 : 100;

  return Math.round(amount * multiplier);
}

export function fromStripeAmount(amount: number | null, currency: string) {
  if (amount === null) return null;

  const normalizedCurrency = currency.toUpperCase();
  const divisor = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency) ? 1 : 100;

  return amount / divisor;
}
