import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { enforceAiLimits } from "@/lib/rate-limit";

export const runtime = "nodejs";

const client = new Anthropic();

// Clamp free-text inputs so they cannot inflate token usage or stuff the prompt.
const clamp = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export async function POST(request: NextRequest) {
  try {
    const blocked = await enforceAiLimits(request, "description");
    if (blocked) return blocked;

    const body = await request.json() as {
      productName?: string;
      category?: string;
      keywords?: string;
      tone?: string;
    };

    const productName = clamp(body.productName, 200);
    const category = clamp(body.category, 100);
    const keywords = clamp(body.keywords, 200);
    const tone = clamp(body.tone, 50) || "professionnel";

    if (productName.length < 2) {
      return NextResponse.json({ error: "Nom du produit requis." }, { status: 400 });
    }

    const prompt = `Tu es un expert en copywriting pour le e-commerce africain.
Écris une description de produit accrocheuse, en français, pour un vendeur africain.

Produit: ${productName}
${category ? `Catégorie: ${category}` : ""}
${keywords ? `Mots-clés à inclure: ${keywords}` : ""}
Ton souhaité: ${tone}

La description doit:
- Faire entre 3 et 5 phrases
- Mettre en avant les bénéfices concrets pour l'acheteur
- Utiliser un langage simple et direct, adapté au marché africain
- Inclure un appel à l'action naturel à la fin
- Ne pas utiliser d'emojis excessifs

Réponds uniquement avec la description, sans introduction ni commentaire.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return NextResponse.json({ description: content.text.trim() });
  } catch (err) {
    console.error("[outils/description]", err);
    return NextResponse.json(
      { error: "Impossible de générer la description. Réessayez." },
      { status: 500 },
    );
  }
}
