"use client";

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
  setCycleId: (cycleId: string | null) => void;
  addItem: (item: CartItem) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      cycleId: null,
      items: [],
      setCycleId: (cycleId) => set({ cycleId }),
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
      setQuantity: (id, quantity) => set((state) => ({ items: state.items.map((item) => item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item) })),
      removeItem: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: "larocota-cart-v3" },
  ),
);

export const cartTotal = (items: CartItem[]) => items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
