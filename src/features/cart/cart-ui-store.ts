"use client";

import { create } from "zustand";

type CartUiState = {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

/** Ephemeral UI state shared by the header cart button, the dock and the drawer on the home page. */
export const useCartUi = create<CartUiState>()((set) => ({
  drawerOpen: false,
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
}));
