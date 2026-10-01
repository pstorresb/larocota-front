"use client";

import type { CatalogSlot } from "@/lib/api/client";
import { slotDayHeading, slotTimes } from "@/lib/order-status";

type Props = {
  slots: CatalogSlot[];
  value: string | null;
  onChange: (startsAt: string) => void;
  /** "recibes" (delivery) or "retiras" (pickup); only changes the helper sentence. */
  verb: "recibes" | "retiras";
};

/** Grid of fulfillment slots for the cycle. Full slots stay visible but disabled so the customer sees why. */
export function SlotPicker({ slots, value, onChange, verb }: Props) {
  const first = slots[0];
  const allFull = slots.length > 0 && slots.every((slot) => slot.remaining === 0);
  return (
    <fieldset className="slot-picker">
      <legend>{first ? `Elige tu franja del ${slotDayHeading(first.startsAt).toLowerCase()}` : "Elige tu franja"}</legend>
      <p className="slot-help">Es la hora aproximada en que {verb} tu pedido.</p>
      {slots.length === 0 ? (
        <p className="form-error" role="alert">Este ciclo aún no tiene franjas de entrega.</p>
      ) : (
        <div className="slot-grid" role="radiogroup" aria-label="Franja horaria">
          {slots.map((slot) => {
            const full = slot.remaining === 0;
            const selected = value === slot.startsAt;
            const scarce = slot.remaining !== null && slot.remaining > 0 && slot.remaining <= 3;
            return (
              <button
                key={slot.startsAt}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`slot-chip ${selected ? "selected" : ""} ${full ? "full" : ""}`}
                disabled={full}
                onClick={() => onChange(slot.startsAt)}
              >
                <span>{slotTimes(slot.startsAt, slot.endsAt)}</span>
                {full ? <small>Lleno</small> : scarce ? <small>Quedan {slot.remaining}</small> : null}
              </button>
            );
          })}
        </div>
      )}
      {allFull && <p className="form-error" role="alert">Todas las franjas están llenas para este ciclo. Escríbenos y buscamos una opción.</p>}
    </fieldset>
  );
}
