"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Eye, FileCheck2, MapPin, RefreshCw, Search, ShoppingBag, X, XCircle } from "lucide-react";
import { api, ApiError, paymentProofUrl, type AdminOrder, type AdminOrderDetail } from "@/lib/api/client";

const statusLabels: Record<string, string> = { draft: "Borrador", payment_pending: "Pago pendiente", payment_review: "Pago en revisión", payment_rejected: "Pago rechazado", confirmed: "Confirmado", in_preparation: "En preparación", ready: "Listo", out_for_delivery: "En reparto", delivered: "Entregado", cancelled: "Cancelado" };
const money = (value: string) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(value));
const dateTime = (value: string) => new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selected, setSelected] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reason, setReason] = useState("");
  const [proofObjectUrl, setProofObjectUrl] = useState("");
  const [proofLoadError, setProofLoadError] = useState("");
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const proofId = selected?.proof?.id;
  const proofLoading = Boolean(proofId) && !proofObjectUrl && !proofLoadError;

  async function load(search = "") { setLoading(true); setError(""); try { setOrders((await api.adminOrders(search)).orders); } catch { setError("No pudimos cargar los pedidos."); } finally { setLoading(false); } }
  useEffect(() => { let active = true; api.adminOrders().then(({ orders: records }) => { if (active) setOrders(records); }).catch(() => { if (active) setError("No pudimos cargar los pedidos."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!proofId) return;
    let active = true;
    let objectUrl = "";
    fetch(paymentProofUrl(proofId), { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo descargar el comprobante.");
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setProofObjectUrl(objectUrl);
      })
      .catch(() => { if (active) setProofLoadError("No pudimos mostrar el comprobante. Intenta actualizar el pedido."); })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [proofId]);
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void load(String(new FormData(event.currentTarget).get("search") ?? "")); }

  async function openOrder(orderId: string) {
    setDetailLoading(true); setDetailError(""); setReason(""); setProofObjectUrl(""); setProofLoadError("");
    try { setSelected((await api.adminOrder(orderId)).order); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "No pudimos abrir el pedido."); }
    finally { setDetailLoading(false); }
  }

  async function review(decision: "approve" | "reject") {
    if (!selected?.proof || (decision === "reject" && reason.trim().length < 5)) return;
    setReviewing(true); setDetailError("");
    try {
      await api.reviewPayment(selected.proof.id, decision === "approve" ? { decision } : { decision, reason: reason.trim() });
      const refreshed = (await api.adminOrder(selected.id)).order;
      setSelected(refreshed); setReason(""); await load();
    } catch (cause) { setDetailError(cause instanceof ApiError ? cause.message : "No pudimos registrar la revisión."); }
    finally { setReviewing(false); }
  }

  const canReview = selected?.status === "payment_review" && selected.proof?.status === "under_review";
  const mapLink = selected?.addressSnapshot?.latitude !== undefined && selected.addressSnapshot.longitude !== undefined ? `https://www.openstreetmap.org/?mlat=${selected.addressSnapshot.latitude}&mlon=${selected.addressSnapshot.longitude}#map=17/${selected.addressSnapshot.latitude}/${selected.addressSnapshot.longitude}` : null;

  return <main className="admin-dashboard admin-list-page">
    <div className="admin-heading"><div><p className="section-kicker">Operación</p><h1>Pedidos</h1><p>Revisa pagos, clientes, productos y entregas desde un solo lugar.</p></div><button type="button" onClick={() => void load()}><RefreshCw size={16} /> Actualizar</button></div>
    <section className="admin-panel list-panel">
      <form className="list-toolbar" onSubmit={search}><label><Search size={17} /><input name="search" placeholder="Buscar por pedido o correo" /></label><button type="submit">Buscar</button></form>
      {loading ? <div className="admin-skeleton">Cargando pedidos…</div> : error ? <div className="admin-empty-state"><strong>{error}</strong></div> : orders.length ? <div className="orders-admin-table"><div className="orders-admin-head"><span>Pedido</span><span>Cliente</span><span>Estado</span><span>Entrega</span><span>Total</span><span>Creado</span><span /></div>{orders.map((order) => <button className="orders-admin-row" type="button" key={order.id} onClick={() => void openOrder(order.id)}><b>{order.orderNumber}</b><span><strong>{order.firstName} {order.lastName}</strong><small>{order.email}</small></span><span><i className={`order-status status-${order.status}`}>{statusLabels[order.status] ?? order.status}</i></span><span>{order.fulfillmentType === "pickup" ? "Retiro" : "Entrega"}</span><b>{money(order.total)}</b><span>{new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(new Date(order.createdAt))}</span><i className="order-open"><Eye size={16} /> Revisar</i></button>)}</div> : <div className="admin-empty-state"><ShoppingBag size={24} /><strong>Aún no hay pedidos</strong><span>Cuando un cliente complete el checkout, aparecerá aquí.</span></div>}
    </section>
    {detailLoading && <div className="admin-detail-loading">Abriendo pedido…</div>}
    {selected && <div className="admin-modal-backdrop order-detail-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="admin-modal order-detail-modal" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
      <header><div><span className="section-kicker">Pedido</span><h2 id="order-detail-title">{selected.orderNumber}</h2><p>Creado {dateTime(selected.createdAt)}</p></div><button type="button" aria-label="Cerrar" onClick={() => setSelected(null)}><X size={20} /></button></header>
      <div className="order-detail-body">
        <div className="order-detail-top"><div><span>Estado actual</span><strong><i className={`order-status status-${selected.status}`}>{statusLabels[selected.status] ?? selected.status}</i></strong></div><div><span>Total recibido</span><strong>{money(selected.total)}</strong></div><div><span>Entrega</span><strong>{dateTime(selected.fulfillmentAt)}</strong></div></div>
        <section className="order-detail-section"><h3>Cliente y entrega</h3><div className="order-detail-columns"><dl><div><dt>Cliente</dt><dd>{selected.contactSnapshot.firstName} {selected.contactSnapshot.lastName}</dd></div><div><dt>Correo</dt><dd>{selected.contactSnapshot.email}</dd></div><div><dt>Teléfono</dt><dd>{selected.contactSnapshot.phone}</dd></div></dl><dl><div><dt>Dirección</dt><dd>{selected.addressSnapshot?.addressLine || "Sin dirección registrada"}</dd></div><div><dt>Hora solicitada</dt><dd>{selected.addressSnapshot?.requestedDeliveryTime || "No registrada"}</dd></div><div><dt>Sector</dt><dd>{selected.addressSnapshot?.sector || "—"}</dd></div><div><dt>Referencia</dt><dd>{selected.addressSnapshot?.reference || "—"}</dd></div>{mapLink && <div><dt>Ubicación</dt><dd><a href={mapLink} target="_blank" rel="noreferrer"><MapPin size={13} /> Abrir mapa</a></dd></div>}</dl></div>{selected.customerNotes && <p className="order-customer-note"><b>Nota:</b> {selected.customerNotes}</p>}</section>
        <section className="order-detail-section"><h3>Productos</h3><div className="order-detail-items">{selected.items.map((item) => <article key={item.id}><div><strong>{item.quantity} × {item.name}</strong>{item.snapshotJson.modifiers?.length ? <small>{item.snapshotJson.modifiers.map((modifier) => `${modifier.quantity}× ${modifier.optionName}`).join(" · ")}</small> : null}</div><b>{money(item.lineTotal)}</b></article>)}</div><div className="order-detail-totals"><span>Subtotal <b>{money(selected.subtotal)}</b></span><span>IVA <b>{money(selected.taxTotal)}</b></span><strong>Total <b>{money(selected.total)}</b></strong></div></section>
        <section className="order-detail-section payment-review-section"><div className="payment-review-heading"><div><h3>Comprobante de transferencia</h3><p>{selected.proof ? `${selected.proof.originalName} · enviado ${dateTime(selected.proof.createdAt)}` : "El cliente todavía no ha enviado un comprobante."}</p></div>{selected.proof && <i className={`proof-status proof-${selected.proof.status}`}>{selected.proof.status === "under_review" ? "Por revisar" : selected.proof.status === "approved" ? "Aprobado" : "Rechazado"}</i>}</div>
          {selected.proof && <div className="payment-proof-viewer">
            {proofLoading && <div className="payment-proof-state">Cargando comprobante…</div>}
            {proofLoadError && <div className="payment-proof-state proof-error">{proofLoadError}</div>}
            {proofObjectUrl && selected.proof.mimeType.startsWith("image/") && <Image className="payment-proof-image" src={proofObjectUrl} alt={`Comprobante del pedido ${selected.orderNumber}`} width={1400} height={1000} unoptimized />}
            {proofObjectUrl && selected.proof.mimeType === "application/pdf" && <iframe className="payment-proof-frame" title={`Comprobante ${selected.orderNumber}`} src={proofObjectUrl} />}
            {proofObjectUrl && <a className="payment-proof-open" href={proofObjectUrl} target="_blank" rel="noreferrer">Abrir comprobante en otra pestaña</a>}
          </div>}
          {canReview && <div className="payment-decision"><div className="payment-checklist"><FileCheck2 size={18} /><span><strong>Antes de aprobar</strong><small>Comprueba en la cuenta bancaria el valor de {money(selected.total)}, la fecha y el remitente.</small></span></div><label>Motivo si rechazas<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} placeholder="Ej. El valor recibido no coincide con el total del pedido." /></label><div className="payment-actions"><button className="reject-payment" type="button" disabled={reviewing || reason.trim().length < 5} onClick={() => void review("reject")}><XCircle size={17} /> Rechazar pago</button><button className="approve-payment" type="button" disabled={reviewing} onClick={() => void review("approve")}><CheckCircle2 size={17} /> {reviewing ? "Procesando…" : "Confirmar pago"}</button></div></div>}
          {!canReview && selected.proof?.status === "approved" && <div className="payment-reviewed-message"><CheckCircle2 size={18} /> Este pago ya fue aprobado y el pedido está confirmado.</div>}
          {detailError && <p className="form-error" role="alert">{detailError}</p>}
        </section>
        {selected.history.length > 0 && <section className="order-detail-section"><h3>Historial</h3><div className="order-history">{selected.history.map((entry) => <div key={entry.id}><span /><p><strong>{statusLabels[entry.toStatus] ?? entry.toStatus}</strong><small>{entry.publicNote || "Estado actualizado"} · {dateTime(entry.createdAt)}{entry.actorName ? ` · ${entry.actorName}` : ""}</small></p></div>)}</div></section>}
      </div>
    </section></div>}
  </main>;
}
