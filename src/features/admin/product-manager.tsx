"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductEditor } from "@/features/admin/product-editor";
import { PRODUCT_PLACEHOLDER } from "@/features/storefront/types";
import { api, ApiError, productImageUrl, type AdminCategory, type AdminProduct } from "@/lib/api/client";
import { money } from "@/lib/order-status";
import { moveItem } from "@/lib/reorder";

type StatusFilter = "all" | "active" | "inactive";

export function ProductManager() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editor, setEditor] = useState<{ record: AdminProduct | null } | null>(null);
  const [toDelete, setToDelete] = useState<AdminProduct | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const fetchAll = () => Promise.all([api.adminProducts(), api.adminCategories()]);
  function apply([productData, categoryData]: Awaited<ReturnType<typeof fetchAll>>) {
    setProducts(productData.products);
    setCategories(categoryData.categories);
  }
  async function reload() {
    try { apply(await fetchAll()); setLoadError(""); }
    catch { setLoadError("No pudimos cargar los productos."); }
  }

  useEffect(() => {
    let active = true;
    fetchAll()
      .then((data) => { if (active) apply(data); })
      .catch(() => { if (active) setLoadError("No pudimos cargar los productos."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Initial load only; later refreshes go through `reload()` from event handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtering = search.trim() !== "" || categoryFilter !== "" || status !== "all";
  const term = search.trim().toLowerCase();
  const visible = products.filter((product) =>
    (term === "" || product.name.toLowerCase().includes(term))
    && (categoryFilter === "" || product.categoryId === categoryFilter)
    && (status === "all" || (status === "active" ? product.isActive : !product.isActive)));
  const groups = categories
    .map((category) => ({ category, items: visible.filter((product) => product.categoryId === category.id) }))
    .filter((group) => group.items.length > 0);

  function setRowError(id: string, message: string) {
    setRowErrors((current) => ({ ...current, [id]: message }));
  }

  async function toggleActive(product: AdminProduct) {
    setBusyId(product.id); setRowError(product.id, "");
    try {
      const response = await api.updateProduct(product.id, { isActive: !product.isActive });
      setProducts((current) => current.map((item) => item.id === product.id ? response.product : item));
    } catch (reason) { setRowError(product.id, reason instanceof ApiError ? reason.message : "No pudimos cambiar el estado."); }
    finally { setBusyId(null); }
  }

  /** Moves a product inside its category and saves the new order; the list snaps back if the save fails. */
  async function reorder(categoryId: string, fromId: string, toId: string) {
    const inCategory = products.filter((product) => product.categoryId === categoryId);
    const from = inCategory.findIndex((product) => product.id === fromId);
    const to = inCategory.findIndex((product) => product.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const moved = moveItem(inCategory, from, to);
    const previous = products;
    const others = products.filter((product) => product.categoryId !== categoryId);
    setProducts([...others, ...moved.map((product, index) => ({ ...product, sortOrder: index + 1 }))]);
    setRowError(fromId, "");
    try { await api.reorderProducts(moved.map((product) => product.id)); }
    catch (reason) {
      setProducts(previous);
      setRowError(fromId, reason instanceof ApiError ? reason.message : "No pudimos guardar el nuevo orden.");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusyId(toDelete.id); setDeleteError("");
    try {
      await api.deleteProduct(toDelete.id);
      setProducts((current) => current.filter((item) => item.id !== toDelete.id));
      setToDelete(null);
    } catch (reason) { setDeleteError(reason instanceof ApiError ? reason.message : "No pudimos eliminar el producto."); }
    finally { setBusyId(null); }
  }

  const activeCount = products.filter((product) => product.isActive).length;

  return (
    <main className="admin-dashboard admin-list-page">
      <div className="admin-heading">
        <div><p className="section-kicker">Catálogo</p><h1>Productos</h1><p>Lo que puedes ofrecer en cada ciclo. El orden de esta lista es el orden del menú en la tienda.</p></div>
        <button type="button" disabled={categories.length === 0} onClick={() => setEditor({ record: null })}><Plus size={16} /> Crear producto</button>
      </div>

      {!loading && categories.length === 0 && !loadError && <p className="admin-notice">Primero crea una <Link href="/admin/categories">categoría</Link> para poder registrar productos.</p>}
      {loadError && <p className="form-error" role="alert">{loadError}</p>}

      <div className="catalog-toolbar">
        <label className="ui-control catalog-search"><Search size={16} aria-hidden="true" /><input value={search} placeholder="Buscar por nombre" aria-label="Buscar producto por nombre" onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="ui-control catalog-select">
          <select value={categoryFilter} aria-label="Filtrar por categoría" onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <Segmented label="Estado" value={status} options={[{ value: "all", label: "Todos" }, { value: "active", label: "Activos" }, { value: "inactive", label: "Inactivos" }]} onChange={setStatus} />
        <span className="catalog-count">{visible.length} de {products.length} productos, {activeCount} activos</span>
      </div>
      {filtering && <p className="catalog-hint">Quita la búsqueda y los filtros para reordenar.</p>}

      {loading ? (
        <section className="catalog-group"><div className="catalog-list">{Array.from({ length: 5 }, (_, index) => <div className="catalog-row" key={index}><Skeleton width="100%" height={56} /></div>)}</div></section>
      ) : products.length === 0 ? (
        <div className="admin-panel admin-empty-state"><strong>Aún no hay productos</strong><span>Crea el primero para armar el menú.</span></div>
      ) : groups.length === 0 ? (
        <div className="admin-panel admin-empty-state"><strong>Ningún producto coincide</strong><span>Prueba con otra búsqueda o cambia los filtros.</span></div>
      ) : groups.map(({ category, items }) => (
        <section className="catalog-group" key={category.id}>
          <header><h2>{category.name}</h2>{!category.isActive && <Badge tone="warn">Categoría oculta</Badge>}<span>{items.length} {items.length === 1 ? "producto" : "productos"}</span></header>
          <ul className="catalog-list">
            {items.map((product, index) => {
              const thumb = product.imageCardUrl ? productImageUrl(product.imageCardUrl) : null;
              const busy = busyId === product.id;
              return (
                <li
                  key={product.id}
                  className={`catalog-row ${product.isActive ? "" : "is-inactive"} ${dragId === product.id ? "is-dragging" : ""} ${overId === product.id && dragId !== product.id ? "is-over" : ""}`}
                  draggable={!filtering}
                  onDragStart={(event) => { setDragId(product.id); event.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(event) => { if (dragId && products.find((item) => item.id === dragId)?.categoryId === category.id) { event.preventDefault(); setOverId(product.id); } }}
                  onDragEnd={() => { setDragId(null); setOverId(null); }}
                  onDrop={(event) => { event.preventDefault(); if (dragId) void reorder(category.id, dragId, product.id); setDragId(null); setOverId(null); }}
                >
                  <span className="catalog-grip" aria-hidden="true">{!filtering && <GripVertical size={18} />}</span>
                  <span className="catalog-thumb">
                    {thumb ? <Image src={thumb} alt="" width={64} height={48} unoptimized /> : <Image className="is-placeholder" src={PRODUCT_PLACEHOLDER} alt="" width={52} height={26} />}
                  </span>
                  <div className="catalog-main">
                    <strong>{product.name}</strong>
                    <span>{product.shortDescription}</span>
                    <div className="catalog-tags">
                      {product.badge && <Badge tone="brand">{product.badge}</Badge>}
                      {!product.imageUrl && <Badge tone="warn">Sin imagen</Badge>}
                      {product.modifierGroupCount === 0 && <Badge tone="neutral">Sin personalización</Badge>}
                    </div>
                    {rowErrors[product.id] && <small className="ui-field-error" role="alert">{rowErrors[product.id]}</small>}
                  </div>
                  <span className="catalog-price">{money.format(Number(product.basePrice))}<small>{Number(product.taxRate) > 0 ? "IVA incluido" : "Sin IVA"}</small></span>
                  <button type="button" role="switch" aria-checked={product.isActive} aria-label={`${product.name}: ${product.isActive ? "activo, desactivar" : "inactivo, activar"}`} className="switch" disabled={busy} onClick={() => void toggleActive(product)}>
                    <span /><em>{product.isActive ? "Activo" : "Inactivo"}</em>
                  </button>
                  <div className="catalog-actions">
                    {!filtering && <>
                      <button type="button" className="icon-button" aria-label={`Subir ${product.name}`} disabled={index === 0} onClick={() => { const previous = items[index - 1]; if (previous) void reorder(category.id, product.id, previous.id); }}><ArrowUp size={16} /></button>
                      <button type="button" className="icon-button" aria-label={`Bajar ${product.name}`} disabled={index === items.length - 1} onClick={() => { const next = items[index + 1]; if (next) void reorder(category.id, product.id, next.id); }}><ArrowDown size={16} /></button>
                    </>}
                    <button type="button" className="icon-button" aria-label={`Editar ${product.name}`} onClick={() => setEditor({ record: product })}><Pencil size={16} /></button>
                    <button type="button" className="icon-button is-danger" aria-label={`Eliminar ${product.name}`} disabled={busy} onClick={() => { setDeleteError(""); setToDelete(product); }}><Trash2 size={16} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {editor && (
        <ProductEditor
          key={editor.record?.id ?? "new"}
          record={editor.record}
          categories={categories}
          products={products}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); void reload(); }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="¿Eliminar este producto?"
          body={<p><strong>{toDelete.name}.</strong> Se borra por completo, con su imagen y personalización. Solo es posible si nadie lo ha pedido; si ya tiene pedidos, desactívalo para ocultarlo.</p>}
          confirmLabel="Eliminar producto"
          busy={busyId === toDelete.id}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </main>
  );
}
