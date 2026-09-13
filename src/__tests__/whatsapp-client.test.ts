/**
 * startWhatsAppOrder sans DOM réel : window/navigator/document/fetch sont
 * stubbés au minimum.
 *
 * - Ordinateur : l'onglet est ouvert dans le geste, SANS `noopener` (sinon
 *   `window.open` renvoie null), puis reçoit wa.me ; la boutique ne bouge pas.
 * - Mobile : l'appel réseau est borné ; au-delà, WhatsApp s'ouvre sans
 *   enregistrement ; sur Android le filet de repli est posé.
 * - Un refus métier (400/409) n'ouvre rien et remonte le message.
 */
import {
  ANDROID_FALLBACK_DELAY_MS,
  REGISTER_TIMEOUT_MS,
  startWhatsAppOrder,
} from "@/lib/orders/whatsapp-client";

type Listener = () => void;

let assigned: string[];
let opened: Array<{ args: unknown[]; tab: FakeTab | null }>;
let timers: Array<{ cb: Listener; ms: number }>;
let popupBlocked: boolean;
let fetchImpl: (input: string, init: RequestInit) => Promise<Response>;

interface FakeTab {
  opener: unknown;
  closed: boolean;
  location: { href: string };
  document: { title: string; body: { append: (node: unknown) => void }; createElement: (tag: string) => { textContent: string; style: { cssText: string } } };
  close: () => void;
}

function fakeTab(): FakeTab {
  const tab: FakeTab = {
    opener: "boutique",
    closed: false,
    location: { href: "" },
    document: {
      title: "",
      body: { append: () => {} },
      createElement: () => ({ textContent: "", style: { cssText: "" } }),
    },
    close: () => {
      tab.closed = true;
    },
  };
  return tab;
}

const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/148";
const ANDROID = "Mozilla/5.0 (Linux; Android 12; Infinix X6816) Chrome Mobile";
const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari";

const REQUEST = {
  shopId: "s1",
  items: [{ product_id: "p1", quantity: 1 }],
  fallbackUrl: "https://wa.me/22670000000?text=Bonjour%2C%20je%20commande",
};
const WA_URL = "https://wa.me/22670000000?text=Commande%20%230F8A7B6C";

