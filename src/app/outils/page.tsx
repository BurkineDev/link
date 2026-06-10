import type { Metadata } from "next";
import { OutilsClient } from "./outils-client";

export const metadata: Metadata = {
  title: "Outils gratuits pour vendre sur WhatsApp et Instagram | Bio-Lien",
  description:
    "Générez des descriptions produits, messages WhatsApp et prix avec marge pour vendre plus facilement avec Bio-Lien.",
};

export default function OutilsPage() {
  return <OutilsClient />;
}
