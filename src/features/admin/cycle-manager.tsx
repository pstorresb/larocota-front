"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Copy, LayoutGrid, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CycleSlots } from "@/features/admin/cycle-slots";
import { api, ApiError, type AdminCycle, type AdminCycleInput, type AdminProduct, type CycleStatus, type FulfillmentType } from "@/lib/api/client";
import { cycleStatusLabels, cycleStatusTone, cycleTransitions } from "@/lib/cycle-status";
import { fromDateAndTime, fromDateTimeLocal, toDateOnly, toDateTimeLocal, toTimeOnly } from "@/lib/datetime-local";
import { shortDateTime, shortTime, weekdayDate } from "@/lib/order-status";

type Assignment = { selected: boolean; capacity: string; price: string };
type Editor = { record: AdminCycle | null };

/** Client-side mirror of the API's window rules, so the admin sees the problem before saving. */
function windowProblem(input: { opensAt: string | null; closesAt: string | null; startsAt: string | null; endsAt: string | null; slotMinutes: number }) {
  const { opensAt, closesAt, startsAt, endsAt, slotMinutes } = input;
  if (!opensAt || !closesAt || !startsAt || !endsAt) return "Completa todas las fechas del ciclo.";
  if (!(opensAt < closesAt && closesAt < startsAt && startsAt < endsAt)) return "Las fechas del ciclo no están en orden: apertura, cierre y luego la ventana de entrega.";
  const windowMs = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  if (windowMs > 24 * 3_600_000) return "La ventana de entrega no puede superar 24 horas.";
  if (windowMs % (slotMinutes * 60_000) !== 0) return `La ventana de entrega debe ser un múltiplo de la franja (${slotMinutes} min).`;
  return null;
}

