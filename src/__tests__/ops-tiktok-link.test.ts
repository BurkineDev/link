/**
 * Sonde TikTok : l'URL rejouée, la lecture de la réponse (302 = direct,
 * 200 = interstitiel, le reste = inconnu), une sonde qui ne lève jamais,
 * la mémoire du passage précédent et l'alerte ouverte seulement à la
 * bascule — jamais une par jour.
 */

import {
  classifyTikTokLinkResponse,
  describeTikTokLinkProbe,
  previousKnownTikTokStatus,
  probeTikTokLink,
  readTikTokStatus,
  tiktokLinkChange,
  tiktokLinkUrl,
  TIKTOK_PROBE_TARGET,
  type TikTokLinkProbe,
} from "@/lib/ops/tiktok-link";

const probe = (status: TikTokLinkProbe["status"], extra: Partial<TikTokLinkProbe> = {}): TikTokLinkProbe => ({
  status,
  target: TIKTOK_PROBE_TARGET,
  httpStatus: status === "direct" ? 302 : status === "interstitial" ? 200 : null,
  location: status === "direct" ? TIKTOK_PROBE_TARGET : null,
  error: null,
  ...extra,
});

describe("tiktokLinkUrl", () => {
  test("la requête de l'app : link/v2, scene=bio_url, cible encodée", () => {
    const url = new URL(tiktokLinkUrl("https://www.bio-lien.com/wendtech"));
    expect(url.origin + url.pathname).toBe("https://www.tiktok.com/link/v2");
    expect(url.searchParams.get("scene")).toBe("bio_url");
    expect(url.searchParams.get("aid")).toBe("1988");
    expect(url.searchParams.get("target")).toBe("https://www.bio-lien.com/wendtech");
    expect(url.search).toContain("target=https%3A%2F%2Fwww.bio-lien.com%2Fwendtech");
  });
});

describe("classifyTikTokLinkResponse", () => {
  const target = "https://www.bio-lien.com/";

  test("302 vers la cible : ouverture directe", () => {
    expect(classifyTikTokLinkResponse(302, "https://www.bio-lien.com/", target)).toBe("direct");
    expect(classifyTikTokLinkResponse(301, "https://www.bio-lien.com/wendtech", target)).toBe("direct");
  });

  test("200 : la page interstitielle", () => {
    expect(classifyTikTokLinkResponse(200, null, target)).toBe("interstitial");
  });

  test("redirection ailleurs, sans Location, 403, 5xx : on ne conclut pas", () => {
    expect(classifyTikTokLinkResponse(302, "https://www.tiktok.com/login", target)).toBe("unknown");
    expect(classifyTikTokLinkResponse(302, null, target)).toBe("unknown");
    expect(classifyTikTokLinkResponse(302, "pas une url", target)).toBe("unknown");
    expect(classifyTikTokLinkResponse(403, null, target)).toBe("unknown");
    expect(classifyTikTokLinkResponse(503, null, target)).toBe("unknown");
  });
});

describe("probeTikTokLink", () => {
  test("rejoue la requête sans suivre la redirection et lit le 302", async () => {
    const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain("https://www.tiktok.com/link/v2?");
      expect(init?.redirect).toBe("manual");
      expect((init?.headers as Record<string, string>)["user-agent"]).toContain("musical_ly");
      return new Response(null, { status: 302, headers: { location: "https://www.bio-lien.com/" } });
    });
    const result = await probeTikTokLink({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({
      status: "direct",
      target: TIKTOK_PROBE_TARGET,
      httpStatus: 302,
      location: "https://www.bio-lien.com/",
      error: null,
    });
  });

  test("200 : interstitiel, la cible est celle demandée", async () => {
    const fetchImpl = jest.fn(async () => new Response("<html>Ouvrir quand même</html>", { status: 200 }));
    const result = await probeTikTokLink({ target: "https://www.bio-lien.com/wendtech", fetchImpl });
    expect(result.status).toBe("interstitial");
    expect(result.target).toBe("https://www.bio-lien.com/wendtech");
    expect(result.httpStatus).toBe(200);
  });

  test("réseau en panne ou délai dépassé : « unknown » avec le message, jamais d'exception", async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error("fetch failed");
    });
    const result = await probeTikTokLink({ fetchImpl });
    expect(result).toEqual({
      status: "unknown",
      target: TIKTOK_PROBE_TARGET,
      httpStatus: null,
      location: null,
      error: "fetch failed",
    });
  });
});

