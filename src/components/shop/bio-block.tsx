"use client";

import { MessageCircle } from "lucide-react";
import { BioLinkButton } from "@/components/shop/bio-link-button";
import { blockClickEndpoint } from "@/lib/blocks/ids";
import type { ResolvedBlock } from "@/lib/blocks/types";
import type { BioPalette } from "@/lib/bio-themes";
import { cn } from "@/lib/utils";
import { normalizeWhatsAppNumber } from "@/lib/utils/whatsapp";
import type { SocialLinks } from "@/lib/types/database";

/**
 * Rendu public d'un bloc de contenu (tout sauf les blocs produits, qui
 * alimentent l'onglet Boutique).
 *
 * Un type que ce composant ne sait pas rendre renvoie `null` plutôt que de
 * lever : la page d'un vendeur ne doit jamais tomber parce qu'un bloc a été
 * enregistré par une version plus récente du produit.
 */

interface BioBlockProps {
  block: ResolvedBlock;
  palette: BioPalette;
  /** Classe de rayon dérivée de la forme de CTA de la boutique. */
  radiusClass: string;
  pageUrl: string;
  shopName: string;
  /** Numéro de la boutique — utilisé si le bloc n'en porte pas. */
  shopWhatsappNumber: string | null;
  /** Réseaux des réglages — utilisés si le bloc SOCIAL n'en liste aucun. */
  shopSocialLinks: SocialLinks | null;
}

export function BioBlock({
  block,
  palette,
  radiusClass,
  pageUrl,
  shopName,
  shopWhatsappNumber,
  shopSocialLinks,
}: BioBlockProps) {
  const body = renderBlock({
    block,
    palette,
    radiusClass,
    pageUrl,
    shopName,
    shopWhatsappNumber,
    shopSocialLinks,
  });

  if (body === null) return null;

  // Le titre est optionnel et sert de respiration entre deux groupes de
  // blocs — il n'est rendu que s'il existe, jamais comme placeholder.
  if (!block.title) return body;

  return (
    <div className="space-y-2">
      <h2 className="px-1 text-sm font-semibold" style={{ color: palette.text }}>
        {block.title}
      </h2>
      {body}
    </div>
  );
}

function renderBlock({
  block,
  palette,
  radiusClass,
  pageUrl,
  shopName,
  shopWhatsappNumber,
  shopSocialLinks,
}: BioBlockProps): React.ReactElement | null {
  switch (block.type) {
    case "LINK": {
      const config = block.config as {
        url: string;
        label: string;
        icon: string;
        thumbnailUrl?: string | null;
      };
      return (
        <ul>
          <BioLinkButton
            link={{
              id: block.id,
              label: config.label,
              url: config.url,
              icon: config.icon,
              thumbnail_url: config.thumbnailUrl ?? null,
              position: block.position,
            }}
            palette={palette}
            radiusClass={radiusClass}
            pageUrl={pageUrl}
            clickEndpoint={blockClickEndpoint(block.id)}
          />
        </ul>
      );
    }

    case "WHATSAPP": {
      const config = block.config as {
        phone?: string | null;
        label: string;
        prefilledMessage?: string | null;
      };
      const digits = normalizeWhatsAppNumber(
        config.phone || shopWhatsappNumber,
      );
      // Sans numéro exploitable, le bouton mènerait à une page d'erreur
      // WhatsApp : mieux vaut ne rien afficher.
      if (digits.length < 8) return null;

      const message =
        config.prefilledMessage?.trim() ||
        `Bonjour ${shopName} 👋\nJ'ai des questions sur ta boutique.\n\nBoutique : ${pageUrl}`;

      return (
        <a
          href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => beacon(blockClickEndpoint(block.id))}
          className={cn(
            "flex w-full items-center justify-center gap-2 px-4 py-3.5 text-[15px] font-semibold text-white",
            "transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            radiusClass,
          )}
          style={
            {
              backgroundColor: "#25D366",
              ["--tw-ring-color"]: palette.text,
              ["--tw-ring-offset-color"]: palette.backgroundSolid,
            } as React.CSSProperties
          }
        >
          <MessageCircle className="size-5" />
          {config.label}
        </a>
      );
    }

    case "TEXT": {
      const config = block.config as { body: string; align: "left" | "center" };
      return (
        <p
          className="whitespace-pre-line px-2 text-[15px] leading-relaxed"
          style={{ color: palette.text, textAlign: config.align }}
        >
          {config.body}
        </p>
      );
    }

    case "IMAGE": {
      const config = block.config as {
        url: string;
        alt: string;
        linkUrl?: string | null;
      };
      const image = (
        // Adresse fournie par le vendeur, hôte arbitraire : impossible à
        // déclarer dans next.config, donc <img> et pas next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.url}
          alt={config.alt}
          loading="lazy"
          decoding="async"
          className={cn("w-full object-cover", radiusClass)}
        />
      );

      if (!config.linkUrl) return image;
      return (
        <a
          href={config.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => beacon(blockClickEndpoint(block.id))}
          className="block"
        >
          {image}
        </a>
      );
    }

    case "SOCIAL": {
      const config = block.config as {
        networks: Array<{ network: string; url: string }>;
      };
      const networks =
        config.networks.length > 0
          ? config.networks
          : Object.entries(shopSocialLinks ?? {}).flatMap(([network, url]) =>
              typeof url === "string" && url ? [{ network, url }] : [],
            );
      if (networks.length === 0) return null;

      return (
        <ul className="flex flex-wrap justify-center gap-2">
          {networks.map((entry) => (
            <li key={`${entry.network}:${entry.url}`}>
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "block px-4 py-2 text-sm font-semibold capitalize",
                  "transition-transform duration-150 active:scale-95",
                  radiusClass,
                )}
                style={{
                  backgroundColor: palette.surface,
                  color: palette.surfaceText,
                  border: `1px solid ${palette.border}`,
                }}
              >
                {entry.network}
              </a>
            </li>
          ))}
        </ul>
      );
    }

    default:
      // Types déclarés mais pas encore rendus (VIDEO, FORM, BOOKING…).
      return null;
  }
}

/** Compte un tap sans retarder la navigation — même contrat qu'ailleurs. */
function beacon(endpoint: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint);
      return;
    }
    void fetch(endpoint, { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    // Les statistiques ne doivent jamais casser un lien.
  }
}
