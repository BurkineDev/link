"use client";

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
            return { items: [{ ...item, quantity: 1 }], shopId: item.shopId };
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
