import type { ReactNode } from "react";

type Tone = "brand" | "neutral" | "ok" | "warn" | "soldout";

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={["badge", `badge-${tone}`, className].filter(Boolean).join(" ")}>{children}</span>;
}
