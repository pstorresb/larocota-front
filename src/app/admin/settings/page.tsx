"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, Landmark, MapPin, ShieldCheck, Store } from "lucide-react";
import { api, ApiError, type PaymentSettings, type PickupSettings } from "@/lib/api/client";

const emptyPayment: PaymentSettings = { enabled: false, bankName: "", accountType: "Cuenta de ahorros", accountNumber: "", holderName: "", holderIdentifier: "", instructions: "" };
const emptyPickup: PickupSettings = { addressLine: "", reference: "", hours: "", mapUrl: "", instructions: "" };

export default function AdminSettingsPage() {
  const [payment, setPayment] = useState<PaymentSettings>(emptyPayment);
  const [pickup, setPickup] = useState<PickupSettings>(emptyPickup);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [pickupMessage, setPickupMessage] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingPickup, setSavingPickup] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await api.adminSettings();
      setPayment(response.settings.payment);
      setPickup(response.settings.pickup);
      setCanEdit(response.canEdit);
    } catch {
      setError("No pudimos cargar la configuración.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    api.adminSettings()
      .then((response) => { if (active) { setPayment(response.settings.payment); setPickup(response.settings.pickup); setCanEdit(response.canEdit); } })
      .catch(() => { if (active) setError("No pudimos cargar la configuración."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPayment(true);
    setPaymentMessage("");
    try {
      const response = await api.updatePaymentSettings(payment);
      setPayment(response.value);
      setPaymentMessage(response.value.enabled ? "Guardado. Los clientes ya ven esta cuenta en el checkout." : "Guardado. La cuenta sigue oculta hasta que la publiques.");
    } catch (reason) {
      setPaymentMessage(reason instanceof ApiError ? reason.message : "No pudimos guardar la cuenta de cobro.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function savePickup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPickup(true);
    setPickupMessage("");
    try {
      const response = await api.updatePickupSettings(pickup);
      setPickup(response.value);
      setPickupMessage("Guardado. El punto de retiro se muestra en el checkout y en los pedidos.");
    } catch (reason) {
      setPickupMessage(reason instanceof ApiError ? reason.message : "No pudimos guardar el punto de retiro.");
    } finally {
      setSavingPickup(false);
    }
  }

  if (loading) return <main className="admin-dashboard admin-list-page"><div className="admin-skeleton">Cargando configuración…</div></main>;
  if (error) return <main className="admin-dashboard admin-list-page"><div className="admin-empty-state"><strong>{error}</strong><button type="button" onClick={() => void load()}>Reintentar</button></div></main>;

  const readOnly = !canEdit;

  return <main className="admin-dashboard admin-list-page">
    <div className="admin-heading"><div><p className="section-kicker">Operación</p><h1>Configuración</h1><p>Datos globales que usa la tienda: cuenta de cobro y punto de retiro. Lo que cambia cada semana vive en <Link href="/admin/cycles">Ciclos</Link>.</p></div></div>
    {readOnly && <div className="admin-notice"><ShieldCheck size={16} /> Solo un superadministrador puede editar estos datos. Puedes consultarlos.</div>}

    <section className="settings-forms">
      <form className="settings-card settings-card-priority settings-form" onSubmit={savePayment}>
        <div className="settings-card-icon"><Landmark size={21} /></div>
        <div><span className="settings-eyebrow">Transferencias</span><h2>Cuenta de cobro</h2><p>Es la cuenta que el cliente ve en el checkout antes de subir su comprobante. Publícala solo cuando los datos sean reales.</p></div>
        <div className="admin-form-grid">
          <label>Banco<input name="bankName" value={payment.bankName} disabled={readOnly} maxLength={80} placeholder="Banco Pichincha" onChange={(event) => setPayment({ ...payment, bankName: event.target.value })} /></label>
          <label>Tipo de cuenta<select name="accountType" value={payment.accountType} disabled={readOnly} onChange={(event) => setPayment({ ...payment, accountType: event.target.value })}><option>Cuenta de ahorros</option><option>Cuenta corriente</option></select></label>
          <label>Número de cuenta<input name="accountNumber" value={payment.accountNumber} disabled={readOnly} maxLength={40} inputMode="numeric" onChange={(event) => setPayment({ ...payment, accountNumber: event.target.value })} /></label>
          <label>Titular<input name="holderName" value={payment.holderName} disabled={readOnly} maxLength={120} onChange={(event) => setPayment({ ...payment, holderName: event.target.value })} /></label>
          <label>Cédula o RUC del titular<input name="holderIdentifier" value={payment.holderIdentifier} disabled={readOnly} maxLength={40} onChange={(event) => setPayment({ ...payment, holderIdentifier: event.target.value })} /><small>Solo visible aquí. No se muestra a los clientes.</small></label>
          <label className="wide">Instrucciones para el cliente<textarea name="instructions" value={payment.instructions} disabled={readOnly} maxLength={600} placeholder="Ej. Transfiere el total exacto y anota tu número de pedido en la descripción." onChange={(event) => setPayment({ ...payment, instructions: event.target.value })} /></label>
          <label className="wide check-field product-status-toggle"><input name="enabled" type="checkbox" checked={payment.enabled} disabled={readOnly} onChange={(event) => setPayment({ ...payment, enabled: event.target.checked })} /> Publicar esta cuenta en el checkout</label>
        </div>
        <div className="settings-security"><ShieldCheck size={17} /><span>{payment.enabled ? "La cuenta está publicada. Los clientes pueden transferir y subir comprobantes." : "Mientras no esté publicada, el checkout no permite crear pedidos."}</span></div>
        {paymentMessage && <p className="profile-message" role="status">{paymentMessage}</p>}
        {!readOnly && <footer><button type="submit" disabled={savingPayment}>{savingPayment ? "Guardando…" : "Guardar cuenta de cobro"}</button></footer>}
      </form>

      <form className="settings-card settings-form" onSubmit={savePickup}>
        <div className="settings-card-icon"><Store size={21} /></div>
        <div><span className="settings-eyebrow">Logística</span><h2>Punto de retiro</h2><p>Dirección y horario que ven los clientes que eligen retirar su pedido. La modalidad se habilita por ciclo.</p></div>
        <div className="admin-form-grid">
          <label className="wide">Dirección<input name="addressLine" value={pickup.addressLine} disabled={readOnly} maxLength={300} placeholder="Ej. Av. Mariano Acosta 12-34 y Gabriela Mistral" onChange={(event) => setPickup({ ...pickup, addressLine: event.target.value })} /></label>
          <label className="wide">Referencia<input name="reference" value={pickup.reference} disabled={readOnly} maxLength={300} placeholder="Ej. Frente al parque, portón rojo" onChange={(event) => setPickup({ ...pickup, reference: event.target.value })} /></label>
          <label>Horario de retiro<input name="hours" value={pickup.hours} disabled={readOnly} maxLength={200} placeholder="Ej. Viernes de 12:00 a 14:00" onChange={(event) => setPickup({ ...pickup, hours: event.target.value })} /></label>
          <label>Enlace de mapa<input name="mapUrl" value={pickup.mapUrl} disabled={readOnly} maxLength={500} type="url" placeholder="https://maps.app.goo.gl/…" onChange={(event) => setPickup({ ...pickup, mapUrl: event.target.value })} /></label>
          <label className="wide">Indicaciones<textarea name="instructions" value={pickup.instructions} disabled={readOnly} maxLength={600} placeholder="Ej. Menciona tu número de pedido al llegar." onChange={(event) => setPickup({ ...pickup, instructions: event.target.value })} /></label>
        </div>
        <dl><div><dt>Ciudad</dt><dd><MapPin size={14} /> Ibarra</dd></div><div><dt>Modalidades por ciclo</dt><dd><Link href="/admin/cycles"><CalendarDays size={14} /> Gestionar ciclos</Link></dd></div></dl>
        {pickupMessage && <p className="profile-message" role="status">{pickupMessage}</p>}
        {!readOnly && <footer><button type="submit" disabled={savingPickup}>{savingPickup ? "Guardando…" : "Guardar punto de retiro"}</button></footer>}
      </form>
    </section>

    <section className="settings-explanation"><h2>¿Qué debe vivir aquí?</h2><p>Configuración reúne datos globales del negocio. Los elementos que cambian cada semana (fechas, productos disponibles, capacidad y modalidades de entrega o retiro) se gestionan en <Link href="/admin/cycles">Ciclos</Link>. La aprobación de transferencias se realiza dentro de <Link href="/admin/orders">Pedidos</Link>, junto al comprobante y al total correspondiente. Un pedido sin comprobante se cancela automáticamente al vencer su plazo y libera los cupos.</p></section>
  </main>;
}
