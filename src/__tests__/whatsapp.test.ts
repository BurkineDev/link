/**
 * Unit tests for the wa.me URL builder used by the "WhatsApp checkout"
 * mode. The seller's number is user-supplied and the buyer's text gets
 * URL-encoded into the link, so this is where bad input would break the
 * whole flow.
 */

import {
  buildWhatsAppOrderUrl,
  isValidWhatsAppNumber,
  normalizeWhatsAppNumber,
} from "@/lib/utils/whatsapp";

describe("normalizeWhatsAppNumber", () => {
  it("strips spaces, parens, dashes and the + prefix", () => {
    expect(normalizeWhatsAppNumber("+226 70 12 34 56")).toBe("22670123456");
    expect(normalizeWhatsAppNumber("(226) 70-12-34-56")).toBe("22670123456");
  });

  it("returns empty string for nullish input", () => {
    expect(normalizeWhatsAppNumber(null)).toBe("");
    expect(normalizeWhatsAppNumber(undefined)).toBe("");
    expect(normalizeWhatsAppNumber("")).toBe("");
  });
});

describe("isValidWhatsAppNumber", () => {
  it("accepts numbers between 8 and 15 digits (E.164)", () => {
    expect(isValidWhatsAppNumber("+22670123456")).toBe(true);
    expect(isValidWhatsAppNumber("+1 415 555 0100")).toBe(true);
  });

  it("rejects too-short numbers (likely missing country code)", () => {
    expect(isValidWhatsAppNumber("1234567")).toBe(false);
    expect(isValidWhatsAppNumber("12")).toBe(false);
  });

  it("rejects too-long numbers (>15 digits)", () => {
    expect(isValidWhatsAppNumber("1234567890123456")).toBe(false);
  });

  it("rejects null/undefined/empty", () => {
    expect(isValidWhatsAppNumber(null)).toBe(false);
    expect(isValidWhatsAppNumber(undefined)).toBe(false);
    expect(isValidWhatsAppNumber("")).toBe(false);
  });
});

describe("buildWhatsAppOrderUrl", () => {
  const shop = { whatsappNumber: "+226 70 12 34 56", shopName: "Amara Fashion" };

  it("returns null when the number is missing or invalid (so callers hide the CTA)", () => {
    expect(
      buildWhatsAppOrderUrl({ ...shop, whatsappNumber: null }),
    ).toBeNull();
    expect(
      buildWhatsAppOrderUrl({ ...shop, whatsappNumber: "123" }),
    ).toBeNull();
  });

  it("targets wa.me with the digits-only number", () => {
    const url = buildWhatsAppOrderUrl(shop)!;
    expect(url).toMatch(/^https:\/\/wa\.me\/22670123456\?text=/);
  });

  it("greets the shop and asks about its products when no product is passed", () => {
    const url = buildWhatsAppOrderUrl(shop)!;
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain("Bonjour Amara Fashion");
    expect(text).toContain("questions sur ta boutique");
  });

  it("includes product name, variant and quantity when given", () => {
    const url = buildWhatsAppOrderUrl({
      ...shop,
      productName: "Robe wax",
      variantLabel: "L / Rouge",
      quantity: 2,
      price: 12500,
      currency: "XOF",
    })!;
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain("Robe wax");
    expect(text).toContain("L / Rouge");
    expect(text).toContain("× 2");
  });

  it("multiplies price by quantity in the prefilled total", () => {
    const url = buildWhatsAppOrderUrl({
      ...shop,
      productName: "Sac",
      price: 5000,
      currency: "XOF",
      quantity: 3,
    })!;
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toMatch(/15[\s ]?000/);
  });

  it("appends the shop URL when provided", () => {
    const url = buildWhatsAppOrderUrl({
      ...shop,
      shopUrl: "https://www.bio-lien.com/amara",
    })!;
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain("https://www.bio-lien.com/amara");
  });

  it("URL-encodes special characters in product names (so emojis and accents don't break the link)", () => {
    const url = buildWhatsAppOrderUrl({
      ...shop,
      productName: "Crème Karité 🌿",
    })!;
    expect(url).not.toContain("🌿");
    expect(url).toContain("%F0%9F%8C%BF");
  });
});
