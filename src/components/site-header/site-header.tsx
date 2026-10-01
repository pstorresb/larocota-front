import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderAccount } from "@/components/site-header/header-account";
import { HeaderCart } from "@/components/site-header/header-cart";

/**
 * Shared header. Server component: the logo and nav render in the HTML; the account and cart
 * buttons are small client islands so the session and the cart badge update without a flash.
 */
export function SiteHeader({ backHref, backLabel = "Volver al menú" }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="site-header">
      <Link className="site-logo" href="/" aria-label="La Rocota, inicio">
        <Image className="brand-logo" src="/brand/la-rocota-logo-final.png" alt="La Rocota" width={668} height={340} priority />
      </Link>
      <nav className="site-nav" aria-label="Principal">
        {backHref ? (
          <Link className="site-back" href={backHref}><ArrowLeft size={18} /><span>{backLabel}</span></Link>
        ) : (
          <>
            <Link className="site-nav-primary" href="/#menu">Menú</Link>
            <Link href="/#como-funciona">Cómo funciona</Link>
          </>
        )}
      </nav>
      <div className="site-actions">
        <HeaderAccount />
        <ThemeToggle />
        <HeaderCart />
      </div>
    </header>
  );
}
