"use client";

import { ImagePlus, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Segmented } from "@/components/ui/segmented";
import { draftToPayload, modifierGroupsToDraft, ProductConfiguratorEditor, validateModifierGroups, type ModifierGroupDraft } from "@/features/admin/product-configurator-editor";
import { ProductCardView } from "@/features/storefront/product-card-view";
import { api, ApiError, productImageUrl, type AdminCategory, type AdminProduct, type AdminProductInput } from "@/lib/api/client";
import { money } from "@/lib/order-status";

// Same limits as the API.
const NAME_MAX = 120;
const DESCRIPTION_MAX = 300;
const BADGE_MAX = 40;
const ALT_MAX = 180;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Draft = { categoryId: string; name: string; shortDescription: string; badge: string; price: string; taxRate: number; imageAlt: string };
type FieldErrors = Partial<Record<"categoryId" | "name" | "shortDescription" | "price", string>>;
type ConfigState = "loading" | "ready" | "error";

function validate(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};
  const price = Number(draft.price.replace(",", "."));
  if (!draft.categoryId) errors.categoryId = "Elige una categoría.";
  if (draft.name.trim().length < 2) errors.name = "Escribe el nombre del producto.";
  if (draft.shortDescription.trim().length < 5) errors.shortDescription = "Describe el producto en al menos 5 letras.";
  if (draft.price.trim() === "" || !Number.isFinite(price) || price < 0) errors.price = "Escribe el precio final.";
  else if (price > 10000) errors.price = "El precio es demasiado alto.";
  return errors;
}

type Props = {
  record: AdminProduct | null;
  categories: AdminCategory[];
  products: AdminProduct[];
  onClose: () => void;
  onSaved: () => void;
};

