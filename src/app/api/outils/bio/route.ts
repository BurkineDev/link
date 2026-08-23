import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { enforceAiLimits } from "@/lib/rate-limit";
import { getEffectivePlan, getPlanLimits } from "@/lib/subscription";
import { parseBioOptions } from "@/lib/ai/bio-options";

export const runtime = "nodejs";

const client = new Anthropic();

// ---------------------------------------------------------------------------
// POST /api/outils/bio — propose des bios pour la page d'un vendeur.
//
// « Si t'as la flemme d'écrire une bio, ils vont te transformer ça en quelque
// chose de top » — c'est ainsi qu'une créatrice décrit l'outil équivalent chez
// Linktree. Le métier de cette route n'est pas de faire rêver : c'est de
// débloquer un champ vide devant lequel un vendeur abandonne.
//
// Trois propositions plutôt qu'une : choisir coûte moins cher que regénérer,
// et un seul appel sert les trois.
//
// Réservée au plan Pro. Chaque génération est un appel facturé : sans compte
// et sans plan, cette route serait une dépense ouverte à qui trouve l'URL.
// La limite de débit par IP protège du volume, pas du principe.
// ---------------------------------------------------------------------------

/** Une bio de page bio est courte par nature — deux phrases suffisent. */
const TARGET_LENGTH = 140;

const clamp = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export async function POST(request: NextRequest) {
  try {
    const blocked = await enforceAiLimits(request, "bio");
    if (blocked) return blocked;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Lu avec la clé service : l'abonnement décide d'une dépense, il ne se
    // lit pas à travers une politique que le client pourrait contourner.
    const { data: sub } = await getAdminClient()
      .from("creator_subscriptions")
      .select("plan, status, provider, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();

    const plan = getEffectivePlan(sub);
    if (!getPlanLimits(plan).aiWriting) {
      return NextResponse.json(
        {
          error:
            "La rédaction assistée fait partie du plan Pro. Passe en Pro pour l'utiliser.",
          code: "PLAN_REQUIRED",
        },
        { status: 402 },
      );
    }

    const body = (await request.json()) as {
      shopName?: string;
      activity?: string;
      city?: string;
      tone?: string;
    };

    const shopName = clamp(body.shopName, 80);
    const activity = clamp(body.activity, 200);
    const city = clamp(body.city, 80);
    const tone = clamp(body.tone, 40) || "chaleureux";

    if (shopName.length < 2) {
      return NextResponse.json(
        { error: "Le nom de la boutique est requis." },
        { status: 400 },
      );
    }

    const message = await client.messages.create({
      // Le modèle le moins cher du catalogue, choisi délibérément : écrire
      // deux phrases ne demande pas davantage, et la fonctionnalité doit
      // rester rentable à l'échelle d'un abonnement mensuel.
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      system: `Tu écris des bios courtes pour les pages « lien en bio » de vendeurs d'Afrique de l'Ouest — le genre de page qu'on met dans sa bio TikTok ou Instagram.

Contraintes de forme, sans exception :
- Français simple et direct. Pas de jargon marketing, pas de superlatifs creux.
- ${TARGET_LENGTH} caractères maximum par bio. Une ou deux phrases.
- Au plus un emoji, et seulement s'il apporte quelque chose.
- Ne jamais inventer de fait : pas de chiffre, pas d'année d'ancienneté, pas de récompense, rien qui ne soit dans les informations fournies.
- Ne pas répéter le nom de la boutique : il est déjà affiché juste au-dessus.
- Écrire à la personne qui visite, pas sur soi à la troisième personne.

Réponds avec exactement trois propositions, une par ligne, sans numérotation, sans guillemets, sans introduction ni commentaire.`,
      messages: [
        {
          role: "user",
          content: [
            `Boutique : ${shopName}`,
            activity ? `Ce qu'elle vend : ${activity}` : null,
            city ? `Ville : ${city}` : null,
            `Ton souhaité : ${tone}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      console.warn("[outils/bio] refus:", message.stop_details);
      return NextResponse.json(
        { error: "Impossible de générer une bio pour cette boutique." },
        { status: 422 },
      );
    }

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const options = parseBioOptions(text);

    if (options.length === 0) {
      throw new Error("Réponse vide");
    }

    return NextResponse.json({ options });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Trop de demandes en ce moment. Réessaie dans un instant." },
        { status: 429 },
      );
    }
    console.error("[outils/bio]", err);
    return NextResponse.json(
      { error: "Impossible de générer la bio. Réessaye." },
      { status: 500 },
    );
  }
}
