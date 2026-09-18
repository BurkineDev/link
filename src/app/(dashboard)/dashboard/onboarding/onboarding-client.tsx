"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft, ArrowRight, Camera, Check, Copy, ExternalLink, Loader2, MessageCircle } from "lucide-react";
import { DEFAULT_BIO_THEME } from "@/lib/bio-themes";
import { seedBlocksForIntentions } from "@/lib/onboarding/intentions";
import { usernameSchema } from "@/lib/validations/auth";
import { useDebounce } from "@/hooks/use-debounce";
import { isValidE164, iso2FromE164 } from "@/lib/phone/dial-codes";
import { WhatsAppNumberField } from "@/components/dashboard/whatsapp-number-field";
import {
  browserDraftStorage,
  clearDraft,
  loadDraft,
  saveDraft,
  type OnboardingDraft,
} from "@/lib/onboarding/draft";
import {
  currencyForWhatsAppNumber,
  productSlugFor,
  shareTexts,
  shopSlugFromName,
  usernameForShop,
} from "@/lib/onboarding/simple";

/**
 * L'assistant de démarrage — trois questions, puis le lien.
 *
 * L'ancienne version demandait cinq écrans (profil, boutique avec « slug »
 * et devise, objectifs, thème, fin) pour aboutir à une page sans produit.
 * Une vendeuse qui arrive de TikTok sur un téléphone d'entrée de gamme
 * n'a pas ce temps-là, et ne sait pas ce qu'est un slug. Ici :
 *
 * 1. « Comment s'appelle ta boutique ? » — l'adresse se déduit du nom.
 * 2. « Ton numéro WhatsApp » — c'est là que les commandes arrivent ; la
 *    devise se déduit du pays.
 * 3. « Ton premier produit » — nom, prix, photo ; on peut passer.
 * Puis « Voilà ton lien », avec de quoi le partager sur WhatsApp ou le
 * copier pour la bio TikTok.
 *
 * Le thème est Wax (voir DEFAULT_BIO_THEME), modifiable après dans les
 * réglages ; les réseaux se remplissent depuis « Ma page ». La boutique est
 * créée à la fin de l'écran 2 (une seule transaction côté serveur) et
 * publiée dès qu'on sort de l'écran 3, avec ou sans produit : une page avec
 * un bouton WhatsApp vaut mieux qu'une page qui n'existe pas.
 */

const STEP_COUNT = 3;

interface Created {
  id: string;
  slug: string;
  currency: string;
}

