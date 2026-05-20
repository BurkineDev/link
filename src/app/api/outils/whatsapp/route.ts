import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const MESSAGE_TYPES = {
  relance: "Relance un client qui n'a pas finalisé sa commande",
  confirmation: "Confirme une commande reçue",
  livraison: "Annonce que la commande est en route",
  promo: "Annonce une promotion ou un nouveau produit",
  rupture: "Informe que le produit est en rupture de stock",
} as const;

type MessageType = keyof typeof MESSAGE_TYPES;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      type?: string;
      shopName?: string;
      productName?: string;
      details?: string;
    };

    const { type, shopName, productName, details } = body;

    if (!type || !(type in MESSAGE_TYPES)) {
      return NextResponse.json({ error: "Type de message invalide." }, { status: 400 });
    }

    const messageType = type as MessageType;
    const context = MESSAGE_TYPES[messageType];

    const prompt = `Tu es un expert en vente sur WhatsApp pour les commerçants africains.
Écris un message WhatsApp court et efficace, en français, pour un vendeur.

Objectif du message: ${context}
${shopName ? `Nom de la boutique: ${shopName}` : ""}
${productName ? `Produit concerné: ${productName}` : ""}
${details ? `Détails supplémentaires: ${details}` : ""}

Le message doit:
- Faire entre 3 et 6 lignes maximum
- Être chaleureux et naturel, pas robotique
- Utiliser le prénom du client avec "[Prénom]" comme placeholder
- Inclure le nom de la boutique si fourni
- Être adapté au style de communication WhatsApp africain (direct, chaleureux)
- Finir par une action claire

Réponds uniquement avec le message, sans introduction ni commentaire.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 250,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return NextResponse.json({ message: content.text.trim() });
  } catch (err) {
    console.error("[outils/whatsapp]", err);
    return NextResponse.json(
      { error: "Impossible de générer le message. Réessayez." },
      { status: 500 },
    );
  }
}