export function CycleManager() {
  const [cycles, setCycles] = useState<AdminCycle[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [assignmentsReady, setAssignmentsReady] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [slotsFor, setSlotsFor] = useState<AdminCycle | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Live preview of the fulfillment window while editing.
  const [windowDraft, setWindowDraft] = useState({ opensAt: "", closesAt: "", date: "", from: "", to: "", slotMinutes: 60 });

  const fetchAll = () => Promise.all([api.adminCycles(), api.adminProducts()]);
  function apply([cycleData, productData]: Awaited<ReturnType<typeof fetchAll>>) {
    setCycles(cycleData.cycles);
    setProducts(productData.products.filter((item) => item.isActive));
  }

  async function load() {
    setLoading(true); setError("");
    try { apply(await fetchAll()); }
    catch { setError("No pudimos cargar los ciclos."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    fetchAll()
      .then((data) => { if (active) apply(data); })
      .catch(() => { if (active) setError("No pudimos cargar los ciclos."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Initial load only; later refreshes go through `load()` from event handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openEditor(record: AdminCycle | null) {
    setFormError("");
    setEditor({ record });
    setAssignments({});
    setWindowDraft({
      opensAt: toDateTimeLocal(record?.opensAt),
      closesAt: toDateTimeLocal(record?.closesAt),
      date: toDateOnly(record?.fulfillmentStartsAt),
      from: toTimeOnly(record?.fulfillmentStartsAt),
      to: toTimeOnly(record?.fulfillmentEndsAt),
      slotMinutes: record?.slotMinutes ?? 60,
    });
    if (!record) { setAssignmentsReady(true); return; }
    setAssignmentsReady(false);
    try {
      const selected = await api.adminCycleProducts(record.id);
      setAssignments(Object.fromEntries(selected.products.map((item) => [item.productId, { selected: item.isAvailable, capacity: item.capacity ? String(item.capacity) : "", price: item.priceOverride ?? "" }])));
      setAssignmentsReady(true);
    } catch {
      setFormError("No pudimos cargar los productos actuales del ciclo. Cierra e inténtalo nuevamente.");
    }
  }

  function updateAssignment(productId: string, change: Partial<Assignment>) {
    setAssignments((current) => ({ ...current, [productId]: { ...(current[productId] ?? { selected: false, capacity: "", price: "" }), ...change } }));
  }

  const preview = useMemo(() => {
    const startsAt = fromDateAndTime(windowDraft.date, windowDraft.from);
    const endsAt = fromDateAndTime(windowDraft.date, windowDraft.to);
    const problem = windowProblem({ opensAt: fromDateTimeLocal(windowDraft.opensAt), closesAt: fromDateTimeLocal(windowDraft.closesAt), startsAt, endsAt, slotMinutes: windowDraft.slotMinutes });
    const slots = startsAt && endsAt && !problem ? Math.floor((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / (windowDraft.slotMinutes * 60_000)) : 0;
    return { startsAt, endsAt, problem, slots };
  }, [windowDraft]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true); setFormError("");
    const data = new FormData(event.currentTarget);
    const modes = data.getAll("fulfillmentModes") as FulfillmentType[];
    if (modes.length === 0) { setFormError("Selecciona al menos una modalidad: retiro o entrega."); setSaving(false); return; }
    const opensAt = fromDateTimeLocal(windowDraft.opensAt);
    const closesAt = fromDateTimeLocal(windowDraft.closesAt);
    if (preview.problem || !opensAt || !closesAt || !preview.startsAt || !preview.endsAt) { setFormError(preview.problem ?? "Completa todas las fechas del ciclo."); setSaving(false); return; }
    const input: AdminCycleInput = {
      name: String(data.get("name")),
      opensAt, closesAt,
      fulfillmentStartsAt: preview.startsAt,
      fulfillmentEndsAt: preview.endsAt,
      slotMinutes: windowDraft.slotMinutes === 30 ? 30 : 60,
      slotCapacity: data.get("slotCapacity") ? Number(data.get("slotCapacity")) : null,
      globalCapacity: data.get("globalCapacity") ? Number(data.get("globalCapacity")) : null,
      fulfillmentModes: modes,
      publicMessage: String(data.get("publicMessage") || ""),
    };
    try {
      const response = editor.record ? await api.updateCycle(editor.record.id, input) : await api.createCycle(input);
      await api.setCycleProducts(response.cycle.id, products.flatMap((product, index) => {
        const assignment = assignments[product.id];
        if (!assignment?.selected) return [];
        return [{ productId: product.id, capacity: assignment.capacity ? Number(assignment.capacity) : null, priceOverride: assignment.price ? Number(assignment.price) : null, isAvailable: true, sortOrder: index }];
      }));
      setEditor(null);
      await load();
    } catch (reason) { setFormError(reason instanceof ApiError ? reason.message : "No pudimos guardar los cambios."); }
    finally { setSaving(false); }
  }

  async function transition(cycle: AdminCycle, to: CycleStatus, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(cycle.id); setError("");
    try { await api.updateCycle(cycle.id, { status: to }); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "No pudimos cambiar el estado del ciclo."); }
    finally { setBusyId(null); }
  }

  async function duplicate(cycle: AdminCycle) {
    setBusyId(cycle.id); setError("");
    try { await api.duplicateCycle(cycle.id); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "No pudimos duplicar el ciclo."); }
    finally { setBusyId(null); }
  }

  async function remove(cycle: AdminCycle) {
    if (!window.confirm("¿Eliminar este ciclo? Solo se puede si no tiene pedidos.")) return;
    setBusyId(cycle.id); setError("");
    try { await api.deleteCycle(cycle.id); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "No pudimos eliminar el ciclo."); }
    finally { setBusyId(null); }
  }

  const current = editor?.record ?? null;
  const selectedCount = Object.values(assignments).filter((item) => item.selected).length;

  return (
    <main className="admin-dashboard admin-list-page">
      <div className="admin-heading">
        <div><p className="section-kicker">Publicación</p><h1>Ciclos de venta</h1><p>Cada ciclo abre pedidos unos días y entrega en una ventana dividida en franjas.</p></div>
        <button type="button" onClick={() => void openEditor(null)}><Plus size={16} /> Crear ciclo</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="admin-panel list-panel">
        {loading ? <div className="admin-skeleton">Cargando…</div>
          : cycles.length === 0 ? <div className="admin-empty-state"><strong>No hay ciclos</strong><span>Crea el primero para publicar el menú.</span></div>
          : <div className="cycle-list">
            {cycles.map((cycle) => (
              <article className="cycle-row" key={cycle.id}>
                <div className="cycle-row-main">
                  <div className="cycle-row-title"><strong>{cycle.name}</strong><Badge tone={cycleStatusTone[cycle.status]}>{cycleStatusLabels[cycle.status]}</Badge></div>
                  <dl className="cycle-row-facts">
                    <div><dt><CalendarDays size={14} /> Pedidos</dt><dd>{shortDateTime.format(new Date(cycle.opensAt))} hasta {shortDateTime.format(new Date(cycle.closesAt))}</dd></div>
                    <div><dt><Clock3 size={14} /> Entrega</dt><dd>{weekdayDate.format(new Date(cycle.fulfillmentStartsAt))}, {shortTime.format(new Date(cycle.fulfillmentStartsAt))} a {shortTime.format(new Date(cycle.fulfillmentEndsAt))}, franjas de {cycle.slotMinutes} min{cycle.slotCapacity ? `, ${cycle.slotCapacity} pedidos por franja` : ""}</dd></div>
                    <div><dt>Contenido</dt><dd>{cycle.productCount} productos, {cycle.activeOrderCount} pedidos activos{cycle.globalCapacity ? `, cupo global ${cycle.globalCapacity}` : ""}. {cycle.fulfillmentModes.map((mode) => mode === "pickup" ? "Retiro" : "Entrega").join(" y ")}.</dd></div>
                  </dl>
                </div>
                <div className="cycle-row-actions">
                  {cycleTransitions[cycle.status].map((action) => (
                    <button key={action.to} type="button" className={action.to === "cancelled" ? "cycle-action cycle-action-danger" : "cycle-action cycle-action-primary"} disabled={busyId === cycle.id} onClick={() => void transition(cycle, action.to, action.confirm)}>{action.label}</button>
                  ))}
                  <button type="button" className="cycle-action" disabled={busyId === cycle.id} onClick={() => setSlotsFor(cycle)}><LayoutGrid size={15} /> Franjas</button>
                  <button type="button" className="cycle-action" disabled={busyId === cycle.id} onClick={() => void openEditor(cycle)}><Pencil size={15} /> Editar</button>
                  <button type="button" className="cycle-action" disabled={busyId === cycle.id} onClick={() => void duplicate(cycle)}><Copy size={15} /> Duplicar</button>
                  {cycle.orderCount === 0 && <button type="button" className="cycle-action cycle-action-danger" aria-label="Eliminar ciclo" disabled={busyId === cycle.id} onClick={() => void remove(cycle)}><Trash2 size={15} /></button>}
                </div>
              </article>
            ))}
          </div>}
      </section>

      {slotsFor && <CycleSlots cycle={slotsFor} onClose={() => setSlotsFor(null)} />}

      {editor && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}>
          <section className="admin-modal admin-resource-modal" role="dialog" aria-modal="true" aria-labelledby="cycle-editor-title">
            <header>
              <div><span className="section-kicker">{current ? "Editar ciclo" : "Nuevo ciclo"}</span><h2 id="cycle-editor-title">{current?.name ?? "Ciclo de venta"}</h2><p>Fechas de pedidos, ventana de entrega, cupos y productos.</p></div>
              <button type="button" aria-label="Cerrar" onClick={() => setEditor(null)}><X size={20} /></button>
            </header>
            <form onSubmit={save}>
              <div className="admin-form-grid">
                <label className="wide">Nombre<input name="name" required minLength={2} defaultValue={current?.name ?? ""} placeholder="Ej. Menú de la semana del 6 de octubre" /></label>
                <label>Apertura de pedidos<input type="datetime-local" required value={windowDraft.opensAt} onChange={(event) => setWindowDraft((draft) => ({ ...draft, opensAt: event.target.value }))} /></label>
                <label>Cierre de pedidos<input type="datetime-local" required value={windowDraft.closesAt} onChange={(event) => setWindowDraft((draft) => ({ ...draft, closesAt: event.target.value }))} /></label>
                <fieldset className="wide cycle-window-field">
                  <legend>Ventana de entrega</legend>
                  <div className="cycle-window-grid">
                    <label>Día<input type="date" required value={windowDraft.date} onChange={(event) => setWindowDraft((draft) => ({ ...draft, date: event.target.value }))} /></label>
                    <label>Desde<input type="time" required step={1800} value={windowDraft.from} onChange={(event) => setWindowDraft((draft) => ({ ...draft, from: event.target.value }))} /></label>
                    <label>Hasta<input type="time" required step={1800} value={windowDraft.to} onChange={(event) => setWindowDraft((draft) => ({ ...draft, to: event.target.value }))} /></label>
                    <label>Duración de franja<select value={windowDraft.slotMinutes} onChange={(event) => setWindowDraft((draft) => ({ ...draft, slotMinutes: Number(event.target.value) }))}><option value={30}>30 minutos</option><option value={60}>1 hora</option></select></label>
                    <label>Pedidos por franja<input name="slotCapacity" type="number" min="1" placeholder="Sin límite" defaultValue={current?.slotCapacity ?? ""} /></label>
                  </div>
                  <p className={`cycle-window-hint ${preview.problem ? "is-problem" : ""}`}>{preview.problem ?? `Se crearán ${preview.slots} franjas de ${windowDraft.slotMinutes} minutos. Horas de Ecuador.`}</p>
                </fieldset>
                <label>Cupo global (unidades)<input name="globalCapacity" type="number" min="1" placeholder="Sin límite" defaultValue={current?.globalCapacity ?? ""} /></label>
                <fieldset className="admin-checkboxes"><legend>Modalidades</legend>
                  <label><input type="checkbox" name="fulfillmentModes" value="pickup" defaultChecked={current ? current.fulfillmentModes.includes("pickup") : true} /> Retiro en el local</label>
                  <label><input type="checkbox" name="fulfillmentModes" value="delivery" defaultChecked={current ? current.fulfillmentModes.includes("delivery") : true} /> Entrega a domicilio</label>
                </fieldset>
                <label className="wide">Mensaje público<textarea name="publicMessage" maxLength={500} defaultValue={current?.publicMessage ?? ""} placeholder="Se muestra en la portada mientras el ciclo esté visible." /></label>
                <fieldset className="wide cycle-products-field">
                  <legend>Productos del ciclo{assignmentsReady ? `, ${selectedCount} seleccionados` : ""}</legend>
                  {!assignmentsReady ? <p className="cycle-products-loading">Cargando productos asociados…</p>
                    : products.length === 0 ? <p>Crea productos activos antes de publicar el ciclo.</p>
                    : products.map((product) => {
                      const assignment = assignments[product.id] ?? { selected: false, capacity: "", price: "" };
                      return (
                        <div key={product.id} className={assignment.selected ? "cycle-product-selected" : undefined}>
                          <label><input type="checkbox" checked={assignment.selected} onChange={(event) => updateAssignment(product.id, { selected: event.target.checked })} /> {product.name}</label>
                          <input type="number" min="1" placeholder="Cupo" aria-label={`Cupo de ${product.name}`} value={assignment.capacity} disabled={!assignment.selected} onChange={(event) => updateAssignment(product.id, { capacity: event.target.value })} />
                          <input type="number" min="0" step="0.01" placeholder="Precio especial" aria-label={`Precio especial de ${product.name}`} value={assignment.price} disabled={!assignment.selected} onChange={(event) => updateAssignment(product.id, { price: event.target.value })} />
                        </div>
                      );
                    })}
                </fieldset>
              </div>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <footer>
                <button type="button" className="secondary" onClick={() => setEditor(null)}>Cancelar</button>
                <button type="submit" disabled={saving || !assignmentsReady}>{saving ? "Guardando…" : current ? "Guardar cambios" : "Crear ciclo"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