export default function OnboardingClient({
  userId,
  profile,
  nextPath,
  onlineCheckout,
}: {
  userId: string;
  profile: { fullName: string | null; username: string | null };
  nextPath: string | null;
  /** Caisse Bio-Lien allumée : le mode de commande reste « whatsapp » ici quoi qu'il arrive. */
  onlineCheckout: boolean;
}) {
  void onlineCheckout;
  const router = useRouter();
  const storage = useMemo(() => browserDraftStorage(), []);
  // Le brouillon est lu une fois, à la première construction de l'état : ce
  // que la vendeuse avait tapé avant une coupure ou un rechargement.
  const [draft] = useState<OnboardingDraft | null>(() =>
    typeof window === "undefined" ? null : loadDraft(storage, userId),
  );

  const [step, setStep] = useState<number>(() => (draft?.step2?.shopName ? 2 : 1));

  // ── Écran 1 : le nom, et l'adresse qui en découle ─────────────────────
  const [shopName, setShopName] = useState(draft?.step2?.shopName ?? "");
  const [slugEdited, setSlugEdited] = useState(
    Boolean(draft?.step2?.shopSlug && draft.step2.shopSlug !== shopSlugFromName(draft.step2.shopName)),
  );
  const [slug, setSlug] = useState(draft?.step2?.shopSlug || shopSlugFromName(draft?.step2?.shopName ?? ""));
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const debouncedSlug = useDebounce(slug, 400);

  // L'adresse suit le nom tant que la vendeuse ne l'a pas retouchée.
  function changeShopName(value: string) {
    setShopName(value);
    if (!slugEdited) setSlug(shopSlugFromName(value));
  }

  useEffect(() => {
    let cancelled = false;
    if (debouncedSlug.length < 3) {
      queueMicrotask(() => {
        if (!cancelled) setSlugAvailable(null);
      });
      return () => {
        cancelled = true;
      };
    }
    queueMicrotask(() => {
      if (!cancelled) setCheckingSlug(true);
    });
    // Réseau coupé : on ne sait pas, le serveur tranchera à la création
    // (409) — plutôt que de bloquer l'écran sur un faux « pris ».
    fetch(`/api/shops/check-slug?slug=${encodeURIComponent(debouncedSlug)}`)
      .then(async (res) => (res.ok ? ((await res.json()) as { available?: boolean }).available === true : null))
      .catch(() => null)
      .then((available) => {
        if (cancelled) return;
        setSlugAvailable(available);
        setCheckingSlug(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSlug]);

  // ── Écran 2 : le numéro WhatsApp ───────────────────────────────────────
  const [whatsappNumber, setWhatsappNumber] = useState(draft?.step2?.whatsappNumber ?? "");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  // ── Écran 3 : le premier produit ───────────────────────────────────────
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productImage, setProductImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  // Le brouillon : ce que la vendeuse a tapé survit à un rechargement ou à
  // une coupure, sept jours. Rien n'est envoyé au serveur avant l'écran 2.
  useEffect(() => {
    if (created) return;
    saveDraft(storage, userId, {
      step: Math.min(step, 2),
      step1: null,
      step2: { shopName, shopSlug: slug, currency: currencyForWhatsAppNumber(whatsappNumber), checkoutMode: "whatsapp", whatsappNumber },
      intentions: ["sell", "whatsapp"],
      handles: {},
      announcement: "",
      bioTheme: DEFAULT_BIO_THEME,
    });
  }, [storage, userId, step, shopName, slug, whatsappNumber, created]);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.bio-lien.com";
  const publicUrl = `${origin}/${created?.slug ?? slug}`;
  const shortUrl = publicUrl.replace(/^https?:\/\//, "");
  const exitTo = nextPath ?? "/dashboard";

  const nameOk = shopName.trim().length >= 2;
  const slugOk = usernameSchema.safeParse(slug).success && slugAvailable !== false;

  // ── Actions ─────────────────────────────────────────────────────────────
  async function createShop() {
    if (!isValidE164(whatsappNumber)) {
      toast.error("Choisis l'indicatif et saisis ton numéro WhatsApp complet.");
      return;
    }
    setCreating(true);
    const currency = currencyForWhatsAppNumber(whatsappNumber);
    const name = shopName.trim();
    const body = {
      fullName: profile.fullName ?? name,
      username: profile.username ?? usernameForShop(slug),
      shop: {
        name,
        slug,
        description: null,
        currency,
        checkoutMode: "whatsapp",
        whatsappNumber,
        bioTheme: DEFAULT_BIO_THEME,
        intentions: ["sell", "whatsapp"],
      },
      blocks: seedBlocksForIntentions({ intentions: ["sell", "whatsapp"], whatsappNumber, shopName: name }),
    };
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { shopId?: string; slug?: string | null; code?: string; error?: string };
      if (res.status === 409 && json.code === "ALREADY_ONBOARDED" && json.shopId) {
        // Une boutique existe déjà (double clic, ancien passage) : on
        // continue avec elle plutôt que de bloquer.
        setCreated({ id: json.shopId, slug: json.slug ?? slug, currency });
        setStep(3);
        return;
      }
      if (res.status === 409 && json.code === "SLUG_TAKEN") {
        setSlugAvailable(false);
        setStep(1);
        toast.error("Cette adresse vient d'être prise. Choisis-en une autre.");
        return;
      }
      if (!res.ok || !json.shopId) {
        throw new Error(json.error ?? "Impossible de créer ta page.");
      }
      setCreated({ id: json.shopId, slug, currency });
      clearDraft(storage, userId);
      setStep(3);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de créer ta page.");
    } finally {
      setCreating(false);
    }
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", `${userId}/products`);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "La photo n'a pas pu être envoyée.");
      setProductImage(json.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "La photo n'a pas pu être envoyée.");
    } finally {
      setUploading(false);
    }
  }

  async function publish(shop: Created) {
    const res = await fetch(`/api/shops/${shop.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: true }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Impossible de publier ta page.");
    }
  }

  async function finish(withProduct: boolean) {
    if (!created) return;
    setFinishing(true);
    try {
      if (withProduct) {
        const price = Number(productPrice.replace(/\s/g, "").replace(",", "."));
        if (productName.trim().length < 2 || !Number.isFinite(price) || price < 0) {
          toast.error("Indique le nom du produit et son prix.");
          return;
        }
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop_id: created.id,
            name: productName.trim(),
            slug: productSlugFor(productName),
            price,
            currency: created.currency,
            images: productImage ? [productImage] : [],
            is_published: true,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Le produit n'a pas pu être ajouté.");
        }
      }
      await publish(created);
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setFinishing(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.message(publicUrl, { description: "Copie ce lien à la main." });
    }
  }

  const share = shareTexts(publicUrl, shopName.trim());

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          {!done && (
            <ol className="flex items-center gap-2" aria-label={`Étape ${step} sur ${STEP_COUNT}`}>
              {Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map((n) => (
                <li
                  key={n}
                  aria-current={n === step ? "step" : undefined}
                  className={cn(
                    "h-2.5 rounded-full transition-all",
                    n < step ? "w-6 bg-primary" : n === step ? "w-8 bg-primary" : "w-2.5 bg-muted",
                  )}
                />
              ))}
            </ol>
          )}
        </div>

        {step === 1 && !done && (
          <Card className="space-y-6 p-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">Comment s&apos;appelle ta boutique&nbsp;?</h1>
              <p className="text-muted-foreground">Le nom que tes clients connaissent — sur TikTok, au marché, sur WhatsApp.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-name">Nom de la boutique</Label>
              <Input
                id="shop-name"
                autoFocus
                autoComplete="organization"
                placeholder="Awa Couture"
                className="h-12 text-base"
                value={shopName}
                onChange={(e) => changeShopName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nameOk && slugOk) setStep(2);
                }}
              />
            </div>
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs text-muted-foreground">Ton adresse</p>
              {slugEdited ? (
                <div className="mt-1 flex items-center gap-1 text-sm">
                  <span className="shrink-0 text-muted-foreground">bio-lien.com/</span>
                  <Input
                    aria-label="Adresse de ta page"
                    className="h-9"
                    value={slug}
                    onChange={(e) => setSlug(shopSlugFromName(e.target.value))}
                  />
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="break-all font-mono text-sm font-semibold">bio-lien.com/{slug || "…"}</p>
                  <button type="button" className="shrink-0 text-xs underline" onClick={() => setSlugEdited(true)}>
                    modifier
                  </button>
                </div>
              )}
              <p className="mt-1 min-h-4 text-xs" role="status">
                {slug.length >= 3 && checkingSlug && "Vérification…"}
                {slug.length >= 3 && !checkingSlug && slugAvailable === true && <span className="text-green-700">Disponible</span>}
                {slug.length >= 3 && !checkingSlug && slugAvailable === false && <span className="text-destructive">Déjà prise — change une lettre.</span>}
              </p>
            </div>
            <Button className="h-12 w-full gap-2" disabled={!nameOk || !slugOk || checkingSlug} onClick={() => setStep(2)}>
              Continuer <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        )}

        {step === 2 && !done && (
          <Card className="space-y-6 p-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">Ton numéro WhatsApp</h1>
              <p className="text-muted-foreground">C&apos;est là que tes clients t&apos;écrivent pour commander. Rien d&apos;autre à installer.</p>
            </div>
            <WhatsAppNumberField
              id="onboarding-whatsapp"
              value={whatsappNumber}
              onChange={setWhatsappNumber}
              currency={currencyForWhatsAppNumber(whatsappNumber)}
              label="Numéro WhatsApp"
              help={`Les prix de ta page seront en ${currencyForWhatsAppNumber(whatsappNumber) === "XOF" ? "FCFA" : currencyForWhatsAppNumber(whatsappNumber)}${iso2FromE164(whatsappNumber) ? "" : " (selon ton pays)"}.`}
            />
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="h-12 gap-2" onClick={() => setStep(1)} disabled={creating}>
                <ArrowLeft className="h-4 w-4" /> Retour
              </Button>
              <Button className="h-12 flex-1 gap-2" disabled={!isValidE164(whatsappNumber) || creating} onClick={createShop}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Créer ma page <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </Card>
        )}

        {step === 3 && created && !done && (
          <Card className="space-y-6 p-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">Ton premier produit</h1>
              <p className="text-muted-foreground">Le nom, le prix, une photo. Tu en ajouteras d&apos;autres après.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-name">Nom du produit</Label>
              <Input
                id="product-name"
                autoFocus
                placeholder="Robe en pagne, coupe droite"
                className="h-12 text-base"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">Prix ({created.currency === "XOF" || created.currency === "XAF" ? "FCFA" : created.currency})</Label>
              <Input
                id="product-price"
                inputMode="decimal"
                placeholder="12 500"
                className="h-12 text-base"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-photo">Photo (facultatif)</Label>
              <label
                htmlFor="product-photo"
                className={cn(
                  "flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm",
                  productImage && "border-solid border-primary text-primary",
                )}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : productImage ? <Check className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                {uploading ? "Envoi de la photo…" : productImage ? "Photo ajoutée" : "Prendre ou choisir une photo"}
              </label>
              <input
                id="product-photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadPhoto(file);
                }}
              />
            </div>
            <div className="flex flex-col gap-3">
              <Button className="h-12 gap-2" disabled={finishing || uploading} onClick={() => finish(true)}>
                {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Ajouter et voir mon lien <ArrowRight className="h-4 w-4" /></>}
              </Button>
              <Button variant="ghost" className="h-12" disabled={finishing || uploading} onClick={() => finish(false)}>
                Passer — j&apos;ajouterai mes produits après
              </Button>
            </div>
          </Card>
        )}

        {done && created && (
          <Card className="space-y-6 p-6">
            <div className="space-y-1 text-center">
              <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-primary/20">
                <Check className="size-7" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold">Voilà ton lien</h1>
              <p className="text-muted-foreground">Ta page est en ligne. Mets ce lien dans ta bio TikTok et Instagram, et envoie-le sur WhatsApp.</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-center">
              <p className="break-all font-mono text-base font-semibold">{shortUrl}</p>
            </div>
            <div className="grid gap-3">
              <Button asChild className="h-12 gap-2">
                <a href={share.whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" /> Partager sur WhatsApp
                </a>
              </Button>
              <Button variant="outline" className="h-12 gap-2" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copié" : "Copier le lien pour ma bio TikTok"}
              </Button>
              <Button asChild variant="outline" className="h-12 gap-2">
                <a href={`/${created.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Voir ma page
                </a>
              </Button>
              <Button variant="ghost" className="h-12" onClick={() => router.replace(exitTo)}>
                {nextPath ? "Continuer" : "Aller à mon espace"}
              </Button>
            </div>
          </Card>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          En créant ta page, tu acceptes les{" "}
          <Link href="/legal/terms" className="underline hover:text-primary">
            conditions d&apos;utilisation
          </Link>{" "}
          de Bio-Lien.
        </p>
      </div>
    </div>
  );
}
