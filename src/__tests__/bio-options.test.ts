/**
 * Nettoyage des bios proposées par le modèle.
 *
 * Ce qui sort d'ici atterrit dans le champ que verront tous les visiteurs
 * d'une boutique. Une bio qui commence par « 1. » est un défaut public.
 */

import { parseBioOptions } from "@/lib/ai/bio-options";

describe("parseBioOptions", () => {
  test("rend les trois lignes telles quelles quand le modèle obéit", () => {
    const out = parseBioOptions(
      "Tissus wax et prêt-à-porter, livrés à Abidjan.\nDes pièces uniques choisies une par une.\nÉcris-moi, je réponds vite.",
    );
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("Tissus wax et prêt-à-porter, livrés à Abidjan.");
  });

  test("retire la numérotation", () => {
    expect(parseBioOptions("1. Première\n2) Deuxième\n3 . Troisième")).toEqual([
      "Première",
      "Deuxième",
      "Troisième",
    ]);
  });

  test("retire les puces", () => {
    expect(parseBioOptions("- Une\n* Deux\n• Trois")).toEqual([
      "Une",
      "Deux",
      "Trois",
    ]);
  });

  test("retire les guillemets qui entourent", () => {
    expect(parseBioOptions('"Une bio"\n«Deux»\n“Trois”')).toEqual([
      "Une bio",
      "Deux",
      "Trois",
    ]);
  });

  test("ne touche pas à une apostrophe interne", () => {
    expect(parseBioOptions("L'atelier d'à côté")).toEqual([
      "L'atelier d'à côté",
    ]);
  });

  test("ignore les lignes vides", () => {
    expect(parseBioOptions("Une\n\n\nDeux\n   \nTrois")).toEqual([
      "Une",
      "Deux",
      "Trois",
    ]);
  });

  test("ne rend jamais plus que la limite demandée", () => {
    expect(parseBioOptions("a\nb\nc\nd\ne")).toHaveLength(3);
    expect(parseBioOptions("a\nb\nc\nd\ne", 2)).toHaveLength(2);
  });

  test("tronque à la longueur du champ en base", () => {
    const [only] = parseBioOptions("x".repeat(900));
    expect(only!.length).toBe(500);
  });

  test("une réponse vide ne rend rien plutôt que du vide déguisé", () => {
    expect(parseBioOptions("")).toEqual([]);
    expect(parseBioOptions("\n\n  \n")).toEqual([]);
  });
});
