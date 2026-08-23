import {
  INTENTIONS,
  isIntention,
  seedBlocksForIntentions,
  socialProfileUrl,
} from "@/lib/onboarding/intentions";

describe("socialProfileUrl", () => {
  it("accepte un pseudo avec ou sans @", () => {
    expect(socialProfileUrl("tiktok", "@amara")).toBe(
      "https://www.tiktok.com/@amara",
    );
    expect(socialProfileUrl("tiktok", "amara")).toBe(
      "https://www.tiktok.com/@amara",
    );
  });

  it("garde une URL déjà complète telle quelle", () => {
    const pasted = "https://www.instagram.com/amara.shop/";
    expect(socialProfileUrl("instagram", pasted)).toBe(pasted);
  });

  it("construit l'adresse propre à chaque réseau", () => {
    expect(socialProfileUrl("instagram", "amara")).toBe(
      "https://www.instagram.com/amara",
    );
    expect(socialProfileUrl("youtube", "@amara")).toBe(
      "https://www.youtube.com/@amara",
    );
  });

  it("ignore une saisie vide ou inexploitable", () => {
    expect(socialProfileUrl("tiktok", "")).toBeNull();
    expect(socialProfileUrl("tiktok", "   ")).toBeNull();
    expect(socialProfileUrl("tiktok", "mon pseudo")).toBeNull();
    expect(socialProfileUrl("tiktok", "a/b")).toBeNull();
  });
});

describe("isIntention", () => {
  it("reconnaît les intentions connues et rejette le reste", () => {
    INTENTIONS.forEach((i) => expect(isIntention(i)).toBe(true));
    expect(isIntention("croissance")).toBe(false);
    expect(isIntention(null)).toBe(false);
  });
});

describe("seedBlocksForIntentions", () => {
  it("ne génère rien sans intention", () => {
    expect(seedBlocksForIntentions({ intentions: [] })).toEqual([]);
  });

  it("crée la collection produits pour l'intention « vendre »", () => {
    const seeds = seedBlocksForIntentions({ intentions: ["sell"] });
    expect(seeds).toHaveLength(1);
    expect(seeds[0].type).toBe("PRODUCT_COLLECTION");
    expect(seeds[0].title).toBe("Ma boutique");
  });

  it("crée le bouton WhatsApp seulement si un numéro utilisable existe", () => {
    expect(
      seedBlocksForIntentions({
        intentions: ["whatsapp"],
        whatsappNumber: "+226 70 11 22 33",
        shopName: "Wax & Karité",
      }),
    ).toEqual([
      expect.objectContaining({
        type: "WHATSAPP",
        config: expect.objectContaining({ phone: "22670112233" }),
      }),
    ]);

    // Un numéro trop court mènerait à une page d'erreur WhatsApp.
    expect(
      seedBlocksForIntentions({
        intentions: ["whatsapp"],
        whatsappNumber: "70112",
      }),
    ).toEqual([]);
  });

  it("ne crée un lien que pour les réseaux réellement renseignés", () => {
    const seeds = seedBlocksForIntentions({
      intentions: ["socials"],
      handles: { tiktok: "@amara", instagram: "", youtube: "   " },
    });
    expect(seeds).toHaveLength(1);
    expect(seeds[0]).toMatchObject({
      type: "LINK",
      config: { url: "https://www.tiktok.com/@amara", icon: "tiktok" },
    });
  });

  it("ignore l'intention « promo » sans message", () => {
    expect(seedBlocksForIntentions({ intentions: ["promote"] })).toEqual([]);
    expect(
      seedBlocksForIntentions({
        intentions: ["promote"],
        announcement: "   ",
      }),
    ).toEqual([]);
  });

  it("ordonne la page : annonce, réseaux, boutique, WhatsApp", () => {
    const seeds = seedBlocksForIntentions({
      intentions: ["whatsapp", "sell", "socials", "promote"],
      announcement: "Livraison offerte 🎉",
      handles: { instagram: "amara" },
      whatsappNumber: "22670112233",
      shopName: "Wax",
    });

    expect(seeds.map((s) => s.type)).toEqual([
      "TEXT",
      "LINK",
      "PRODUCT_COLLECTION",
      "WHATSAPP",
    ]);
    expect(seeds.map((s) => s.position)).toEqual([0, 1, 2, 3]);
  });

  it("écarte une valeur qui n'est pas une intention", () => {
    const seeds = seedBlocksForIntentions({
      intentions: ["sell", "vendre-plus" as never],
    });
    expect(seeds.map((s) => s.type)).toEqual(["PRODUCT_COLLECTION"]);
  });
});
