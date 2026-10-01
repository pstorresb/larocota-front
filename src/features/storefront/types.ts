import type { ModifierGroup } from "@/lib/api/client";

/** Catalog product shaped for the storefront UI (prices in dollars, resolved image URL). */
export type StoreProduct = {
  id: string;
  category: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
  imageAlt: string;
  badge: string | null;
  available: number;
  modifierGroups: ModifierGroup[];
};

export const PRODUCT_PLACEHOLDER = "/brand/la-rocota-logo-final.png";
