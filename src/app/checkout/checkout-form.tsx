"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ChevronLeft, ChevronDown, Check, X, Tag } from "lucide-react";

import { useCart, useCartReady, type CartItem } from "@/hooks/use-cart";
import { AFRICAN_COUNTRIES, type Currency } from "@/lib/constants";
import { isMobileMoneyCovered, isMobileMoneyCurrency } from "@/lib/payments/mobile-money-coverage";
import { dialCodeEntry, dialCodeFor, nsnHint, toE164 } from "@/lib/phone/dial-codes";
import { cartNeedsShipping, quoteShipping } from "@/lib/checkout/shipping";
import type { CheckoutShop, CheckoutShopStatus } from "@/lib/checkout/shop-context";
import { CheckoutSkeleton } from "@/components/checkout/checkout-skeleton";
import { readableTextOn } from "@/lib/bio-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MobileOrderSummary,
  OrderSummary,
  formatPrice,
  orderTotal,
} from "@/components/checkout/order-summary";
import {
  PaymentMethods,
  type PaymentType,
  type MobileProvider,
} from "@/components/checkout/payment-methods";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const checkoutSchema = z
  .object({
    full_name: z
      .string()
      .min(2, "Le nom complet est requis (2 caractères min.)")
      .max(100),
    email: z
      .string()
      .min(1, "L'adresse email est requise")
      .email("Adresse email invalide"),
    phone: z.string().min(1, "Le numéro de téléphone est requis"),
    requires_shipping: z.boolean(),
    address_line1: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    country: z.string().length(2).optional(),
    notes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.requires_shipping) {
      if (!data.address_line1 || data.address_line1.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "L'adresse est requise",
          path: ["address_line1"],
        });
      }
      if (!data.city || data.city.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La ville est requise",
          path: ["city"],
        });
      }
      if (!data.country) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Le pays est requis",
          path: ["country"],
        });
      }
    }
  });

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

// ---------------------------------------------------------------------------
// Indicatifs : une seule source de vérité, partagée avec le côté vendeur
// (src/lib/phone/dial-codes.ts). Les deux tables partielles qui vivaient ici
// laissaient tout pays absent retomber sur +225.
// ---------------------------------------------------------------------------

/** Pays proposés dans le sélecteur d'indicatif : ceux de la livraison, dans le même ordre. */
const PHONE_CODE_OPTIONS = AFRICAN_COUNTRIES.map((c) => ({
  iso2: c.code,
  dialCode: dialCodeFor(c.code) ?? "",
  flag: dialCodeEntry(c.code)?.flag ?? "",
  name: c.name,
})).filter((c) => c.dialCode);

// ---------------------------------------------------------------------------
// Enveloppe : attend le panier et la boutique avant de montrer le formulaire
// ---------------------------------------------------------------------------

interface CheckoutFormProps {
  mobileMoneyEnabled?: boolean;
  /** Boutique chargée côté serveur depuis `?shop=` ; null si absente, inconnue ou en panne. */
  shop?: CheckoutShop | null;
  shopStatus?: CheckoutShopStatus;
}

/**
 * Le panier vit dans le navigateur, la boutique vient du serveur : le
 * formulaire n'est monté qu'une fois les deux connus et d'accord, avec ses
 * valeurs par défaut définitives (adresse ou non, pays). Sans boutique
 * résolue, aucun total n'est jamais proposé : la livraison en dépend.
 */
