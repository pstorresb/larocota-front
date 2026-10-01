"use client";

import Link from "next/link";
import { Store, Truck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError, type AdminCycle, type AdminCycleSlots } from "@/lib/api/client";
import { orderStatusLabel, slotDayHeading, slotTimes } from "@/lib/order-status";

/** Occupancy per fulfillment slot, with the orders inside each one. */
export function CycleSlots({ cycle, onClose }: { cycle: AdminCycle; onClose: () => void }) {
  const [data, setData] = useState<AdminCycleSlots | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.adminCycleSlots(cycle.id)
      .then((result) => { if (active) setData(result); })
      .catch((reason) => { if (active) setError(reason instanceof ApiError ? reason.message : "No pudimos cargar las franjas."); });
    return () => { active = false; };
  }, [cycle.id]);

  const totalOrders = data ? data.slots.reduce((sum, slot) => sum + slot.orders, 0) + data.unassigned.length : 0;

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="admin-modal admin-resource-modal" role="dialog" aria-modal="true" aria-labelledby="cycle-slots-title">
        <header>
          <div>
            <span className="section-kicker">Ocupación por franja</span>
            <h2 id="cycle-slots-title">{cycle.name}</h2>
            <p>{slotDayHeading(cycle.fulfillmentStartsAt)}, franjas de {cycle.slotMinutes} minutos{cycle.slotCapacity ? `, hasta ${cycle.slotCapacity} pedidos por franja` : ", sin límite por franja"}. {totalOrders} pedidos activos.</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="cycle-slots-body">
          {error && <p className="form-error" role="alert">{error}</p>}
          {!data && !error && <p className="admin-skeleton">Cargando franjas…</p>}
          {data && data.slots.map((slot) => {
            const ratio = slot.capacity ? Math.min(1, slot.orders / slot.capacity) : 0;
            return (
              <article className={`slot-row ${slot.capacity && slot.orders >= slot.capacity ? "is-full" : ""}`} key={slot.startsAt}>
                <div className="slot-row-head">
                  <strong>{slotTimes(slot.startsAt, slot.endsAt)}</strong>
                  <span>{slot.orders}{slot.capacity ? ` de ${slot.capacity}` : ""} {slot.orders === 1 ? "pedido" : "pedidos"}</span>
                  <small><Store size={13} /> {slot.pickup} <Truck size={13} /> {slot.delivery}</small>
                </div>
                {slot.capacity && <div className="slot-bar" aria-hidden="true"><span style={{ width: `${ratio * 100}%` }} /></div>}
                {slot.items.length > 0 && (
                  <ul className="slot-orders">
                    {slot.items.map((item) => (
                      <li key={item.id}><Link href={`/admin/orders?search=${encodeURIComponent(item.orderNumber)}`}>{item.orderNumber}</Link> {item.customerName} <em>{orderStatusLabel(item.status)}</em></li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
          {data && data.unassigned.length > 0 && (
            <article className="slot-row">
              <div className="slot-row-head"><strong>Sin franja</strong><span>{data.unassigned.length} pedidos anteriores a las franjas</span></div>
              <ul className="slot-orders">{data.unassigned.map((item) => <li key={item.id}><Link href={`/admin/orders?search=${encodeURIComponent(item.orderNumber)}`}>{item.orderNumber}</Link> {item.customerName} <em>{orderStatusLabel(item.status)}</em></li>)}</ul>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
