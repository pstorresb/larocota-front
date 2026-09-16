"use client";

import { Check, ChefHat, CircleCheckBig, PackageCheck, Truck, Wallet, XCircle } from "lucide-react";
import { useState } from "react";
import type { AdminOrderDetail, OrderStatus } from "@/lib/api/client";

type Station = { status: OrderStatus; label: string; icon: React.ComponentType<{ size?: number }> };

/** Operational stations after payment, in the order the kitchen works through them. */
function stationsFor(order: AdminOrderDetail): Station[] {
  const pickup = order.fulfillmentType === "pickup";
  return [
    { status: "confirmed", label: "Pago confirmado", icon: Wallet },
    { status: "in_preparation", label: "En preparación", icon: ChefHat },
    { status: "ready", label: pickup ? "Listo para retirar" : "Listo para salir", icon: PackageCheck },
    ...(pickup ? [] : [{ status: "out_for_delivery" as OrderStatus, label: "En camino", icon: Truck }]),
    { status: "delivered", label: pickup ? "Retirado" : "Entregado", icon: CircleCheckBig },
  ];
}

/** The single next operational move for an order, or null when there is none. */
export function nextOperationalStep(order: AdminOrderDetail): { status: OrderStatus; label: string } | null {
  const pickup = order.fulfillmentType === "pickup";
  switch (order.status) {
    case "confirmed": return { status: "in_preparation", label: "Iniciar preparación" };
    case "in_preparation": return { status: "ready", label: pickup ? "Marcar listo para retirar" : "Marcar listo para salir" };
    case "ready": return pickup ? { status: "delivered", label: "Marcar retirado" } : { status: "out_for_delivery", label: "Marcar en camino" };
    case "out_for_delivery": return { status: "delivered", label: "Marcar entregado" };
    default: return null;
  }
}

/** Mirrors the API state machine: cancellation is possible until the order leaves the kitchen. */
export function canCancel(order: AdminOrderDetail) {
  return ["draft", "payment_pending", "payment_review", "payment_rejected", "confirmed", "in_preparation"].includes(order.status);
}

type Props = {
  order: AdminOrderDetail;
  busy: boolean;
  onAdvance: (status: OrderStatus) => void;
  onCancel: (reason: string) => void;
};

export function OrderProgress({ order, busy, onAdvance, onCancel }: Props) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const stations = stationsFor(order);
  const currentIndex = stations.findIndex((station) => station.status === order.status);
  const beforePayment = currentIndex === -1 && order.status !== "cancelled";
  const next = nextOperationalStep(order);
  const finished = order.status === "delivered";

  if (order.status === "cancelled") {
    return (
      <section className="order-detail-section order-progress">
        <div className="order-progress-heading"><h3>Avance del pedido</h3></div>
        <p className="order-progress-note order-progress-note-cancelled"><XCircle size={16} /> Este pedido fue cancelado y sus cupos quedaron liberados.</p>
      </section>
    );
  }

  return (
    <section className="order-detail-section order-progress">
      <div className="order-progress-heading">
        <h3>Avance del pedido</h3>
        <p>{beforePayment ? "Se habilita cuando confirmes el pago." : finished ? "Completado." : "El cliente recibe un correo con cada cambio."}</p>
      </div>

      <ol className="order-rail" aria-label="Estaciones del pedido">
        {stations.map((station, index) => {
          const state = beforePayment ? "pending" : index < currentIndex || finished ? "done" : index === currentIndex ? "current" : "pending";
          const Icon = station.icon;
          return (
            <li key={station.status} className={`order-rail-station is-${state}`} aria-current={state === "current" ? "step" : undefined}>
              <span className="order-rail-node">{state === "done" ? <Check size={15} /> : <Icon size={15} />}</span>
              <span className="order-rail-label">{station.label}</span>
            </li>
          );
        })}
      </ol>

      {(next || canCancel(order)) && (
        <div className="order-progress-actions">
          {next && <button type="button" className="order-advance" disabled={busy} onClick={() => onAdvance(next.status)}>{busy ? "Actualizando…" : next.label}</button>}
          {canCancel(order) && !cancelling && <button type="button" className="order-cancel-link" disabled={busy} onClick={() => setCancelling(true)}>Cancelar pedido</button>}
        </div>
      )}

      {cancelling && (
        <div className="order-cancel-panel">
          <label>Motivo de la cancelación<textarea value={reason} rows={2} maxLength={500} placeholder="Ej. El cliente pidió cancelar por WhatsApp." onChange={(event) => setReason(event.target.value)} /></label>
          <small>Se libera el cupo reservado y el cliente recibe un correo con este motivo.</small>
          <div>
            <button type="button" className="order-cancel-confirm" disabled={busy || reason.trim().length < 5} onClick={() => { onCancel(reason.trim()); setCancelling(false); setReason(""); }}>{busy ? "Cancelando…" : "Confirmar cancelación"}</button>
            <button type="button" className="order-cancel-back" disabled={busy} onClick={() => { setCancelling(false); setReason(""); }}>Volver</button>
          </div>
        </div>
      )}
    </section>
  );
}
