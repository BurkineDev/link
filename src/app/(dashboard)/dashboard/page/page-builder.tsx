"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { resolveBioTheme } from "@/lib/bio-themes";
import {
  BLOCK_TYPE_META,
  BLOCK_TYPES,
  type BlockType,
} from "@/lib/blocks/types";
import type { ResolvedBlock } from "@/lib/blocks/types";
import { BlockEditorDialog, defaultConfigFor } from "./block-editor";
import { BioPagePreview } from "./bio-page-preview";
import type { ShopRow } from "@/lib/types/database";

/**
 * Page Builder : éditeur à gauche, aperçu mobile fidèle à droite.
 *
 * L'état des blocs vit ici et l'aperçu le consomme directement — le vendeur
 * voit sa modification avant même que la requête ne parte. Chaque écriture est
 * ensuite confirmée par le serveur et l'échec ramène l'état précédent, plutôt
 * que de laisser croire à un enregistrement qui n'a pas eu lieu.
 */

interface PageBuilderProps {
  shop: ShopRow;
  initialBlocks: ResolvedBlock[];
  /** « legacy » = composition proposée, pas encore enregistrée en base. */
  source: "stored" | "legacy";
  pageUrl: string;
}

export function PageBuilder({
  shop,
  initialBlocks,
  source,
  pageUrl,
}: PageBuilderProps) {
  const [blocks, setBlocks] = useState<ResolvedBlock[]>(initialBlocks);
  const [isLegacy, setIsLegacy] = useState(source === "legacy");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editing, setEditing] = useState<ResolvedBlock | null>(null);
  const [creating, setCreating] = useState<BlockType | null>(null);
  const [busy, setBusy] = useState(false);

  const palette = useMemo(() => resolveBioTheme(shop), [shop]);

  /** Les blocs synthétisés n'existent pas en base : rien n'est modifiable. */
  const guardLegacy = (): boolean => {
    if (!isLegacy) return false;
    toast.info(
      "Adopte d'abord cette composition pour pouvoir la modifier.",
    );
    return true;
  };

  const adoptLegacyComposition = async () => {
    setBusy(true);
    try {
      const created: ResolvedBlock[] = [];
      // Séquentiel : l'ordre d'insertion détermine la position côté serveur.
      for (const block of blocks) {
        const res = await fetch("/api/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop_id: shop.id,
            type: block.type,
            title: block.title,
            config: block.config,
            style: block.style,
            visible: block.visible,
          }),
        });
        if (!res.ok) throw new Error("adopt");
        const { block: row } = await res.json();
        created.push({ ...block, id: row.id, position: row.position });
      }
      setBlocks(created);
      setIsLegacy(false);
      toast.success("Ta page est maintenant modifiable bloc par bloc.");
    } catch {
      toast.error("Impossible d'enregistrer la composition. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const addBlock = async (type: BlockType, config: unknown, title: string | null) => {
    setBusy(true);
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: shop.id, type, config, title }),
      });
      if (!res.ok) throw new Error("create");
      const { block } = await res.json();
      setBlocks((cur) => [
        ...cur,
        {
          id: block.id,
          type,
          position: block.position,
          title: block.title,
          config: block.config,
          style: block.style ?? {},
          visible: block.visible,
        } as ResolvedBlock,
      ]);
      toast.success("Bloc ajouté.");
    } catch {
      toast.error("Impossible d'ajouter le bloc.");
    } finally {
      setBusy(false);
      setCreating(null);
    }
  };

  const updateBlock = async (
    id: string,
    patch: { config?: unknown; title?: string | null; visible?: boolean },
  ) => {
    const previous = blocks;
    setBlocks((cur) =>
      cur.map((b) => (b.id === id ? ({ ...b, ...patch } as ResolvedBlock) : b)),
    );
    const res = await fetch(`/api/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setBlocks(previous);
      toast.error("Modification non enregistrée.");
      return false;
    }
    return true;
  };

  const toggleVisible = async (block: ResolvedBlock) => {
    if (guardLegacy()) return;
    await updateBlock(block.id, { visible: !block.visible });
  };

  const duplicateBlock = async (block: ResolvedBlock) => {
    if (guardLegacy()) return;
    setBusy(true);
    const res = await fetch(`/api/blocks/${block.id}`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      toast.error("Duplication impossible.");
      return;
    }
    const { block: row } = await res.json();
    setBlocks((cur) => [
      ...cur,
      { ...block, id: row.id, position: row.position },
    ]);
    toast.success("Bloc dupliqué.");
  };

  const removeBlock = async (block: ResolvedBlock) => {
    if (guardLegacy()) return;
    const previous = blocks;
    setBlocks((cur) => cur.filter((b) => b.id !== block.id));
    const res = await fetch(`/api/blocks/${block.id}`, { method: "DELETE" });
    if (!res.ok) {
      setBlocks(previous);
      toast.error("Suppression impossible.");
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    if (guardLegacy()) return;
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;

    const previous = blocks;
    const reordered = [...blocks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved!);
    setBlocks(reordered.map((b, i) => ({ ...b, position: i })));

    const res = await fetch("/api/blocks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shop.id,
        block_ids: reordered.map((b) => b.id),
      }),
    });
    if (!res.ok) {
      setBlocks(previous);
      toast.error("Réordonnancement non enregistré.");
    }
  };

  const availableTypes = BLOCK_TYPES.filter((t) => BLOCK_TYPE_META[t].available);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ma page</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compose ce que verront tes visiteurs. Chaque changement est visible
            à droite.
          </p>
        </div>
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <ExternalLinkIcon className="size-4" />
          Voir en ligne
        </a>
      </header>

      {isLegacy && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              Voici ta page actuelle, convertie en blocs
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Rien n&apos;a encore changé en ligne. Adopte cette composition
              pour pouvoir réordonner, masquer et ajouter des blocs.
            </p>
          </div>
          <Button
            onClick={adoptLegacyComposition}
            disabled={busy}
            className="shrink-0 gap-1.5"
          >
            {busy && <Loader2Icon className="size-4 animate-spin" />}
            Adopter et modifier
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* ── Éditeur ── */}
        <div className="min-w-0 space-y-3">
          {blocks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="text-sm font-medium">Ta page est vide</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ajoute ton premier bloc : un lien, un produit, ou ton WhatsApp.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {blocks.map((block, index) => (
                <li
                  key={block.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors",
                    block.visible ? "border-border" : "border-border/60 opacity-60",
                  )}
                >
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0 || busy}
                      aria-label="Monter ce bloc"
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUpIcon className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === blocks.length - 1 || busy}
                      aria-label="Descendre ce bloc"
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDownIcon className="size-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (guardLegacy()) return;
                      setEditing(block);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium">
                      {block.title || BLOCK_TYPE_META[block.type].label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {describeBlock(block)}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                      label={block.visible ? "Masquer ce bloc" : "Afficher ce bloc"}
                      onClick={() => toggleVisible(block)}
                    >
                      {block.visible ? (
                        <EyeIcon className="size-4" />
                      ) : (
                        <EyeOffIcon className="size-4" />
                      )}
                    </IconButton>
                    <IconButton
                      label="Dupliquer ce bloc"
                      onClick={() => duplicateBlock(block)}
                    >
                      <CopyIcon className="size-4" />
                    </IconButton>
                    <IconButton
                      label="Supprimer ce bloc"
                      onClick={() => removeBlock(block)}
                      destructive
                    >
                      <Trash2Icon className="size-4" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Button
            onClick={() => {
              if (guardLegacy()) return;
              setLibraryOpen(true);
            }}
            disabled={busy}
            className="h-12 w-full gap-2"
          >
            <PlusIcon className="size-4" />
            Ajouter
          </Button>
        </div>

        {/* ── Aperçu ── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Aperçu
          </p>
          <BioPagePreview shop={shop} palette={palette} blocks={blocks} />
        </aside>
      </div>

      {/* Bibliothèque de blocs */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un bloc</DialogTitle>
            <DialogDescription>
              Choisis ce que tu veux montrer à tes visiteurs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {availableTypes.map((type) => {
              const meta = BLOCK_TYPE_META[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setLibraryOpen(false);
                    setCreating(type);
                  }}
                  className="rounded-xl border border-border p-3 text-left transition-colors hover:border-foreground/40 hover:bg-muted/60"
                >
                  <p className="text-sm font-semibold">{meta.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {meta.description}
                  </p>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Création */}
      {creating && (
        <BlockEditorDialog
          open
          onOpenChange={(open) => !open && setCreating(null)}
          type={creating}
          initialConfig={defaultConfigFor(creating, shop)}
          initialTitle={null}
          onSubmit={(config, title) => addBlock(creating, config, title)}
        />
      )}

      {/* Édition */}
      {editing && (
        <BlockEditorDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          type={editing.type}
          initialConfig={editing.config}
          initialTitle={editing.title}
          onSubmit={async (config, title) => {
            const ok = await updateBlock(editing.id, { config, title });
            if (ok) {
              toast.success("Bloc mis à jour.");
              setEditing(null);
            }
          }}
        />
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  destructive,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted",
        destructive ? "hover:text-destructive" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Résumé d'une ligne de l'éditeur — ce que le bloc contient concrètement. */
function describeBlock(block: ResolvedBlock): string {
  const config = block.config as Record<string, unknown>;
  switch (block.type) {
    case "LINK":
      return String(config.label ?? "") || String(config.url ?? "");
    case "TEXT":
      return String(config.body ?? "").slice(0, 60);
    case "WHATSAPP":
      return String(config.label ?? "WhatsApp");
    case "PRODUCT_COLLECTION":
      return "Tes produits publiés";
    case "PRODUCT":
      return "Un produit mis en avant";
    case "SOCIAL":
      return "Tes réseaux sociaux";
    case "IMAGE":
      return String(config.alt ?? "Image");
    default:
      return BLOCK_TYPE_META[block.type].description;
  }
}
