"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarClock, LockKeyhole, Maximize2, Minus, Plus, ShoppingBag, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { cartTotal, useCart } from "@/features/cart/cart-store";
import { ThemeToggle } from "@/components/theme-toggle";
import { api, productImageUrl, type CatalogCycle, type ModifierGroup, type ModifierSelection } from "@/lib/api/client";

const PRODUCT_PLACEHOLDER = "/brand/la-rocota-logo.png";

type StoreProduct = { id: string; category: string; name: string; description: string; price: number; image: string | null; imageAlt: string; badge: string | null; available: number; modifierGroups: ModifierGroup[] };

const money = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export function Storefront() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [cycle, setCycle] = useState<CatalogCycle | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Todo");
  const [cartOpen, setCartOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [optionQuantities, setOptionQuantities] = useState<Record<string, number>>({});
  const items = useCart((state) => state.items);
  const addItem = useCart((state) => state.addItem);
  const setCycleId = useCart((state) => state.setCycleId);
  const setCartQuantity = useCart((state) => state.setQuantity);
  const removeItem = useCart((state) => state.removeItem);
  const cartCount = items.reduce((total, item) => total + item.quantity, 0);

  const modifierTotal = selectedProduct?.modifierGroups.reduce((groupTotal, group) => groupTotal + group.options.reduce((optionTotal, option) => {
    const selected = optionQuantities[option.id] ?? 0;
    const charged = Math.max(0, selected - option.includedQuantity);
    return optionTotal + charged * ((option.priceDeltaCents ?? Math.round(Number(option.priceDelta) * 100)) / 100);
  }, 0), 0) ?? 0;
  const modalTotal = selectedProduct ? (selectedProduct.price + modifierTotal) * quantity : 0;
  const configurationValid = selectedProduct?.modifierGroups.every((group) => {
    const count = group.options.filter((option) => (optionQuantities[option.id] ?? 0) > 0).length;
    return count >= group.minSelections && count <= group.maxSelections;
  }) ?? false;

  useEffect(() => {
    let active = true;
    api.catalog().then((catalog) => {
      if (!active) return;
      setCycle(catalog.cycle);
      setCycleId(catalog.cycle?.id ?? null);
      setCategories(catalog.categories.map((category) => category.name));
      setProducts(catalog.products.map((product) => ({ id: product.id, category: product.category, name: product.name, description: product.description, price: product.basePriceCents / 100, available: product.available, image: product.imageUrl ? productImageUrl(product.imageUrl) : null, imageAlt: product.imageAlt || product.name, badge: product.badge, modifierGroups: product.modifierGroups })));
    }).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [setCycleId]);

  function openProduct(product: StoreProduct) {
    setSelectedProduct(product);
    setImageViewerOpen(false);
    setQuantity(1);
    setOptionQuantities(Object.fromEntries(product.modifierGroups.flatMap((group) => group.options.filter((option) => option.defaultQuantity > 0).map((option) => [option.id, option.defaultQuantity]))));
  }

  function setOption(group: ModifierGroup, optionId: string, nextQuantity: number) {
    const option = group.options.find((item) => item.id === optionId);
    if (!option) return;
    setOptionQuantities((current) => {
      if (option.isLocked && nextQuantity < option.defaultQuantity) return current;
      const next = { ...current };
      if (group.selectionType === "single") {
        if (nextQuantity <= 0 && group.minSelections > 0) return current;
        group.options.forEach((item) => { next[item.id] = 0; });
        next[optionId] = nextQuantity > 0 ? 1 : 0;
        return next;
      }
      const activeBefore = group.options.filter((item) => (current[item.id] ?? 0) > 0).length;
      const isNew = (current[optionId] ?? 0) === 0 && nextQuantity > 0;
      if (isNew && activeBefore >= group.maxSelections) return current;
      next[optionId] = Math.max(0, Math.min(option.maxQuantity, nextQuantity));
      return next;
    });
  }

  function addToCart() {
    if (!selectedProduct) return;
    const selections: ModifierSelection[] = selectedProduct.modifierGroups.map((group) => ({ groupId: group.id, options: group.options.flatMap((option) => (optionQuantities[option.id] ?? 0) > 0 ? [{ optionId: option.id, quantity: optionQuantities[option.id] }] : []) }));
    addItem({
      id: crypto.randomUUID(),
      productId: selectedProduct.id,
      name: selectedProduct.name,
      image: selectedProduct.image ?? PRODUCT_PLACEHOLDER,
      unitPrice: selectedProduct.price + modifierTotal,
      quantity,
      selections,
      modifiers: selectedProduct.modifierGroups.flatMap((group) => group.options.flatMap((option) => {
        const selected = optionQuantities[option.id] ?? 0;
        if (!selected) return [];
        return [{ groupName: group.name, optionName: option.name, quantity: selected, totalDelta: Math.max(0, selected - option.includedQuantity) * ((option.priceDeltaCents ?? Math.round(Number(option.priceDelta) * 100)) / 100) }];
      })),
    });
    setSelectedProduct(null);
    setCartOpen(true);
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a href="#inicio" aria-label="La Rocota, inicio">
          <Image className="brand-logo" src="/brand/la-rocota-logo.png" alt="La Rocota" width={420} height={140} />
        </a>
        <div className="top-actions">
          <Link className="ghost-button" href="/account"><UserRound size={18} /> Mi cuenta</Link>
          <ThemeToggle />
          <button className="cart-button" type="button" aria-label={`Mi pedido, ${cartCount} productos`} onClick={() => setCartOpen(true)}><ShoppingBag size={21} /><span className="count-dot">{cartCount}</span></button>
        </div>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow">Pedidos semanales · Ibarra</p>
          <h1>Fresco, rico y <span>hecho para ti.</span></h1>
          <p className="hero-subtitle">Elige tu almuerzo, personalízalo y recíbelo recién preparado. Cocinamos bajo pedido para que cada bocado llegue como debe.</p>
          <div className="hero-actions">
            <a className="primary-button" href="#menu">Ver menú <ArrowRight size={18} /></a>
          </div>
        </div>
        <div className="hero-photo">
          <Image src="/brand/hero-food.png" alt="Selección de ensalada, sánduche, quesadillas y jugo fresco" fill preload sizes="(max-width: 950px) 100vw, 55vw" />
          <div className="cycle-card">
            <div className="cycle-label"><CalendarClock size={16} /> {cycle ? cycle.name : "Próximo ciclo"}</div>
            {cycle ? <><strong>{cycle.publicMessage || "Pedidos disponibles para este ciclo."}</strong><p>Entrega: {new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeStyle: "short" }).format(new Date(cycle.fulfillmentAt))}</p></> : <><strong>El próximo menú se publicará desde administración.</strong><p>Vuelve pronto para conocer la fecha de entrega.</p></>}
          </div>
        </div>
      </section>

      <p className="menu-bridge">Preparado a tu gusto, recién hecho.</p>

      <section className="menu-section" id="menu">
        <div className="menu-heading">
          <div><p className="section-kicker">Menú de esta semana</p><h2>¿Qué te provoca?</h2></div>
          <p className="menu-note">Preparamos cantidades limitadas según los pedidos confirmados. Los precios incluyen IVA.</p>
        </div>
        <nav className="category-tabs" aria-label="Categorías del menú">
          {['Todo', ...categories].map((category) => (
            <button className={`category-tab ${activeCategory === category ? 'active' : ''}`} type="button" key={category} aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)}>{category}</button>
          ))}
        </nav>
        <div className="product-grid">
          {products.filter((product) => activeCategory === 'Todo' || product.category === activeCategory).map((product) => (
            <article className="product-card" key={product.id}>
              <div className="product-visual">
                {product.image ? <Image src={product.image} alt={product.imageAlt} fill sizes="(max-width: 650px) 100vw, 33vw" unoptimized /> : <div className="brand-product-placeholder"><Image src={PRODUCT_PLACEHOLDER} alt="Producto La Rocota sin fotografía" width={220} height={74} /></div>}
                {product.badge && <span className="product-badge">{product.badge}</span>}
              </div>
              <div className="product-copy">
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <div className="product-footer">
                  <span className="product-price">Desde {money.format(product.price)}</span>
                  <button className="add-button" type="button" aria-label={`Personalizar ${product.name}`} onClick={() => openProduct(product)}><Plus size={20} /></button>
                </div>
              </div>
            </article>
          ))}
          {!catalogLoading && products.every((product) => activeCategory !== 'Todo' && product.category !== activeCategory) && (
            <div className="menu-empty"><strong>{products.length ? "No hay productos en esta categoría." : "El menú aún no está publicado."}</strong><p>{products.length ? "Selecciona otra categoría." : "La administración está preparando el primer ciclo de venta."}</p></div>
          )}
          {catalogLoading && <div className="menu-empty"><strong>Cargando menú…</strong></div>}
        </div>
      </section>

      {cartCount > 0 && (
        <div className="cart-dock" role="status">
          <span className="cart-dock-icon"><ShoppingBag size={20} /></span>
          <div><span>{cartCount} {cartCount === 1 ? "producto" : "productos"} · {money.format(cartTotal(items))}</span><strong>Tu pedido está listo para revisar</strong></div>
          <button type="button" onClick={() => setCartOpen(true)}>Revisar <ArrowRight size={16} /></button>
        </div>
      )}

      {cartOpen && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCartOpen(false)}>
          <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <div className="drawer-header"><div><p className="section-kicker">Tu selección</p><h2 id="cart-title">Mi pedido</h2></div><button className="close-button drawer-close" type="button" aria-label="Cerrar carrito" onClick={() => setCartOpen(false)}><X size={20} /></button></div>
            <div className="drawer-items">
              {items.length === 0 ? (
                <div className="empty-cart"><ShoppingBag size={28} /><strong>Tu pedido está vacío</strong><p>Agrega algo rico del menú para comenzar.</p></div>
              ) : items.map((item) => (
                <article className="drawer-item" key={item.id}>
                  <Image className={item.image === PRODUCT_PLACEHOLDER ? "brand-cart-placeholder" : undefined} src={item.image} alt="" width={88} height={76} unoptimized />
                  <div className="drawer-item-copy"><strong>{item.name}</strong>{item.modifiers.length > 0 && <small>{item.modifiers.map((modifier) => `${modifier.quantity}× ${modifier.optionName}`).join(" · ")}</small>}<b>{money.format(item.unitPrice * item.quantity)}</b></div>
                  <div className="drawer-item-actions"><button type="button" aria-label="Quitar producto" onClick={() => removeItem(item.id)}><Trash2 size={16} /></button><div><button type="button" aria-label="Disminuir" onClick={() => setCartQuantity(item.id, item.quantity - 1)}><Minus size={14} /></button><span>{item.quantity}</span><button type="button" aria-label="Aumentar" onClick={() => setCartQuantity(item.id, item.quantity + 1)}><Plus size={14} /></button></div></div>
                </article>
              ))}
            </div>
            <div className="drawer-footer"><div><span>Subtotal</span><strong>{money.format(cartTotal(items))}</strong></div><p>El total final se confirma antes de crear tu pedido.</p>{items.length > 0 && <Link className="drawer-checkout" href="/checkout">Continuar al checkout <ArrowRight size={17} /></Link>}</div>
          </aside>
        </div>
      )}

      {selectedProduct && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedProduct(null)}>
          <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-title">
            <div className="modal-image">{selectedProduct.image ? <button className="modal-image-button" type="button" aria-label={`Ver imagen ampliada de ${selectedProduct.name}`} onClick={() => setImageViewerOpen(true)}><Image src={selectedProduct.image} alt={selectedProduct.imageAlt} fill sizes="(max-width: 650px) 100vw, 40vw" unoptimized /><span aria-hidden="true"><Maximize2 size={18} /></span></button> : <div className="brand-product-placeholder modal-placeholder"><Image src={PRODUCT_PLACEHOLDER} alt="Producto La Rocota sin fotografía" width={280} height={94} /></div>}</div>
            <div className="modal-panel">
              <div className="modal-toolbar"><span>Personaliza tu plato</span><button className="close-button product-modal-close" type="button" aria-label="Cerrar personalización" onClick={() => setSelectedProduct(null)}><X size={21} /></button></div>
              <div className="modal-content">
              <h2 id="product-title">{selectedProduct.name}</h2>
              <p className="modal-description">{selectedProduct.description}</p>
              <div className="modal-price-summary"><span>Precio por unidad</span><strong>{money.format(selectedProduct.price + modifierTotal)}</strong></div>
              <div className="modifier-customer-groups">
                {selectedProduct.modifierGroups.map((group) => {
                  const selectedCount = group.options.filter((option) => (optionQuantities[option.id] ?? 0) > 0).length;
                  return <section className="option-group" key={group.id} role={group.selectionType === "single" ? "radiogroup" : "group"} aria-label={group.name}>
                    <div className="option-heading"><div><h3>{group.name}</h3>{group.description && <p>{group.description}</p>}</div><span className={group.minSelections > 0 ? "required-badge" : "optional-badge"}>{group.minSelections > 0 ? "Requerido" : "Opcional"}</span></div>
                    <p className="selection-help">{group.selectionType === "single" ? "Selecciona 1" : `Selecciona hasta ${group.maxSelections}`} · {selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}</p>
                    {group.options.map((option) => {
                      const selected = optionQuantities[option.id] ?? 0;
                      const delta = (option.priceDeltaCents ?? Math.round(Number(option.priceDelta) * 100)) / 100;
                      return <div className={`option-row ${option.isLocked ? "locked-option" : ""}`} key={option.id}>
                        <button className={`option-check ${group.selectionType === "single" ? "single" : ""} ${option.isLocked ? "locked" : ""} ${selected > 0 ? "selected" : ""}`} type="button" role={group.selectionType === "single" ? "radio" : undefined} aria-checked={group.selectionType === "single" ? selected > 0 : undefined} aria-label={option.isLocked ? `${option.name}, ingrediente fijo` : `${selected > 0 ? (group.minSelections > 0 ? "Seleccionado" : "Quitar") : "Seleccionar"} ${option.name}`} disabled={option.isLocked} onClick={() => setOption(group, option.id, selected > 0 ? 0 : 1)}>{selected > 0 && (option.isLocked ? <LockKeyhole size={12} /> : <span>✓</span>)}</button>
                        <div className="option-label"><strong>{option.name}</strong>{option.description && <small>{option.description}</small>}{delta > 0 && <span>+{money.format(delta)} por unidad adicional</span>}</div>
                        {group.selectionType === "multiple" && option.maxQuantity > 1 && <div className="option-quantity"><button type="button" disabled={selected <= option.defaultQuantity && option.isLocked || selected === 0} onClick={() => setOption(group, option.id, selected - 1)}><Minus size={13} /></button><b>{selected}</b><button type="button" disabled={selected >= option.maxQuantity} onClick={() => setOption(group, option.id, selected + 1)}><Plus size={13} /></button></div>}
                      </div>;
                    })}
                  </section>;
                })}
              </div>
              <div className="quantity-row">
                <strong>Cantidad</strong>
                <div className="quantity-control">
                  <button type="button" aria-label="Disminuir cantidad" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={16} /></button>
                  <strong>{quantity}</strong>
                  <button type="button" aria-label="Aumentar cantidad" onClick={() => setQuantity((value) => value + 1)}><Plus size={16} /></button>
                </div>
              </div>
              {!configurationValid && <p className="configuration-error">Completa las selecciones requeridas para continuar.</p>}
              <button className="modal-add" type="button" disabled={!configurationValid} onClick={addToCart}>Agregar al pedido · {money.format(modalTotal)}</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {selectedProduct?.image && <Lightbox
        className="rocota-lightbox"
        open={imageViewerOpen}
        close={() => setImageViewerOpen(false)}
        slides={[{ src: selectedProduct.image, alt: selectedProduct.imageAlt }]}
        plugins={[Zoom]}
        zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true }}
        controller={{ closeOnBackdropClick: true }}
        render={{ buttonPrev: () => null, buttonNext: () => null }}
        labels={{ Close: "Cerrar", "Zoom in": "Ampliar", "Zoom out": "Reducir" }}
      />}
    </main>
  );
}
