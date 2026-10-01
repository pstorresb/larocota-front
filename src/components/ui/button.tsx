import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "on-brand" | "on-brand-ghost";
type Size = "sm" | "md" | "lg";

type BaseProps = { variant?: Variant; size?: Size; className?: string; children: ReactNode };
type LinkProps = BaseProps & { href: string; target?: string; rel?: string; "aria-label"?: string };
type NativeProps = BaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };

function classes(variant: Variant, size: Size, className?: string) {
  return ["btn", `btn-${variant}`, `btn-${size}`, className].filter(Boolean).join(" ");
}

/** Semantic button: renders a Next `Link` when `href` is given, a native button otherwise. */
export function Button(props: LinkProps | NativeProps) {
  const { variant = "primary", size = "md", className, children, ...rest } = props;
  const cls = classes(variant, size, className);
  if (typeof rest.href === "string") {
    const { href, target, rel, "aria-label": ariaLabel } = rest as Omit<LinkProps, keyof BaseProps>;
    return <Link className={cls} href={href} target={target} rel={rel} aria-label={ariaLabel}>{children}</Link>;
  }
  const native = { ...(rest as Omit<NativeProps, keyof BaseProps>) };
  delete native.href;
  const { type = "button", ...attributes } = native;
  return <button className={cls} type={type} {...attributes}>{children}</button>;
}
