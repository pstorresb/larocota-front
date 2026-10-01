import type { AdminCycle, CycleStatus } from "@/lib/api/client";
import { shortTime, slotTimes, weekdayDate } from "@/lib/order-status";

/** Mirrors larocota-back/src/modules/cycles/cycle-status.ts. */
export const cycleStatusLabels: Record<CycleStatus, string> = {
  draft: "Borrador",
  scheduled: "Programado",
  open: "Abierto",
  closed: "Cerrado",
  fulfilled: "Entregado",
  cancelled: "Cancelado",
};

export const cycleStatusTone: Record<CycleStatus, "neutral" | "ok" | "brand" | "warn" | "soldout"> = {
  draft: "neutral",
  scheduled: "warn",
  open: "ok",
  closed: "brand",
  fulfilled: "neutral",
  cancelled: "soldout",
};

/** The path a cycle normally walks. `cancelled` sits outside it. */
export const cycleStages: CycleStatus[] = ["draft", "scheduled", "open", "closed", "fulfilled"];

export const cycleStageHelp: Array<{ status: CycleStatus; customer: string; next: string }> = [
  { status: "draft", customer: "No lo ve nadie.", next: "Tú lo publicas cuando esté listo." },
  { status: "scheduled", customer: "Ven el menú con la fecha de apertura.", next: "Se abre solo al llegar la apertura." },
  { status: "open", customer: "Pueden hacer pedidos.", next: "Se cierra solo al llegar el cierre." },
  { status: "closed", customer: "Ya no pueden pedir.", next: "Tú lo marcas como entregado al terminar." },
  { status: "fulfilled", customer: "Sale de la tienda.", next: "Queda en el historial." },
];

function when(value: string) {
  return `${weekdayDate.format(new Date(value))} a las ${shortTime.format(new Date(value))}`;
}

/** One sentence saying what the cycle is doing now and what will happen on its own. */
export function cycleStatusSentence(cycle: AdminCycle, now = new Date()) {
  const delivery = `${weekdayDate.format(new Date(cycle.fulfillmentStartsAt))}, ${slotTimes(cycle.fulfillmentStartsAt, cycle.fulfillmentEndsAt)}`;
  switch (cycle.status) {
    case "draft":
      return "Los clientes aún no lo ven. Publícalo cuando esté listo.";
    case "scheduled":
      return new Date(cycle.opensAt) <= now
        ? "Publicado. Los pedidos se abren en menos de un minuto."
        : `Visible en la tienda como próximo menú. Los pedidos se abren solos el ${when(cycle.opensAt)}.`;
    case "open":
      return new Date(cycle.opensAt) > now
        ? `Marcado como abierto, pero la apertura es el ${when(cycle.opensAt)}. Usa «Abrir ahora» o espera esa fecha.`
        : `Recibiendo pedidos. Se cierra solo el ${when(cycle.closesAt)}.`;
    case "closed":
      return `Pedidos cerrados. Entrega el ${delivery}.`;
    case "fulfilled":
      return `Entregado el ${weekdayDate.format(new Date(cycle.fulfillmentStartsAt))}.`;
    case "cancelled":
      return "Cancelado. No aparece en la tienda.";
  }
}

/** The cycle the storefront is showing, using the same rule as GET /catalog. */
export function storefrontCycleId(cycles: AdminCycle[], now = new Date()) {
  const open = cycles
    .filter((cycle) => cycle.status === "open" && new Date(cycle.opensAt) <= now && new Date(cycle.closesAt) > now)
    .sort((a, b) => a.opensAt.localeCompare(b.opensAt))[0];
  if (open) return open.id;
  const scheduled = cycles
    .filter((cycle) => cycle.status === "scheduled" && new Date(cycle.closesAt) > now)
    .sort((a, b) => a.opensAt.localeCompare(b.opensAt))[0];
  return scheduled?.id ?? null;
}
