/**
 * Zones de livraison : schéma partagé, libellé du délai, et les routes
 * /api/shipping-zones (propriété, validation, plafond, devise).
 *
 * La création et la modification n'existent que caisse allumée
 * (NEXT_PUBLIC_ONLINE_CHECKOUT=1) : les suites POST et PATCH posent le
 * drapeau ; caisse masquée (le défaut sous Jest), elles répondent 404.
 */

import { NextRequest } from "next/server";
import { deliveryDelayLabel, shippingZoneSchema } from "@/lib/shipping/zone-schema";

// ---------------------------------------------------------------------------
// Schéma et libellés (aucune dépendance)
// ---------------------------------------------------------------------------

describe("shippingZoneSchema", () => {
  const base = { name: "Ouaga", countries: ["BF"], rate: 1500 };

  it("accepte une zone minimale et pose les valeurs par défaut", () => {
    const parsed = shippingZoneSchema.parse(base);
    expect(parsed).toEqual({
      name: "Ouaga",
      countries: ["BF"],
      rate: 1500,
      free_above: null,
      estimated_min: null,
      estimated_max: null,
      is_active: true,
    });
  });

  it("normalise et dédoublonne les codes pays", () => {
    const parsed = shippingZoneSchema.parse({ ...base, countries: [" bf ", "BF", "ci"] });
    expect(parsed.countries).toEqual(["BF", "CI"]);
  });

  it("refuse un pays hors de la liste, une zone sans pays, un tarif négatif", () => {
    expect(shippingZoneSchema.safeParse({ ...base, countries: ["FR"] }).success).toBe(false);
    expect(shippingZoneSchema.safeParse({ ...base, countries: [] }).success).toBe(false);
    expect(shippingZoneSchema.safeParse({ ...base, rate: -1 }).success).toBe(false);
    expect(shippingZoneSchema.safeParse({ ...base, name: "A" }).success).toBe(false);
  });

  it("refuse un délai maximum inférieur au minimum, accepte l'égalité", () => {
    expect(
      shippingZoneSchema.safeParse({ ...base, estimated_min: 3, estimated_max: 2 }).success,
    ).toBe(false);
    expect(
      shippingZoneSchema.safeParse({ ...base, estimated_min: 2, estimated_max: 2 }).success,
    ).toBe(true);
    expect(shippingZoneSchema.safeParse({ ...base, estimated_min: 1.5 }).success).toBe(false);
    expect(shippingZoneSchema.safeParse({ ...base, estimated_max: 91 }).success).toBe(false);
  });
});

