"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, FileUp, Mail, MapPin, Store, Truck, Utensils, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { api, ApiError, type CustomerOrderDetail, type PublicSettings } from "@/lib/api/client";
import { longDate, longDateTime, money, orderStatusLabel, shortDateTime } from "@/lib/order-status";

type Step = { key: string; title: string; detail: string; state: "done" | "current" | "pending" };

function buildSteps(order: CustomerOrderDetail): Step[] {
  const status = order.status;
  const cancelled = status === "cancelled";
  const rejected = status === "payment_rejected";
  const paid = ["confirmed", "in_preparation", "ready", "out_for_delivery", "delivered"].includes(status);
  const preparing = ["in_preparation", "ready", "out_for_delivery", "delivered"].includes(status);
  const finished = status === "delivered";
  const fulfillmentDate = longDate.format(new Date(order.fulfillmentAt));
  const state = (value: Step["state"]) => (cancelled ? "pending" : value);
  return [
    { key: "received", title: "Pedido recibido", detail: status === "payment_pending" ? "Falta tu comprobante" : "Comprobante recibido", state: state(status === "payment_pending" ? "current" : "done") },
    { key: "paid", title: rejected ? "Comprobante rechazado" : "Pago confirmado", detail: rejected ? "Sube uno nuevo" : status === "payment_review" ? "En revisión" : paid ? "Validado" : "Te avisaremos por correo", state: state(paid ? "done" : rejected || status === "payment_review" ? "current" : "pending") },
    { key: "prepared", title: order.fulfillmentType === "pickup" ? "Listo para retirar" : "En camino", detail: finished ? "Entregado" : `Para el ${fulfillmentDate}`, state: state(finished ? "done" : preparing ? "current" : "pending") },
  ];
}

