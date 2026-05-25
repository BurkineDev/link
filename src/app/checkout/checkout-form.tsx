"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ChevronLeft, Check, X, Tag } from "lucide-react";

import { useCart } from "@/hooks/use-cart";
import { AFRICAN_COUNTRIES, CURRENCY_META, type Currency } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderSummary, formatPrice } from "@/components/checkout/order-summary";
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
    phone: z
      .string()
      .min(1, "Le numéro de téléphone est requis")
      .regex(/^\+?[1-9]\d{6,14}$/, "Numéro de téléphone invalide (ex: +22507000000)"),
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
// Country code presets for phone selector
// ---------------------------------------------------------------------------

const PHONE_CODES = [
  { code: "+221", flag: "🇸🇳", label: "SN" },
  { code: "+225", flag: "🇨🇮", label: "CI" },
  { code: "+223", flag: "🇲🇱", label: "ML" },
  { code: "+226", flag: "🇧🇫", label: "BF" },
  { code: "+237", flag: "🇨🇲", label: "CM" },
  { code: "+233", flag: "🇬🇭", label: "GH" },
  { code: "+234", flag: "🇳🇬", label: "NG" },
  { code: "+254", flag: "🇰🇪", label: "KE" },
  { code: "+212", flag: "🇲🇦", label: "MA" },
  { code: "+1", flag: "🇺🇸", label: "US" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CheckoutFormProps {
  mobileMoneyEnabled?: boolean;
}

export default function CheckoutForm({ mobileMoneyEnabled = false }: CheckoutFormProps) {
  const router = useRouter();
  const { items, getTotal, clearCart, shopId } = useCart();

  const hasPhysical = items.length > 0;
  const currency: Currency = (items[0]?.currency as Currency) ?? "XOF";

  const shopName = items[0]?.shopSlug
    ? items[0].shopSlug.charAt(0).toUpperCase() + items[0].shopSlug.slice(1)
    : "Boutique";

  const [phoneCountryCode, setPhoneCountryCode] = useState("+225");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [paymentSelection, setPaymentSelection] = useState<{
    type: PaymentType;
    mobileProvider?: MobileProvider;
  }>({ type: mobileMoneyEnabled ? "mobile_money" : "card" });

  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: number;
    discount_type: "percent" | "fixed";
    discount_value: number;
  } | null>(null);
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      requires_shipping: hasPhysical,
      country: "CI",
    },
  });

  const requiresShipping = useWatch({ control, name: "requires_shipping" });

  useEffect(() => {
    if (items.length === 0) router.back();
  }, [items.length, router]);

  const subtotal = getTotal();
  const discount = appliedPromo?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);

  // ---------------------------------------------------------------------------
  async function applyPromo() {
    if (!shopId || !promoInput.trim()) return;
    setIsCheckingPromo(true);
    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          code: promoInput.trim().toUpperCase(),
          orderTotal: subtotal,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Code promo invalide.");
        return;
      }
      setAppliedPromo({
        code: promoInput.trim().toUpperCase(),
        discount: data.discount,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
      });
      toast.success("Code promo appliqué !");
    } finally {
      setIsCheckingPromo(false);
    }
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoInput("");
  }

  async function onSubmit(values: CheckoutFormValues) {
    if (!shopId) {
      toast.error("Boutique introuvable. Veuillez rafraîchir la page.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        shopId,
        buyerDetails: {
          full_name: values.full_name,
          email: values.email,
          phone: phoneCountryCode + values.phone.replace(/\s+/g, ""),
        },
        shippingAddress: values.requires_shipping
          ? {
              full_name: values.full_name,
              address_line1: values.address_line1!,
              city: values.city!,
              country: values.country!,
              phone: phoneCountryCode + values.phone.replace(/\s+/g, ""),
            }
          : null,
        items: items.map((item) => ({
          product_id: item.productId,
          variant_id: item.variantId ?? null,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        paymentMethod: {
          type: paymentSelection.type,
          mobileProvider: paymentSelection.mobileProvider,
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
        throw new Error(data.error ?? "Une erreur est survenue. Veuillez réessayer.");
      }

      clearCart();
      window.location.assign(data.paymentLink);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (items.length === 0) return null;

  const currencyMeta = CURRENCY_META[currency];
  const paymentBlurb =
    paymentSelection.type === "mobile_money"
      ? "Paiement Mobile Money sécurisé via Genius Pay"
      : "Paiement sécurisé via Stripe";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="mb-8">
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

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">

            {/* Section 1 – Coordonnées */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold">Vos coordonnées</h2>

              <div className="space-y-4">
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
                    placeholder="fatou@example.com"
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone">Numéro de téléphone</Label>
                  <div className="flex gap-2">
                    <Select
                      value={phoneCountryCode}
                      onValueChange={(v) => setPhoneCountryCode(v ?? "+225")}
                    >
                      <SelectTrigger className="w-24 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHONE_CODES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.flag} {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="0708070000"
                      autoComplete="tel-national"
                      className="flex-1"
                      aria-invalid={!!errors.phone}
                      {...register("phone")}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-xs text-destructive">{errors.phone.message}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Section 2 – Livraison */}
            {requiresShipping && (
              <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
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
                            <SelectValue placeholder="Sélectionner un pays" />
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
                  </div>
                </div>
              </section>
            )}

            {/* Section 3 – Mode de paiement */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold">Mode de paiement</h2>
              <PaymentMethods
                value={paymentSelection}
                onChange={setPaymentSelection}
                mobileMoneyDisabled={!mobileMoneyEnabled}
              />
            </section>

            {/* Section 4 – Code promo */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold flex items-center gap-2">
                <Tag className="size-4" />
                Code promo
              </h2>
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
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label="Retirer le code promo"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="MONCODE"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    className="uppercase"
                    maxLength={30}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyPromo}
                    disabled={!promoInput.trim() || isCheckingPromo}
                  >
                    {isCheckingPromo ? <Loader2 className="size-4 animate-spin" /> : "Appliquer"}
                  </Button>
                </div>
              )}
            </section>

            {/* Section 5 – Notes */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold">Notes optionnelles</h2>
              <Textarea
                placeholder="Instructions spéciales, informations de livraison..."
                rows={3}
                className="resize-none"
                {...register("notes")}
              />
              {errors.notes && (
                <p className="mt-1 text-xs text-destructive">{errors.notes.message}</p>
              )}
            </section>

            <div className="lg:hidden">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full gap-2 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 border-0"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Traitement en cours…
                  </>
                ) : (
                  `Payer ${total.toLocaleString("fr-FR")} ${currencyMeta.symbol}`
                )}
              </Button>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="hidden lg:block">
            <OrderSummary
              items={items}
              shopName={shopName}
              currency={currency}
              shipping={0}
              discount={discount}
              discountLabel={appliedPromo?.code}
            >
              <Separator className="my-2" />
              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 h-12 w-full gap-2 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 border-0"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Traitement en cours…
                  </>
                ) : (
                  `Payer ${formatPrice(total, currency)}`
                )}
              </Button>
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
