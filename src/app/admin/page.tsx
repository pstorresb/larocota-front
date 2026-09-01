"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3, DollarSign, PackageCheck, ShoppingBag, Users } from "lucide-react";
import { api, type AdminOrder } from "@/lib/api/client";

type DashboardData = Awaited<ReturnType<typeof api.adminDashboard>>;

const statusLabels: Record<string, string> = {
  draft: "Borrador", payment_pending: "Pago pendiente", payment_review: "Pago en revisión", payment_rejected: "Pago rechazado",
  confirmed: "Confirmado", in_preparation: "En preparación", ready: "Listo", out_for_delivery: "En reparto", delivered: "Entregado", cancelled: "Cancelado",
};

function money(value: string | number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(value));
}

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.adminDashboard(), api.adminOrders()])
      .then(([summary, recent]) => { setDashboard(summary); setOrders(recent.orders.slice(0, 5)); })
      .catch(() => setError("No pudimos cargar el resumen administrativo."));
  }, []);

  if (error) return <main className="admin-dashboard"><div className="admin-empty-state"><strong>{error}</strong><button type="button" onClick={() => location.reload()}>Reintentar</button></div></main>;
  if (!dashboard) return <main className="admin-dashboard"><div className="admin-skeleton">Cargando datos del negocio…</div></main>;
  if (!dashboard.cycle) return <main className="admin-dashboard"><div className="admin-heading"><div><p className="section-kicker">Instalación limpia</p><h1>Configura La Rocota</h1><p>No hay datos de demostración. Crea la estructura del negocio desde aquí.</p></div></div><section className="admin-onboarding"><Link href="/admin/categories"><strong>1. Categorías</strong><span>Organiza las familias del menú.</span></Link><Link href="/admin/products"><strong>2. Productos</strong><span>Define platos, precios e IVA.</span></Link><Link href="/admin/cycles"><strong>3. Ciclo de venta</strong><span>Publica fechas, cupos y productos.</span></Link></section></main>;

  const capacity = dashboard.cycle.globalCapacity ?? dashboard.products.reduce((sum, product) => sum + product.capacity, 0);
  const units = dashboard.products.reduce((sum, product) => sum + product.units, 0);
  const fill = capacity > 0 ? Math.min(100, Math.round((units / capacity) * 100)) : 0;

  return (
    <main className="admin-dashboard">
      <div className="admin-heading"><div><p className="section-kicker">Operación en vivo</p><h1>Resumen del ciclo</h1><p>{dashboard.cycle.name}. Los valores provienen de la base de datos.</p></div><Link className="admin-primary-link" href="/admin/cycles">Gestionar ciclos</Link></div>
      <section className="metric-grid">
        <article><span className="metric-icon"><DollarSign size={20} /></span><div><small>Ventas válidas</small><strong>{money(dashboard.metrics.sales)}</strong><em>Sin pedidos cancelados</em></div></article>
        <article><span className="metric-icon"><ShoppingBag size={20} /></span><div><small>Pedidos</small><strong>{dashboard.metrics.orders}</strong><em>En el ciclo seleccionado</em></div></article>
        <article><span className="metric-icon"><Users size={20} /></span><div><small>Ticket promedio</small><strong>{money(dashboard.metrics.averageTicket)}</strong><em>Pedidos no cancelados</em></div></article>
        <article><span className="metric-icon alert"><Clock3 size={20} /></span><div><small>Pagos por revisar</small><strong>{dashboard.metrics.pendingPayments}</strong><em className={dashboard.metrics.pendingPayments ? "negative" : "positive"}>{dashboard.metrics.pendingPayments ? "Requieren atención" : "Todo al día"}</em></div></article>
      </section>
      <div className="admin-grid">
        <section className="admin-panel orders-panel"><div className="panel-heading"><div><h2>Pedidos recientes</h2><p>Historial real del ciclo.</p></div><Link href="/admin/orders">Ver todos</Link></div>
          {orders.length ? <div className="orders-table"><div className="table-head"><span>Pedido</span><span>Cliente</span><span>Estado</span><span>Total</span><span>Fecha</span></div>{orders.map((order) => <div className="table-row" key={order.id}><b>{order.orderNumber}</b><span>{order.firstName} {order.lastName}</span><span><i className="order-status">{statusLabels[order.status] ?? order.status}</i></span><b>{money(order.total)}</b><span>{new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short" }).format(new Date(order.createdAt))}</span></div>)}</div> : <div className="admin-empty-state"><ShoppingBag size={22} /><strong>Aún no hay pedidos</strong><span>Los pedidos confirmados desde la tienda aparecerán aquí.</span></div>}
        </section>
        <aside className="admin-panel cycle-panel"><div className="panel-heading"><div><h2>Capacidad</h2><p>Producción del ciclo.</p></div><PackageCheck size={20} /></div><div className="capacity-number"><strong>{units}</strong><span>de {capacity || 0} cupos</span></div><div className="capacity-track"><span style={{ width: `${fill}%` }} /></div><ul>{dashboard.products.map((product) => <li key={product.name}><span>{product.name}</span><b>{product.units} / {product.capacity}</b></li>)}</ul><Link className="cycle-manage-link" href="/admin/cycles">Editar capacidad</Link></aside>
      </div>
    </main>
  );
}
