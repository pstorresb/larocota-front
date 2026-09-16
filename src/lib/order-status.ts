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

export const money = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
export const longDate = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeZone: "America/Guayaquil" });
export const longDateTime = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeStyle: "short", timeZone: "America/Guayaquil" });
export const shortDateTime = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });
