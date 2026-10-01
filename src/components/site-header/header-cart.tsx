"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { cartCount, useCart, useCartHydrated } from "@/features/cart/cart-store";
import { useCartUi } from "@/features/cart/cart-ui-store";

/** On the home page the cart opens the drawer; elsewhere it goes straight to the checkout. */
export function HeaderCart() {
  const pathname = usePathname();
  const hydrated = useCartHydrated();
  const count = useCart((state) => cartCount(state.items));
  const openDrawer = useCartUi((state) => state.openDrawer);
  const shown = hydrated ? count : 0;
  const label = `Mi pedido, ${shown} ${shown === 1 ? "producto" : "productos"}`;
  const badge = <span className="count-dot">{shown > 0 ? shown : ""}</span>;

  if (pathname === "/") {
    return <button className="icon-button header-cart" type="button" aria-label={label} onClick={openDrawer}><ShoppingBag size={21} />{badge}</button>;
  }
  return <Link className="icon-button header-cart" href="/checkout" aria-label={label}><ShoppingBag size={21} />{badge}</Link>;
}
