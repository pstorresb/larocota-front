"use client";

import { CalendarClock, Lock, Search, Store, Truck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimeField } from "@/components/ui/date-time-field";
import { Segmented } from "@/components/ui/segmented";
import { TimeSelect } from "@/components/ui/time-select";
import { api, ApiError, type AdminCycle, type AdminCycleInput, type AdminProduct, type FulfillmentType } from "@/lib/api/client";
import { fromDateAndTime, toDateOnly, toTimeOnly } from "@/lib/datetime-local";
import { money, shortTime, weekdayDate } from "@/lib/order-status";

type Assignment = { selected: boolean; capacity: string; price: string };
type Draft = {
  name: string; message: string;
  opensDate: string; opensTime: string; closesDate: string; closesTime: string;
  date: string; from: string; to: string; slotMinutes: 30 | 60;
  slotCapacity: string; globalCapacity: string;
  pickup: boolean; delivery: boolean;
};
type FieldErrors = Partial<Record<"name" | "opensAt" | "closesAt" | "date" | "to" | "modes", string>>;

function initialDraft(record: AdminCycle | null): Draft {
  return {
    name: record?.name ?? "",
    message: record?.publicMessage ?? "",
    opensDate: toDateOnly(record?.opensAt), opensTime: toTimeOnly(record?.opensAt),
    closesDate: toDateOnly(record?.closesAt), closesTime: toTimeOnly(record?.closesAt),
    date: toDateOnly(record?.fulfillmentStartsAt),
    from: toTimeOnly(record?.fulfillmentStartsAt) || "11:30",
    to: toTimeOnly(record?.fulfillmentEndsAt) || "14:00",
    slotMinutes: record?.slotMinutes ?? 30,
    slotCapacity: record?.slotCapacity ? String(record.slotCapacity) : "",
    globalCapacity: record?.globalCapacity ? String(record.globalCapacity) : "",
    pickup: record ? record.fulfillmentModes.includes("pickup") : true,
    delivery: record ? record.fulfillmentModes.includes("delivery") : true,
  };
}

