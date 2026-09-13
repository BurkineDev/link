/**
 * useCartReady : le panier vit dans localStorage ; la page de commande ne
 * doit ni le juger vide pendant l'hydratation, ni casser quand le stockage
 * est bloqué (cookies refusés, WebView sans DOM storage), ni attendre à
 * jamais quand la valeur stockée est illisible.
 *
 * Le hook est exercé sans DOM : on rejoue ses deux instantanés comme React
 * le ferait (serveur → false, client → getSnapshot).
 */
type G = { window?: unknown };
const g = globalThis as unknown as G;

function storage(initial: Record<string, string>) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const ITEM = { productId: "p1", name: "Savon", price: 1500, currency: "XOF", quantity: 1, shopId: "shop-1", shopSlug: "maboutique" };

beforeEach(() => {
  jest.resetModules();
});
afterEach(() => {
  delete g.window;
});

async function snapshot() {
  return import("@/hooks/use-cart");
}

test("serveur : jamais prêt, quel que soit le stockage", async () => {
  // Même instance de React que le hook : tout est importé après resetModules.
  const { createElement } = await import("react");
  const { renderToString } = await import("react-dom/server");
  const { useCartReady } = await snapshot();
  const Probe = () => createElement("span", null, String(useCartReady()));
  expect(renderToString(createElement(Probe))).toContain("false");
});

test("stockage lisible : prêt dès que la persistance est relue, articles présents", async () => {
  g.window = {
    localStorage: storage({
      "linkboutik-cart": JSON.stringify({ state: { items: [ITEM], shopId: "shop-1" }, version: 0 }),
    }),
  };
  const { useCart, cartHydrationSnapshot } = await snapshot();
  expect(useCart.getState().items).toHaveLength(1);
  expect(cartHydrationSnapshot()).toBe(true);
});

test("stockage bloqué (le getter lève) : le store tourne en mémoire et le hook ne lève pas", async () => {
  g.window = {
    get localStorage(): Storage {
      throw new Error("SecurityError: The operation is insecure.");
    },
  };
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const { useCart, cartHydrationSnapshot } = await snapshot();
  useCart.getState().addItem(ITEM);
  expect(useCart.getState().items).toHaveLength(1);
  expect(() => cartHydrationSnapshot()).not.toThrow();
  expect(cartHydrationSnapshot()).toBe(true);
  warn.mockRestore();
});

test("valeur stockée illisible : réputé prêt (panier vide) plutôt qu'attendre à jamais", async () => {
  g.window = { localStorage: storage({ "linkboutik-cart": '{"state":{"items":[{"productId":"p0"' }) };
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  const { useCart, cartHydrationSnapshot } = await snapshot();
  expect(useCart.getState().items).toEqual([]);
  expect(cartHydrationSnapshot()).toBe(true);
  error.mockRestore();
});

test("updatePrices remplace le prix des articles visés, addItem rafraîchit prix et nature", async () => {
  g.window = { localStorage: storage({}) };
  const { useCart } = await snapshot();
  useCart.getState().addItem({ ...ITEM, isDigital: false });
  useCart.getState().addItem({ ...ITEM, variantId: "v1", price: 2000 });
  useCart.getState().updatePrices([{ product_id: "p1", variant_id: null, unit_price: 1800 }]);
  expect(useCart.getState().items.map((i) => [i.variantId, i.price])).toEqual([
    [undefined, 1800],
    ["v1", 2000],
  ]);
  useCart.getState().addItem({ ...ITEM, price: 1700, isDigital: true });
  expect(useCart.getState().items[0]).toMatchObject({ price: 1700, quantity: 2, isDigital: true });
});
