/**
 * Le proxy garde la source d'une visite de campagne : cookie posé au premier
 * contact seulement, jamais sans UTM, jamais par-dessus un cookie existant,
 * et les redirections d'authentification restent intactes.
 */

import { NextRequest } from "next/server";

let _hasSession = false;
jest.mock("better-auth/cookies", () => ({
  getSessionCookie: () => (_hasSession ? "session" : null),
}));

import { proxy } from "@/proxy";
import { ACQUISITION_COOKIE, decodeAcquisition } from "@/lib/acquisition";

const request = (url: string, cookie?: string) =>
  new NextRequest(url, { headers: cookie ? { cookie } : {} });

const setCookie = (headers: Headers) => headers.get("set-cookie") ?? "";

beforeEach(() => {
  _hasSession = false;
});

describe("proxy — source de la visite", () => {
  test("une visite de campagne pose le cookie trente jours, lisible par le serveur seul", async () => {
    const res = await proxy(request("http://localhost:3000/pricing?utm_source=tiktok&utm_campaign=lancement"));
    const cookie = setCookie(res.headers);
    expect(cookie).toContain(`${ACQUISITION_COOKIE}=`);
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    const value = /biolien_acq=([^;]+)/.exec(cookie)![1];
    expect(decodeAcquisition(value)).toMatchObject({ source: "tiktok", campaign: "lancement", landing: "/pricing" });
    expect(res.headers.get("x-middleware-request-x-pathname")).toBe("/pricing");
  });

  test("sans UTM ni ref : rien n'est posé", async () => {
    const res = await proxy(request("http://localhost:3000/"));
    expect(setCookie(res.headers)).toBe("");
  });

  test("premier contact : un cookie déjà posé n'est pas écrasé par une campagne suivante", async () => {
    const res = await proxy(request("http://localhost:3000/?utm_source=meta", `${ACQUISITION_COOKIE}=deja`));
    expect(setCookie(res.headers)).toBe("");
  });

  test("les redirections d'authentification ne changent pas : le cookie n'y est pas posé", async () => {
    const res = await proxy(request("http://localhost:3000/dashboard?utm_source=meta"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login\?.*next=%2Fdashboard/);
    expect(setCookie(res.headers)).toBe("");
  });
});
