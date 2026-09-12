/**
 * GET /go/[lien] — résolution, comptage et réponse selon l'appareil.
 */

import { NextRequest } from "next/server";

let _link: { url: string } | null = null;
let _block: { config: unknown } | null = null;
const mockPrisma = {
  shopLink: { findFirst: jest.fn(async () => _link) },
  pageBlock: { findFirst: jest.fn(async () => _block) },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const tracked: string[] = [];
jest.mock("@/lib/db/tracking", () => ({
  trackShopLinkClick: jest.fn(async (id: string) => { tracked.push(`link:${id}`); }),
  trackPageBlockClick: jest.fn(async (id: string) => { tracked.push(`block:${id}`); }),
}));

let _limited = false;
jest.mock("@/lib/rate-limit", () => ({
  rateLimit: jest.fn(() => ({ success: !_limited, remaining: 1, resetAt: 0 })),
  getClientIp: jest.fn(() => "203.0.113.7"),
}));

// La tâche différée s'exécute tout de suite : on veut voir le comptage.
jest.mock("@/lib/after-response", () => ({
  scheduleAfterResponse: (task: () => Promise<unknown>, onError: (e: unknown) => void) => {
    void task().catch(onError);
  },
}));

import { GET } from "@/app/go/[lien]/route";

const ID = "11111111-1111-4111-8111-111111111111";
const ANDROID = "Mozilla/5.0 (Linux; Android 12; Infinix X6816) Chrome/120 Mobile";
const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari";
const DESKTOP = "Mozilla/5.0 (Macintosh) Chrome/120";

function get(id: string, userAgent = DESKTOP) {
  return GET(new NextRequest(`http://localhost:3000/go/${id}`, { headers: { "user-agent": userAgent } }), {
    params: Promise.resolve({ lien: id }),
  });
}

beforeEach(() => {
  _link = null;
  _block = null;
  _limited = false;
  tracked.length = 0;
  mockPrisma.shopLink.findFirst.mockClear();
  mockPrisma.pageBlock.findFirst.mockClear();
});

describe("GET /go/[lien]", () => {
  test("identifiant non UUID ou inconnu → 404 sans lecture inutile", async () => {
    expect((await get("pas-un-uuid")).status).toBe(404);
    expect(mockPrisma.shopLink.findFirst).not.toHaveBeenCalled();
    expect((await get(ID)).status).toBe(404);
    expect(tracked).toEqual([]);
  });

  test("lien de BioPage, ordinateur : 302 vers le web, clic compté sur shop_links, jamais mis en cache", async () => {
    _link = { url: "https://www.tiktok.com/@amy.creator" };
    const res = await get(ID);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://www.tiktok.com/@amy.creator");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    await new Promise((r) => setTimeout(r, 0));
    expect(tracked).toEqual([`link:${ID}`]);
  });

  test("bloc LIEN enregistré : lu après shop_links, compté sur page_blocks", async () => {
    _block = { config: { url: "https://instagram.com/amy.creator", label: "Insta", icon: "instagram" } };
    const res = await get(ID, ANDROID);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/^intent:\/\/user\?username=amy\.creator#Intent;scheme=instagram;package=com\.instagram\.android;/);
    await new Promise((r) => setTimeout(r, 0));
    expect(tracked).toEqual([`block:${ID}`]);
  });

  test("Android + TikTok : 302 vers l'intent HTTPS forcé par paquet", async () => {
    _link = { url: "https://www.tiktok.com/@amy.creator" };
    const res = await get(ID, ANDROID);
    expect(res.headers.get("location")).toBe(
      "intent://www.tiktok.com/@amy.creator#Intent;scheme=https;package=com.zhiliaoapp.musically;S.browser_fallback_url=https%3A%2F%2Fwww.tiktok.com%2F%40amy.creator;end",
    );
  });

  test("iOS + Facebook : page-pont HTML, pas de redirection", async () => {
    _link = { url: "https://www.facebook.com/wax.and.co" };
    const res = await get(ID, IOS);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain("fb://facewebmodal/f?href=");
    expect(html).toContain("https://www.facebook.com/wax.and.co");
  });

  test("une URL non http(s)/mailto/tel enregistrée par erreur n'est jamais suivie", async () => {
    _block = { config: { url: "javascript:alert(1)" } };
    expect((await get(ID)).status).toBe(404);
    _block = { config: { url: "" } };
    expect((await get(ID)).status).toBe(404);
  });

  test("au-delà de la limite par IP : redirection toujours servie, clic non compté", async () => {
    _link = { url: "https://example.com/promo" };
    _limited = true;
    const res = await get(ID);
    expect(res.status).toBe(302);
    await new Promise((r) => setTimeout(r, 0));
    expect(tracked).toEqual([]);
  });
});