export default function OrderConfirmationPage() {
  const params = useParams<{ orderNumber: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [settings, setSettings] = useState<PublicSettings>({ payment: null, pickup: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  useEffect(() => {
    let active = true;
    // The checkout redirects here with ?proof=missing when the order was created but the upload failed.
    const proofMissing = new URLSearchParams(window.location.search).get("proof") === "missing";
    Promise.allSettled([api.myOrder(params.orderNumber), api.publicSettings()]).then(([orderResult, settingsResult]) => {
      if (!active) return;
      if (proofMissing) setUploadMessage("Creamos tu pedido, pero el comprobante no se subió. Inténtalo de nuevo aquí abajo.");
      if (settingsResult.status === "fulfilled") setSettings(settingsResult.value);
      if (orderResult.status === "fulfilled") setOrder(orderResult.value.order);
      else {
        const reason = orderResult.reason;
        if (reason instanceof ApiError && reason.status === 401) { router.replace(`/login?next=/order-confirmation/${encodeURIComponent(params.orderNumber)}`); return; }
        setError(reason instanceof ApiError && reason.status === 404 ? "No encontramos este pedido en tu cuenta." : "No pudimos cargar tu pedido. Intenta nuevamente.");
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [params.orderNumber, router]);

  async function uploadProof(file: File | null) {
    if (!order || !file) return;
    setUploading(true);
    setUploadMessage("");
    try {
      await api.uploadProof(order.id, file);
      const refreshed = await api.myOrder(order.orderNumber);
      setOrder(refreshed.order);
      setUploadMessage("Comprobante recibido. Lo revisaremos y te avisaremos por correo.");
    } catch (reason) {
      setUploadMessage(reason instanceof ApiError ? reason.message : "No pudimos subir el comprobante. Intenta nuevamente.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <main className="confirmation-page"><SiteHeader /><div className="account-session-state">Cargando tu pedido…</div></main>;
  if (error || !order) return <main className="confirmation-page"><SiteHeader /><section className="confirmation-card"><div className="confirmation-icon confirmation-icon-warning"><AlertTriangle size={34} /></div><h1>{error || "Pedido no disponible"}</h1><div className="confirmation-actions"><Link className="primary-button" href="/account">Ver mis pedidos</Link><Link className="text-link" href="/">Volver al inicio</Link></div></section></main>;

  const needsProof = order.status === "payment_pending" || order.status === "payment_rejected";
  const cancelled = order.status === "cancelled";
  const deadline = order.paymentDeadline ? longDateTime.format(new Date(order.paymentDeadline)) : null;
  const steps = buildSteps(order);
  const pickup = settings.pickup;
  const payment = settings.payment;
  const headline = cancelled ? "Este pedido fue cancelado."
    : order.status === "payment_rejected" ? "No pudimos validar tu comprobante."
    : order.status === "payment_pending" ? "Recibimos tu pedido. Falta el comprobante."
    : order.status === "payment_review" ? "¡Gracias! Ya estamos revisando tu pago."
    : order.status === "delivered" ? "Pedido entregado. ¡Buen provecho!"
    : "Tu pedido está confirmado.";

  return (
    <main className="confirmation-page">
      <SiteHeader />
      <section className="confirmation-card">
        <div className={`confirmation-icon ${cancelled || order.status === "payment_rejected" ? "confirmation-icon-warning" : ""}`}>{cancelled ? <XCircle size={38} /> : <CheckCircle2 size={38} />}</div>
        <p className="section-kicker">{orderStatusLabel(order.status)}</p>
        <h1>{headline}</h1>
        <p className="confirmation-lead">Pedido <strong>{order.orderNumber}</strong> · {order.cycleName}. {order.adminPublicNote ? order.adminPublicNote : cancelled ? "Si crees que es un error, escríbenos." : "Te avisaremos por correo con cada novedad."}</p>

        <div className="confirmation-details">
          <div>{order.fulfillmentType === "pickup" ? <Store size={20} /> : <Truck size={20} />}<span><b>{order.fulfillmentType === "pickup" ? "Retiro" : "Entrega"}</b>{longDateTime.format(new Date(order.fulfillmentAt))}{order.fulfillmentType === "delivery" && order.addressSnapshot?.requestedDeliveryTime ? ` · hora solicitada ${order.addressSnapshot.requestedDeliveryTime}` : ""}</span></div>
          <div><MapPin size={20} /><span><b>{order.fulfillmentType === "pickup" ? "Punto de retiro" : "Dirección"}</b>{order.fulfillmentType === "pickup" ? (pickup ? `${pickup.addressLine}${pickup.hours ? ` · ${pickup.hours}` : ""}` : "Te confirmaremos la dirección por correo.") : order.addressSnapshot?.addressLine ?? "Sin dirección registrada"}</span></div>
          {needsProof && deadline && !cancelled && <div><Clock3 size={20} /><span><b>Plazo para el comprobante</b>{deadline}. Después, el pedido se cancela y liberamos los cupos.</span></div>}
          <div><Mail size={20} /><span><b>Confirmación</b>Recibirás las novedades en {order.contactSnapshot.email}.</span></div>
        </div>

        {!cancelled && (
          <ol className="order-steps">
            {steps.map((step) => <li key={step.key} className={step.state}>{step.key === "received" ? <FileCheck2 size={18} /> : step.key === "paid" ? <CheckCircle2 size={18} /> : <Utensils size={18} />}<span><b>{step.title}</b><small>{step.detail}</small></span></li>)}
          </ol>
        )}

        {needsProof && !cancelled && (
          <section className="proof-upload-panel">
            <h2>{order.status === "payment_rejected" ? "Sube un nuevo comprobante" : "Sube tu comprobante"}</h2>
            {order.proof?.rejectionReason && <p className="form-error" role="alert">Motivo del rechazo: {order.proof.rejectionReason}</p>}
            {payment && <p className="proof-upload-hint">Transfiere <strong>{money.format(Number(order.total))}</strong> a {payment.bankName}, {payment.accountType.toLowerCase()} <strong>{payment.accountNumber}</strong>{payment.holderName ? ` (${payment.holderName})` : ""}.</p>}
            <label className={`upload-zone ${uploading ? "has-file" : ""}`}>
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploading} onChange={(event) => void uploadProof(event.target.files?.[0] ?? null)} />
              <FileUp size={27} /><strong>{uploading ? "Subiendo…" : "Seleccionar comprobante"}</strong><span>JPG, PNG, WebP o PDF · máximo 8 MB</span>
            </label>
            {uploadMessage && <p className="profile-message" role="status">{uploadMessage}</p>}
          </section>
        )}
        {!needsProof && uploadMessage && <p className="profile-message" role="status">{uploadMessage}</p>}

        <section className="order-detail-list">
          <h2>Detalle</h2>
          {order.items.map((item) => <div key={item.id}><span><strong>{item.quantity} × {item.name}</strong>{item.snapshotJson.modifiers?.length ? <small>{item.snapshotJson.modifiers.map((modifier) => `${modifier.quantity}× ${modifier.optionName}`).join(" · ")}</small> : null}</span><b>{money.format(Number(item.lineTotal))}</b></div>)}
          <div className="order-detail-total"><span>Subtotal</span><span>{money.format(Number(order.subtotal))}</span></div>
          <div className="order-detail-total"><span>IVA</span><span>{money.format(Number(order.taxTotal))}</span></div>
          <div className="order-detail-total order-detail-grand"><strong>Total</strong><strong>{money.format(Number(order.total))}</strong></div>
        </section>

        {order.history.length > 0 && (
          <section className="order-detail-list order-timeline">
            <h2>Seguimiento</h2>
            {order.history.map((entry) => <div key={entry.id}><span><strong>{orderStatusLabel(entry.toStatus)}</strong>{entry.publicNote && <small>{entry.publicNote}</small>}</span><time dateTime={entry.createdAt}>{shortDateTime.format(new Date(entry.createdAt))}</time></div>)}
          </section>
        )}

        <div className="confirmation-actions"><Link className="primary-button" href="/account">Ver mis pedidos</Link><Link className="text-link" href="/">Volver al inicio</Link></div>
      </section>
    </main>
  );
}
