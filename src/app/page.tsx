import { SiteHeader } from "@/components/site-header/site-header";
import { CartDock } from "@/features/storefront/cart-dock";
import { CartDrawer } from "@/features/storefront/cart-drawer";
import { Hero } from "@/features/storefront/hero";
import { HowItWorks } from "@/features/storefront/how-it-works";
import { MenuSection } from "@/features/storefront/menu-section";
import { SiteFooter } from "@/features/storefront/site-footer";
import type { StoreProduct } from "@/features/storefront/types";
import { productImageUrl } from "@/lib/api/client";
import { fetchCatalog, fetchPublicSettings } from "@/lib/api/server";

/** Home. Rendered on the server per request so the menu is in the first HTML (no loading jump). */
export default async function HomePage() {
  const [catalog, settings] = await Promise.all([fetchCatalog(), fetchPublicSettings()]);
  const cycle = catalog?.cycle ?? null;
  const categories = catalog?.categories.map((category) => category.name) ?? [];
  const products: StoreProduct[] = (catalog?.products ?? []).map((product) => ({
    id: product.id,
    category: product.category,
    name: product.name,
    description: product.description,
    price: product.basePriceCents / 100,
    available: product.available,
    image: product.imageUrl ? productImageUrl(product.imageUrl) : null,
    imageCard: product.imageCardUrl ? productImageUrl(product.imageCardUrl) : null,
    imageAlt: product.imageAlt || product.name,
    badge: product.badge,
    modifierGroups: product.modifierGroups,
  }));

  return (
    <main className="site-shell">
      <SiteHeader />
      <Hero cycle={cycle} />
      <p className="menu-bridge"><span>Preparado a tu gusto, recién hecho.</span></p>
      <MenuSection cycle={cycle} categories={categories} products={products} unavailable={catalog === null} />
      <HowItWorks />
      <SiteFooter pickup={settings?.pickup ?? null} />
      <CartDock />
      <CartDrawer />
    </main>
  );
}
