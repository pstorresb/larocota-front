"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateTimeField } from "@/components/ui/date-time-field";
import { CycleCard, type CycleAction } from "@/features/admin/cycle-card";
import { CycleEditor } from "@/features/admin/cycle-editor";
import { CycleSlots } from "@/features/admin/cycle-slots";
import { api, ApiError, type AdminCycle, type AdminProduct } from "@/lib/api/client";
import { cycleStageHelp, cycleStatusLabels, storefrontCycleId } from "@/lib/cycle-status";
import { fromDateAndTime, toDateOnly } from "@/lib/datetime-local";

type Dialog = { kind: "close-now" | "cancel" | "delete" | "reopen" | "fulfill"; cycle: AdminCycle };

const dialogCopy: Record<Dialog["kind"], { title: string; body: string; confirm: string }> = {
  "close-now": { title: "¿Cerrar los pedidos ahora?", body: "Los clientes dejarán de poder pedir en este ciclo. Los pedidos ya hechos se mantienen.", confirm: "Cerrar pedidos" },
  cancel: { title: "¿Cancelar este ciclo?", body: "Saldrá de la tienda y no se puede reactivar. Si tiene pedidos confirmados, primero hay que entregarlos o cancelarlos.", confirm: "Cancelar ciclo" },
  delete: { title: "¿Eliminar este ciclo?", body: "Se borra por completo. Solo es posible porque no tiene pedidos.", confirm: "Eliminar" },
  reopen: { title: "Reabrir pedidos", body: "Elige hasta cuándo se podrá pedir. Debe ser una fecha futura y anterior a la entrega.", confirm: "Reabrir pedidos" },
  fulfill: { title: "¿Marcar el ciclo como entregado?", body: "Pasa al historial. Hazlo cuando hayas entregado todos los pedidos.", confirm: "Marcar como entregado" },
};

const groups: Array<{ title: string; hint: string; match: (cycle: AdminCycle) => boolean; collapsed?: boolean }> = [
  { title: "En curso", hint: "Recibiendo pedidos o pendientes de entrega.", match: (cycle) => cycle.status === "open" || cycle.status === "closed" },
  { title: "Próximos", hint: "Publicados; se abren solos en su fecha.", match: (cycle) => cycle.status === "scheduled" },
  { title: "Borradores", hint: "Solo los ves tú.", match: (cycle) => cycle.status === "draft" },
  { title: "Historial", hint: "Entregados y cancelados.", match: (cycle) => cycle.status === "fulfilled" || cycle.status === "cancelled", collapsed: true },
];