function minutesOf(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function clock(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Shifts a "YYYY-MM-DD" calendar date by whole days. */
function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

/** Same rules as the API (`validateCycleDates`), reported per field so the admin sees where the problem is. */
function validate(draft: Draft) {
  const errors: FieldErrors = {};
  const opensAt = fromDateAndTime(draft.opensDate, draft.opensTime);
  const closesAt = fromDateAndTime(draft.closesDate, draft.closesTime);
  const startsAt = fromDateAndTime(draft.date, draft.from);
  const endsAt = fromDateAndTime(draft.date, draft.to);
  if (draft.name.trim().length < 2) errors.name = "Ponle un nombre al ciclo.";
  if (!opensAt) errors.opensAt = "Elige la fecha y la hora de apertura.";
  if (!closesAt) errors.closesAt = "Elige la fecha y la hora de cierre.";
  else if (opensAt && closesAt <= opensAt) errors.closesAt = "El cierre debe ser posterior a la apertura.";
  if (!draft.date) errors.date = "Elige el día de entrega.";
  else if (closesAt && startsAt && startsAt <= closesAt) errors.date = "La entrega debe empezar después del cierre de pedidos.";
  if (!draft.from || !draft.to) errors.to = "Elige desde y hasta qué hora se entrega.";
  else if (minutesOf(draft.to) <= minutesOf(draft.from)) errors.to = "«Hasta» debe ser posterior a «Desde».";
  else if ((minutesOf(draft.to) - minutesOf(draft.from)) % draft.slotMinutes !== 0) errors.to = `La ventana debe dividirse en franjas completas de ${draft.slotMinutes} minutos.`;
  if (!draft.pickup && !draft.delivery) errors.modes = "Elige al menos una modalidad.";
  return { errors, opensAt, closesAt, startsAt, endsAt };
}

function slotPreview(draft: Draft) {
  if (!draft.from || !draft.to) return [];
  const start = minutesOf(draft.from);
  const end = minutesOf(draft.to);
  const slots: string[] = [];
  for (let at = start; at + draft.slotMinutes <= end; at += draft.slotMinutes) slots.push(`${clock(at)}–${clock(at + draft.slotMinutes)}`);
  return slots;
}

type Props = { record: AdminCycle | null; products: AdminProduct[]; onClose: () => void; onSaved: () => void };

export function CycleEditor({ record, products, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(record));
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [assignmentsReady, setAssignmentsReady] = useState(record === null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [formError, setFormError] = useState("");
  const [touched, setTouched] = useState(record !== null);

  const windowLocked = (record?.activeOrderCount ?? 0) > 0;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!record) return;
    let active = true;
    api.adminCycleProducts(record.id)
      .then((selected) => {
        if (!active) return;
        setAssignments(Object.fromEntries(selected.products.map((item) => [item.productId, { selected: item.isAvailable, capacity: item.capacity ? String(item.capacity) : "", price: item.priceOverride ?? "" }])));
        setAssignmentsReady(true);
      })
      .catch(() => { if (active) setFormError("No pudimos cargar los productos actuales del ciclo. Cierra e inténtalo nuevamente."); });
    return () => { active = false; };
  }, [record]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const check = useMemo(() => validate(draft), [draft]);
  const slots = useMemo(() => slotPreview(draft), [draft]);
  const problems = Object.values(check.errors);
  const show = (key: keyof FieldErrors) => (touched ? check.errors[key] ?? null : null);
  const selectedIds = products.filter((product) => assignments[product.id]?.selected).map((product) => product.id);
  const visibleProducts = products.filter((product) => product.name.toLowerCase().includes(search.trim().toLowerCase()));
  const capacityPerSlot = draft.slotCapacity ? Number(draft.slotCapacity) : null;
  const daysOpen = check.opensAt && check.closesAt && check.closesAt > check.opensAt
    ? Math.max(1, Math.round((new Date(check.closesAt).getTime() - new Date(check.opensAt).getTime()) / 86_400_000))
    : null;

  function updateAssignment(productId: string, change: Partial<Assignment>) {
    setAssignments((current) => ({ ...current, [productId]: { ...(current[productId] ?? { selected: false, capacity: "", price: "" }), ...change } }));
  }

  function selectAll(selected: boolean) {
    setAssignments((current) => {
      const next = { ...current };
      for (const product of visibleProducts) next[product.id] = { ...(next[product.id] ?? { capacity: "", price: "" }), selected };
      return next;
    });
  }

  function openNow() {
    const now = new Date();
    setDraft((current) => ({ ...current, opensDate: toDateOnly(now), opensTime: toTimeOnly(now) }));
  }

  function closeNightBefore() {
    if (!draft.date) return;
    setDraft((current) => ({ ...current, closesDate: shiftDate(current.date, -1), closesTime: "20:00" }));
  }

  async function save(publish: boolean) {
    setTouched(true);
    setFormError("");
    const { opensAt, closesAt, startsAt, endsAt } = check;
    if (problems.length > 0 || !opensAt || !closesAt || !startsAt || !endsAt) return;
    if (publish && selectedIds.length === 0) { setFormError("Agrega al menos un producto antes de publicar el ciclo."); return; }
    const modes: FulfillmentType[] = [...(draft.pickup ? ["pickup" as const] : []), ...(draft.delivery ? ["delivery" as const] : [])];
    const input: AdminCycleInput = {
      name: draft.name.trim(),
      opensAt, closesAt,
      fulfillmentStartsAt: startsAt,
      fulfillmentEndsAt: endsAt,
      slotMinutes: draft.slotMinutes,
      slotCapacity: capacityPerSlot,
      globalCapacity: draft.globalCapacity ? Number(draft.globalCapacity) : null,
      fulfillmentModes: modes,
      publicMessage: draft.message.trim(),
    };
    setSaving(publish ? "publish" : "draft");
    try {
      const response = record ? await api.updateCycle(record.id, input) : await api.createCycle(input);
      await api.setCycleProducts(response.cycle.id, products.flatMap((product, index) => {
        const assignment = assignments[product.id];
        if (!assignment?.selected) return [];
        return [{ productId: product.id, capacity: assignment.capacity ? Number(assignment.capacity) : null, priceOverride: assignment.price ? Number(assignment.price) : null, isAvailable: true, sortOrder: index }];
      }));
      if (publish) await api.updateCycle(response.cycle.id, { status: "scheduled" });
      onSaved();
    } catch (reason) {
      setFormError(reason instanceof ApiError ? reason.message : "No pudimos guardar los cambios.");
    } finally {
      setSaving(null);
    }
  }

  const timeline = {
    orders: check.opensAt && check.closesAt
      ? `${weekdayDate.format(new Date(check.opensAt))}, ${shortTime.format(new Date(check.opensAt))} hasta ${weekdayDate.format(new Date(check.closesAt))}, ${shortTime.format(new Date(check.closesAt))}`
      : "Sin definir",
    delivery: check.startsAt && draft.to ? `${weekdayDate.format(new Date(check.startsAt))}, de ${draft.from} a ${draft.to}` : "Sin definir",
  };

  return (
    <div className="cycle-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="cycle-editor" role="dialog" aria-modal="true" aria-labelledby="cycle-editor-title">
        <header className="cycle-editor-header">
          <div>
            <p className="section-kicker">{record ? "Editar ciclo" : "Nuevo ciclo"}</p>
            <h2 id="cycle-editor-title">{draft.name.trim() || "Ciclo de venta"}</h2>
          </div>
          <button type="button" className="close-button" aria-label="Cerrar" onClick={onClose}><X size={20} /></button>
        </header>

        <div className="cycle-editor-body">
          <div className="cycle-steps">
            <section className="cycle-step">
              <h3><span>1</span> Nombre y mensaje</h3>
              <div className={`ui-field ${show("name") ? "has-error" : ""}`}>
                <label className="ui-field-label" htmlFor="cycle-name">Nombre del ciclo</label>
                <input id="cycle-name" className="ui-control" value={draft.name} maxLength={120} placeholder="Ej. Menú de la semana del 6 de octubre" onChange={(event) => set("name", event.target.value)} />
                {show("name") && <small className="ui-field-error" role="alert">{show("name")}</small>}
              </div>
              <div className="ui-field">
                <label className="ui-field-label" htmlFor="cycle-message">Mensaje para los clientes <em>Opcional</em></label>
                <textarea id="cycle-message" className="ui-control" rows={2} maxLength={500} value={draft.message} placeholder="Se muestra en la portada mientras el ciclo esté visible." onChange={(event) => set("message", event.target.value)} />
                <small className="ui-field-hint">{draft.message.length} de 500</small>
              </div>
            </section>

            <section className="cycle-step">
              <h3><span>2</span> ¿Cuándo se puede pedir?</h3>
              <p className="cycle-step-intro">Los pedidos se abren y se cierran solos en estas fechas. Horas de Ecuador.</p>
              <div className="cycle-step-grid">
                <DateTimeField legend="Se abre" date={draft.opensDate} time={draft.opensTime} onDateChange={(value) => set("opensDate", value)} onTimeChange={(value) => set("opensTime", value)} error={show("opensAt")} />
                <DateTimeField legend="Se cierra" date={draft.closesDate} time={draft.closesTime} minDate={draft.opensDate || undefined} onDateChange={(value) => set("closesDate", value)} onTimeChange={(value) => set("closesTime", value)} error={show("closesAt")} />
              </div>
              <div className="cycle-shortcuts">
                <button type="button" onClick={openNow}>Abrir desde ahora</button>
                <button type="button" onClick={closeNightBefore} disabled={!draft.date}>Cerrar la noche anterior a la entrega, 20:00</button>
              </div>
            </section>

            <section className={`cycle-step ${windowLocked ? "is-locked" : ""}`}>
              <h3><span>3</span> ¿Cuándo se entrega?</h3>
              {windowLocked
                ? <p className="cycle-lock-note"><Lock size={15} /> Ya hay pedidos con franja asignada, así que la ventana de entrega no se puede cambiar.</p>
                : <p className="cycle-step-intro">Un día y un rango de horas. El cliente elige una franja dentro de ese rango.</p>}
              <div className="cycle-window-row">
                <DatePicker label="Día de entrega" value={draft.date} min={draft.closesDate || undefined} onChange={(value) => set("date", value)} error={show("date")} disabled={windowLocked} />
                <TimeSelect label="Desde" value={draft.from} onChange={(value) => set("from", value)} disabled={windowLocked} />
                <TimeSelect label="Hasta" value={draft.to} onChange={(value) => set("to", value)} error={show("to")} disabled={windowLocked} />
              </div>
              <div className="cycle-window-row cycle-window-row-secondary">
                <Segmented label="Duración de cada franja" value={draft.slotMinutes} options={[{ value: 30, label: "30 minutos" }, { value: 60, label: "1 hora" }]} onChange={(value) => set("slotMinutes", value)} disabled={windowLocked} />
                <div className="ui-field">
                  <label className="ui-field-label" htmlFor="cycle-slot-capacity">Pedidos por franja <em>Opcional</em></label>
                  <input id="cycle-slot-capacity" className="ui-control" type="number" min="1" inputMode="numeric" placeholder="Sin límite" value={draft.slotCapacity} onChange={(event) => set("slotCapacity", event.target.value)} />
                </div>
              </div>
              {slots.length > 0 && !check.errors.to && (
                <div className="cycle-slot-preview">
                  <p>Así lo verá el cliente al pagar: {slots.length} {slots.length === 1 ? "franja" : "franjas"}{capacityPerSlot ? `, hasta ${capacityPerSlot} pedidos en cada una` : ""}.</p>
                  <div className="slot-grid">{slots.map((slot) => <span className="slot-chip" key={slot}><span>{slot}</span></span>)}</div>
                </div>
              )}
            </section>

            <section className="cycle-step">
              <h3><span>4</span> Cupos y modalidades</h3>
              <div className="cycle-modes" role="group" aria-label="Modalidades">
                <button type="button" aria-pressed={draft.pickup} className={`fulfillment-option ${draft.pickup ? "selected" : ""}`} onClick={() => set("pickup", !draft.pickup)}>
                  <Store size={21} /><div><strong>Retiro en el local</strong><span>El cliente pasa en su franja.</span></div>
                </button>
                <button type="button" aria-pressed={draft.delivery} className={`fulfillment-option ${draft.delivery ? "selected" : ""}`} onClick={() => set("delivery", !draft.delivery)}>
                  <Truck size={21} /><div><strong>Entrega a domicilio</strong><span>Gratis dentro de Ibarra.</span></div>
                </button>
              </div>
              {show("modes") && <small className="ui-field-error" role="alert">{show("modes")}</small>}
              <div className="ui-field cycle-global-capacity">
                <label className="ui-field-label" htmlFor="cycle-global-capacity">Cupo total de unidades del ciclo <em>Opcional</em></label>
                <input id="cycle-global-capacity" className="ui-control" type="number" min="1" inputMode="numeric" placeholder="Sin límite" value={draft.globalCapacity} onChange={(event) => set("globalCapacity", event.target.value)} />
                <small className="ui-field-hint">Suma de todos los productos. Además, cada producto puede tener su propio cupo abajo.</small>
              </div>
            </section>

            <section className="cycle-step">
              <h3><span>5</span> Productos del menú</h3>
              {!assignmentsReady ? <p className="cycle-step-intro">Cargando productos del ciclo…</p>
                : products.length === 0 ? <p className="cycle-step-intro">Primero crea productos activos en la sección Productos.</p>
                : <>
                  <div className="cycle-products-toolbar">
                    <label className="ui-control cycle-products-search"><Search size={16} aria-hidden="true" /><input value={search} placeholder="Buscar producto" aria-label="Buscar producto" onChange={(event) => setSearch(event.target.value)} /></label>
                    <button type="button" onClick={() => selectAll(true)}>Seleccionar todos</button>
                    <button type="button" onClick={() => selectAll(false)}>Ninguno</button>
                  </div>
                  <div className="cycle-products-head" aria-hidden="true"><span>{selectedIds.length} de {products.length} seleccionados</span><span>Cupo</span><span>Precio especial</span></div>
                  <ul className="cycle-products">
                    {visibleProducts.map((product) => {
                      const assignment = assignments[product.id] ?? { selected: false, capacity: "", price: "" };
                      return (
                        <li key={product.id} className={assignment.selected ? "is-selected" : undefined}>
                          <label><input type="checkbox" checked={assignment.selected} onChange={(event) => updateAssignment(product.id, { selected: event.target.checked })} /><span><strong>{product.name}</strong><small>{product.categoryName}, {money.format(Number(product.basePrice))}</small></span></label>
                          <input className="ui-control" type="number" min="1" inputMode="numeric" placeholder="Sin límite" aria-label={`Cupo de ${product.name}`} value={assignment.capacity} disabled={!assignment.selected} onChange={(event) => updateAssignment(product.id, { capacity: event.target.value })} />
                          <input className="ui-control" type="number" min="0" step="0.01" inputMode="decimal" placeholder={Number(product.basePrice).toFixed(2)} aria-label={`Precio especial de ${product.name}`} value={assignment.price} disabled={!assignment.selected} onChange={(event) => updateAssignment(product.id, { price: event.target.value })} />
                        </li>
                      );
                    })}
                    {visibleProducts.length === 0 && <li className="cycle-products-empty">Ningún producto coincide con la búsqueda.</li>}
                  </ul>
                </>}
            </section>
          </div>

          <aside className="cycle-summary" aria-label="Resumen del ciclo">
            <h3><CalendarClock size={18} /> Resumen</h3>
            <dl>
              <div><dt>Pedidos</dt><dd>{timeline.orders}{daysOpen ? <small>{daysOpen} {daysOpen === 1 ? "día" : "días"} abierto</small> : null}</dd></div>
              <div><dt>Entrega</dt><dd>{timeline.delivery}{check.startsAt && slots.length > 0 && !check.errors.to ? <small>{slots.length} franjas de {draft.slotMinutes} min{capacityPerSlot ? `, hasta ${slots.length * capacityPerSlot} pedidos en total` : ""}</small> : null}</dd></div>
              <div><dt>Modalidades</dt><dd>{[draft.pickup && "Retiro", draft.delivery && "Entrega a domicilio"].filter(Boolean).join(" y ") || "Ninguna"}</dd></div>
              <div><dt>Productos</dt><dd>{selectedIds.length} seleccionados{draft.globalCapacity ? <small>Cupo total: {draft.globalCapacity} unidades</small> : null}</dd></div>
            </dl>
            {touched && problems.length > 0 && (
              <div className="cycle-summary-problems" role="alert">
                <strong>Falta corregir</strong>
                <ul>{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
              </div>
            )}
            {(!touched || problems.length === 0) && <p className="cycle-summary-ok">{record ? "Los cambios se aplican al guardar." : "Guárdalo como borrador para seguir luego, o publícalo para que aparezca en la tienda."}</p>}
          </aside>
        </div>

        <footer className="cycle-editor-footer">
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div>
            <Button variant="ghost" onClick={onClose} disabled={saving !== null}>Cancelar</Button>
            {record ? (
              <Button onClick={() => void save(false)} disabled={saving !== null || !assignmentsReady}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => void save(false)} disabled={saving !== null}>{saving === "draft" ? "Guardando…" : "Guardar borrador"}</Button>
                <Button onClick={() => void save(true)} disabled={saving !== null}>{saving === "publish" ? "Publicando…" : "Guardar y publicar"}</Button>
              </>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
