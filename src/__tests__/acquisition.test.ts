/**
 * D'où vient une inscription : lecture des UTM (ou `ref`) d'une URL, cookie
 * encodé/décodé sans faire confiance au navigateur, et le lien de support qui
 * passe par WhatsApp quand le numéro est posé.
 */

import { ACQUISITION_COOKIE, ACQUISITION_MAX_AGE, acquisitionFromUrl, decodeAcquisition, encodeAcquisition } from "@/lib/acquisition";
import { supportHref, supportLabel, supportWhatsAppNumber } from "@/lib/support";

const NOW = new Date("2026-09-17T15:00:00Z");

describe("acquisitionFromUrl", () => {
  test("une visite de campagne : source, medium, campagne, contenu, page d'atterrissage, date", () => {
    const url = new URL(
      "https://www.bio-lien.com/pricing?utm_source=tiktok&utm_medium=video&utm_campaign=lancement-themes&utm_content=hook-2&utm_term=vendeuse&plan=pro",
    );
    expect(acquisitionFromUrl(url, NOW)).toEqual({
      source: "tiktok",
      medium: "video",
      campaign: "lancement-themes",
      content: "hook-2",
      term: "vendeuse",
      landing: "/pricing",
      at: "2026-09-17T15:00:00.000Z",
    });
  });

  test("« ref= » suffit (un lien partagé à la main) ; sans source, rien", () => {
    expect(acquisitionFromUrl(new URL("https://www.bio-lien.com/?ref=groupe-whatsapp-abidjan"), NOW)).toMatchObject({
      source: "groupe-whatsapp-abidjan",
      medium: undefined,
      landing: "/",
    });
    expect(acquisitionFromUrl(new URL("https://www.bio-lien.com/?utm_medium=video"), NOW)).toBeNull();
    expect(acquisitionFromUrl(new URL("https://www.bio-lien.com/wendtech"), NOW)).toBeNull();
  });

  test("les valeurs sont bornées et nettoyées : pas de roman dans un cookie", () => {
    const long = "x".repeat(500);
    const result = acquisitionFromUrl(new URL(`https://www.bio-lien.com/?utm_source=${long}&utm_campaign=%20%20`), NOW);
    expect(result?.source).toHaveLength(80);
    expect(result?.campaign).toBeUndefined();
  });
});

describe("encodeAcquisition / decodeAcquisition", () => {
  const sample = acquisitionFromUrl(new URL("https://www.bio-lien.com/?utm_source=meta&utm_campaign=ci-abidjan"), NOW)!;

  test("aller-retour fidèle, et le cookie ne contient ni guillemet ni point-virgule", () => {
    const encoded = encodeAcquisition(sample);
    expect(encoded).not.toMatch(/["; ]/);
    expect(decodeAcquisition(encoded)).toEqual(sample);
    expect(ACQUISITION_COOKIE).toBe("biolien_acq");
    expect(ACQUISITION_MAX_AGE).toBe(30 * 24 * 60 * 60);
  });

  test("encodé deux fois par l'API cookies de Next : toujours lisible", () => {
    expect(decodeAcquisition(encodeURIComponent(encodeAcquisition(sample)))).toEqual(sample);
    // Et une valeur déjà décodée par un lecteur de cookies zélé aussi.
    expect(decodeAcquisition(JSON.stringify(sample))).toEqual(sample);
  });

  test("un cookie tordu, vide ou sans source vaut « rien » — jamais d'exception", () => {
    expect(decodeAcquisition(null)).toBeNull();
    expect(decodeAcquisition("")).toBeNull();
    expect(decodeAcquisition("%7Bpas-du-json")).toBeNull();
    expect(decodeAcquisition(encodeURIComponent(JSON.stringify({ medium: "video" })))).toBeNull();
    expect(decodeAcquisition(encodeURIComponent(JSON.stringify([1, 2])))).toBeNull();
    expect(decodeAcquisition(encodeURIComponent("42"))).toBeNull();
  });

  test("les champs relus sont rebornés et une date invalide est remplacée", () => {
    const forged = encodeURIComponent(JSON.stringify({ source: "y".repeat(300), at: "hier", campaign: 12 }));
    const decoded = decodeAcquisition(forged);
    expect(decoded?.source).toHaveLength(80);
    expect(decoded?.campaign).toBeUndefined();
    expect(Number.isNaN(Date.parse(decoded!.at))).toBe(false);
  });
});

describe("support", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  });

  test("sans numéro : e-mail avec sujet et corps encodés", () => {
    expect(supportWhatsAppNumber()).toBeNull();
    expect(supportHref("Mobile Money hors couverture")).toBe("mailto:support@bio-lien.com?subject=Mobile%20Money%20hors%20couverture");
    expect(supportHref("Abonnement Pro non activé", "Plan : Pro\nRéférence : MTX-1")).toBe(
      "mailto:support@bio-lien.com?subject=Abonnement%20Pro%20non%20activ%C3%A9&body=Plan%20%3A%20Pro%0AR%C3%A9f%C3%A9rence%20%3A%20MTX-1",
    );
    expect(supportLabel()).toBe("Écrire au support");
  });

  test("avec un numéro : conversation WhatsApp pré-remplie, chiffres seulement", () => {
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = "+226 70 12 34 56";
    expect(supportWhatsAppNumber()).toBe("22670123456");
    expect(supportHref("Mobile Money hors couverture")).toBe("https://wa.me/22670123456?text=Mobile%20Money%20hors%20couverture");
    expect(supportHref("Abonnement Pro non activé", "Plan : Pro")).toBe(
      "https://wa.me/22670123456?text=Abonnement%20Pro%20non%20activ%C3%A9%0APlan%20%3A%20Pro",
    );
    expect(supportLabel()).toBe("Écrire au support sur WhatsApp");
  });

  test("un numéro trop court est ignoré", () => {
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = "123";
    expect(supportWhatsAppNumber()).toBeNull();
  });
});