export default function CheckoutForm({
  mobileMoneyEnabled = false,
  shop: shopParam = null,
  shopStatus = "missing",
}: CheckoutFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { items, shopId } = useCart();
  const cartReady = useCartReady();

  // La boutique de la page doit être celle du panier : une adresse bricolée
  // (`?shop=autre`) ne montre ni le logo ni les frais d'une autre boutique.
  const shop = shopParam && shopParam.id === shopId ? shopParam : null;
  const askedById = searchParams.get("shop") === shopId;

  // Sans contexte (ancien lien, retour d'un prestataire, slug renommé), on
  // recharge la page par l'identifiant du panier — stable, lui. Une seule
  // fois : si la boutique reste introuvable par identifiant, on le dit.
  useEffect(() => {
    if (!cartReady || shop || !shopId || askedById) return;
    router.replace(`/checkout?shop=${encodeURIComponent(shopId)}`);
  }, [cartReady, shop, shopId, askedById, router]);

  // Panier vide : retour d'où l'on vient — mais seulement une fois le panier
  // réellement lu, sinon chaque rechargement renvoyait l'acheteur en arrière
  // avec un panier plein. Sans historique (lien ouvert directement), la
  // boutique plutôt qu'une page blanche.
  useEffect(() => {
    if (!cartReady || items.length > 0) return;
    if (window.history.length > 1) router.back();
    else router.replace(shopParam ? `/${shopParam.slug}` : "/");
  }, [cartReady, items.length, router, shopParam]);

  // Même rendu que le serveur tant que le panier n'est pas lu : pas de
  // désaccord d'hydratation, et ce que le serveur sait déjà s'affiche.
  if (!cartReady || items.length === 0) return <CheckoutSkeleton shop={shopParam} />;

  if (!shop) {
    if (!askedById) return <CheckoutSkeleton shop={null} />;
    return (
      <CheckoutNotice
        title={shopStatus === "error" ? "Boutique momentanément injoignable" : "Boutique indisponible"}
        body={
          shopStatus === "error"
            ? "Impossible de charger la boutique pour l'instant. Réessaie dans un instant : ton panier est conservé."
            : "Cette boutique n'accepte plus de commandes pour le moment. Ton panier est conservé si elle rouvre."
        }
        action={
          shopStatus === "error" ? (
            <Button type="button" onClick={() => router.refresh()}>
              Réessayer
            </Button>
          ) : (
            <Button asChild>
              <Link href={`/${items[0]?.shopSlug ?? ""}`}>Retourner à la boutique</Link>
            </Button>
          )
        }
      />
    );
  }

  return <CheckoutFormBody items={items} shop={shop} mobileMoneyEnabled={mobileMoneyEnabled} />;
}

