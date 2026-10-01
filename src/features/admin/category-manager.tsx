"use client";

import { ArrowDown, ArrowUp, Check, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, type AdminCategory } from "@/lib/api/client";
import { moveItem } from "@/lib/reorder";

const NAME_MAX = 80;

export function CategoryManager() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<AdminCategory | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.adminCategories()
      .then((data) => { if (active) setCategories(data.categories); })
      .catch(() => { if (active) setError("No pudimos cargar las categorías."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const setRowError = (id: string, message: string) => setRowErrors((current) => ({ ...current, [id]: message }));

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (name.length < 2) { setError("Escribe un nombre de al menos 2 letras."); return; }
    setCreating(true); setError("");
    try {
      const response = await api.createCategory({ name });
      setCategories((current) => [...current, response.category]);
      setNewName("");
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "No pudimos crear la categoría."); }
    finally { setCreating(false); }
  }

  async function patch(category: AdminCategory, change: { name?: string; isActive?: boolean }) {
    setBusyId(category.id); setRowError(category.id, "");
    try {
      const response = await api.updateCategory(category.id, change);
      setCategories((current) => current.map((item) => item.id === category.id ? { ...item, ...response.category, productCount: item.productCount } : item));
      setEditing(null);
    } catch (reason) { setRowError(category.id, reason instanceof ApiError ? reason.message : "No pudimos guardar el cambio."); }
    finally { setBusyId(null); }
  }

  async function reorder(fromId: string, toId: string) {
    const from = categories.findIndex((category) => category.id === fromId);
    const to = categories.findIndex((category) => category.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const previous = categories;
    const moved = moveItem(categories, from, to);
    setCategories(moved);
    try { await api.reorderCategories(moved.map((category) => category.id)); }
    catch (reason) {
      setCategories(previous);
      setRowError(fromId, reason instanceof ApiError ? reason.message : "No pudimos guardar el nuevo orden.");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusyId(toDelete.id); setDeleteError("");
    try {
      await api.deleteCategory(toDelete.id);
      setCategories((current) => current.filter((item) => item.id !== toDelete.id));
      setToDelete(null);
    } catch (reason) { setDeleteError(reason instanceof ApiError ? reason.message : "No pudimos eliminar la categoría."); }
    finally { setBusyId(null); }
  }

  return (
    <main className="admin-dashboard admin-list-page">
      <div className="admin-heading">
        <div><p className="section-kicker">Estructura del menú</p><h1>Categorías</h1><p>Son las pestañas del menú en la tienda, en este mismo orden.</p></div>
      </div>

      <form className="catalog-toolbar category-create" onSubmit={create}>
        <label className="ui-control catalog-search"><Plus size={16} aria-hidden="true" /><input value={newName} maxLength={NAME_MAX} placeholder="Nombre de la nueva categoría" aria-label="Nombre de la nueva categoría" onChange={(event) => setNewName(event.target.value)} /></label>
        <button type="submit" className="btn btn-primary btn-md" disabled={creating || newName.trim().length < 2}>{creating ? "Creando…" : "Crear categoría"}</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="catalog-group">
        {loading ? <div className="catalog-list">{Array.from({ length: 3 }, (_, index) => <div className="catalog-row" key={index}><Skeleton width="100%" height={40} /></div>)}</div>
          : categories.length === 0 ? <div className="admin-panel admin-empty-state"><strong>Aún no hay categorías</strong><span>Crea la primera con el campo de arriba.</span></div>
          : (
            <ul className="catalog-list">
              {categories.map((category, index) => {
                const busy = busyId === category.id;
                const isEditing = editing?.id === category.id;
                return (
                  <li
                    key={category.id}
                    className={`catalog-row category-row ${category.isActive ? "" : "is-inactive"} ${dragId === category.id ? "is-dragging" : ""} ${overId === category.id && dragId !== category.id ? "is-over" : ""}`}
                    draggable={!isEditing}
                    onDragStart={(event) => { setDragId(category.id); event.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(event) => { if (dragId) { event.preventDefault(); setOverId(category.id); } }}
                    onDragEnd={() => { setDragId(null); setOverId(null); }}
                    onDrop={(event) => { event.preventDefault(); if (dragId) void reorder(dragId, category.id); setDragId(null); setOverId(null); }}
                  >
                    <span className="catalog-grip" aria-hidden="true"><GripVertical size={18} /></span>
                    <div className="catalog-main">
                      {isEditing ? (
                        <form className="category-rename" onSubmit={(event) => { event.preventDefault(); if (editing.name.trim().length >= 2) void patch(category, { name: editing.name.trim() }); }}>
                          <input className="ui-control" autoFocus value={editing.name} maxLength={NAME_MAX} aria-label={`Nuevo nombre para ${category.name}`} onChange={(event) => setEditing({ id: category.id, name: event.target.value })} onKeyDown={(event) => { if (event.key === "Escape") setEditing(null); }} />
                          <button type="submit" className="icon-button" aria-label="Guardar nombre" disabled={busy || editing.name.trim().length < 2}><Check size={16} /></button>
                          <button type="button" className="icon-button" aria-label="Cancelar" onClick={() => setEditing(null)}><X size={16} /></button>
                        </form>
                      ) : (
                        <>
                          <strong>{category.name}</strong>
                          <span>{category.productCount} {category.productCount === 1 ? "producto" : "productos"}{category.isActive ? "" : ". Oculta: sus productos no aparecen en la tienda."}</span>
                        </>
                      )}
                      {rowErrors[category.id] && <small className="ui-field-error" role="alert">{rowErrors[category.id]}</small>}
                    </div>
                    <button type="button" role="switch" aria-checked={category.isActive} aria-label={`${category.name}: ${category.isActive ? "visible, ocultar" : "oculta, mostrar"}`} className="switch" disabled={busy} onClick={() => void patch(category, { isActive: !category.isActive })}>
                      <span /><em>{category.isActive ? "Visible" : "Oculta"}</em>
                    </button>
                    <div className="catalog-actions">
                      <button type="button" className="icon-button" aria-label={`Subir ${category.name}`} disabled={index === 0} onClick={() => { const previous = categories[index - 1]; if (previous) void reorder(category.id, previous.id); }}><ArrowUp size={16} /></button>
                      <button type="button" className="icon-button" aria-label={`Bajar ${category.name}`} disabled={index === categories.length - 1} onClick={() => { const next = categories[index + 1]; if (next) void reorder(category.id, next.id); }}><ArrowDown size={16} /></button>
                      <button type="button" className="icon-button" aria-label={`Cambiar nombre de ${category.name}`} onClick={() => setEditing({ id: category.id, name: category.name })}><Pencil size={16} /></button>
                      <button type="button" className="icon-button is-danger" aria-label={`Eliminar ${category.name}`} disabled={busy || category.productCount > 0} title={category.productCount > 0 ? "Tiene productos: muévelos o elimínalos antes" : undefined} onClick={() => { setDeleteError(""); setToDelete(category); }}><Trash2 size={16} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
      </section>

      {toDelete && (
        <ConfirmDialog
          title="¿Eliminar esta categoría?"
          body={<p><strong>{toDelete.name}.</strong> Está vacía, así que se puede borrar por completo.</p>}
          confirmLabel="Eliminar categoría"
          busy={busyId === toDelete.id}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </main>
  );
}
