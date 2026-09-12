/**
 * openNativeApp sans DOM réel : on stubbe window/document au minimum.
 * Sur Android, une seule navigation vers intent:// (le repli est dedans) ;
 * sur iOS, schéma puis repli web si la page reste visible.
 */
import { openNativeApp } from "@/lib/links/app-link";

type Listener = () => void;
let assigned: string[];
let hidden: boolean;
let timers: Array<{ cb: Listener; ms: number }>;

beforeEach(() => {
  assigned = [];
  hidden = false;
  timers = [];
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = {
    location: { assign: (u: string) => assigned.push(u) },
    setTimeout: (cb: Listener, ms: number) => {
      timers.push({ cb, ms });
      return timers.length;
    },
    clearTimeout: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  g.document = {
    get hidden() {
      return hidden;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
});

afterEach(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.window;
  delete g.document;
});

const ANDROID = "Mozilla/5.0 (Linux; Android 12; Infinix X6816) AppleWebKit Chrome Mobile";
const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari";

test("Android : une seule navigation, vers intent:// avec paquet et repli", () => {
  openNativeApp("whatsapp://send?phone=22670123456", "https://wa.me/22670123456", {
    androidPackage: "com.whatsapp",
    userAgent: ANDROID,
  });
  expect(assigned).toHaveLength(1);
  expect(assigned[0]).toBe(
    "intent://send?phone=22670123456#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=https%3A%2F%2Fwa.me%2F22670123456;end",
  );
  expect(timers).toHaveLength(0);
});

test("Android sans schéma convertible : va directement au web", () => {
  openNativeApp("https://example.com/app", "https://example.com/app", { userAgent: ANDROID });
  expect(assigned).toEqual(["https://example.com/app"]);
});

test("iOS : tente le schéma, puis le web si la page est toujours visible", () => {
  openNativeApp("instagram://user?username=x", "https://instagram.com/x", {
    androidPackage: "com.instagram.android",
    userAgent: IOS,
  });
  expect(assigned).toEqual(["instagram://user?username=x"]);
  expect(timers).toHaveLength(1);
  expect(timers[0].ms).toBe(1100);
  timers[0].cb();
  expect(assigned).toEqual(["instagram://user?username=x", "https://instagram.com/x"]);
});

test("iOS : si l'app a pris la main (page cachée), pas de repli web", () => {
  openNativeApp("instagram://user?username=x", "https://instagram.com/x", { userAgent: IOS });
  hidden = true;
  timers[0].cb();
  expect(assigned).toEqual(["instagram://user?username=x"]);
});
