"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { Archive, ImagePlus, Pencil, Plus, X } from "lucide-react";
import { api, ApiError, productImageUrl, type AdminCategory, type AdminCycle, type AdminProduct } from "@/lib/api/client";
import { modifierGroupsToDraft, ProductConfiguratorEditor, validateModifierGroups, type ModifierGroupDraft } from "@/features/admin/product-configurator-editor";

type Mode = "categories" | "products" | "cycles";
type Resource = AdminCategory | AdminProduct | AdminCycle;

const labels = {
  categories: { kicker: "Estructura del menú", title: "Categorías", intro: "Crea y ordena las familias del catálogo.", create: "Crear categoría" },
  products: { kicker: "Catálogo", title: "Productos", intro: "Administra platos, precios, impuestos y disponibilidad.", create: "Crear producto" },
  cycles: { kicker: "Publicación", title: "Ciclos de venta", intro: "Define fechas, cupos y productos disponibles para comprar.", create: "Crear ciclo" },
} as const;

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function dateInput(value?: string) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }
function money(value: string) { return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(value)); }

export function CatalogCrud({ mode }: { mode: Mode }) {
  const copy = labels[mode];
  const [records, setRecords] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [editing, setEditing] = useState<Resource | "new" | null>(null);
  const [assignments, setAssignments] = useState<Record<string, { selected: boolean; capacity: string; price: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupDraft[]>([]);
  const [cycleProductsLoading, setCycleProductsLoading] = useState(false);
  const [cycleProductsReady, setCycleProductsReady] = useState(true);

  async function load() {
    setLoading(true); setError("");
    try {
      if (mode === "categories") setRecords((await api.adminCategories()).categories);
      if (mode === "products") {
        const [productData, categoryData] = await Promise.all([api.adminProducts(), api.adminCategories()]);
        setRecords(productData.products); setCategories(categoryData.categories.filter((item) => item.isActive));
      }
      if (mode === "cycles") {
        const [cycleData, productData] = await Promise.all([api.adminCycles(), api.adminProducts()]);
        setRecords(cycleData.cycles); setProducts(productData.products.filter((item) => item.isActive));
      }
    } catch { setError(`No pudimos cargar ${copy.title.toLowerCase()}.`); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    const request = mode === "categories" ? api.adminCategories().then((data) => ({ records: data.categories as Resource[], categories: [], products: [] }))
      : mode === "products" ? Promise.all([api.adminProducts(), api.adminCategories()]).then(([a, b]) => ({ records: a.products as Resource[], categories: b.categories.filter((item) => item.isActive), products: [] }))
      : Promise.all([api.adminCycles(), api.adminProducts()]).then(([a, b]) => ({ records: a.cycles as Resource[], categories: [], products: b.products.filter((item) => item.isActive) }));
    request.then((data) => { if (active) { setRecords(data.records); setCategories(data.categories); setProducts(data.products); } })
      .catch(() => { if (active) setError(`No pudimos cargar ${copy.title.toLowerCase()}.`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [copy.title, mode]);

  async function openEditor(record: Resource | "new") {
    setFormError(""); setEditing(record); setAssignments({}); setModifierGroups([]); setCycleProductsLoading(false); setCycleProductsReady(true);
    if (mode === "products" && record !== "new") {
      const configuration = await api.adminProductConfiguration(record.id).catch(() => ({ groups: [] }));
      setModifierGroups(modifierGroupsToDraft(configuration.groups));
    }
    if (mode === "cycles" && record !== "new") {
      setCycleProductsLoading(true); setCycleProductsReady(false);
      try {
        const selected = await api.adminCycleProducts(record.id);
        setAssignments(Object.fromEntries(selected.products.map((item) => [item.productId, { selected: item.isAvailable, capacity: item.capacity ? String(item.capacity) : "", price: item.priceOverride ?? "" }])));
        setCycleProductsReady(true);
      } catch {
        setFormError("No pudimos cargar los productos actuales del ciclo. Cierra e inténtalo nuevamente.");
      } finally { setCycleProductsLoading(false); }
    }
  }

  function updateAssignment(productId: string, change: Partial<{ selected: boolean; capacity: string; price: string }>) {
    setAssignments((currentAssignments) => {
      const previous = currentAssignments[productId] ?? { selected: false, capacity: "", price: "" };
      return { ...currentAssignments, [productId]: { ...previous, ...change } };
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError("");
    const data = new FormData(event.currentTarget);
    if (mode === "products") {
      const configurationIssue = validateModifierGroups(modifierGroups);
      if (configurationIssue) { setFormError(configurationIssue); setSaving(false); return; }
    }
    try {
      if (mode === "categories") {
        const input = { name: String(data.get("name")), slug: slugify(String(data.get("slug")) || String(data.get("name"))), description: String(data.get("description") || ""), sortOrder: Number(data.get("sortOrder")), isActive: data.get("isActive") === "on" };
        if (editing === "new") await api.createCategory(input); else await api.updateCategory(editing!.id, input);
      }
      if (mode === "products") {
        const input = { categoryId: String(data.get("categoryId")), name: String(data.get("name")), slug: slugify(String(data.get("slug")) || String(data.get("name"))), shortDescription: String(data.get("shortDescription")), description: String(data.get("description") || ""), imageAlt: String(data.get("imageAlt") || ""), badge: String(data.get("badge") || ""), basePrice: Number(data.get("basePrice")), taxRate: Number(data.get("taxRate")) / 100, sortOrder: Number(data.get("sortOrder")), isActive: data.get("isActive") === "on" };
        const response = editing === "new" ? await api.createProduct(input) : await api.updateProduct(editing!.id, input);
        const image = data.get("image");
        if (data.get("removeImage") === "on" && editing !== "new") await api.removeProductImage(response.product.id);
        if (image instanceof File && image.size > 0) await api.uploadProductImage(response.product.id, image);
        await api.saveProductConfiguration(response.product.id, modifierGroups.map((group, groupIndex) => ({ id: group.id, name: group.name, description: group.description, selectionType: group.selectionType, minSelections: group.minSelections, maxSelections: group.maxSelections, isActive: group.isActive, sortOrder: groupIndex, options: group.options.map((option, optionIndex) => ({ id: option.id, name: option.name, description: option.description, priceDelta: option.priceDelta, includedQuantity: option.includedQuantity, defaultQuantity: option.defaultQuantity, maxQuantity: option.maxQuantity, isLocked: option.isLocked, isActive: option.isActive, sortOrder: optionIndex })) })));
      }
      if (mode === "cycles") {
        const modes = data.getAll("fulfillmentModes") as ("pickup" | "delivery")[];
        const input = { name: String(data.get("name")), opensAt: new Date(String(data.get("opensAt"))).toISOString(), closesAt: new Date(String(data.get("closesAt"))).toISOString(), fulfillmentAt: new Date(String(data.get("fulfillmentAt"))).toISOString(), globalCapacity: data.get("globalCapacity") ? Number(data.get("globalCapacity")) : null, fulfillmentModes: modes, publicMessage: String(data.get("publicMessage") || "") };
        const response = editing === "new" ? await api.createCycle(input) : await api.updateCycle(editing!.id, { ...input, status: String(data.get("status")) as AdminCycle["status"] });
        const cycleId = response.cycle.id;
        await api.setCycleProducts(cycleId, products.flatMap((product, index) => data.get(`include-${product.id}`) === "on" ? [{ productId: product.id, capacity: data.get(`capacity-${product.id}`) ? Number(data.get(`capacity-${product.id}`)) : null, priceOverride: data.get(`price-${product.id}`) ? Number(data.get(`price-${product.id}`)) : null, isAvailable: true, sortOrder: index }] : []));
      }
      setEditing(null); await load();
    } catch (reason) { setFormError(reason instanceof ApiError ? reason.message : "No pudimos guardar los cambios."); }
    finally { setSaving(false); }
  }

  async function archive(record: Resource) {
    if (!window.confirm(mode === "cycles" ? "¿Eliminar este ciclo vacío?" : "¿Desactivar este registro?")) return;
    try {
      if (mode === "categories") await api.deleteCategory(record.id);
      if (mode === "products") await api.deleteProduct(record.id);
      if (mode === "cycles") await api.deleteCycle(record.id);
      await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "No pudimos completar la acción."); }
  }

  const current = editing === "new" || !editing ? null : editing;
  return <main className="admin-dashboard admin-list-page">
    <div className="admin-heading"><div><p className="section-kicker">{copy.kicker}</p><h1>{copy.title}</h1><p>{copy.intro}</p></div><button type="button" onClick={() => void openEditor("new")}><Plus size={16} /> {copy.create}</button></div>
    {mode === "products" && !loading && categories.length === 0 && <div className="admin-notice">Primero crea una <Link href="/admin/categories">categoría activa</Link> para poder registrar productos.</div>}
    <section className="admin-panel list-panel">{loading ? <div className="admin-skeleton">Cargando…</div> : error ? <div className="admin-empty-state"><strong>{error}</strong><button onClick={() => void load()}>Reintentar</button></div> : records.length === 0 ? <div className="admin-empty-state"><strong>No hay registros</strong><span>Usa “{copy.create}” para comenzar.</span></div> : <div className="resource-list">{records.map((record) => <article key={record.id}>{mode === "products" && <div className="resource-product-image">{(record as AdminProduct).imageKey ? <Image src={productImageUrl((record as AdminProduct).imageKey)} alt={(record as AdminProduct).imageAlt || (record as AdminProduct).name} width={72} height={58} unoptimized /> : <Image className="resource-brand-placeholder" src="/brand/la-rocota-logo.png" alt="Producto La Rocota sin fotografía" width={58} height={20} />}</div>}<div>{mode === "categories" && <><strong>{(record as AdminCategory).name}</strong><span>/{(record as AdminCategory).slug} · {(record as AdminCategory).productCount} productos</span></>}{mode === "products" && <><strong>{(record as AdminProduct).name}</strong><span>{(record as AdminProduct).categoryName} · {money((record as AdminProduct).basePrice)} · IVA {Number((record as AdminProduct).taxRate) * 100}%</span></>}{mode === "cycles" && <><strong>{(record as AdminCycle).name}</strong><span>{(record as AdminCycle).status} · {(record as AdminCycle).productCount} productos · {(record as AdminCycle).orderCount} pedidos</span></>}</div><div className="resource-actions"><button type="button" aria-label="Editar" onClick={() => void openEditor(record)}><Pencil size={16} /></button><button type="button" aria-label={mode === "cycles" ? "Eliminar" : "Desactivar"} onClick={() => void archive(record)}><Archive size={16} /></button></div></article>)}</div>}</section>

    {editing && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><section className="admin-modal admin-resource-modal" role="dialog" aria-modal="true"><header><div><span className="section-kicker">{editing === "new" ? "Nuevo registro" : "Editar registro"}</span><h2>{mode === "products" ? (editing === "new" ? "Nuevo producto" : (current as AdminProduct).name) : copy.title}</h2>{mode === "products" && <p>Información, imagen y opciones de personalización</p>}</div><button type="button" aria-label="Cerrar" onClick={() => setEditing(null)}><X size={20} /></button></header><form className={mode === "products" ? "admin-product-form" : undefined} onSubmit={save}><div className="admin-form-grid">
      {mode === "categories" && <><label className="wide">Nombre<input name="name" required minLength={2} defaultValue={(current as AdminCategory | null)?.name ?? ""} /></label><label>Slug<input name="slug" placeholder="Se genera automáticamente" defaultValue={(current as AdminCategory | null)?.slug ?? ""} /></label><label>Orden<input name="sortOrder" type="number" min="0" defaultValue={(current as AdminCategory | null)?.sortOrder ?? 0} /></label><label className="wide">Descripción<textarea name="description" defaultValue={(current as AdminCategory | null)?.description ?? ""} /></label><label className="check-field"><input name="isActive" type="checkbox" defaultChecked={(current as AdminCategory | null)?.isActive ?? true} /> Activa</label></>}
      {mode === "products" && <><label className="wide">Categoría<select name="categoryId" required defaultValue={(current as AdminProduct | null)?.categoryId ?? ""}><option value="" disabled>Selecciona una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="wide">Nombre<input name="name" required minLength={2} defaultValue={(current as AdminProduct | null)?.name ?? ""} /></label><label>Slug<input name="slug" placeholder="Automático" defaultValue={(current as AdminProduct | null)?.slug ?? ""} /></label><label>Etiqueta<input name="badge" maxLength={40} placeholder="Ej. Favorita" defaultValue={(current as AdminProduct | null)?.badge ?? ""} /></label><label>Orden<input name="sortOrder" type="number" min="0" defaultValue={(current as AdminProduct | null)?.sortOrder ?? 0} /></label><label>Precio USD<input name="basePrice" type="number" min="0" step="0.01" required defaultValue={(current as AdminProduct | null)?.basePrice ?? ""} /></label><label>IVA %<input name="taxRate" type="number" min="0" max="100" step="0.01" required defaultValue={current ? Number((current as AdminProduct).taxRate) * 100 : 15} /></label><label className="wide">Descripción corta<input name="shortDescription" required minLength={5} maxLength={300} defaultValue={(current as AdminProduct | null)?.shortDescription ?? ""} /></label><label className="wide">Descripción completa<textarea name="description" defaultValue={(current as AdminProduct | null)?.description ?? ""} /></label><div className="wide product-image-editor">{current && (current as AdminProduct).imageKey ? <Image src={productImageUrl((current as AdminProduct).imageKey)} alt={(current as AdminProduct).imageAlt || (current as AdminProduct).name} width={156} height={104} unoptimized /> : <span><ImagePlus size={24} /> Sin imagen</span>}<div><label>Imagen del producto<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label><small>JPG, PNG o WebP. Máximo 8 MB.</small>{current && (current as AdminProduct).imageKey && <label className="check-field"><input name="removeImage" type="checkbox" /> Quitar imagen actual</label>}</div></div><label className="wide">Texto alternativo de la imagen<input name="imageAlt" maxLength={180} placeholder="Describe el plato para accesibilidad" defaultValue={(current as AdminProduct | null)?.imageAlt ?? ""} /></label><label className="wide check-field product-status-toggle"><input name="isActive" type="checkbox" defaultChecked={(current as AdminProduct | null)?.isActive ?? true} /> Producto activo y visible en ciclos publicados</label><ProductConfiguratorEditor groups={modifierGroups} onChange={setModifierGroups} /></>}
      {mode === "cycles" && <><label className="wide">Nombre<input name="name" required minLength={2} defaultValue={(current as AdminCycle | null)?.name ?? ""} /></label><label>Apertura<input name="opensAt" type="datetime-local" required defaultValue={dateInput((current as AdminCycle | null)?.opensAt)} /></label><label>Cierre<input name="closesAt" type="datetime-local" required defaultValue={dateInput((current as AdminCycle | null)?.closesAt)} /></label><label>Entrega<input name="fulfillmentAt" type="datetime-local" required defaultValue={dateInput((current as AdminCycle | null)?.fulfillmentAt)} /></label><label>Cupo global<input name="globalCapacity" type="number" min="1" defaultValue={(current as AdminCycle | null)?.globalCapacity ?? ""} /></label>{current && <label>Estado<select name="status" defaultValue={(current as AdminCycle).status}><option value="draft">Borrador</option><option value="scheduled">Programado</option><option value="open">Abierto</option><option value="closed">Cerrado</option><option value="fulfilled">Cumplido</option><option value="cancelled">Cancelado</option></select></label>}<fieldset className="wide admin-checkboxes"><legend>Modalidad</legend><input type="hidden" name="fulfillmentModes" value="delivery" /><label><input type="checkbox" checked readOnly /> Entrega gratuita</label></fieldset><label className="wide">Mensaje público<textarea name="publicMessage" defaultValue={(current as AdminCycle | null)?.publicMessage ?? ""} /></label><fieldset className="wide cycle-products-field"><legend>Productos del ciclo{cycleProductsReady ? ` · ${Object.values(assignments).filter((item) => item.selected).length} seleccionados` : ""}</legend>{cycleProductsLoading ? <p className="cycle-products-loading">Cargando productos asociados…</p> : products.length ? products.map((product) => { const assignment = assignments[product.id] ?? { selected: false, capacity: "", price: "" }; return <div key={product.id} className={assignment.selected ? "cycle-product-selected" : undefined}><label><input type="checkbox" name={`include-${product.id}`} checked={assignment.selected} onChange={(event) => updateAssignment(product.id, { selected: event.target.checked })} /> {product.name}</label><input name={`capacity-${product.id}`} type="number" min="1" placeholder="Cupo" value={assignment.capacity} disabled={!assignment.selected} onChange={(event) => updateAssignment(product.id, { capacity: event.target.value })} /><input name={`price-${product.id}`} type="number" min="0" step="0.01" placeholder="Precio especial" value={assignment.price} disabled={!assignment.selected} onChange={(event) => updateAssignment(product.id, { price: event.target.value })} /></div>; }) : <p>Crea productos activos antes de publicar el ciclo.</p>}</fieldset></>}
    </div>{formError && <p className="form-error" role="alert">{formError}</p>}<footer><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" disabled={saving || (mode === "products" && categories.length === 0) || (mode === "cycles" && !cycleProductsReady)}>{saving ? "Guardando…" : cycleProductsLoading ? "Cargando…" : "Guardar"}</button></footer></form></section></div>}
  </main>;
}
