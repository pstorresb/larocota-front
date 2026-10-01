"use client";

import Image from "next/image";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cartTotal, useCart } from "@/features/cart/cart-store";
import { useCartUi } from "@/features/cart/cart-ui-store";
import { PRODUCT_PLACEHOLDER } from "@/features/storefront/types";
import { money } from "@/lib/order-status";

export function CartDrawer() {
  const open = useCartUi((state) => state.drawerOpen);
  const close = useCartUi((state) => state.closeDrawer);
  const items = useCart((state) => state.items);
  const setQuantity = useCart((state) => state.setQuantity);
  const removeItem = useCart((state) => state.removeItem);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="drawer-header">
          <div><p className="section-kicker">Tu selección</p><h2 id="cart-title">Mi pedido</h2></div>
          <button className="close-button" type="button" aria-label="Cerrar carrito" onClick={close}><X size={20} /></button>
        </div>
        <div className="drawer-items">
          {items.length === 0 ? (
            <div className="empty-cart"><ShoppingBag size={28} /><strong>Tu pedido está vacío</strong><p>Agrega algo rico del menú para comenzar.</p></div>
          ) : items.map((item) => (
            <article className="drawer-item" key={item.id}>
              <Image className={item.image === PRODUCT_PLACEHOLDER ? "brand-cart-placeholder" : undefined} src={item.image} alt="" width={84} height={72} unoptimized />
              <div className="drawer-item-copy">
                <strong>{item.name}</strong>
                {item.modifiers.length > 0 && <small>{item.modifiers.map((modifier) => `${modifier.quantity}× ${modifier.optionName}`).join(", ")}</small>}
                <b>{money.format(item.unitPrice * item.quantity)}</b>
              </div>
              <div className="drawer-item-actions">
                <button type="button" aria-label={`Quitar ${item.name}`} onClick={() => removeItem(item.id)}><Trash2 size={16} /></button>
                <div>
                  <button type="button" aria-label="Disminuir" onClick={() => setQuantity(item.id, item.quantity - 1)}><Minus size={14} /></button>
                  <span>{item.quantity}</span>
                  <button type="button" aria-label="Aumentar" onClick={() => setQuantity(item.id, item.quantity + 1)}><Plus size={14} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="drawer-footer">
          <div><span>Total</span><strong>{money.format(cartTotal(items))}</strong></div>
          <p>Precios finales, IVA incluido. La entrega es gratis.</p>
          {items.length > 0 && <Button className="drawer-checkout" href="/checkout" size="lg">Continuar al checkout <ArrowRight size={17} /></Button>}
        </div>
      </aside>
    </div>
  );
}
