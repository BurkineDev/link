/**
 * La marque comme entité pour les moteurs : graphies alternatives, profils
 * officiels lus de l'environnement, page À propos dans le plan du site.
 */

import { BRAND_ALTERNATE_NAMES, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";

describe("marque Bio-Lien dans les données structurées", () => {
  test("les graphies qu'on tape dans Google sont déclarées sur l'organisation et le site", () => {
    const org = organizationJsonLd("https://www.bio-lien.com");
    const site = websiteJsonLd("https://www.bio-lien.com");
    expect(org.name).toBe("Bio-Lien");
    expect(org.alternateName).toEqual(BRAND_ALTERNATE_NAMES);
    expect(BRAND_ALTERNATE_NAMES).toEqual(expect.arrayContaining(["Biolien", "Bio Lien", "bio-lien.com"]));
    expect(site.alternateName).toEqual(BRAND_ALTERNATE_NAMES);
    expect(site.publisher).toEqual({ "@type": "Organization", name: "Bio-Lien", url: "https://www.bio-lien.com" });
    expect(org.areaServed).toContain("BF");
  });

  test("sans profils dans l'environnement, aucun sameAs n'est émis", () => {
    const org = organizationJsonLd("https://www.bio-lien.com") as { sameAs?: string[] };
    expect(org.sameAs).toBeUndefined();
  });
});
