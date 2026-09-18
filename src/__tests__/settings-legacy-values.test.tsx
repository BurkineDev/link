/**
 * Réglages → Apparence avec une ligne héritée hors catalogue.
 *
 * Le PATCH est fermé sur le catalogue (polices, thèmes) mais il acceptait
 * n'importe quelle chaîne avant : une boutique peut porter `bio_theme =
 * 'default'` ou `font_family = 'inter'` en base. La page ne doit ni planter
 * (`BIO_THEMES[bioTheme]`) ni présélectionner une valeur que le serveur
 * refuserait en 400 : elle part du repli que la page publique rend déjà.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/dashboard/settings",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: Record<string, unknown> & { href: string; children?: React.ReactNode }) =>
    React.createElement("a", { href, ...rest }, children),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/dashboard/links-section", () => ({ LinksSection: () => null }));
jest.mock("@/components/dashboard/shipping-section", () => ({ ShippingSection: () => null }));

import { SettingsClient } from "@/app/(dashboard)/dashboard/settings/settings-client";
import { DEFAULT_BIO_THEME } from "@/lib/bio-themes";
import type { ShopRow } from "@/lib/types/database";

function shop(overrides: Partial<ShopRow>): ShopRow {
  return {
    id: "shop-1",
    owner_id: "user-1",
    name: "Awa Couture",
    slug: "awa-couture",
    description: null,
    logo_url: null,
    banner_url: null,
    template_id: null,
    is_published: true,
    theme_color: "#6366F1",
    accent_color: "#0F172A",
    font_family: "sans",
    border_radius: "lg",
    card_style: "flat",
    cta_shape: "rounded",
    cta_style: "solid",
    bio_theme: "classic",
    currency: "XOF",
    contact_email: null,
    contact_phone: null,
    social_links: null,
    tiktok_pixel_id: null,
    meta_pixel_id: null,
    whatsapp_number: "+22670123456",
    checkout_mode: "whatsapp",
    intentions: [],
    featured_until: null,
    custom_domain: null,
    custom_domain_verified_at: null,
    show_biolien_badge: true,
    shipping_enabled: false,
    cash_on_delivery: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as ShopRow;
}

function render(overrides: Partial<ShopRow>) {
  return renderToStaticMarkup(
    <SettingsClient
      shop={shop(overrides)}
      links={[]}
      shippingZones={[]}
      canUseAi={false}
      canHideBadge={false}
      onlineCheckout={false}
      initialTab="appearance"
    />,
  );
}

describe("réglages — valeurs héritées hors catalogue", () => {
  it("ne plante pas et présélectionne le thème par défaut pour un bio_theme inconnu", () => {
    const html = render({ bio_theme: "default" as ShopRow["bio_theme"] });
    // La carte Wax (le repli) est pressée, aucune autre.
    const pressed = html.match(/<button[^>]*aria-pressed="true"[^>]*title="([^"]*)"/g) ?? [];
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toContain('title="Cobalt et moutarde');
    expect(DEFAULT_BIO_THEME).toBe("wax");
    // Le thème replié apporte sa paire : la carte « Sans » devient « Du thème ».
    expect(html).toContain("Du thème");
    expect(html).toContain("Ojuju + Atkinson, la paire du thème");
  });

  it("présélectionne « Sans » pour un font_family inconnu", () => {
    const html = render({ font_family: "inter" as ShopRow["font_family"] });
    // Classique n'a pas de paire : la carte garde son libellé « Sans » et est sélectionnée.
    const sans = /<button[^>]*class="[^"]*ring-2 ring-foreground"[^>]*>\s*<span class="text-3xl leading-none">Aa<\/span><span class="text-xs font-semibold">Sans<\/span>/.exec(html);
    expect(sans).not.toBeNull();
    expect(html).not.toContain("Du thème");
  });

  it("garde une ligne valide telle quelle", () => {
    const html = render({ bio_theme: "indigo", font_family: "serif" });
    const pressed = html.match(/<button[^>]*aria-pressed="true"[^>]*title="([^"]*)"/g) ?? [];
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toContain('title="Nuit indigo');
    const serif = /<button[^>]*class="[^"]*ring-2 ring-foreground"[^>]*>\s*<span class="text-3xl leading-none">Aa<\/span><span class="text-xs font-semibold">Serif<\/span>/.exec(html);
    expect(serif).not.toBeNull();
  });
});
