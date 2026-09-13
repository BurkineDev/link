/**
 * loadCheckoutShop : ce que la page de commande sait de la boutique avant
 * le premier rendu — et ce qu'elle refuse de savoir.
 */
let _shop: Record<string, unknown> | null = null;
const mockFindFirst = jest.fn<Promise<Record<string, unknown> | null>, [unknown]>(async () => _shop);
jest.mock("@/lib/prisma", () => ({ prisma: { shop: { findFirst: (args: unknown) => mockFindFirst(args) } } }));

import { loadCheckoutShop } from "@/lib/checkout/shop-context";

const decimal = (n: number) => ({ toString: () => String(n), valueOf: () => n });
const SHOP_ID = "fde3186e-e0f2-47f2-be06-5c4452d37687";

beforeEach(() => {
  mockFindFirst.mockClear();
  _shop = {
    id: SHOP_ID,
    slug: "wax-and-co",
    name: "Wax & Co",
    logoUrl: null,
    themeColor: "#C2410C",
    currency: "XOF",
    shippingEnabled: true,
    shippingZones: [
      { countries: ["BF", "CI"], rate: decimal(1500), freeAbove: decimal(20000), currency: "XOF" },
      { countries: ["FR"], rate: decimal(12), freeAbove: null, currency: "EUR" },
      { countries: ["SN"], rate: decimal(0), freeAbove: null, currency: "XOF" },
    ],
  };
});

test("référence invalide (injection, trop longue) → null sans requête", async () => {
  expect(await loadCheckoutShop("../etc")).toBeNull();
  expect(await loadCheckoutShop("a".repeat(51))).toBeNull();
  expect(await loadCheckoutShop("Wax Co")).toBeNull();
  expect(mockFindFirst).not.toHaveBeenCalled();
});

test("slug ou identifiant, boutiques publiées seulement", async () => {
  await loadCheckoutShop(" Wax-And-Co ");
  expect(mockFindFirst.mock.calls[0]![0]).toMatchObject({ where: { slug: "wax-and-co", isPublished: true } });
  await loadCheckoutShop(SHOP_ID.toUpperCase());
  expect(mockFindFirst.mock.calls[1]![0]).toMatchObject({ where: { id: SHOP_ID, isPublished: true } });
  _shop = null;
  expect(await loadCheckoutShop("inconnue")).toBeNull();
});

test("zones : actives, dans la devise de la boutique, Decimal → nombre", async () => {
  const shop = await loadCheckoutShop("wax-and-co");
  expect(mockFindFirst.mock.calls[0]![0]).toMatchObject({
    select: { shippingZones: { where: { isActive: true }, orderBy: { createdAt: "asc" } } },
  });
  expect(shop).toEqual({
    id: SHOP_ID,
    slug: "wax-and-co",
    name: "Wax & Co",
    logo_url: null,
    theme_color: "#C2410C",
    currency: "XOF",
    shipping_enabled: true,
    shipping_zones: [
      { countries: ["BF", "CI"], rate: 1500, free_above: 20000 },
      { countries: ["SN"], rate: 0, free_above: null },
    ],
  });
});