describe("deliveryDelayLabel", () => {
  it("dit la vérité selon ce que le vendeur a renseigné : un seul délai n'est pas une durée ferme", () => {
    expect(deliveryDelayLabel(null, null)).toBeNull();
    expect(deliveryDelayLabel(0, 0)).toBe("le jour même");
    expect(deliveryDelayLabel(1, 1)).toBe("1 jour");
    expect(deliveryDelayLabel(3, null)).toBe("à partir de 3 jours");
    expect(deliveryDelayLabel(null, 5)).toBe("sous 5 jours");
    expect(deliveryDelayLabel(null, 1)).toBe("sous 1 jour");
    expect(deliveryDelayLabel(0, 2)).toBe("sous 2 jours");
    expect(deliveryDelayLabel(2, 4)).toBe("2 à 4 jours");
  });

  it("parle français pour chaque contrainte, et lit « offerte dès 0 » comme jamais", () => {
    const base = { name: "Ouaga", countries: ["BF"], rate: 1500 };
    const first = (input: unknown) => {
      const r = shippingZoneSchema.safeParse(input);
      return r.success ? null : r.error.issues[0]?.message;
    };
    expect(first({ ...base, rate: "1500" })).toBe("Frais de livraison : indique un nombre");
    expect(first({ ...base, free_above: "abc" })).toBe("Offerte à partir de : indique un nombre");
    expect(first({ ...base, estimated_min: 1.5 })).toBe("Délai minimum : un nombre de jours entier");
    expect(first({ ...base, estimated_max: 91 })).toBe("Délai maximum : 90 jours au maximum");
    expect(first({ ...base, countries: "BF" })).toBe("Choisis au moins un pays");
    expect(shippingZoneSchema.parse({ ...base, free_above: 0 }).free_above).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const OWNER = { id: "user-owner", email: "owner@example.com" };
const OTHER = { id: "user-other", email: "other@example.com" };
const SHOP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ZONE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let _user: { id: string; email: string } | null = OWNER;
let _zoneCount = 0;
let _shopCurrency = "XOF";

jest.mock("@/lib/auth", () => ({
  getCurrentUser: jest.fn(async () => _user),
}));

const mockRevalidate = jest.fn(async () => undefined);
jest.mock("@/lib/shops/revalidate", () => ({
  revalidateShop: (...args: unknown[]) => mockRevalidate(...(args as [])),
}));

const zoneRow = (over: Record<string, unknown> = {}) => ({
  id: ZONE_ID,
  shopId: SHOP_ID,
  name: "Ouaga",
  countries: ["BF"],
  rate: "1500",
  freeAbove: null,
  estimatedMin: 1,
  estimatedMax: 3,
  isActive: true,
  currency: _shopCurrency,
  ...over,
});

const mockPrisma = {
  shop: {
    findFirst: jest.fn(async ({ where }: { where: { id: string; ownerId: string } }) =>
      where.id === SHOP_ID && where.ownerId === OWNER.id
        ? { id: SHOP_ID, currency: _shopCurrency }
        : null,
    ),
  },
  shippingZone: {
    findMany: jest.fn(async () => [zoneRow()]),
    findFirst: jest.fn(
      async ({ where }: { where: { id: string; shop: { ownerId: string } } }) =>
        where.id === ZONE_ID && where.shop.ownerId === OWNER.id
          ? { id: ZONE_ID, shopId: SHOP_ID, shop: { currency: _shopCurrency } }
          : null,
    ),
    count: jest.fn(async () => _zoneCount),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
      zoneRow({ ...data, rate: String(data.rate) }),
    ),
    update: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
      zoneRow({ ...data, rate: String(data.rate) }),
    ),
    delete: jest.fn(async () => ({})),
  },
};
jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET, POST } from "@/app/api/shipping-zones/route";
import { DELETE, PATCH } from "@/app/api/shipping-zones/[id]/route";

function req(method: string, url: string, body?: unknown) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id = ZONE_ID) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  _user = OWNER;
  _zoneCount = 0;
  _shopCurrency = "XOF";
  jest.clearAllMocks();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ONLINE_CHECKOUT;
});

describe("GET /api/shipping-zones", () => {
  it("renvoie les zones du propriétaire, sérialisées", async () => {
    const res = await GET(req("GET", `/api/shipping-zones?shopId=${SHOP_ID}`));
    expect(res.status).toBe(200);
    const { zones } = await res.json();
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({
      id: ZONE_ID,
      shop_id: SHOP_ID,
      rate: 1500,
      free_above: null,
      estimated_min: 1,
      estimated_max: 3,
      is_active: true,
      currency: "XOF",
    });
  });

  it("exige un shopId valide et une session", async () => {
    expect((await GET(req("GET", "/api/shipping-zones"))).status).toBe(400);
    expect((await GET(req("GET", "/api/shipping-zones?shopId=nope"))).status).toBe(400);
    _user = null;
    expect((await GET(req("GET", `/api/shipping-zones?shopId=${SHOP_ID}`))).status).toBe(401);
  });

  it("répond 404 à un autre utilisateur", async () => {
    _user = OTHER;
    expect((await GET(req("GET", `/api/shipping-zones?shopId=${SHOP_ID}`))).status).toBe(404);
  });
});

describe("POST /api/shipping-zones", () => {
  const body = { shop_id: SHOP_ID, name: "Ouaga", countries: ["bf"], rate: 1500, estimated_min: 1, estimated_max: 3 };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
  });

  it("crée la zone dans la devise de la boutique et revalide la page", async () => {
    _shopCurrency = "GHS";
    const res = await POST(req("POST", "/api/shipping-zones", body));
    expect(res.status).toBe(201);
    const { zone } = await res.json();
    expect(zone.currency).toBe("GHS");
    expect(zone.countries).toEqual(["BF"]);
    const created = mockPrisma.shippingZone.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(created.data).toMatchObject({ shopId: SHOP_ID, currency: "GHS", rate: 1500, isActive: true });
    expect(mockRevalidate).toHaveBeenCalledWith(SHOP_ID);
  });

  it("valide la saisie (422) et refuse la boutique d'un autre (404)", async () => {
    expect((await POST(req("POST", "/api/shipping-zones", { ...body, countries: [] }))).status).toBe(422);
    expect((await POST(req("POST", "/api/shipping-zones", { ...body, rate: -5 }))).status).toBe(422);
    _user = OTHER;
    expect((await POST(req("POST", "/api/shipping-zones", body))).status).toBe(404);
    expect(mockPrisma.shippingZone.create).not.toHaveBeenCalled();
  });

  it("refuse un tarif décimal dans une devise sans décimale (422, message français)", async () => {
    const res = await POST(req("POST", "/api/shipping-zones", { ...body, rate: 1.5 }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/montant entier/);
    expect(mockPrisma.shippingZone.create).not.toHaveBeenCalled();
    _shopCurrency = "GHS";
    expect((await POST(req("POST", "/api/shipping-zones", { ...body, rate: 1.5 }))).status).toBe(201);
  });

  it("plafonne à 20 zones par boutique (409)", async () => {
    _zoneCount = 20;
    const res = await POST(req("POST", "/api/shipping-zones", body));
    expect(res.status).toBe(409);
    expect(mockPrisma.shippingZone.create).not.toHaveBeenCalled();
  });
});