export function ProductEditor({ record, categories, products, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(() => ({
    categoryId: record?.categoryId ?? (categories.find((category) => category.isActive)?.id ?? categories[0]?.id ?? ""),
    name: record?.name ?? "",
    shortDescription: record?.shortDescription ?? "",
    badge: record?.badge ?? "",
    price: record ? Number(record.basePrice).toFixed(2) : "",
    // Stored as a decimal string ("0.1500"); compare as a rounded percentage to avoid float noise.
    taxRate: record ? Math.round(Number(record.taxRate) * 10000) / 10000 : 0.15,
    imageAlt: record?.imageAlt ?? "",
  }));
  // Once a new product is created, later attempts update it instead of creating a duplicate.
  const [savedId, setSavedId] = useState<string | null>(record?.id ?? null);
  const [currentImage, setCurrentImage] = useState<string | null>(record?.imageCardUrl ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [groups, setGroups] = useState<ModifierGroupDraft[]>([]);
  const [configState, setConfigState] = useState<ConfigState>(record ? "loading" : "ready");
  const [configAttempt, setConfigAttempt] = useState(0);
  const [configDirty, setConfigDirty] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => { setDraft((current) => ({ ...current, [key]: value })); setDirty(true); };

  // The configuration must be loaded before saving: sending an empty list would delete every group.
  useEffect(() => {
    if (!record) return;
    let active = true;
    api.adminProductConfiguration(record.id)
      .then((result) => { if (active) { setGroups(modifierGroupsToDraft(result.groups)); setConfigState("ready"); } })
      .catch(() => { if (active) setConfigState("error"); });
    return () => { active = false; };
  }, [record, configAttempt]);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function requestClose() {
    if (dirty && !saving) setConfirmClose(true);
    else onClose();
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !confirmClose) { if (dirty) setConfirmClose(true); else onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, confirmClose, onClose]);

  function chooseFile(next: File | null | undefined) {
    setImageError("");
    if (!next) return;
    if (!IMAGE_TYPES.includes(next.type)) { setImageError("La imagen debe ser JPG, PNG o WebP."); return; }
    if (next.size > MAX_IMAGE_BYTES) { setImageError("La imagen pesa más de 8 MB. Elige una más liviana."); return; }
    setFile(next); setRemoveImage(false); setDirty(true);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  const errors = validate(draft);
  const show = (key: keyof FieldErrors) => (touched ? errors[key] ?? null : null);
  const price = Number(draft.price.replace(",", "."));
  const validPrice = Number.isFinite(price) && price >= 0 ? price : 0;
  const tax = Math.round((validPrice * 100 * draft.taxRate) / (1 + draft.taxRate)) / 100;
  const shownImage = previewUrl ?? (removeImage || !currentImage ? null : productImageUrl(currentImage));
  const category = categories.find((item) => item.id === draft.categoryId);

  async function save() {
    setTouched(true);
    setFormError("");
    if (Object.keys(errors).length > 0) { setFormError("Revisa los campos marcados."); return; }
    const configurationIssue = configDirty ? validateModifierGroups(groups) : null;
    if (configurationIssue) { setFormError(configurationIssue); return; }
    const input: AdminProductInput = {
      categoryId: draft.categoryId,
      name: draft.name.trim(),
      shortDescription: draft.shortDescription.trim(),
      badge: draft.badge.trim(),
      imageAlt: draft.imageAlt.trim(),
      basePrice: Math.round(price * 100) / 100,
      taxRate: draft.taxRate,
    };
    setSaving(true);
    try {
      let id = savedId;
      if (id) await api.updateProduct(id, input);
      else {
        const created = await api.createProduct(input);
        id = created.product.id;
        setSavedId(id);
      }
      if (file) {
        const uploaded = await api.uploadProductImage(id, file);
        setCurrentImage(uploaded.product.imageCardUrl);
        setFile(null);
      } else if (removeImage && currentImage) {
        await api.removeProductImage(id);
        setCurrentImage(null);
        setRemoveImage(false);
      }
      if (configDirty) {
        const saved = await api.saveProductConfiguration(id, draftToPayload(groups));
        setGroups(modifierGroupsToDraft(saved.groups));
        setConfigDirty(false);
      }
      onSaved();
    } catch (reason) {
      const message = reason instanceof ApiError ? reason.message : "No pudimos guardar los cambios.";
      setFormError(savedId || record ? message : `${message} Lo que ya se guardó se conserva; corrige y vuelve a guardar.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cycle-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section className="cycle-editor" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
        <header className="cycle-editor-header">
          <div>
            <p className="section-kicker">{savedId ? "Editar producto" : "Nuevo producto"}</p>
            <h2 id="product-editor-title">{draft.name.trim() || "Producto"}</h2>
          </div>
          <button type="button" className="close-button" aria-label="Cerrar" onClick={requestClose}><X size={20} /></button>
        </header>

        <div className="cycle-editor-body">
          <div className="cycle-steps">
            <section className="cycle-step">
              <h3><span>1</span> Datos del producto</h3>
              <div className="cycle-step-grid">
                <div className={`ui-field ${show("categoryId") ? "has-error" : ""}`}>
                  <label className="ui-field-label" htmlFor="product-category">Categoría</label>
                  <div className="ui-control time-select-control">
                    <select id="product-category" value={draft.categoryId} onChange={(event) => set("categoryId", event.target.value)}>
                      <option value="" disabled>Elige una categoría</option>
                      {categories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : " (oculta)"}</option>)}
                    </select>
                  </div>
                  {show("categoryId") && <small className="ui-field-error" role="alert">{show("categoryId")}</small>}
                  {category && !category.isActive && <small className="ui-field-hint">Esta categoría está oculta: el producto no aparece en la tienda hasta activarla.</small>}
                </div>
                <div className="ui-field">
                  <label className="ui-field-label" htmlFor="product-badge">Etiqueta <em>Opcional</em></label>
                  <input id="product-badge" className="ui-control" value={draft.badge} maxLength={BADGE_MAX} placeholder="Ej. Favorita, Nuevo" onChange={(event) => set("badge", event.target.value)} />
                  <small className="ui-field-hint">Se muestra sobre la foto en la tarjeta.</small>
                </div>
              </div>
              <div className={`ui-field ${show("name") ? "has-error" : ""}`}>
                <label className="ui-field-label" htmlFor="product-name">Nombre</label>
                <input id="product-name" className="ui-control" value={draft.name} maxLength={NAME_MAX} placeholder="Ej. Ensalada Rocota" onChange={(event) => set("name", event.target.value)} />
                {show("name") && <small className="ui-field-error" role="alert">{show("name")}</small>}
              </div>
              <div className={`ui-field ${show("shortDescription") ? "has-error" : ""}`}>
                <label className="ui-field-label" htmlFor="product-description">Descripción</label>
                <textarea id="product-description" className="ui-control" rows={3} value={draft.shortDescription} maxLength={DESCRIPTION_MAX} placeholder="Qué lleva, en una o dos frases." onChange={(event) => set("shortDescription", event.target.value)} />
                {show("shortDescription") ? <small className="ui-field-error" role="alert">{show("shortDescription")}</small> : <small className="ui-field-hint">{draft.shortDescription.length} de {DESCRIPTION_MAX}</small>}
              </div>
            </section>

            <section className="cycle-step">
              <h3><span>2</span> Precio</h3>
              <p className="cycle-step-intro">Escribe el precio que paga el cliente. El IVA ya va dentro.</p>
              <div className="cycle-step-grid">
                <div className={`ui-field ${show("price") ? "has-error" : ""}`}>
                  <label className="ui-field-label" htmlFor="product-price">Precio final</label>
                  <div className="ui-control product-price-control"><span aria-hidden="true">$</span><input id="product-price" inputMode="decimal" value={draft.price} placeholder="0.00" onChange={(event) => { if (/^\d*(?:[.,]\d{0,2})?$/.test(event.target.value)) set("price", event.target.value); }} /></div>
                  {show("price") && <small className="ui-field-error" role="alert">{show("price")}</small>}
                </div>
                <Segmented label="IVA" value={draft.taxRate} options={[{ value: 0.15, label: "15 %" }, { value: 0, label: "0 %" }, ...(draft.taxRate !== 0.15 && draft.taxRate !== 0 ? [{ value: draft.taxRate, label: `${Math.round(draft.taxRate * 10000) / 100} %` }] : [])]} onChange={(value) => set("taxRate", value)} />
              </div>
              <p className="product-price-breakdown">{money.format(validPrice)} = {money.format(validPrice - tax)} de base + {money.format(tax)} de IVA</p>
            </section>

            <section className="cycle-step">
              <h3><span>3</span> Imagen</h3>
              <label className={`product-dropzone ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
                <input type="file" accept={IMAGE_TYPES.join(",")} onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = ""; }} />
                <ImagePlus size={26} aria-hidden="true" />
                <strong>{shownImage ? "Cambiar imagen" : "Suelta una imagen o haz clic para elegir"}</strong>
                <span>JPG, PNG o WebP, hasta 8 MB. La optimizamos al guardar.</span>
              </label>
              {imageError && <small className="ui-field-error" role="alert">{imageError}</small>}
              {shownImage && <button type="button" className="product-remove-image" onClick={() => { setFile(null); setRemoveImage(true); setDirty(true); }}><Trash2 size={15} /> Quitar imagen</button>}
              <div className="ui-field">
                <label className="ui-field-label" htmlFor="product-alt">Descripción de la imagen <em>Opcional</em></label>
                <input id="product-alt" className="ui-control" value={draft.imageAlt} maxLength={ALT_MAX} placeholder="Ej. Ensalada con pollo a la parrilla y aguacate" onChange={(event) => set("imageAlt", event.target.value)} />
                <small className="ui-field-hint">La leen los lectores de pantalla y los buscadores.</small>
              </div>
            </section>

            <section className="cycle-step">
              <h3><span>4</span> Personalización</h3>
              {configState === "loading" && <p className="cycle-step-intro">Cargando la personalización…</p>}
              {configState === "error" && (
                <div className="cycle-lock-note product-config-error">
                  <span>No pudimos cargar la personalización. Para no borrarla, no se puede guardar hasta recuperarla.</span>
                  <button type="button" onClick={() => { setConfigState("loading"); setConfigAttempt((attempt) => attempt + 1); }}><RefreshCw size={14} /> Reintentar</button>
                </div>
              )}
              {configState === "ready" && (
                <ProductConfiguratorEditor
                  groups={groups}
                  showIssues={touched}
                  onChange={(next) => { setGroups(next); setConfigDirty(true); setDirty(true); }}
                  copySource={{
                    products: products.filter((product) => product.id !== savedId && product.modifierGroupCount > 0).map((product) => ({ id: product.id, name: product.name })),
                    load: async (productId) => (await api.adminProductConfiguration(productId)).groups,
                  }}
                />
              )}
            </section>
          </div>

          <aside className="cycle-summary product-preview" aria-label="Vista previa">
            <h3>Así se verá en la tienda</h3>
            <ProductCardView
              product={{ name: draft.name.trim(), description: draft.shortDescription.trim(), price: validPrice, image: shownImage, imageAlt: draft.imageAlt || draft.name, badge: draft.badge.trim() || null, available: 99 }}
              action={<span className="add-button" aria-hidden="true"><Plus size={22} /></span>}
            />
            <p className="cycle-summary-ok">{category ? `En la categoría ${category.name}.` : "Elige una categoría."} Para venderlo, agrégalo a un ciclo.</p>
          </aside>
        </div>

        <footer className="cycle-editor-footer">
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div>
            <Button variant="ghost" onClick={requestClose} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={saving || configState !== "ready"}>{saving ? "Guardando…" : configState === "loading" ? "Cargando…" : savedId ? "Guardar cambios" : "Crear producto"}</Button>
          </div>
        </footer>
      </section>

      {confirmClose && (
        <ConfirmDialog
          title="¿Salir sin guardar?"
          body={<p>Los cambios que hiciste en este producto se perderán.</p>}
          confirmLabel="Salir sin guardar"
          cancelLabel="Seguir editando"
          onConfirm={onClose}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </div>
  );
}
