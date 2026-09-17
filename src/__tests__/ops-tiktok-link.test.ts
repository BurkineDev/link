/**
 * Sonde TikTok : l'URL rejouée, la lecture de la réponse (302 vers la cible
 * = direct ; 200 = l'écran ou la page de blocage selon le corps ; le reste
 * = inconnu), une sonde qui ne lève jamais, la mémoire du passage précédent
 * et l'alerte ouverte seulement à la bascule — jamais une par jour.
 */

import {
  classifyTikTokLinkResponse,
  describeTikTokLinkProbe,
  previousKnownTikTokStatus,
  probeTikTokLink,
  readTikTokProbe,
  readTikTokStatus,
  tiktokLinkChange,
  tiktokLinkUrl,
  TIKTOK_AID,
  TIKTOK_PROBE_TARGET,
  type TikTokLinkProbe,
} from "@/lib/ops/tiktok-link";

const probe = (status: TikTokLinkProbe["status"], extra: Partial<TikTokLinkProbe> = {}): TikTokLinkProbe => ({
  status,
  target: TIKTOK_PROBE_TARGET,
  httpStatus: status === "direct" ? 302 : status === "unknown" ? null : 200,
  location: status === "direct" ? TIKTOK_PROBE_TARGET : null,
  error: null,
  webStatus: status,
  ...extra,
});

/** Une réponse par client : l'app (aid 1233) et le site (aid 1988) peuvent différer. */
const byAid = (answers: Record<string, () => Response | Promise<Response>>) =>
  jest.fn(async (input: RequestInfo | URL) => {
    const aid = new URL(String(input)).searchParams.get("aid") ?? "";
    const answer = answers[aid] ?? answers["*"];
    if (!answer) throw new Error(`pas de réponse prévue pour aid=${aid}`);
    return answer();
  }) as unknown as typeof fetch;

// Les pages en 200 relevées les 16-17/09/2026, gabarit de l'app (aid 1233) :
// l'écran franchissable a le bouton « Ouvrir » (continue-button) ; la page
// de blocage a le conteneur « malicious » et pas de bouton.
const INTERSTITIAL_HTML =
  '<html><body data-is-inbucket="false"><div class="container normal tiktok"><p class="prompt_detail_word">Tu quittes TikTok pour accéder à un site Internet externe.</p><div id="continue-button" class="button continue_btn normal_continue_btn"><span class="button_word continue_word">Ouvrir</span></div></div></body></html>';
const BLOCKED_HTML =
  '<html><body data-is-inbucket="false"><div class="container malicious tiktok"><p class="prompt_detail_word">Pour protéger notre communauté, nous limitons certains contenus sur notre plateforme.</p></div></body></html>';
// Gabarit du site tiktok.com (aid 1988) : « Ouvrir quand même » et la classe sur <body>.
const WEB_INTERSTITIAL_HTML =
  '<html><body class="normal pc_body tiktok" data-target="https://www.bio-lien.com/"><p>Tu vas ouvrir un lien :</p><div class="button_wrap open_anyway_wrap"><a id="open-anyway-button" class="open_anyway_btn">Ouvrir quand même</a></div></body></html>';
const WEB_BLOCKED_HTML =
  '<html><body class="malicious pc_body tiktok" data-target="https://www.bio-lien.com/"><p>Ce lien peut être dangereux :</p><p>Pour protéger notre communauté, nous limitons certains contenus.</p></body></html>';

describe("tiktokLinkUrl", () => {
  test("la requête de l'app par défaut : link/v2, aid 1233, scene=bio_url, cible encodée", () => {
    const url = new URL(tiktokLinkUrl("https://www.bio-lien.com/wendtech"));
    expect(url.origin + url.pathname).toBe("https://www.tiktok.com/link/v2");
    expect(url.searchParams.get("scene")).toBe("bio_url");
    expect(url.searchParams.get("aid")).toBe("1233");
    expect(url.searchParams.get("target")).toBe("https://www.bio-lien.com/wendtech");
    expect(url.search).toContain("target=https%3A%2F%2Fwww.bio-lien.com%2Fwendtech");
    expect(new URL(tiktokLinkUrl("https://www.bio-lien.com/", TIKTOK_AID.web)).searchParams.get("aid")).toBe("1988");
  });
});