describe("readTikTokStatus / previousKnownTikTokStatus", () => {
  test("lit le statut du battement de cœur, ignore ce qui n'est pas connu", () => {
    expect(readTikTokStatus({ tiktok: { status: "direct" } })).toBe("direct");
    expect(readTikTokStatus({ tiktok: { status: "interstitial" } })).toBe("interstitial");
    expect(readTikTokStatus({ tiktok: { status: "unknown" } })).toBeNull();
    expect(readTikTokStatus({ reconcile: { checked: 0 } })).toBeNull();
    // Contexte tronqué par boundContext : l'objet est devenu une chaîne.
    expect(readTikTokStatus({ tiktok: '{"status":"direct"…' })).toBeNull();
    expect(readTikTokStatus(null)).toBeNull();
    expect(readTikTokStatus(undefined)).toBeNull();
  });

  test("le dernier statut connu, du plus récent au plus ancien, saute les sondes en échec", () => {
    expect(
      previousKnownTikTokStatus([
        { tiktok: { status: "unknown" } },
        null,
        { tiktok: { status: "direct" } },
        { tiktok: { status: "interstitial" } },
      ]),
    ).toBe("direct");
    expect(previousKnownTikTokStatus([{ tiktok: { status: "unknown" } }, {}])).toBeNull();
    expect(previousKnownTikTokStatus([])).toBeNull();
  });
});

describe("tiktokLinkChange", () => {
  test("interstitiel → direct : l'alerte « ouvre directement », y compris sans passage connu", () => {
    for (const previous of ["interstitial", null] as const) {
      const change = tiktokLinkChange(previous, probe("direct"));
      expect(change).toMatchObject({
        kind: "tiktok.link_direct",
        severity: "warning",
        dedupeKey: "tiktok.link_direct",
        context: { httpStatus: 302, location: TIKTOK_PROBE_TARGET, previous },
      });
      expect(change?.title).toContain("directement");
    }
  });

  test("direct → interstitiel : l'alerte « remet l'écran »", () => {
    const change = tiktokLinkChange("direct", probe("interstitial"));
    expect(change).toMatchObject({
      kind: "tiktok.link_interstitial",
      severity: "warning",
      dedupeKey: "tiktok.link_interstitial",
      context: { httpStatus: 200, previous: "direct" },
    });
  });

  test("même statut qu'hier : rien — une ligne par bascule, pas une par jour", () => {
    expect(tiktokLinkChange("direct", probe("direct"))).toBeNull();
    expect(tiktokLinkChange("interstitial", probe("interstitial"))).toBeNull();
    // Le premier passage, tant que c'est l'écran : rien non plus (c'est l'état connu).
    expect(tiktokLinkChange(null, probe("interstitial"))).toBeNull();
  });

  test("sonde en échec : rien, quel que soit l'état précédent", () => {
    expect(tiktokLinkChange("direct", probe("unknown", { error: "fetch failed" }))).toBeNull();
    expect(tiktokLinkChange("interstitial", probe("unknown", { httpStatus: 403 }))).toBeNull();
    expect(tiktokLinkChange(null, probe("unknown"))).toBeNull();
  });
});

describe("describeTikTokLinkProbe", () => {
  test("une phrase par statut, l'erreur ou le code HTTP quand on ne sait pas", () => {
    expect(describeTikTokLinkProbe(probe("direct"))).toContain("s'ouvre directement dans TikTok (302)");
    expect(describeTikTokLinkProbe(probe("interstitial"))).toContain("encore l'écran « Ouvrir quand même »");
    expect(describeTikTokLinkProbe(probe("unknown", { error: "fetch failed" }))).toBe(
      "Lien TikTok : sonde impossible (fetch failed).",
    );
    expect(describeTikTokLinkProbe(probe("unknown", { httpStatus: 403 }))).toBe("Lien TikTok : sonde impossible (HTTP 403).");
    expect(describeTikTokLinkProbe(null)).toBe("Lien TikTok : sonde non exécutée.");
  });
});
