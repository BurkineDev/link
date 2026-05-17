"use client";

import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/format";
import type { ProductVariantRow } from "@/lib/types/database";
import type { Currency } from "@/lib/types/database";

interface VariantSelectorProps {
  variants: ProductVariantRow[];
  selectedVariantId: string | null;
  onSelect: (variant: ProductVariantRow) => void;
  basePrice: number;
  currency: Currency;
  className?: string;
}

/**
 * Groups variants by their option names (e.g. "Couleur", "Taille") and renders
 * each group as a button row. Disabled variants are styled accordingly.
 */
export function VariantSelector({
  variants,
  selectedVariantId,
  onSelect,
  basePrice,
  currency,
  className,
}: VariantSelectorProps) {
  if (!variants.length) return null;

  // Detect if variants share a common option axis (e.g. all have a "Taille" option)
  // We group by distinct option.name values across all variants.
  const optionNames = Array.from(
    new Set(variants.flatMap((v) => v.options.map((o) => o.name)))
  );

  // When there's only a flat list (no option axis structure), render all as one group.
  const groups: { name: string; variants: ProductVariantRow[] }[] =
    optionNames.length > 0
      ? optionNames.map((name) => ({
          name,
          variants: variants.filter((v) => v.options.some((o) => o.name === name)),
        }))
      : [{ name: "Variante", variants }];

  // Track the display price change when a variant with override price is selected
  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const selectedPrice = selectedVariant?.price ?? basePrice;
  const priceChanged =
    selectedVariant?.price !== null &&
    selectedVariant?.price !== undefined &&
    selectedVariant.price !== basePrice;

  return (
    <div className={cn("space-y-4", className)}>
      {groups.map((group) => (
        <div key={group.name}>
          <p className="mb-2 text-sm font-medium text-foreground">
            {group.name}
            {selectedVariantId && (
              <span className="ml-2 font-normal text-muted-foreground">
                {
                  group.variants
                    .find((v) => v.id === selectedVariantId)
                    ?.options.find((o) => o.name === group.name)?.value
                }
              </span>
            )}
          </p>

          <div className="flex flex-wrap gap-2">
            {group.variants.map((variant) => {
              const isSelected = variant.id === selectedVariantId;
              const isOos =
                variant.stock_quantity !== null &&
                variant.stock_quantity <= 0;

              // Label for this variant within the current option group
              const label =
                variant.options.find((o) => o.name === group.name)?.value ??
                variant.name;

              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={isOos}
                  onClick={() => !isOos && onSelect(variant)}
                  aria-pressed={isSelected}
                  aria-label={`${group.name}: ${label}${isOos ? " (épuisé)" : ""}`}
                  className={cn(
                    // Base: 44px min height for touch friendliness
                    "relative min-h-11 min-w-11 rounded-lg border px-3 py-2 text-sm font-medium",
                    "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-transparent text-white shadow-sm"
                      : "border-border bg-background text-foreground hover:border-foreground/40 hover:bg-muted",
                    isOos &&
                      "cursor-not-allowed opacity-40 line-through decoration-muted-foreground"
                  )}
                  style={
                    isSelected
                      ? { backgroundColor: "var(--shop-primary, #6366f1)" }
                      : undefined
                  }
                >
                  {label}
                  {/* Out-of-stock diagonal strike */}
                  {isOos && (
                    <span
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
                      aria-hidden="true"
                    >
                      <svg
                        className="absolute inset-0 h-full w-full"
                        preserveAspectRatio="none"
                      >
                        <line
                          x1="0"
                          y1="100%"
                          x2="100%"
                          y2="0"
                          stroke="currentColor"
                          strokeWidth="1"
                          strokeOpacity="0.3"
                        />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Show updated price if the selected variant overrides it */}
      {priceChanged && (
        <p className="text-sm text-muted-foreground">
          Prix pour cette variante :{" "}
          <span className="font-semibold text-foreground">
            {formatPrice(selectedPrice, currency)}
          </span>
        </p>
      )}
    </div>
  );
}
