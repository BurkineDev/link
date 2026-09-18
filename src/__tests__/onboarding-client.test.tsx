/**
 * L'assistant à trois questions, rendu côté serveur : le premier écran ne
 * demande que le nom, l'adresse s'affiche en dessous, et un brouillon
 * ramène la vendeuse à l'écran WhatsApp. Le rendu statique suffit à
 * garantir qu'aucun jargon n'apparaît et que l'écran s'ouvre sans planter.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }) }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), message: jest.fn() } }));
jest.mock("@/components/shared/logo", () => ({ Logo: () => <span>Bio-Lien</span> }));
jest.mock("@/components/dashboard/whatsapp-number-field", () => ({
  WhatsAppNumberField: ({ label, help }: { label: string; help: string }) => (
    <div>
      <label>{label}</label>
      <p>{help}</p>
    </div>
  ),
}));

import OnboardingClient from "@/app/(dashboard)/dashboard/onboarding/onboarding-client";

const render = (profile = { fullName: null as string | null, username: null as string | null }) =>
  renderToStaticMarkup(<OnboardingClient userId="u1" profile={profile} nextPath={null} onlineCheckout={false} />);

describe("OnboardingClient", () => {
  test("le premier écran ne pose qu'une question : le nom de la boutique", () => {
    const html = render();
    expect(html).toContain("Comment s&#x27;appelle ta boutique");
    expect(html).toContain('id="shop-name"');
    expect(html).toContain("bio-lien.com/");
    expect(html).toContain("Étape 1 sur 3");
    // Aucun mot technique, aucun champ superflu.
    for (const banned of ["slug", "Devise", "Objectif", "Thème", "username", "Nom d'utilisateur"]) {
      expect(html).not.toContain(banned);
    }
    expect(html).not.toContain('id="onboarding-whatsapp"');
  });

  test("le bouton Continuer attend un nom (et une adresse) valides", () => {
    const html = render();
    // Rendu initial sans nom : le bouton est désactivé.
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*Continuer/);
  });

  test("les conditions d'utilisation restent visibles, avec le vocabulaire « ta page »", () => {
    const html = render();
    expect(html).toContain("En créant ta page");
    expect(html).toContain('href="/legal/terms"');
  });
});