function CheckoutNotice({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-muted-foreground">{body}</p>
      <div className="mt-6 flex justify-center">{action}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulaire
// ---------------------------------------------------------------------------

/** Pays proposé d'office : le premier que la boutique livre, sinon la Côte d'Ivoire. */
function defaultShippingCountry(shop: CheckoutShop): string {
  if (shop.shipping_enabled) {
    for (const zone of shop.shipping_zones) {
      const covered = zone.countries.find((code) =>
        AFRICAN_COUNTRIES.some((c) => c.code === code.toUpperCase()),
      );
      if (covered) return covered.toUpperCase();
    }
  }
  return "CI";
}

interface CheckoutFormBodyProps {
  items: CartItem[];
  shop: CheckoutShop;
  mobileMoneyEnabled: boolean;
}

function CheckoutFormBody({ items, shop, mobileMoneyEnabled }: CheckoutFormBodyProps) {
  const router = useRouter();
  const updatePrices = useCart((s) => s.updatePrices);

  const physical = cartNeedsShipping(items);
  // Les prix du panier sont dans la devise où ils ont été ajoutés ; si la
  // boutique a changé de devise depuis, on ne mélange pas : on arrête.
  const currency = (items[0]?.currency as Currency) ?? shop.currency;
  const currencyMismatch = currency !== shop.currency;
  const accent = shop.theme_color;
  const accentInk = readableTextOn(accent);
  const shopName = shop.name;

  const [phoneIso2, setPhoneIso2] = useState("CI");
  // Un choix manuel de l'acheteur l'emporte : on ne le lui reprend pas quand
  // il modifie ensuite son pays de livraison.
  const [phoneCodePinned, setPhoneCodePinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [paymentSelection, setPaymentSelection] = useState<{
    type: PaymentType;
    mobileProvider?: MobileProvider;
  }>({ type: mobileMoneyEnabled && isMobileMoneyCurrency(currency) ? "mobile_money" : "card" });

  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: number;
    discount_type: "percent" | "fixed";
    discount_value: number;
  } | null>(null);
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);
  // Code promo et note vivent derrière un lien : rares, et ils poussaient le
  // bouton de paiement sous cinq sections sur téléphone.
  const [extrasOpen, setExtrasOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      requires_shipping: physical,
      country: defaultShippingCountry(shop),
    },
  });

  const requiresShipping = useWatch({ control, name: "requires_shipping" });
  const shippingCountry = useWatch({ control, name: "country" });

  // L'indicatif suit le pays de livraison tant que l'acheteur ne l'a pas
  // choisi lui-même. Dérivé plutôt que synchronisé : il n'y a qu'une seule
  // source de vérité, et rien à resynchroniser après coup.
  const phoneCountry = phoneCodePinned
    ? phoneIso2
    : (shippingCountry && dialCodeFor(shippingCountry) ? shippingCountry : phoneIso2);
  const dialCode = dialCodeFor(phoneCountry) ?? "";
  const phoneHint = nsnHint(phoneCountry);
  const phoneValue = useWatch({ control, name: "phone" });
  // Le numéro international réellement envoyé — et débité en Mobile Money.
  // Affiché sous le champ pour que l'acheteur le voie avant de payer.
  const composedPhone = phoneValue ? toE164(phoneValue, phoneCountry) : null;

  // Pays de l'acheteur pour la couverture Mobile Money : celui de la
  // livraison quand il y en a une, sinon celui de son numéro (un panier
  // tout numérique n'a pas d'adresse).
  const buyerCountry = requiresShipping ? shippingCountry : phoneCountry;
  const countryLabel =
    AFRICAN_COUNTRIES.find((c) => c.code === buyerCountry)?.name ?? null;

  // Genius Pay ne couvre pas tous les pays en Mobile Money : hors couverture,
  // il accepte le paiement mais n'envoie jamais le push. On bascule sur la
  // carte plutôt que de laisser partir une commande qui ne peut pas aboutir.
  // Dérivé, pas synchronisé : le choix de l'acheteur reste intact s'il revient
  // à un pays couvert.
  const mobileMoneyCovered = isMobileMoneyCovered(buyerCountry);
  // Même logique pour la devise : Genius Pay règle en XOF, une boutique en
  // XAF ou KES ne peut pas voir sa commande confirmée.
  const mobileMoneyCurrencyOk = isMobileMoneyCurrency(currency);
  const payment =
    (!mobileMoneyCovered || !mobileMoneyCurrencyOk) && paymentSelection.type === "mobile_money"
      ? { type: "card" as PaymentType, mobileProvider: undefined }
      : paymentSelection;

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discount = appliedPromo?.discount ?? 0;
  // Même règle que l'API : ce que l'acheteur voit ici est ce qu'il paie.
  const shipping = quoteShipping({
    physical,
    shippingEnabled: shop.shipping_enabled,
    zones: shop.shipping_zones,
    country: requiresShipping ? shippingCountry : null,
    subtotal,
  });
  const total = orderTotal({ items, currency, shipping, discount });
  const shippingUnavailable = shipping.kind === "unavailable";
  const blocked = shippingUnavailable || currencyMismatch;

  // ---------------------------------------------------------------------------
  async function applyPromo(code = promoInput, orderTotal = subtotal): Promise<boolean> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return false;
    setIsCheckingPromo(true);
    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: shop.id, code: normalized, orderTotal }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAppliedPromo(null);
        toast.error(data.error ?? "Code promo invalide.");
        return false;
      }
      setAppliedPromo({
        code: normalized,
        discount: data.discount,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
      });
      return true;
    } finally {
      setIsCheckingPromo(false);
    }
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoInput("");
  }

  async function onSubmit(values: CheckoutFormValues) {
    const phone = toE164(values.phone, phoneCountry);
    if (!phone) {
      setError("phone", {
        type: "manual",
        message: `Numéro invalide pour ${dialCode} : ${phoneHint ?? "vérifie l'indicatif et le nombre de chiffres"}.`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        shopId: shop.id,
        buyerDetails: {
          full_name: values.full_name,
          email: values.email,
          phone,
        },
        shippingAddress: values.requires_shipping
          ? {
              full_name: values.full_name,
              address_line1: values.address_line1!,
              city: values.city!,
              country: values.country!,
              phone,
            }
          : null,
        items: items.map((item) => ({
          product_id: item.productId,
          variant_id: item.variantId ?? null,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        paymentMethod: {
          type: payment.type,
          mobileProvider: payment.mobileProvider,
        },
        notes: values.notes || undefined,
        currency,
        promoCode: appliedPromo?.code,
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // Le vendeur a changé ses prix depuis l'ajout au panier : le récap
        // se met à jour (et la remise avec), l'acheteur revalide.
        if (res.status === 409 && data.code === "PRICE_CHANGED" && Array.isArray(data.items)) {
          const changes = data.items as Array<{ product_id: string; variant_id: string | null; unit_price: number }>;
          updatePrices(changes);
          const newSubtotal = items.reduce((sum, i) => {
            const change = changes.find(
              (c) => c.product_id === i.productId && (c.variant_id ?? undefined) === i.variantId,
            );
            return sum + (change ? change.unit_price : i.price) * i.quantity;
          }, 0);
          if (appliedPromo) await applyPromo(appliedPromo.code, newSubtotal);
          toast.error("Le prix de certains articles a changé : vérifie le récapitulatif avant de payer.");
          return;
        }
        // L'article est finalement à livrer (drapeau du panier périmé) :
        // la section adresse apparaît.
        if (res.status === 422 && data.code === "SHIPPING_ADDRESS_REQUIRED") {
          setValue("requires_shipping", true);
          toast.error("Cet article se livre : indique ton adresse.");
          return;
        }
        throw new Error(data.error ?? "Une erreur est survenue. Veuillez réessayer.");
      }

      // Le panier n'est PAS vidé ici : tant que l'opérateur n'a pas confirmé,
      // l'acheteur peut abandonner, échouer ou fermer l'onglet. Le vider avant
      // la redirection lui faisait tout perdre pour un paiement qui n'avait
      // même pas commencé. C'est la page de retour qui le vide, à la
      // confirmation.
      window.location.assign(data.paymentLink);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const paymentBlurb =
    payment.type === "mobile_money"
      ? "Paiement Mobile Money sécurisé via Genius Pay"
      : "Paiement sécurisé via Stripe";

  const payButton = (
    <Button
      type="submit"
      disabled={isSubmitting || blocked}
      className="h-12 w-full gap-2 border-0 text-base font-semibold"
      style={{ backgroundColor: accent, color: accentInk }}
    >
      {isSubmitting ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Traitement en cours…
        </>
      ) : currencyMismatch ? (
        "Les prix ont changé"
      ) : shippingUnavailable ? (
        "Livraison indisponible pour ce pays"
      ) : (
        `Payer ${formatPrice(total, currency)}`
      )}
    </Button>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Retour
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Finaliser la commande</h1>
      </div>

      {currencyMismatch && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
        >
          Les prix de la boutique ont changé de devise depuis que tu as rempli ton panier.{" "}
          <Link href={`/${shop.slug}`} className="font-semibold underline">
            Retourne à la boutique
          </Link>{" "}
          pour le refaire.
        </div>
      )}

      {/* Téléphone : chez qui, quoi, combien — avant le premier champ */}
      <div className="mb-6 lg:hidden">
        <MobileOrderSummary
          items={items}
          shopName={shopName}
          shopLogo={shop.logo_url}
          accent={accent}
          currency={currency}
          shipping={shipping}
          physical={physical}
          discount={discount}
          discountLabel={appliedPromo?.code}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">

            {/* Section 1 – Coordonnées : le téléphone d'abord, c'est lui qui paie en Mobile Money */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <h2 className="mb-4 text-base font-semibold">Vos coordonnées</h2>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Numéro de téléphone</Label>
                  <div className="flex gap-2">
                    <Select
                      value={phoneCountry}
                      onValueChange={(v) => {
                        if (!v) return;
                        setPhoneIso2(v);
                        setPhoneCodePinned(true);
                      }}
                    >
                      <SelectTrigger className="w-[7.5rem] shrink-0" aria-label="Indicatif du pays">
                        <SelectValue>
                          {dialCodeEntry(phoneCountry)?.flag} {dialCode}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PHONE_CODE_OPTIONS.map((c) => (
                          <SelectItem key={c.iso2} value={c.iso2}>
                            {c.flag} {c.dialCode} · {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      placeholder={phoneHint ? `${phoneHint}, ex. 70 12 34 56` : "Ton numéro"}
                      autoComplete="tel-national"
                      className="flex-1"
                      aria-invalid={!!errors.phone}
                      aria-describedby="phone-help"
                      {...register("phone")}
                    />
                  </div>
                  <p id="phone-help" className="text-xs text-muted-foreground">
                    {composedPhone
                      ? `Numéro utilisé : ${composedPhone}${payment.type === "mobile_money" ? " (celui qui sera débité)" : ""}`
                      : phoneHint
                        ? `Sans l'indicatif ${dialCode} : ${phoneHint}.`
                        : "Choisis l'indicatif de ton pays."}
                  </p>
                  {errors.phone && (
                    <p className="text-xs text-destructive">{errors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Nom complet</Label>
                  <Input
                    id="full_name"
                    placeholder="Fatou Diallo"
                    autoComplete="name"
                    aria-invalid={!!errors.full_name}
                    {...register("full_name")}
                  />
                  {errors.full_name && (
                    <p className="text-xs text-destructive">{errors.full_name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Adresse email</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    placeholder="fatou@example.com"
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                    aria-describedby="email-help"
                    {...register("email")}
                  />
                  <p id="email-help" className="text-xs text-muted-foreground">
                    Pour le reçu et le suivi de la commande.
                  </p>
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Section 2 – Livraison (articles physiques seulement) */}
            {requiresShipping && (
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
                <h2 className="mb-4 text-base font-semibold">Adresse de livraison</h2>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="address_line1">Adresse</Label>
                    <Input
                      id="address_line1"
                      placeholder="123 Rue de la Paix"
                      autoComplete="address-line1"
                      aria-invalid={!!errors.address_line1}
                      {...register("address_line1")}
                    />
                    {errors.address_line1 && (
                      <p className="text-xs text-destructive">{errors.address_line1.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      placeholder="Abidjan"
                      autoComplete="address-level2"
                      aria-invalid={!!errors.city}
                      {...register("city")}
                    />
                    {errors.city && (
                      <p className="text-xs text-destructive">{errors.city.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="country">Pays</Label>
                    <Controller
                      name="country"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="country" className="w-full" aria-invalid={!!errors.country}>
                            <SelectValue placeholder="Sélectionner un pays">
                              {AFRICAN_COUNTRIES.find((c) => c.code === field.value)?.name ??
                                "Sélectionner un pays"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {AFRICAN_COUNTRIES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.country && (
                      <p className="text-xs text-destructive">{errors.country.message}</p>
                    )}
                    {shippingUnavailable && (
                      <p className="text-xs text-destructive" role="alert">
                        {shopName} ne livre pas dans ce pays. Choisis un autre pays de
                        livraison ou contacte le vendeur.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Section 3 – Mode de paiement */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <h2 className="mb-4 text-base font-semibold">Mode de paiement</h2>
              <PaymentMethods
                value={payment}
                onChange={setPaymentSelection}
                mobileMoneyDisabled={!mobileMoneyEnabled}
                buyerCountry={buyerCountry}
                buyerCountryLabel={countryLabel}
                shopCurrency={currency}
              />
            </section>

            {/* Section 4 – Code promo et note, repliés : rares, et ils
                éloignaient le bouton de paiement sur téléphone */}
            <section className="rounded-xl border border-border bg-card shadow-sm">
              <button
                type="button"
                onClick={() => setExtrasOpen((v) => !v)}
                aria-expanded={extrasOpen}
                aria-controls="checkout-extras"
                className="flex w-full items-center justify-between gap-3 p-5 text-left text-sm font-semibold sm:p-6"
              >
                <span className="flex items-center gap-2">
                  <Tag className="size-4" />
                  {appliedPromo
                    ? `Code ${appliedPromo.code} appliqué`
                    : "Ajouter un code promo ou une note"}
                </span>
                <ChevronDown
                  className={cn("size-4 text-muted-foreground transition-transform", extrasOpen && "rotate-180")}
                  aria-hidden="true"
                />
              </button>

              <div id="checkout-extras" hidden={!extrasOpen} className="space-y-5 border-t border-border p-5 sm:p-6">
                <div className="space-y-1.5">
                  <Label htmlFor="promo">Code promo</Label>
                  {appliedPromo ? (
                    <div className="flex items-center justify-between rounded-lg border-2 border-[var(--success)] bg-[var(--success)]/10 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Check className="size-4 text-[var(--success)]" />
                        <div>
                          <p className="text-sm font-bold text-foreground">{appliedPromo.code}</p>
                          <p className="text-xs text-muted-foreground">
                            −{formatPrice(appliedPromo.discount, currency)} appliqué
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removePromo}
                        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Retirer le code promo"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        id="promo"
                        placeholder="MONCODE"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void applyPromo();
                          }
                        }}
                        className="uppercase"
                        maxLength={30}
                        autoComplete="off"
                        aria-label="Code promo"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void applyPromo()}
                        disabled={!promoInput.trim() || isCheckingPromo}
                      >
                        {isCheckingPromo ? <Loader2 className="size-4 animate-spin" /> : "Appliquer"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">Note pour le vendeur</Label>
                  <Textarea
                    id="notes"
                    placeholder="Instructions spéciales, informations de livraison..."
                    rows={3}
                    maxLength={500}
                    className="resize-none"
                    {...register("notes")}
                  />
                  {errors.notes && (
                    <p className="text-xs text-destructive">{errors.notes.message}</p>
                  )}
                </div>
              </div>
            </section>

            <div className="lg:hidden">
              {payButton}
              <p className="mt-2 text-center text-xs text-muted-foreground">{paymentBlurb}</p>
            </div>
          </div>

          {/* Colonne de droite (ordinateur) */}
          <div className="hidden lg:block">
            <OrderSummary
              items={items}
              shopName={shopName}
              shopLogo={shop.logo_url}
              accent={accent}
              currency={currency}
              shipping={shipping}
              physical={physical}
              discount={discount}
              discountLabel={appliedPromo?.code}
            >
              <Separator className="my-2" />
              <div className="mt-2">{payButton}</div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {paymentBlurb}
              </p>
            </OrderSummary>
          </div>
        </div>
      </form>
    </div>
  );
}