function respond(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

function setUserAgent(userAgent: string, maxTouchPoints = 0) {
  (globalThis as unknown as Record<string, unknown>).navigator = { userAgent, maxTouchPoints };
}

beforeEach(() => {
  assigned = [];
  opened = [];
  timers = [];
  popupBlocked = false;
  fetchImpl = async () => respond(201, { order_id: "0f8a7b6c-1", reference: "0F8A7B6C", wa_url: WA_URL });
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = {
    open: (...args: unknown[]) => {
      const tab = popupBlocked ? null : fakeTab();
      opened.push({ args, tab });
      return tab;
    },
    location: { assign: (u: string) => assigned.push(u) },
    setTimeout: (cb: Listener, ms: number) => {
      timers.push({ cb, ms });
      return timers.length;
    },
    clearTimeout: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  g.document = { hidden: false, addEventListener: () => {}, removeEventListener: () => {} };
  g.fetch = (input: string, init: RequestInit) => fetchImpl(input, init);
  setUserAgent(DESKTOP);
});

afterEach(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.window;
  delete g.document;
  delete g.fetch;
  delete g.navigator;
});

describe("ordinateur", () => {
  test("ouvre l'onglet dans le geste, sans noopener, coupe opener, puis y charge wa.me", async () => {
    const outcome = await startWhatsAppOrder(REQUEST);
    expect(outcome).toEqual({ ok: true, orderId: "0f8a7b6c-1", reference: "0F8A7B6C" });
    expect(opened).toHaveLength(1);
    expect(opened[0]!.args).toEqual(["", "_blank"]);
    const tab = opened[0]!.tab!;
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe(WA_URL);
    expect(tab.document.title).toMatch(/WhatsApp/);
    // La page boutique reste en place.
    expect(assigned).toEqual([]);
  });

  test("pop-up bloqué : wa.me dans l'onglet courant plutôt que rien", async () => {
    popupBlocked = true;
    await startWhatsAppOrder(REQUEST);
    expect(assigned).toEqual([WA_URL]);
  });

  test("refus métier (variante, stock) : l'onglet est refermé, rien ne s'ouvre, le message remonte", async () => {
    fetchImpl = async () => respond(409, { error: "Stock insuffisant pour « Tissu wax » (0 disponible).", code: "OUT_OF_STOCK" });
    const outcome = await startWhatsAppOrder(REQUEST);
    expect(outcome).toEqual({ ok: false, reason: "rejected", message: "Stock insuffisant pour « Tissu wax » (0 disponible)." });
    expect(opened[0]!.tab!.closed).toBe(true);
    expect(opened[0]!.tab!.location.href).toBe("");
    expect(assigned).toEqual([]);
  });

  test("boutique repassée en ligne (NOT_WHATSAPP_MODE) ou panne : WhatsApp s'ouvre avec le message d'origine", async () => {
    fetchImpl = async () => respond(409, { error: "…", code: "NOT_WHATSAPP_MODE" });
    expect(await startWhatsAppOrder(REQUEST)).toEqual({ ok: false, reason: "fallback" });
    expect(opened[0]!.tab!.location.href).toBe(REQUEST.fallbackUrl);

    fetchImpl = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await startWhatsAppOrder(REQUEST)).toEqual({ ok: false, reason: "fallback" });
    expect(opened[1]!.tab!.location.href).toBe(REQUEST.fallbackUrl);

    fetchImpl = async () => respond(500, {});
    await startWhatsAppOrder(REQUEST);
    expect(opened[2]!.tab!.location.href).toBe(REQUEST.fallbackUrl);
  });
});

describe("mobile", () => {
  test("Android : pas d'onglet, intent:// avec le message enregistré, filet de repli posé", async () => {
    setUserAgent(ANDROID, 5);
    const outcome = await startWhatsAppOrder(REQUEST);
    expect(outcome).toMatchObject({ ok: true });
    expect(opened).toHaveLength(0);
    expect(assigned).toHaveLength(1);
    expect(assigned[0]).toMatch(/^intent:\/\/send\?phone=22670000000&text=Commande%20%230F8A7B6C#Intent;scheme=whatsapp;package=com\.whatsapp;/);
    expect(timers.map((t) => t.ms)).toContain(ANDROID_FALLBACK_DELAY_MS);
  });

  test("iOS : schéma whatsapp:// puis wa.me si la page reste visible", async () => {
    setUserAgent(IOS, 5);
    await startWhatsAppOrder(REQUEST);
    expect(assigned[0]).toBe("whatsapp://send?phone=22670000000&text=Commande%20%230F8A7B6C");
    const fallback = timers.find((t) => t.ms === 1100)!;
    fallback.cb();
    expect(assigned[1]).toBe(WA_URL);
  });

  test("l'appel réseau est borné : passé le délai, WhatsApp s'ouvre sans enregistrement", async () => {
    setUserAgent(ANDROID, 5);
    jest.useFakeTimers();
    try {
      fetchImpl = (_input, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      const pending = startWhatsAppOrder(REQUEST);
      jest.advanceTimersByTime(REGISTER_TIMEOUT_MS);
      expect(await pending).toEqual({ ok: false, reason: "fallback" });
      expect(assigned[0]).toMatch(/^intent:\/\/send\?phone=22670000000&text=Bonjour%2C%20je%20commande#Intent;/);
      // Sous les ~5 s d'activation transitoire des navigateurs mobiles.
      expect(REGISTER_TIMEOUT_MS).toBeLessThan(5000);
    } finally {
      jest.useRealTimers();
    }
  });
});