export function CycleManager() {
  const [cycles, setCycles] = useState<AdminCycle[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState<{ record: AdminCycle | null } | null>(null);
  const [slotsFor, setSlotsFor] = useState<AdminCycle | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [reopen, setReopen] = useState({ date: "", time: "20:00" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  const fetchAll = () => Promise.all([api.adminCycles(), api.adminProducts()]);
  function apply([cycleData, productData]: Awaited<ReturnType<typeof fetchAll>>) {
    setCycles(cycleData.cycles);
    setProducts(productData.products.filter((item) => item.isActive));
  }

  async function reload() {
    try { apply(await fetchAll()); setLoadError(""); }
    catch { setLoadError("No pudimos cargar los ciclos."); }
  }

  useEffect(() => {
    let active = true;
    fetchAll()
      .then((data) => { if (active) apply(data); })
      .catch(() => { if (active) setLoadError("No pudimos cargar los ciclos."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Initial load only; later refreshes go through `reload()` from event handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Runs a mutation for one cycle, reporting failures inside that cycle's card. */
  async function run(cycle: AdminCycle, task: () => Promise<unknown>) {
    setBusyId(cycle.id);
    setCardErrors((current) => ({ ...current, [cycle.id]: "" }));
    try { await task(); await reload(); return true; }
    catch (reason) {
      const message = reason instanceof ApiError ? reason.message : "No pudimos completar la acción.";
      setCardErrors((current) => ({ ...current, [cycle.id]: message }));
      return message;
    } finally { setBusyId(null); }
  }

  function onAction(cycle: AdminCycle, action: CycleAction) {
    switch (action) {
      case "edit": setEditor({ record: cycle }); break;
      case "slots": setSlotsFor(cycle); break;
      case "publish": void run(cycle, () => api.updateCycle(cycle.id, { status: "scheduled" })); break;
      case "open-now": void run(cycle, () => api.updateCycle(cycle.id, { status: "open", opensAt: new Date().toISOString() })); break;
      case "to-draft": void run(cycle, () => api.updateCycle(cycle.id, { status: "draft" })); break;
      case "repeat": void run(cycle, () => api.duplicateCycle(cycle.id)); break;
      case "reopen":
        setReopen({ date: toDateOnly(new Date()), time: "20:00" });
        setDialogError("");
        setDialog({ kind: "reopen", cycle });
        break;
      default:
        setDialogError("");
        setDialog({ kind: action, cycle });
    }
  }

  async function confirmDialog() {
    if (!dialog) return;
    const { kind, cycle } = dialog;
    let task: () => Promise<unknown>;
    if (kind === "close-now") task = () => api.updateCycle(cycle.id, { status: "closed" });
    else if (kind === "cancel") task = () => api.updateCycle(cycle.id, { status: "cancelled" });
    else if (kind === "fulfill") task = () => api.updateCycle(cycle.id, { status: "fulfilled" });
    else if (kind === "delete") task = () => api.deleteCycle(cycle.id);
    else {
      const closesAt = fromDateAndTime(reopen.date, reopen.time);
      if (!closesAt) { setDialogError("Elige la nueva fecha y hora de cierre."); return; }
      task = () => api.updateCycle(cycle.id, { status: "open", closesAt });
    }
    const result = await run(cycle, task);
    if (result === true) setDialog(null);
    else setDialogError(result);
  }

  const storefrontId = storefrontCycleId(cycles);

  return (
    <main className="admin-dashboard admin-list-page">
      <div className="admin-heading">
        <div><p className="section-kicker">Publicación</p><h1>Ciclos de venta</h1><p>Cada ciclo abre pedidos unos días y entrega en una ventana dividida en franjas.</p></div>
        <button type="button" onClick={() => setEditor({ record: null })}><Plus size={16} /> Crear ciclo</button>
      </div>

      <details className="cycle-help">
        <summary>Cómo funcionan los estados</summary>
        <table>
          <thead><tr><th>Estado</th><th>Qué ven los clientes</th><th>Cómo avanza</th></tr></thead>
          <tbody>{cycleStageHelp.map((row) => <tr key={row.status}><th>{cycleStatusLabels[row.status]}</th><td>{row.customer}</td><td>{row.next}</td></tr>)}</tbody>
        </table>
        <p>La tienda muestra un solo ciclo: el que está abierto o, si no hay, el próximo programado.</p>
      </details>

      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {loading ? <div className="admin-skeleton">Cargando…</div>
        : cycles.length === 0 ? <div className="admin-panel admin-empty-state"><strong>Aún no hay ciclos</strong><span>Crea el primero para publicar el menú.</span></div>
        : groups.map((group) => {
          const items = cycles.filter(group.match);
          if (items.length === 0) return null;
          const cards = items.map((cycle) => (
            <CycleCard key={cycle.id} cycle={cycle} inStorefront={cycle.id === storefrontId} busy={busyId === cycle.id} error={cardErrors[cycle.id]} onAction={(action) => onAction(cycle, action)} />
          ));
          return group.collapsed ? (
            <details className="cycle-group" key={group.title}>
              <summary><h2>{group.title}</h2><span>{items.length} {items.length === 1 ? "ciclo" : "ciclos"}. {group.hint}</span></summary>
              <div className="cycle-group-list">{cards}</div>
            </details>
          ) : (
            <section className="cycle-group" key={group.title}>
              <header><h2>{group.title}</h2><span>{group.hint}</span></header>
              <div className="cycle-group-list">{cards}</div>
            </section>
          );
        })}

      {slotsFor && <CycleSlots cycle={slotsFor} onClose={() => setSlotsFor(null)} />}

      {editor && (
        <CycleEditor
          key={editor.record?.id ?? "new"}
          record={editor.record}
          products={products}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); void reload(); }}
        />
      )}

      {dialog && (
        <ConfirmDialog
          title={dialogCopy[dialog.kind].title}
          body={<p><strong>{dialog.cycle.name}.</strong> {dialogCopy[dialog.kind].body}</p>}
          confirmLabel={dialogCopy[dialog.kind].confirm}
          busy={busyId === dialog.cycle.id}
          error={dialogError}
          onConfirm={() => void confirmDialog()}
          onCancel={() => setDialog(null)}
        >
          {dialog.kind === "reopen" && (
            <DateTimeField
              legend="Nuevo cierre de pedidos"
              date={reopen.date}
              time={reopen.time}
              minDate={toDateOnly(new Date())}
              maxDate={toDateOnly(dialog.cycle.fulfillmentStartsAt)}
              onDateChange={(date) => setReopen((current) => ({ ...current, date }))}
              onTimeChange={(time) => setReopen((current) => ({ ...current, time }))}
            />
          )}
        </ConfirmDialog>
      )}
    </main>
  );
}
