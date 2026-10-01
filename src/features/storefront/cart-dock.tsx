"use client";

import { ArrowRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cartCount, cartTotal, useCart, useCartHydrated } from "@/features/cart/cart-store";
import { useCartUi } from "@/features/cart/cart-ui-store";
import { money } from "@/lib/order-status";

export function CartDock() {
  const hydrated = useCartHydrated();
  const items = useCart((state) => state.items);
  const openDrawer = useCartUi((state) => state.openDrawer);
  const count = cartCount(items);
  if (!hydrated || count === 0) return null;
  return (
    <div className="cart-dock" role="status">
      <span className="cart-dock-icon"><ShoppingBag size={20} /></span>
      <div>
        <span>{count} {count === 1 ? "producto" : "productos"}, {money.format(cartTotal(items))}</span>
        <strong>Tu pedido está listo para revisar</strong>
      </div>
      <Button size="sm" onClick={openDrawer}>Revisar <ArrowRight size={16} /></Button>
    </div>
  );
}
