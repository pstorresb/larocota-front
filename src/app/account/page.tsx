"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Clock3, LogOut, PackageCheck, Settings2, ShoppingBag, UserRound } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { api, ApiError, type AuthUser, type CustomerOrder } from "@/lib/api/client";

const statusLabels: Record<string, string> = {
  draft: "Borrador", payment_pending: "Pago pendiente", payment_review: "Pago en revisión", payment_rejected: "Pago rechazado",
  confirmed: "Confirmado", in_preparation: "En preparación", ready: "Listo", out_for_delivery: "En reparto", delivered: "Entregado", cancelled: "Cancelado",
};

function money(value: string) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(value));
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  useEffect(() => {
    let active = true;
    api.me().then(async ({ user: sessionUser }) => {
      if (!active) return;
      if (sessionUser.role === "admin" || sessionUser.role === "superadmin") { router.replace("/admin"); return; }
      setUser(sessionUser);
      const response = await api.myOrders();
      if (active) setOrders(response.orders);
    }).catch((reason) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 401) router.replace("/login?next=/account");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  async function logout() {
    await api.logout().catch(() => undefined);
    router.replace("/login");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await api.updateProfile({ firstName: String(data.get("firstName")), lastName: String(data.get("lastName")), phone: String(data.get("phone")) });
      setUser(response.user);
      setProfileMessage("Tus datos quedaron guardados.");
      const next = new URLSearchParams(window.location.search).get("next");
      if (next?.startsWith("/") && !next.startsWith("//") && next !== "/account") router.replace(next);
    } catch (reason) {
      setProfileMessage(reason instanceof ApiError ? reason.message : "No pudimos guardar tus datos.");
    } finally { setSavingProfile(false); }
  }

  if (loading || !user) return <main className="account-page"><SiteHeader backHref="/#menu" /><div className="account-session-state">Cargando tu cuenta…</div></main>;
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  return (
    <main className="account-page">
      <SiteHeader backHref="/#menu" />
      <div className="account-shell">
        <aside className="account-nav"><div className="account-person"><span>{initials}</span><div><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small></div></div><nav><a className="active" href="#pedidos"><PackageCheck size={18} /> Mis pedidos</a><a href="#perfil"><UserRound size={18} /> Mi perfil</a><a href="#preferencias"><Settings2 size={18} /> Preferencias</a></nav><button type="button" className="account-logout" onClick={logout}><LogOut size={18} /> Cerrar sesión</button></aside>
        <section className="account-content" id="pedidos"><p className="section-kicker">Mi cuenta</p><h1>Mis pedidos</h1><p>Revisa el estado y los detalles de tus compras.</p>
          {orders.length ? <div className="customer-orders">{orders.map((order) => <article className="order-card" key={order.id}><div className="order-card-top"><div><span className="status-badge"><Clock3 size={14} /> {statusLabels[order.status] ?? order.status}</span><h2>{order.orderNumber}</h2><small>Creado el {new Intl.DateTimeFormat("es-EC", { dateStyle: "long" }).format(new Date(order.createdAt))}</small></div><strong>{money(order.total)}</strong></div><div className="order-card-products">{order.items.map((item) => <span key={`${order.id}-${item.name}`}>{item.quantity} × {item.name}</span>)}</div><div className="order-card-footer"><div><b>Entrega</b><span>{new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeStyle: "short" }).format(new Date(order.fulfillmentAt))} · {order.fulfillmentType === "pickup" ? "Retiro" : "Entrega"}</span></div></div></article>)}</div> : <div className="account-empty"><ShoppingBag size={28} /><h2>Aún no tienes pedidos</h2><p>Cuando completes una compra, podrás seguirla desde aquí.</p><Link href="/#menu">Explorar el menú</Link></div>}
          <section className={`account-profile ${!user.phone ? "profile-incomplete" : ""}`} id="perfil"><div className="account-profile-heading"><div><h2>{user.phone ? "Mi perfil" : "Completa tu cuenta"}</h2><p>{user.phone ? "Mantén actualizados tus datos de contacto." : "Solo falta tu teléfono para coordinar las entregas."}</p></div>{!user.phone && <span>Último paso</span>}</div><form className="account-profile-form" onSubmit={saveProfile}><label>Nombre<input name="firstName" required minLength={2} defaultValue={user.firstName} autoComplete="given-name" /></label><label>Apellido<input name="lastName" required minLength={2} defaultValue={user.lastName} autoComplete="family-name" /></label><label className="wide">Correo electrónico<input value={user.email} disabled /></label><label className="wide">Teléfono<input name="phone" required inputMode="numeric" pattern="0[0-9]{9}" maxLength={10} defaultValue={user.phone ?? ""} autoComplete="tel" title="Ingresa 10 dígitos en formato 0XXXXXXXXX" placeholder="0990000000" onChange={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 10); }} /><small>Ingresa 10 dígitos: 0XXXXXXXXX. Lo usaremos para coordinar tu pedido y entrega.</small></label>{profileMessage && <p className="profile-message" role="status">{profileMessage}</p>}<button type="submit" disabled={savingProfile}>{savingProfile ? "Guardando…" : "Guardar mis datos"}</button></form></section>
        </section>
      </div>
    </main>
  );
}