describe("classifyTikTokLinkResponse", () => {
  const target = "https://www.bio-lien.com/";

  test("3xx vers la cible : ouverture directe — Location absolue, relative au protocole, 301/302/307/308", () => {
    expect(classifyTikTokLinkResponse(302, "https://www.bio-lien.com/", target)).toBe("direct");
    expect(classifyTikTokLinkResponse(301, "https://www.bio-lien.com/wendtech", target)).toBe("direct");
    expect(classifyTikTokLinkResponse(307, "https://www.bio-lien.com/", target)).toBe("direct");
    expect(classifyTikTokLinkResponse(308, "https://www.bio-lien.com/", target)).toBe("direct");
    expect(classifyTikTokLinkResponse(302, "//www.bio-lien.com/", target)).toBe("direct");
  });

  test("200 : l'écran si le bouton « Ouvrir » / « Ouvrir quand même » est là, bloqué si c'est la page « dangereux » — les deux gabarits", () => {
    expect(classifyTikTokLinkResponse(200, null, target, INTERSTITIAL_HTML)).toBe("interstitial");
    expect(classifyTikTokLinkResponse(200, null, target, WEB_INTERSTITIAL_HTML)).toBe("interstitial");
    expect(classifyTikTokLinkResponse(200, null, target, BLOCKED_HTML)).toBe("blocked");
    expect(classifyTikTokLinkResponse(200, null, target, WEB_BLOCKED_HTML)).toBe("blocked");
  });

  test("200 sans l'une ni l'autre (défi anti-robot, connexion, corps vide) : on ne conclut pas", () => {
    expect(classifyTikTokLinkResponse(200, null, target, "<html><body class=\"pc_body\">Verify you are human</body></html>")).toBe("unknown");
    expect(classifyTikTokLinkResponse(200, null, target, "")).toBe("unknown");
    expect(classifyTikTokLinkResponse(200, null, target, null)).toBe("unknown");
    expect(classifyTikTokLinkResponse(200, null, target)).toBe("unknown");
  });

  test("redirection ailleurs (absolue ou relative à tiktok.com), sans Location, 403, 5xx : on ne conclut pas", () => {
    expect(classifyTikTokLinkResponse(302, "https://www.tiktok.com/login", target)).toBe("unknown");
    expect(classifyTikTokLinkResponse(302, "/login", target)).toBe("unknown");
    expect(classifyTikTokLinkResponse(302, null, target)).toBe("unknown");
    expect(classifyTikTokLinkResponse(302, "pas une url", target)).toBe("unknown");
    expect(classifyTikTokLinkResponse(403, null, target)).toBe("unknown");
    expect(classifyTikTokLinkResponse(503, null, target)).toBe("unknown");
  });
});

