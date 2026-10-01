import type { OrderStatus } from "@/lib/api/client";

/** Customer-facing labels for every order status. Mirrors larocota-back/src/modules/orders/state-machine.ts. */
export const orderStatusLabels: Record<OrderStatus, string> = {
  draft: "Borrador",
  payment_pending: "Pago pendiente",
  payment_review: "Pago en revisión",
  payment_rejected: "Comprobante rechazado",
  confirmed: "Confirmado",
  in_preparation: "En preparación",
  ready: "Listo",
  out_for_delivery: "En reparto",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export function orderStatusLabel(status: string) {
  return orderStatusLabels[status as OrderStatus] ?? status;
}

// Every formatter pins America/Guayaquil so server and client output match (no hydration mismatch)
// and customers always see Ecuador time regardless of their device.
const TZ = "America/Guayaquil";
export const money = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
export const longDate = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeZone: TZ });
export const longDateTime = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeStyle: "short", timeZone: TZ });
export const shortDateTime = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: TZ });
/** "viernes 3 de octubre" */
export const weekdayLongDate = new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
/** "vie 3 oct" */
export const weekdayDate = new Intl.DateTimeFormat("es-EC", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
/** "11:30" */
export const shortTime = new Intl.DateTimeFormat("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });

function toDate(value: string | Date) { return value instanceof Date ? value : new Date(value); }

/** "vie 3 oct, 12:00–12:30" */
export function slotRange(startsAt: string | Date, endsAt: string | Date) {
  return `${weekdayDate.format(toDate(startsAt))}, ${shortTime.format(toDate(startsAt))}–${shortTime.format(toDate(endsAt))}`;
}

/** "12:00–12:30" */
export function slotTimes(startsAt: string | Date, endsAt: string | Date) {
  return `${shortTime.format(toDate(startsAt))}–${shortTime.format(toDate(endsAt))}`;
}

/** "Viernes 3 de octubre" */
export function slotDayHeading(value: string | Date) {
  const text = weekdayLongDate.format(toDate(value));
  return text.charAt(0).toUpperCase() + text.slice(1);
}
