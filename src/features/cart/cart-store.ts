"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  image: string;
  unitPrice: number;
  quantity: number;
  selections: Array<{ groupId: string; options: Array<{ optionId: string; quantity: number }> }>;
  modifiers: Array<{ groupName: string; optionName: string; quantity: number; totalDelta: number }>;
};

type CartState = {
  cycleId: string | null;
  items: CartItem[];
  /** True right after `syncCycle` emptied a cart that belonged to a previous cycle. Not persisted. */
  cycleReset: boolean;
  setCycleId: (cycleId: string | null) => void;
  /** Aligns the cart with the catalog's current cycle; items from another cycle are dropped. */
  syncCycle: (cycleId: string | null) => void;
  dismissCycleReset: () => void;
  addItem: (item: CartItem) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
};

/**
 * Persisted cart. Hydration from localStorage is deferred (`skipHydration`) and triggered once by
 * `<CartHydration/>` in the root layout, so server and first client render agree (no badge flash).
 */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      cycleId: null,
      items: [],
      cycleReset: false,
      setCycleId: (cycleId) => set({ cycleId }),
      syncCycle: (cycleId) => set((state) => {
        const stale = state.items.length > 0 && state.cycleId !== null && state.cycleId !== cycleId;
        return stale ? { cycleId, items: [], cycleReset: true } : { cycleId };
      }),
      dismissCycleReset: () => set({ cycleReset: false }),
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
      setQuantity: (id, quantity) => set((state) => ({ items: state.items.map((item) => item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item) })),
      removeItem: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: "larocota-cart-v3", skipHydration: true, partialize: (state) => ({ cycleId: state.cycleId, items: state.items }) },
  ),
);

const subscribeHydration = (onChange: () => void) => useCart.persist.onFinishHydration(onChange);
const getHydrated = () => useCart.persist.hasHydrated();
const getServerHydrated = () => false;

/** True once the persisted cart has been read on the client. Render cart-dependent UI only after this. */
export function useCartHydrated() {
  return useSyncExternalStore(subscribeHydration, getHydrated, getServerHydrated);
}

export const cartTotal = (items: CartItem[]) => items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
export const cartCount = (items: CartItem[]) => items.reduce((total, item) => total + item.quantity, 0);
