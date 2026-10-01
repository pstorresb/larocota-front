"use client";

import Image from "next/image";
import { LockKeyhole, Maximize2, Minus, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { useCart } from "@/features/cart/cart-store";
import { useCartUi } from "@/features/cart/cart-ui-store";
import { PRODUCT_PLACEHOLDER, type StoreProduct } from "@/features/storefront/types";
import type { ModifierGroup, ModifierOption, ModifierSelection } from "@/lib/api/client";
import { money } from "@/lib/order-status";

function optionDelta(option: ModifierOption) {
  return (option.priceDeltaCents ?? Math.round(Number(option.priceDelta) * 100)) / 100;
}

function defaultQuantities(product: StoreProduct) {
  return Object.fromEntries(product.modifierGroups.flatMap((group) => group.options.filter((option) => option.defaultQuantity > 0).map((option) => [option.id, option.defaultQuantity])));
}

/** Product configurator. The API re-validates every rule; this mirrors them for immediate feedback. */
export function ProductModal({ product, onClose }: { product: StoreProduct; onClose: () => void }) {
  const addItem = useCart((state) => state.addItem);
  const openDrawer = useCartUi((state) => state.openDrawer);
  const [quantity, setQuantity] = useState(1);
  const [optionQuantities, setOptionQuantities] = useState<Record<string, number>>(() => defaultQuantities(product));
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  const modifierTotal = product.modifierGroups.reduce((groupTotal, group) => groupTotal + group.options.reduce((optionTotal, option) => {
    const selected = optionQuantities[option.id] ?? 0;
    const charged = Math.max(0, selected - option.includedQuantity);
    return optionTotal + charged * optionDelta(option);
  }, 0), 0);
  const unitPrice = product.price + modifierTotal;
  const modalTotal = unitPrice * quantity;
  const configurationValid = product.modifierGroups.every((group) => {
    const count = group.options.filter((option) => (optionQuantities[option.id] ?? 0) > 0).length;
    return count >= group.minSelections && count <= group.maxSelections;
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !imageViewerOpen) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [imageViewerOpen, onClose]);

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
    const selections: ModifierSelection[] = product.modifierGroups.map((group) => ({
      groupId: group.id,
      options: group.options.flatMap((option) => (optionQuantities[option.id] ?? 0) > 0 ? [{ optionId: option.id, quantity: optionQuantities[option.id] ?? 0 }] : []),
    }));
    addItem({
      id: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      image: product.image ?? PRODUCT_PLACEHOLDER,
      unitPrice,
      quantity,
      selections,
      modifiers: product.modifierGroups.flatMap((group) => group.options.flatMap((option) => {
        const selected = optionQuantities[option.id] ?? 0;
        if (!selected) return [];
        return [{ groupName: group.name, optionName: option.name, quantity: selected, totalDelta: Math.max(0, selected - option.includedQuantity) * optionDelta(option) }];
      })),
    });
    onClose();
    openDrawer();
  }

  return (
    <>
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-title">
          <div className="modal-image">
            {product.image ? (
              <button className="modal-image-button" type="button" aria-label={`Ver imagen ampliada de ${product.name}`} onClick={() => setImageViewerOpen(true)}>
                <Image src={product.image} alt={product.imageAlt} fill sizes="(max-width: 760px) 100vw, 40vw" unoptimized />
                <span aria-hidden="true"><Maximize2 size={18} /></span>
              </button>
            ) : (
              <div className="brand-product-placeholder modal-placeholder"><Image src={PRODUCT_PLACEHOLDER} alt="Producto La Rocota sin fotografía" width={334} height={170} /></div>
            )}
          </div>
          <div className="modal-panel">
            <div className="modal-toolbar">
              <span>Personaliza tu plato</span>
              <button className="close-button product-modal-close" type="button" aria-label="Cerrar personalización" onClick={onClose}><X size={21} /></button>
            </div>
            <div className="modal-content">
              <h2 id="product-title">{product.name}</h2>
              <p className="modal-description">{product.description}</p>
              <div className="modal-price-summary"><span>Precio por unidad</span><strong>{money.format(unitPrice)}</strong></div>
              <div className="modifier-customer-groups">
                {product.modifierGroups.map((group) => {
                  const selectedCount = group.options.filter((option) => (optionQuantities[option.id] ?? 0) > 0).length;
                  const allIncluded = group.options.filter((option) => option.isActive).every((option) => option.includedQuantity > 0);
                  const help = group.selectionType === "single"
                    ? `Elige 1 (${selectedCount} elegido${selectedCount === 1 ? "" : "s"})`
                    : allIncluded ? "Vienen incluidos: quita lo que no quieras" : `Elige hasta ${group.maxSelections} (${selectedCount} elegido${selectedCount === 1 ? "" : "s"})`;
                  return (
                    <section className="option-group" key={group.id} role={group.selectionType === "single" ? "radiogroup" : "group"} aria-label={group.name}>
                      <div className="option-heading">
                        <div><h3>{group.name}</h3>{group.description && <p>{group.description}</p>}</div>
                        <span className={group.minSelections > 0 ? "required-badge" : "optional-badge"}>{group.minSelections > 0 ? "Requerido" : "Opcional"}</span>
                      </div>
                      <p className="selection-help">{help}</p>
                      {group.options.map((option) => {
                        const selected = optionQuantities[option.id] ?? 0;
                        const delta = optionDelta(option);
                        return (
                          <div className={`option-row ${option.isLocked ? "locked-option" : ""}`} key={option.id}>
                            <button
                              className={`option-check ${group.selectionType === "single" ? "single" : ""} ${option.isLocked ? "locked" : ""} ${selected > 0 ? "selected" : ""}`}
                              type="button"
                              role={group.selectionType === "single" ? "radio" : undefined}
                              aria-checked={group.selectionType === "single" ? selected > 0 : undefined}
                              aria-label={option.isLocked ? `${option.name}, ingrediente fijo` : `${selected > 0 ? (group.minSelections > 0 ? "Seleccionado" : "Quitar") : "Seleccionar"} ${option.name}`}
                              disabled={option.isLocked}
                              onClick={() => setOption(group, option.id, selected > 0 ? 0 : 1)}
                            >
                              {selected > 0 && (option.isLocked ? <LockKeyhole size={12} /> : <span>✓</span>)}
                            </button>
                            <div className="option-label">
                              <strong>{option.name}</strong>
                              {option.description && <small>{option.description}</small>}
                              {delta > 0 && <span>+{money.format(delta)}{option.includedQuantity > 0 ? " por unidad adicional" : option.maxQuantity > 1 ? " cada una" : ""}</span>}
                            </div>
                            {group.selectionType === "multiple" && option.maxQuantity > 1 && (
                              <div className="option-quantity">
                                <button type="button" aria-label={`Menos ${option.name}`} disabled={(selected <= option.defaultQuantity && option.isLocked) || selected === 0} onClick={() => setOption(group, option.id, selected - 1)}><Minus size={13} /></button>
                                <b>{selected}</b>
                                <button type="button" aria-label={`Más ${option.name}`} disabled={selected >= option.maxQuantity} onClick={() => setOption(group, option.id, selected + 1)}><Plus size={13} /></button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </section>
                  );
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
              {configurationValid && quantity > product.available && <p className="configuration-error">Solo quedan {product.available} unidades disponibles.</p>}
              <button className="modal-add" type="button" disabled={!configurationValid || quantity > product.available} onClick={addToCart}>Agregar al pedido, {money.format(modalTotal)}</button>
            </div>
          </div>
        </section>
      </div>
      {product.image && (
        <Lightbox
          className="rocota-lightbox"
          open={imageViewerOpen}
          close={() => setImageViewerOpen(false)}
          slides={[{ src: product.image, alt: product.imageAlt }]}
          plugins={[Zoom]}
          zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true }}
          controller={{ closeOnBackdropClick: true }}
          render={{ buttonPrev: () => null, buttonNext: () => null }}
          labels={{ Close: "Cerrar", "Zoom in": "Ampliar", "Zoom out": "Reducir" }}
        />
      )}
    </>
  );
}