describe("PATCH & DELETE /api/shipping-zones/[id]", () => {
  const body = { name: "Ouaga élargie", countries: ["BF", "CI"], rate: 0, free_above: null, is_active: false };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_ONLINE_CHECKOUT = "1";
  });

  it("modifie une zone du propriétaire et la remet dans la devise de la boutique", async () => {
    _shopCurrency = "XAF";
    const res = await PATCH(req("PATCH", `/api/shipping-zones/${ZONE_ID}`, body), ctx());
    expect(res.status).toBe(200);
    const updated = mockPrisma.shippingZone.update.mock.calls[0][0] as { where: unknown; data: Record<string, unknown> };
    expect(updated.where).toEqual({ id: ZONE_ID });
    expect(updated.data).toMatchObject({ name: "Ouaga élargie", countries: ["BF", "CI"], rate: 0, isActive: false, currency: "XAF" });
    expect(mockRevalidate).toHaveBeenCalledWith(SHOP_ID);
  });

  it("refuse une zone qui n'est pas la sienne (404), un id invalide (404), une saisie invalide (422)", async () => {
    _user = OTHER;
    expect((await PATCH(req("PATCH", `/api/shipping-zones/${ZONE_ID}`, body), ctx())).status).toBe(404);
    expect((await DELETE(req("DELETE", `/api/shipping-zones/${ZONE_ID}`), ctx())).status).toBe(404);
    _user = OWNER;
    expect((await PATCH(req("PATCH", "/api/shipping-zones/not-a-uuid", body), ctx("not-a-uuid"))).status).toBe(404);
    expect((await PATCH(req("PATCH", `/api/shipping-zones/${ZONE_ID}`, { ...body, name: "" }), ctx())).status).toBe(422);
    expect(mockPrisma.shippingZone.update).not.toHaveBeenCalled();
    expect(mockPrisma.shippingZone.delete).not.toHaveBeenCalled();
  });

  it("supprime une zone du propriétaire et revalide", async () => {
    const res = await DELETE(req("DELETE", `/api/shipping-zones/${ZONE_ID}`), ctx());
    expect(res.status).toBe(200);
    expect(mockPrisma.shippingZone.delete).toHaveBeenCalledWith({ where: { id: ZONE_ID } });
    expect(mockRevalidate).toHaveBeenCalledWith(SHOP_ID);
  });
});

describe("caisse masquée (drapeau absent)", () => {
  const create = { shop_id: SHOP_ID, name: "Ouaga", countries: ["bf"], rate: 1500 };
  const update = { name: "Ouaga élargie", countries: ["BF", "CI"], rate: 0 };

  it("POST et PATCH répondent 404 « Introuvable », même au propriétaire, sans rien écrire", async () => {
    let res = await POST(req("POST", "/api/shipping-zones", create));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Introuvable" });
    res = await PATCH(req("PATCH", `/api/shipping-zones/${ZONE_ID}`, update), ctx());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Introuvable" });
    expect(mockPrisma.shippingZone.create).not.toHaveBeenCalled();
    expect(mockPrisma.shippingZone.update).not.toHaveBeenCalled();
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("GET et DELETE restent ouverts : lire et faire le ménage, pas créer", async () => {
    expect((await GET(req("GET", `/api/shipping-zones?shopId=${SHOP_ID}`))).status).toBe(200);
    expect((await DELETE(req("DELETE", `/api/shipping-zones/${ZONE_ID}`), ctx())).status).toBe(200);
    expect(mockPrisma.shippingZone.delete).toHaveBeenCalledWith({ where: { id: ZONE_ID } });
  });
});
