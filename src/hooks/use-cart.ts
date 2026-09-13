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
  clearCart: () => void;
  getItemCount: () => number;
  getTotal: () => number;
}

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
            return {
              items: state.items.map((i) =>
                i.productId === item.productId && i.variantId === item.variantId
                  ? { ...i, quantity: i.quantity + item.quantity }
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

      clearCart: () => set({ items: [], shopId: null }),

      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      getTotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: "linkboutik-cart",
      partialize: (state) => ({ items: state.items, shopId: state.shopId }),
    }
  )
);

const noopSubscribe = () => () => {};

/**
 * Le panier est-il lisible ? Faux sur le serveur et pendant l'hydratation
 * (React y lit l'état initial du store, vide, pas le localStorage), vrai
 * ensuite et une fois la persistance relue. Une page qui décide sur
 * `items.length === 0` avant ça renvoie l'acheteur d'où il vient alors que
 * son panier est plein — c'est ce que faisait /checkout à chaque
 * rechargement.
 */
export function useCartReady(): boolean {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const hydrated = useSyncExternalStore(
    (onChange) => useCart.persist.onFinishHydration(onChange),
    () => useCart.persist.hasHydrated(),
    () => false,
  );
  return mounted && hydrated;
}
