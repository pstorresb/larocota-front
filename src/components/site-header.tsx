"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, UserRound } from "lucide-react";
import { useCart } from "@/features/cart/cart-store";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader({ backHref, backLabel = "Volver al menú" }: { backHref?: string; backLabel?: string }) {
  const count = useCart((state) => state.items.reduce((total, item) => total + item.quantity, 0));
  return (
    <header className="topbar page-topbar">
      <div className="header-side">
        {backHref && <Link className="header-back" href={backHref}><ArrowLeft size={18} /> {backLabel}</Link>}
      </div>
      <Link href="/" aria-label="La Rocota, inicio"><Image className="brand-logo" src="/brand/la-rocota-logo-final.png" alt="La Rocota" width={668} height={340} /></Link>
      <div className="top-actions header-side header-side-right">
        <Link className="ghost-button account-button" href="/account" aria-label="Mi cuenta"><UserRound size={18} /><span>Mi cuenta</span></Link>
        <ThemeToggle />
        <Link className="cart-button" href="/checkout" aria-label={`Mi pedido, ${count} productos`}><ShoppingBag size={21} /><span className="count-dot">{count}</span></Link>
      </div>
    </header>
  );
}
