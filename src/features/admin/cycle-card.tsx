"use client";

import { Check, MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminCycle } from "@/lib/api/client";
import { cycleStages, cycleStatusLabels, cycleStatusSentence, cycleStatusTone } from "@/lib/cycle-status";
import { shortTime, slotTimes, weekdayDate } from "@/lib/order-status";

export type CycleAction = "publish" | "open-now" | "close-now" | "reopen" | "fulfill" | "to-draft" | "cancel" | "edit" | "slots" | "repeat" | "delete";

type Props = {
  cycle: AdminCycle;
  inStorefront: boolean;
  busy: boolean;
  error?: string | null;
  onAction: (action: CycleAction) => void;
};

/** Primary moves for the current status: the one thing the admin most likely wants next. */
function primaryActions(cycle: AdminCycle): Array<{ action: CycleAction; label: string; quiet?: boolean }> {
  switch (cycle.status) {
    case "draft": return [{ action: "publish", label: "Publicar" }];
    case "scheduled": return [{ action: "open-now", label: "Abrir ahora" }];
    case "open": return [{ action: "close-now", label: "Cerrar pedidos ahora" }];
    case "closed": return [{ action: "fulfill", label: "Marcar como entregado" }, { action: "reopen", label: "Reabrir pedidos", quiet: true }];
    default: return [];
  }
}

function secondaryActions(cycle: AdminCycle): Array<{ action: CycleAction; label: string; danger?: boolean }> {
  const live = cycle.status !== "fulfilled" && cycle.status !== "cancelled";
  return [
    ...(live ? [{ action: "edit" as const, label: "Editar" }] : []),
    { action: "slots" as const, label: "Ver franjas y pedidos" },
    { action: "repeat" as const, label: "Repetir la próxima semana" },
    ...(cycle.status === "scheduled" ? [{ action: "to-draft" as const, label: "Volver a borrador" }] : []),
    ...(live ? [{ action: "cancel" as const, label: "Cancelar ciclo", danger: true }] : []),
    ...(cycle.orderCount === 0 ? [{ action: "delete" as const, label: "Eliminar", danger: true }] : []),
  ];
}

export function CycleCard({ cycle, inStorefront, busy, error, onAction }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const currentIndex = cycleStages.indexOf(cycle.status);
  const cancelled = cycle.status === "cancelled";

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: MouseEvent) => { if (!menu.current?.contains(event.target as Node)) setMenuOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  return (
    <article className={`cycle-card ${cancelled ? "is-cancelled" : ""}`}>
      <div className="cycle-card-top">
        <div className="cycle-card-title">
          <h3>{cycle.name}</h3>
          <Badge tone={cycleStatusTone[cycle.status]}>{cycleStatusLabels[cycle.status]}</Badge>
          {inStorefront && <Badge tone="brand">En la tienda ahora</Badge>}
        </div>
        <div className="cycle-card-actions">
          {primaryActions(cycle).map((item) => (
            <Button key={item.action} size="sm" variant={item.quiet ? "secondary" : "primary"} disabled={busy} onClick={() => onAction(item.action)}>{item.label}</Button>
          ))}
          <div className="cycle-menu" ref={menu}>
            <button type="button" className="icon-button" aria-label={`Más acciones para ${cycle.name}`} aria-haspopup="menu" aria-expanded={menuOpen} disabled={busy} onClick={() => setMenuOpen((open) => !open)}><MoreHorizontal size={19} /></button>
            {menuOpen && (
              <div className="cycle-menu-list" role="menu">
                {secondaryActions(cycle).map((item) => (
                  <button key={item.action} type="button" role="menuitem" className={item.danger ? "is-danger" : undefined} onClick={() => { setMenuOpen(false); onAction(item.action); }}>{item.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {!cancelled && (
        <ol className="cycle-stages" aria-label={`Etapa actual: ${cycleStatusLabels[cycle.status]}`}>
          {cycleStages.map((stage, index) => (
            <li key={stage} className={index < currentIndex ? "is-done" : index === currentIndex ? "is-current" : undefined} aria-current={index === currentIndex ? "step" : undefined}>
              <span>{index < currentIndex ? <Check size={12} /> : null}</span>{cycleStatusLabels[stage]}
            </li>
          ))}
        </ol>
      )}

      <p className="cycle-card-sentence">{cycleStatusSentence(cycle)}</p>

      <dl className="cycle-card-facts">
        <div><dt>Pedidos</dt><dd>{weekdayDate.format(new Date(cycle.opensAt))}, {shortTime.format(new Date(cycle.opensAt))} hasta {weekdayDate.format(new Date(cycle.closesAt))}, {shortTime.format(new Date(cycle.closesAt))}</dd></div>
        <div><dt>Entrega</dt><dd>{weekdayDate.format(new Date(cycle.fulfillmentStartsAt))}, {slotTimes(cycle.fulfillmentStartsAt, cycle.fulfillmentEndsAt)}, franjas de {cycle.slotMinutes} min</dd></div>
        <div><dt>Menú</dt><dd>{cycle.productCount} productos, {cycle.activeOrderCount} {cycle.activeOrderCount === 1 ? "pedido" : "pedidos"}</dd></div>
      </dl>

      {error && <p className="form-error" role="alert">{error}</p>}
    </article>
  );
}
