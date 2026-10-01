import Image from "next/image";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_PLACEHOLDER } from "@/features/storefront/types";
import { money } from "@/lib/order-status";

export type ProductCardData = {
  name: string;
  description: string;
  /** Final price in dollars, tax included. */
  price: number;
  image: string | null;
  imageAlt: string;
  badge: string | null;
  available: number;
};

/**
 * The product card exactly as the storefront shows it. The admin editor renders the same component
 * as its live preview, so the two can never drift apart.
 */
export function ProductCardView({ product, action }: { product: ProductCardData; action?: ReactNode }) {
  const soldOut = product.available === 0;
  return (
    <article className="product-card">
      <div className="product-visual">
        {product.image
          ? <Image src={product.image} alt={product.imageAlt} fill sizes="(max-width: 760px) 100vw, (max-width: 950px) 50vw, 33vw" unoptimized />
          : <div className="brand-product-placeholder"><Image src={PRODUCT_PLACEHOLDER} alt="Producto La Rocota sin fotografía" width={334} height={170} /></div>}
        {soldOut ? <Badge className="product-badge" tone="soldout">Agotado</Badge> : product.badge && <Badge className="product-badge" tone="brand">{product.badge}</Badge>}
      </div>
      <div className="product-copy">
        <h3>{product.name || "Nombre del producto"}</h3>
        <p>{product.description || "Aquí va la descripción corta."}</p>
        <div className="product-footer">
          <span className="product-price">
            {money.format(product.price)}
            {product.available > 0 && product.available <= 5 && <small>Quedan {product.available}</small>}
          </span>
          {action}
        </div>
      </div>
    </article>
  );
}
