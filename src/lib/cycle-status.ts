import type { CycleStatus } from "@/lib/api/client";

/** Mirrors larocota-back/src/modules/cycles/cycle-status.ts. */
export const cycleStatusLabels: Record<CycleStatus, string> = {
  draft: "Borrador",
  scheduled: "Programado",
  open: "Abierto",
  closed: "Cerrado",
  fulfilled: "Cumplido",
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

/** Admin actions available from each status, with the verb shown on the button. */
export const cycleTransitions: Record<CycleStatus, Array<{ to: CycleStatus; label: string; confirm?: string }>> = {
  draft: [{ to: "scheduled", label: "Programar" }, { to: "cancelled", label: "Cancelar ciclo", confirm: "¿Cancelar este ciclo? No podrás reactivarlo." }],
  scheduled: [{ to: "open", label: "Abrir ahora" }, { to: "draft", label: "Volver a borrador" }, { to: "cancelled", label: "Cancelar ciclo", confirm: "¿Cancelar este ciclo? No podrás reactivarlo." }],
  open: [{ to: "closed", label: "Cerrar pedidos" }, { to: "cancelled", label: "Cancelar ciclo", confirm: "¿Cancelar este ciclo abierto? Los pedidos confirmados lo impiden." }],
  closed: [{ to: "fulfilled", label: "Marcar cumplido" }, { to: "cancelled", label: "Cancelar ciclo", confirm: "¿Cancelar este ciclo?" }],
  fulfilled: [],
  cancelled: [],
};
