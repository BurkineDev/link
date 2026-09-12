/**
 * Invalidation du cache des pages boutique : à chaque écriture du vendeur,
 * la page publique et ses fiches produit doivent être marquées périmées,
 * sans jamais faire échouer la mutation.
 */
const _paths: Array<[string, string | undefined]> = [];
let _slug: string | null = "boutique-awa";
let _throwOnRevalidate = false;

jest.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => {
    if (_throwOnRevalidate) throw new Error("outside request scope");
    _paths.push([path, type]);
  },
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    shop: {
      findUnique: jest.fn(async () => (_slug ? { slug: _slug } : null)),
    },
  },
}));

import { revalidateShop, revalidateShopSlug } from "@/lib/shops/revalidate";

beforeEach(() => {
  _paths.length = 0;
  _slug = "boutique-awa";
  _throwOnRevalidate = false;
});

test("revalidateShop invalide la page boutique et toutes ses fiches produit", async () => {
  await revalidateShop("shop-1");
  expect(_paths).toEqual([
    ["/boutique-awa", undefined],
    ["/boutique-awa/[productSlug]", "page"],
  ]);
});

test("renommage : l'ancien et le nouveau slug sont invalidés", () => {
  revalidateShopSlug("ancien-nom", "nouveau-nom");
  expect(_paths.map(([p]) => p)).toEqual([
    "/ancien-nom",
    "/ancien-nom/[productSlug]",
    "/nouveau-nom",
    "/nouveau-nom/[productSlug]",
  ]);
});

test("boutique introuvable ou slug vide : rien, sans erreur", async () => {
  _slug = null;
  await expect(revalidateShop("nope")).resolves.toBeUndefined();
  revalidateShopSlug("", "");
  expect(_paths).toEqual([]);
});

test("une erreur de revalidation ne remonte jamais (la mutation a déjà réussi)", async () => {
  _throwOnRevalidate = true;
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  await expect(revalidateShop("shop-1")).resolves.toBeUndefined();
  expect(() => revalidateShopSlug("x")).not.toThrow();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});
