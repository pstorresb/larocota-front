"use client";

import { useEffect } from "react";
import { useCart } from "@/features/cart/cart-store";

/** Reads the persisted cart once the page is on the client. Mounted in the root layout. */
export function CartHydration() {
  useEffect(() => { void useCart.persist.rehydrate(); }, []);
  return null;
}
