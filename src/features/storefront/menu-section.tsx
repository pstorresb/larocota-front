"use client";

import { CalendarClock, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart, useCartHydrated } from "@/features/cart/cart-store";
import { ProductCardView } from "@/features/storefront/product-card-view";
import { ProductModal } from "@/features/storefront/product-modal";
import type { StoreProduct } from "@/features/storefront/types";
import type { CatalogCycle } from "@/lib/api/client";
import { shortTime, weekdayLongDate } from "@/lib/order-status";

const ALL = "Todo";

type Props = { cycle: CatalogCycle | null; categories: string[]; products: StoreProduct[]; unavailable: boolean };

/** Category tabs, product grid and the configurator. Data arrives from the server; nothing is fetched here. */
export function MenuSection({ cycle, categories, products, unavailable }: Props) {
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const hydrated = useCartHydrated();
  const cartReset = useCart((state) => state.cycleReset);
  const syncCycle = useCart((state) => state.syncCycle);
  const isOpen = cycle?.isOpen ?? false;
  const cycleId = cycle?.id ?? null;

  // A persisted cart from a previous cycle can't be ordered; the store empties it and flags it.
  useEffect(() => {
    if (hydrated) syncCycle(cycleId);
  }, [hydrated, cycleId, syncCycle]);

  const visible = products.filter((product) => activeCategory === ALL || product.category === activeCategory);
  const closedBanner = !cycle
    ? "Por ahora no hay pedidos abiertos. Pronto publicaremos el próximo menú."
    : !isOpen ? `Los pedidos abren el ${weekdayLongDate.format(new Date(cycle.opensAt))} a las ${shortTime.format(new Date(cycle.opensAt))}. Ya puedes mirar el menú.` : null;

  return (
    <section className="menu-section" id="menu">
      <div className="menu-heading">
        <div><p className="section-kicker">{cycle?.name ?? "Menú"}</p><h2>¿Qué te provoca?</h2></div>
        <p className="menu-note">Preparamos cantidades limitadas según los pedidos confirmados. Precios finales, IVA incluido.</p>
      </div>
      {closedBanner && products.length > 0 && <p className="menu-banner"><CalendarClock size={20} /> {closedBanner}</p>}
      {cartReset && <p className="menu-cart-notice" role="status">Tu selección anterior era de otro ciclo, así que la vaciamos. Elige de nuevo del menú actual.</p>}
      {categories.length > 0 && (
        <nav className="category-tabs" aria-label="Categorías del menú">
          {[ALL, ...categories].map((category) => (
            <button className={`category-tab ${activeCategory === category ? "active" : ""}`} type="button" key={category} aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)}>{category}</button>
          ))}
        </nav>
      )}
      <div className="product-grid">
        {visible.map((product) => {
          const soldOut = product.available === 0;
          const addLabel = soldOut ? `${product.name} agotado` : !isOpen ? `${product.name}: los pedidos aún no abren` : `Personalizar ${product.name}`;
          return (
            <ProductCardView
              key={product.id}
              product={{ ...product, image: product.imageCard ?? product.image }}
              action={<button className="add-button" type="button" aria-label={addLabel} disabled={soldOut || !isOpen} onClick={() => setSelectedProduct(product)}><Plus size={22} /></button>}
            />
          );
        })}
        {unavailable && (
          <div className="menu-empty"><strong>No pudimos cargar el menú.</strong><p>Revisa tu conexión y recarga la página.</p></div>
        )}
        {!unavailable && visible.length === 0 && (
          <div className="menu-empty">
            <strong>{products.length ? "No hay productos en esta categoría." : "El menú aún no está publicado."}</strong>
            <p>{products.length ? "Elige otra categoría." : "Estamos preparando el próximo ciclo de venta."}</p>
          </div>
        )}
      </div>
      {selectedProduct && <ProductModal key={selectedProduct.id} product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
    </section>
  );
}
