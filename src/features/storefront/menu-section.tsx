"use client";

import Image from "next/image";
import { CalendarClock, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useCart, useCartHydrated } from "@/features/cart/cart-store";
import { ProductModal } from "@/features/storefront/product-modal";
import { PRODUCT_PLACEHOLDER, type StoreProduct } from "@/features/storefront/types";
import type { CatalogCycle } from "@/lib/api/client";
import { money, shortTime, weekdayLongDate } from "@/lib/order-status";

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
        <p className="menu-note">Preparamos cantidades limitadas según los pedidos confirmados. Los precios incluyen IVA.</p>
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
            <article className="product-card" key={product.id}>
              <div className="product-visual">
                {product.image
                  ? <Image src={product.image} alt={product.imageAlt} fill sizes="(max-width: 760px) 100vw, (max-width: 950px) 50vw, 33vw" unoptimized />
                  : <div className="brand-product-placeholder"><Image src={PRODUCT_PLACEHOLDER} alt="Producto La Rocota sin fotografía" width={334} height={170} /></div>}
                {soldOut ? <Badge className="product-badge" tone="soldout">Agotado</Badge> : product.badge && <Badge className="product-badge" tone="brand">{product.badge}</Badge>}
              </div>
              <div className="product-copy">
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div className="product-footer">
                  <span className="product-price">
                    {money.format(product.price)}
                    {product.available > 0 && product.available <= 5 && <small>Quedan {product.available}</small>}
                  </span>
                  <button className="add-button" type="button" aria-label={addLabel} disabled={soldOut || !isOpen} onClick={() => setSelectedProduct(product)}><Plus size={22} /></button>
                </div>
              </div>
            </article>
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
