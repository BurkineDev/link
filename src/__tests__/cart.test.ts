import { useCart, type CartItem } from "@/hooks/use-cart";

jest.mock("zustand/middleware", () => {
  const actual = jest.requireActual("zustand/middleware");
  const storage = new Map<string, string>();
  const testStorage = actual.createJSONStorage(() => ({
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  }));
  return { ...actual, persist: (initializer: unknown, options: object) =>
    actual.persist(initializer, { ...options, storage: testStorage }) };
});

const item: CartItem = {
  productId: "product-a", name: "Produit", price: 2500, currency: "XOF",
  quantity: 1, shopId: "shop-a", shopSlug: "boutique-a",
};

beforeEach(() => useCart.getState().clearCart());

it("conserve la quantité choisie quand l'acheteur change de boutique", () => {
  useCart.getState().addItem(item);
  useCart.getState().addItem({ ...item, productId: "product-b", shopId: "shop-b", shopSlug: "boutique-b", quantity: 3 });
  expect(useCart.getState().items).toHaveLength(1);
  expect(useCart.getState().shopId).toBe("shop-b");
  expect(useCart.getState().getItemCount()).toBe(3);
  expect(useCart.getState().getTotal()).toBe(7500);
});

it("conserve la quantité après avoir vidé le panier d'une autre boutique", () => {
  useCart.getState().addItem(item);
  useCart.getState().removeItem(item.productId);
  useCart.getState().addItem({ ...item, shopId: "shop-b", shopSlug: "boutique-b", quantity: 4 });
  expect(useCart.getState().getItemCount()).toBe(4);
});
