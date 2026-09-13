"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  image?: string;
  variantLabel?: string;
  shopId: string;
  shopSlug: string;
  /** Absent sur les paniers d'avant ce drapeau : réputé physique. */
  isDigital?: boolean;
}

interface CartStore {
  items: CartItem[];
  shopId: string | null;

  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  /** Prix relus en base au moment de payer (réponse PRICE_CHANGED de l'API). */
  updatePrices: (changes: Array<{ product_id: string; variant_id?: string | null; unit_price: number }>) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getTotal: () => number;
}

let hydrationFailed = false;

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      shopId: null,

      addItem: (item) => {
        set((state) => {
          // Cart is per-shop — clear if switching shops
          if (state.shopId && state.shopId !== item.shopId) {
            return { items: [{ ...item }], shopId: item.shopId };
          }

          const existing = state.items.find(
            (i) => i.productId === item.productId && i.variantId === item.variantId
          );

          if (existing) {
            // Un nouvel ajout depuis la boutique rafraîchit le prix et la
            // nature de l'article : la page vient d'être servie à jour.
            return {
              items: state.items.map((i) =>
                i.productId === item.productId && i.variantId === item.variantId
                  ? { ...i, price: item.price, isDigital: item.isDigital, quantity: i.quantity + item.quantity }
                  : i
              ),
              shopId: item.shopId,
            };
          }

          return {
            items: [...state.items, item],
            shopId: item.shopId,
          };
        });
      },

      removeItem: (productId, variantId) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId)
          ),
        }));
      },

      updateQuantity: (productId, quantity, variantId) => {
        if (quantity <= 0) {
          get().removeItem(productId, variantId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId && i.variantId === variantId
              ? { ...i, quantity }
              : i
          ),
        }));
      },

      updatePrices: (changes) => {
        set((state) => ({
          items: state.items.map((i) => {
            const change = changes.find(
              (c) => c.product_id === i.productId && (c.variant_id ?? undefined) === i.variantId,
            );
            return change ? { ...i, price: change.unit_price } : i;
          }),
        }));
      },

      clearCart: () => set({ items: [], shopId: null }),

      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      getTotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: "linkboutik-cart",
      partialize: (state) => ({ items: state.items, shopId: state.shopId }),
      // Valeur stockée illisible (JSON tronqué, vieux format) : on repart
      // d'un panier vide plutôt que d'attendre une hydratation qui
      // n'arrivera jamais.
      onRehydrateStorage: () => (_state, error) => {
        if (error) hydrationFailed = true;
      },
    }
  )
);

const noopSubscribe = () => () => {};
const alwaysTrue = () => true;
const alwaysFalse = () => false;

// Sans stockage (cookies bloqués, WebView sans DOM storage), le middleware
// persist ne pose pas `api.persist` malgré le typage : rien à relire, le
// panier en mémoire est prêt dès le montage. Fermetures hissées : des
// identités stables évitent à useSyncExternalStore de se réabonner.
const cartPersist = (useCart as { persist?: typeof useCart.persist }).persist;
const subscribeHydration = cartPersist
  ? (onChange: () => void) => cartPersist.onFinishHydration(onChange)
  : noopSubscribe;
const getHydrated = cartPersist
  ? () => cartPersist.hasHydrated() || hydrationFailed
  : alwaysTrue;

/**
 * Le panier est-il lisible ? Faux sur le serveur et pendant l'hydratation
 * (React y lit l'état initial du store, vide, pas le localStorage), vrai
 * ensuite et une fois la persistance relue — ou réputée illisible. Une page
 * qui décide sur `items.length === 0` avant ça renvoie l'acheteur d'où il
 * vient alors que son panier est plein — c'est ce que faisait /checkout à
 * chaque rechargement.
 */
export function useCartReady(): boolean {
  const mounted = useSyncExternalStore(noopSubscribe, alwaysTrue, alwaysFalse);
  const hydrated = useSyncExternalStore(subscribeHydration, getHydrated, alwaysFalse);
  return mounted && hydrated;
}

/** Instantané client du hook, pour les tests sans DOM. */
export const cartHydrationSnapshot = getHydrated;