describe("probeTikTokLink", () => {
  test("interroge l'app et le site, sans suivre la redirection ; le verdict de l'app fait foi, le corps est abandonné", async () => {
    const cancel = jest.fn(async () => {});
    const seen: string[] = [];
    const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new URL(String(input)).searchParams.get("aid") ?? "");
      expect(String(input)).toContain("https://www.tiktok.com/link/v2?");
      expect(init?.redirect).toBe("manual");
      expect((init?.headers as Record<string, string>)["user-agent"]).toContain("musical_ly");
      return {
        status: 302,
        headers: new Headers({ location: "https://www.bio-lien.com/" }),
        body: { cancel },
        text: async () => "",
      } as unknown as Response;
    });
    const result = await probeTikTokLink({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({
      status: "direct",
      target: TIKTOK_PROBE_TARGET,
      httpStatus: 302,
      location: "https://www.bio-lien.com/",
      error: null,
      webStatus: "direct",
    });
    expect(seen.sort()).toEqual(["1233", "1988"]);
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  test("200 avec l'écran : interstitiel, la cible est celle demandée", async () => {
    const fetchImpl = byAid({ "*": () => new Response(INTERSTITIAL_HTML, { status: 200 }) });
    const result = await probeTikTokLink({ target: "https://www.bio-lien.com/wendtech", fetchImpl });
    expect(result).toMatchObject({
      status: "interstitial", target: "https://www.bio-lien.com/wendtech", httpStatus: 200, error: null, webStatus: "interstitial",
    });
  });

  test("l'app et le site ne sont pas d'accord : httpStatus/location/error sont ceux de l'app, webStatus dit l'autre", async () => {
    const fetchImpl = byAid({
      "1233": () => new Response(INTERSTITIAL_HTML, { status: 200 }),
      "1988": () => new Response(null, { status: 302, headers: { location: "https://www.bio-lien.com/" } }),
    });
    expect(await probeTikTokLink({ fetchImpl })).toEqual({
      status: "interstitial", target: TIKTOK_PROBE_TARGET, httpStatus: 200, location: null, error: null, webStatus: "direct",
    });
    const inverse = byAid({
      "1233": () => new Response(null, { status: 302, headers: { location: "https://www.bio-lien.com/" } }),
      "1988": () => new Response(WEB_INTERSTITIAL_HTML, { status: 200 }),
    });
    expect(await probeTikTokLink({ fetchImpl: inverse })).toMatchObject({ status: "direct", httpStatus: 302, webStatus: "interstitial" });
  });

  test("200 avec la page de blocage : bloqué", async () => {
    const fetchImpl = byAid({ "*": () => new Response(BLOCKED_HTML, { status: 200 }) });
    expect(await probeTikTokLink({ fetchImpl })).toMatchObject({ status: "blocked", httpStatus: 200, error: null, webStatus: "blocked" });
  });

  test("200 sans page reconnue : « unknown » avec le motif, pas un faux statut", async () => {
    const fetchImpl = byAid({ "*": () => new Response("<html><body>Verify you are human</body></html>", { status: 200 }) });
    expect(await probeTikTokLink({ fetchImpl })).toMatchObject({ status: "unknown", httpStatus: 200, error: "200 sans la page attendue" });
  });

  test("réseau en panne ou délai dépassé : « unknown » avec le message et la cause, jamais d'exception — même si un seul client échoue", async () => {
    const fetchImpl = jest.fn(async () => {
      throw Object.assign(new Error("fetch failed"), { cause: { code: "ENOTFOUND" } });
    });
    expect(await probeTikTokLink({ fetchImpl })).toEqual({
      status: "unknown",
      target: TIKTOK_PROBE_TARGET,
      httpStatus: null,
      location: null,
      error: "fetch failed — ENOTFOUND",
      webStatus: "unknown",
    });
    const timeout = jest.fn(async () => {
      throw new Error("The operation was aborted due to timeout");
    });
    expect((await probeTikTokLink({ fetchImpl: timeout })).error).toBe("The operation was aborted due to timeout");

    // Seul le site échoue : le verdict de l'app est intact.
    const half = byAid({
      "1233": () => new Response(INTERSTITIAL_HTML, { status: 200 }),
      "1988": () => {
        throw new Error("fetch failed");
      },
    });
    expect(await probeTikTokLink({ fetchImpl: half })).toMatchObject({ status: "interstitial", error: null, webStatus: "unknown" });
  });
});

describe("readTikTokProbe / readTikTokStatus / previousKnownTikTokStatus", () => {
  test("relit la sonde du battement de cœur, échec compris ; rien si elle manque ou a été tronquée", () => {
    expect(readTikTokProbe({ tiktok: probe("unknown", { error: "fetch failed" }) })).toEqual(probe("unknown", { error: "fetch failed" }));
    // Sonde antérieure, sans verdict web : webStatus null.
    expect(readTikTokProbe({ tiktok: { status: "direct" } })).toEqual({
      status: "direct", target: TIKTOK_PROBE_TARGET, httpStatus: null, location: null, error: null, webStatus: null,
    });
    expect(readTikTokProbe({ tiktok: { status: "direct", webStatus: "ailleurs" } })?.webStatus).toBeNull();
    expect(readTikTokProbe({ tiktok: { status: "ailleurs" } })).toBeNull();
    // Contexte tronqué par boundContext : l'objet est devenu une chaîne.
    expect(readTikTokProbe({ tiktok: '{"status":"direct"…' })).toBeNull();
    expect(readTikTokProbe({ reconcile: { checked: 0 } })).toBeNull();
    expect(readTikTokProbe(null)).toBeNull();
    expect(readTikTokProbe(undefined)).toBeNull();
  });

  test("le statut connu seulement : « unknown » ne compte pas", () => {
    expect(readTikTokStatus({ tiktok: { status: "direct" } })).toBe("direct");
    expect(readTikTokStatus({ tiktok: { status: "interstitial" } })).toBe("interstitial");
    expect(readTikTokStatus({ tiktok: { status: "blocked" } })).toBe("blocked");
    expect(readTikTokStatus({ tiktok: { status: "unknown" } })).toBeNull();
    expect(readTikTokStatus({ tiktok: '{"status":"direct"…' })).toBeNull();
    expect(readTikTokStatus(null)).toBeNull();
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
    expect(change?.title).toContain("remet l'écran");
  });

  test("bloqué : alerte critique dès la première fois ; débloqué → « de retour »", () => {
    for (const previous of ["interstitial", "direct", null] as const) {
      expect(tiktokLinkChange(previous, probe("blocked"))).toMatchObject({
        kind: "tiktok.link_blocked",
        severity: "critical",
        dedupeKey: "tiktok.link_blocked",
        context: { previous },
      });
    }
    expect(tiktokLinkChange("blocked", probe("blocked"))).toBeNull();
    const back = tiktokLinkChange("blocked", probe("interstitial"));
    expect(back).toMatchObject({ kind: "tiktok.link_interstitial", severity: "warning" });
    expect(back?.title).toContain("débloque");
    expect(tiktokLinkChange("blocked", probe("direct"))).toMatchObject({ kind: "tiktok.link_direct" });
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
    expect(tiktokLinkChange("blocked", probe("unknown"))).toBeNull();
    expect(tiktokLinkChange(null, probe("unknown"))).toBeNull();
  });
});

describe("describeTikTokLinkProbe", () => {
  test("une phrase par statut ; quand on ne sait pas, l'erreur, la redirection vue ou le code HTTP", () => {
    expect(describeTikTokLinkProbe(probe("direct"))).toBe(
      "Lien TikTok : bio-lien.com s'ouvre directement dans l'app (302), sans l'écran « Ouvrir quand même ».",
    );
    expect(describeTikTokLinkProbe(probe("interstitial"))).toBe(
      "Lien TikTok : encore l'écran « Ouvrir quand même » dans l'app (TikTok ne connaît pas bio-lien.com).",
    );
    expect(describeTikTokLinkProbe(probe("blocked"))).toContain("BLOQUÉ");
    expect(describeTikTokLinkProbe(probe("unknown", { error: "fetch failed — ENOTFOUND" }))).toBe(
      "Lien TikTok : sonde impossible (fetch failed — ENOTFOUND).",
    );
    expect(describeTikTokLinkProbe(probe("unknown", { httpStatus: 403 }))).toBe("Lien TikTok : sonde impossible (HTTP 403).");
    expect(describeTikTokLinkProbe(probe("unknown", { httpStatus: 302, location: "https://www.tiktok.com/login?next=x" }))).toBe(
      "Lien TikTok : sonde impossible (TikTok redirige vers www.tiktok.com au lieu de bio-lien.com).",
    );
    expect(describeTikTokLinkProbe(probe("unknown", { httpStatus: 302, location: "/login" }))).toBe(
      "Lien TikTok : sonde impossible (TikTok redirige vers www.tiktok.com au lieu de bio-lien.com).",
    );
    expect(describeTikTokLinkProbe(null)).toBe("Lien TikTok : sonde non exécutée.");
  });

  test("le verdict du site tiktok.com n'est ajouté que s'il diffère de celui de l'app", () => {
    expect(describeTikTokLinkProbe(probe("interstitial", { webStatus: "direct" }))).toBe(
      "Lien TikTok : encore l'écran « Ouvrir quand même » dans l'app (TikTok ne connaît pas bio-lien.com). Sur le site tiktok.com : ouverture directe.",
    );
    expect(describeTikTokLinkProbe(probe("direct", { webStatus: "interstitial" }))).toContain("Sur le site tiktok.com : l'écran.");
    expect(describeTikTokLinkProbe(probe("interstitial", { webStatus: "unknown" }))).toContain("Sur le site tiktok.com : sonde impossible.");
    expect(describeTikTokLinkProbe(probe("interstitial", { webStatus: null }))).not.toContain("tiktok.com :");
    expect(describeTikTokLinkProbe(probe("interstitial"))).not.toContain("Sur le site");
  });
});
