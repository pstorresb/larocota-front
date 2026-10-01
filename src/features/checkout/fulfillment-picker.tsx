"use client";

import { ExternalLink, MapPin, Store, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { SlotPicker } from "@/features/checkout/slot-picker";
import type { CatalogCycle, FulfillmentType, PickupSettings } from "@/lib/api/client";

const modeCopy: Record<FulfillmentType, { title: string; hint: string }> = {
  pickup: { title: "Retiro en el local", hint: "Sin costo. Pasas en la franja que elijas." },
  delivery: { title: "Entrega a domicilio", hint: "Gratis dentro de Ibarra, en tu franja." },
};

type Props = {
  cycle: CatalogCycle;
  mode: FulfillmentType | null;
  onModeChange: (mode: FulfillmentType) => void;
  slotStartsAt: string | null;
  onSlotChange: (startsAt: string) => void;
  pickup: PickupSettings | null;
  /** Delivery address fields, rendered below the slot picker when the mode is delivery. */
  children: ReactNode;
};

/** Mode choice, slot choice and the place: the whole "how do you get your order" step. */
export function FulfillmentPicker({ cycle, mode, onModeChange, slotStartsAt, onSlotChange, pickup, children }: Props) {
  const modes = cycle.fulfillmentModes;
  return (
    <div className="fulfillment-picker">
      <div className="fulfillment-choices" role="radiogroup" aria-label="Modalidad de entrega">
        {modes.map((option) => (
          <button key={option} type="button" role="radio" aria-checked={mode === option} className={`fulfillment-option ${mode === option ? "selected" : ""}`} onClick={() => onModeChange(option)}>
            {option === "pickup" ? <Store size={21} /> : <Truck size={21} />}
            <div><strong>{modeCopy[option].title}</strong><span>{modeCopy[option].hint}</span></div>
            <b>Gratis</b>
          </button>
        ))}
      </div>

      {mode && <SlotPicker slots={cycle.slots} value={slotStartsAt} onChange={onSlotChange} verb={mode === "pickup" ? "retiras" : "recibes"} />}

      {mode === "pickup" && (
        <div className="location-card pickup-card">
          <div className="location-card-heading"><div><MapPin size={18} /><span><strong>Punto de retiro</strong><small>{pickup ? "Te avisamos por correo cuando esté listo." : "Te confirmaremos la dirección exacta por correo."}</small></span></div></div>
          {pickup ? (
            <dl className="pickup-details">
              <div><dt>Dirección</dt><dd>{pickup.addressLine}</dd></div>
              {pickup.reference && <div><dt>Referencia</dt><dd>{pickup.reference}</dd></div>}
              {pickup.instructions && <div><dt>Indicaciones</dt><dd>{pickup.instructions}</dd></div>}
            </dl>
          ) : <p className="location-status">Ibarra, Ecuador.</p>}
          {pickup?.mapUrl && <a className="text-link pickup-map-link" href={pickup.mapUrl} target="_blank" rel="noreferrer">Ver en el mapa <ExternalLink size={13} /></a>}
        </div>
      )}

      {mode === "delivery" && children}
    </div>
  );
}
