"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, LogOut, PackageOpen, Settings, ShoppingBag, Tags, Users } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { api, ApiError, type AuthUser } from "@/lib/api/client";

const nav = [
  ["Resumen", "/admin", BarChart3],
  ["Pedidos", "/admin/orders", ShoppingBag],
  ["Productos", "/admin/products", PackageOpen],
  ["Categorías", "/admin/categories", Tags],
  ["Ciclos", "/admin/cycles", CalendarDays],
  ["Usuarios", "/admin/users", Users],
  ["Configuración", "/admin/settings", Settings],
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.me().then(({ user: sessionUser }) => {
      if (!active) return;
      if (sessionUser.role !== "admin" && sessionUser.role !== "superadmin") {
        router.replace("/account");
        return;
      }
      setUser(sessionUser);
      setLoading(false);
    }).catch((reason) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 401) router.replace("/login?next=/admin");
      else router.replace("/login");
    });
    return () => { active = false; };
  }, [router]);

  async function logout() {
    await api.logout().catch(() => undefined);
    router.replace("/login");
  }

  if (loading || !user) return <main className="admin-access-state"><span className="admin-loader" /><strong>Verificando acceso administrativo…</strong></main>;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-logo" href="/" aria-label="Ir a la tienda"><Image src="/brand/la-rocota-logo-final.png" alt="La Rocota" width={668} height={340} /></Link>
        <span className="admin-label">Administración</span>
        <nav aria-label="Administración">
          {nav.map(([label, href, Icon]) => {
            const isActive = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return <Link className={isActive ? "active" : ""} href={href} key={href}><Icon size={18} /> {label}</Link>;
          })}
        </nav>
        <button type="button" className="admin-logout" onClick={logout}><LogOut size={17} /> Cerrar sesión</button>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar"><div className="admin-context"><strong>Panel administrativo</strong><span>La Rocota · Ibarra</span></div><div className="admin-top-actions"><ThemeToggle /><Link href="/">Ver tienda</Link></div></header>
        {children}
      </div>
    </div>
  );
}
