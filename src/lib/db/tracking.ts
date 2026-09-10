import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Port des dernières fonctions Postgres : compteurs publics, réordonnancement
 * des blocs et consommation d'un lien de téléchargement.
 *
 * Les trois compteurs sont appelés depuis le navigateur d'un visiteur anonyme
 * (`sendBeacon`). Leur seule capacité est un +1 sur un objet *visible* d'une
 * boutique *publiée* ; un identifiant inconnu est un no-op silencieux, pour
 * qu'on ne puisse rien énumérer. Ces contraintes vivaient dans le `where` des
 * fonctions SQL ; elles vivent ici dans le `where` Prisma.
 */

export async function trackPageBlockClick(blockId: string): Promise<void> {
  await prisma.pageBlock.updateMany({
    where: { id: blockId, visible: true, shop: { isPublished: true } },
    data: { clickCount: { increment: 1 } },
  });
}

export async function trackShopLinkClick(linkId: string): Promise<void> {
  await prisma.shopLink.updateMany({
    where: { id: linkId, isActive: true, shop: { isPublished: true } },
    data: { clickCount: { increment: 1 } },
  });
}

/** Une ligne par boutique et par jour ; `on conflict do update` côté SQL. */
export async function trackShopPageView(shopId: string): Promise<void> {
  const published = await prisma.shop.findFirst({
    where: { id: shopId, isPublished: true },
    select: { id: true },
  });
  if (!published) return;

  // `current_date` côté Postgres ; ici le jour UTC, stocké dans une colonne
  // `date` — l'heure est ignorée.
  const day = new Date(new Date().toISOString().slice(0, 10));

  await prisma.shopPageView.upsert({
    where: { shopId_day: { shopId, day } },
    create: { shopId, day, views: 1 },
    update: { views: { increment: 1 } },
  });
}

/**
 * Port de `reorder_page_blocks` : la position de chaque bloc devient son
 * index dans la liste. Un identifiant qui n'appartient pas à la boutique est
 * ignoré, comme le faisait le `where b.shop_id = p_shop_id`.
 */
export async function reorderPageBlocks(
  shopId: string,
  blockIds: string[],
): Promise<void> {
  await prisma.$transaction(
    blockIds.map((id, index) =>
      prisma.pageBlock.updateMany({
        where: { id, shopId },
        data: { position: index },
      }),
    ),
  );
}

export type ConsumeDownloadResult =
  | { ok: false; reason: "not_found" | "not_paid" | "expired" | "limit_reached" }
  | { ok: true; file_key: string; file_name: string | null };

/**
 * Port de `consume_digital_download` : consomme un lien sous verrou, pour
 * que deux téléchargements simultanés ne contournent pas la limite.
 */
export async function consumeDigitalDownload(
  token: string,
): Promise<ConsumeDownloadResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      select id from public.digital_downloads
       where token = ${token}::uuid for update
    `;
    if (locked.length === 0) {
      return { ok: false, reason: "not_found" } as const;
    }

    const download = await tx.digitalDownload.findUniqueOrThrow({
      where: { id: locked[0].id },
      select: {
        id: true,
        fileKey: true,
        fileName: true,
        downloadCount: true,
        downloadLimit: true,
        expiresAt: true,
        order: { select: { paymentStatus: true } },
      },
    });

    if (download.order.paymentStatus !== "paid") {
      return { ok: false, reason: "not_paid" } as const;
    }
    if (download.expiresAt !== null && download.expiresAt <= new Date()) {
      return { ok: false, reason: "expired" } as const;
    }
    if (download.downloadCount >= download.downloadLimit) {
      return { ok: false, reason: "limit_reached" } as const;
    }

    await tx.digitalDownload.update({
      where: { id: download.id },
      data: { downloadCount: { increment: 1 }, lastDownloadedAt: new Date() },
    });

    return {
      ok: true,
      file_key: download.fileKey,
      file_name: download.fileName,
    } as const;
  });
}
