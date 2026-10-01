import type { CSSProperties } from "react";

/** Placeholder block with a shimmer; sized by the caller so it matches the real element. */
export function Skeleton({ width, height, radius, className, style }: { width?: string | number; height?: string | number; radius?: string | number; className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={["skeleton", className].filter(Boolean).join(" ")} style={{ width, height, borderRadius: radius, ...style }} />;
}
