"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Copy, ExternalLink, FileUp, Landmark, LocateFixed, LockKeyhole, MapPin, Navigation, Store, Truck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { cartTotal, useCart } from "@/features/cart/cart-store";
import { api, ApiError, type AuthUser, type CatalogCycle, type FulfillmentType, type PublicSettings } from "@/lib/api/client";
import { longDate, money } from "@/lib/order-status";

type Contact = Pick<AuthUser, "email" | "firstName" | "lastName"> & { phone: string };
const ecuadorPhone = /^0\d{9}$/;

function extractCoordinates(value: string) {
  let decoded = value.trim();
  try { decoded = decodeURIComponent(decoded); } catch { /* Keep the original text. */ }
  const patterns = [
    /@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
    /(?:q|query|ll)=(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/i,
    /(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/,
  ];
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) return { latitude, longitude };
  }
  return null;
}

const modeCopy: Record<FulfillmentType, { title: string; hint: string }> = {
  pickup: { title: "Retiro en el local", hint: "Sin costo. Te avisamos cuando esté listo." },
  delivery: { title: "Entrega a domicilio", hint: "Gratuita dentro de Ibarra." },
};

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCart((state) => state.items);
  const cycleId = useCart((state) => state.cycleId);
  const clear = useCart((state) => state.clear);

  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cycle, setCycle] = useState<CatalogCycle | null>(null);
  const [settings, setSettings] = useState<PublicSettings>({ payment: null, pickup: null });
  const [mode, setMode] = useState<FulfillmentType | null>(null);
  const [contact, setContact] = useState<Contact>({ email: "", firstName: "", lastName: "", phone: "" });
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [locationText, setLocationText] = useState("");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const [copied, setCopied] = useState(false);

  const quoteSignature = JSON.stringify({ cycleId, items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, selections: item.selections })) });
  const [quote, setQuote] = useState<{ signature: string; subtotalCents: number; taxCents: number; totalCents: number } | null>(null);
  const activeQuote = quote?.signature === quoteSignature ? quote : null;
  const subtotal = activeQuote ? activeQuote.subtotalCents / 100 : cartTotal(items);
  const tax = activeQuote ? activeQuote.taxCents / 100 : 0;
  const total = activeQuote ? activeQuote.totalCents / 100 : subtotal;

  const allowedModes: FulfillmentType[] = cycle?.fulfillmentModes ?? [];
  const payment = settings.payment;
  const pickup = settings.pickup;
  const mapSrc = coordinates ? `https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.longitude - .006}%2C${coordinates.latitude - .004}%2C${coordinates.longitude + .006}%2C${coordinates.latitude + .004}&layer=mapnik&marker=${coordinates.latitude}%2C${coordinates.longitude}` : null;
  const mapLink = coordinates ? `https://www.openstreetmap.org/?mlat=${coordinates.latitude}&mlon=${coordinates.longitude}#map=17/${coordinates.latitude}/${coordinates.longitude}` : null;
  const fulfillmentDate = cycle ? longDate.format(new Date(cycle.fulfillmentAt)) : null;

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.catalog(), api.me(), api.publicSettings()]).then(([catalogResult, userResult, settingsResult]) => {
      if (!active) return;
      if (catalogResult.status === "fulfilled") {
        const nextCycle = catalogResult.value.cycle;
        setCycle(nextCycle);
        const modes = nextCycle?.fulfillmentModes ?? [];
        // Pickup is the default when the cycle offers it; otherwise the only mode available.
        setMode(modes.includes("pickup") ? "pickup" : modes[0] ?? null);
      }
      if (settingsResult.status === "fulfilled") setSettings(settingsResult.value);
      if (userResult.status === "fulfilled") {
        const user = userResult.value.user;
        setContact({ email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? "" });
        setAccountLoaded(true);
      }
      setSessionResolved(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!cycleId || items.length === 0) return;
    let active = true;
    api.quoteOrder({ cycleId, items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, selections: item.selections })) })
      .then((result) => { if (active) { setQuote({ ...result, signature: quoteSignature }); setErrorMessage(""); } })
      .catch((reason) => { if (active) { setQuote(null); setErrorMessage(reason instanceof ApiError ? reason.message : "No pudimos validar los precios del pedido."); } });
    return () => { active = false; };
  }, [cycleId, items, quoteSignature]);

  function updateContact(field: keyof Contact, value: string) {
    setContact((current) => ({ ...current, [field]: value }));
  }

  async function copyAccountNumber() {
    if (!payment) return;
    try {
      await navigator.clipboard.writeText(payment.accountNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* Clipboard unavailable: the number is still visible. */ }
  }

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setLocationStatus("Tu navegador no permite obtener la ubicación. Puedes pegar un enlace o las coordenadas.");
      return;
    }
    setLocating(true);
    setLocationStatus("Solicitando tu ubicación…");
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)) };
      setCoordinates(next);
      setLocationText(`${next.latitude}, ${next.longitude}`);
      setLocationStatus("Ubicación guardada. Podrás revisarla antes de enviar.");
      setLocating(false);
    }, () => {
      setLocationStatus("No pudimos acceder a tu ubicación. Pega un enlace de Maps o escribe las coordenadas.");
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 });
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountLoaded) { router.push("/login?next=/checkout"); return; }
    if (!cycleId || !mode) { setErrorMessage("No hay un ciclo de venta abierto en este momento."); return; }
    if (!payment) { setErrorMessage("Todavía no publicamos los datos para la transferencia. Escríbenos antes de hacer tu pedido."); return; }
    const form = event.currentTarget;
    const data = new FormData(form);
    const proofFile = selectedFile;
    const addressLine = String(data.get("addressLine") ?? "").trim();
    const requestedDeliveryTime = String(data.get("requestedDeliveryTime") ?? "");
    const normalizedContact = { email: contact.email.trim(), firstName: contact.firstName.trim(), lastName: contact.lastName.trim(), phone: contact.phone.trim() };
    const isDelivery = mode === "delivery";
    const issue = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContact.email) ? { field: "email", message: "Ingresa un correo electrónico válido." }
      : normalizedContact.firstName.length < 2 ? { field: "firstName", message: "Ingresa tu nombre." }
      : normalizedContact.lastName.length < 2 ? { field: "lastName", message: "Ingresa tu apellido." }
      : !ecuadorPhone.test(normalizedContact.phone) ? { field: "phone", message: "Ingresa un teléfono ecuatoriano de 10 dígitos, en formato 0XXXXXXXXX." }
      : isDelivery && addressLine.length < 8 ? { field: "addressLine", message: "Completa la dirección de entrega con al menos 8 caracteres." }
      : isDelivery && !/^([01]\d|2[0-3]):[0-5]\d$/.test(requestedDeliveryTime) ? { field: "requestedDeliveryTime", message: "Selecciona la hora aproximada en que deseas recibir el pedido." }
      : !proofFile ? { field: "proof", message: "Sube el comprobante de la transferencia." }
      : null;
    if (issue) {
      setErrorMessage(issue.message);
      const field = form.elements.namedItem(issue.field);
      if (field instanceof HTMLElement) { field.focus(); field.scrollIntoView({ behavior: "smooth", block: "center" }); }
      return;
    }
    if (!proofFile) return;
    setSubmitting(true);
    setErrorMessage("");
    let orderNumber: string | null = null;
    try {
      const result = await api.createOrder({
        cycleId,
        fulfillmentType: mode,
        contact: normalizedContact,
        address: isDelivery ? {
          addressLine,
          requestedDeliveryTime,
          sector: String(data.get("sector") ?? "").trim(),
          reference: String(data.get("reference") ?? "").trim(),
          locationText: locationText || undefined,
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
        } : null,
        customerNotes: String(data.get("notes") ?? "") || undefined,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, selections: item.selections })),
      });
      orderNumber = result.order.orderNumber;
      await api.uploadProof(result.order.id, proofFile);
      clear();
      router.push(`/order-confirmation/${orderNumber}`);
    } catch (reason) {
      if (orderNumber) {
        // The order exists; the confirmation page lets the customer retry the proof upload.
        clear();
        router.push(`/order-confirmation/${orderNumber}?proof=missing`);
        return;
      }
      setErrorMessage(reason instanceof ApiError ? reason.message : "No pudimos conectar con el servicio. Intenta nuevamente.");
      setSubmitting(false);
    }
  }

  const canSubmit = accountLoaded && items.length > 0 && Boolean(cycleId) && Boolean(activeQuote) && Boolean(mode) && Boolean(payment) && !submitting;

  return <main className="checkout-page">
    <SiteHeader backHref="/#menu" />
    <div className="checkout-shell">
      <section className="checkout-main">
        {!sessionResolved ? <div className="checkout-session-loading">Comprobando tu cuenta…</div> : !accountLoaded ? (
          <section className="checkout-account-gate">
            <p className="section-kicker">Antes de continuar</p>
            <h1>Guarda tu pedido con una cuenta</h1>
            <p>Crear o iniciar sesión es necesario para proteger tu dirección, comprobante y seguimiento del pedido. Tu carrito ya está guardado y te esperará al volver.</p>
            <Link className="primary-button" href="/login?next=/checkout">Crear cuenta o iniciar sesión</Link>
            <Link className="checkout-gate-back" href="/#menu">Seguir viendo el menú</Link>
          </section>
        ) : <>
          <div className="checkout-title">
            <p className="section-kicker">Último paso</p>
            <h1>{mode === "pickup" ? "¿Cuándo pasas por tu pedido?" : "¿Dónde entregamos tu pedido?"}</h1>
            <p>Confirma tus datos, elige cómo recibirlo y sube el comprobante de transferencia.</p>
            <small className="required-fields-note"><span>*</span> Campos obligatorios</small>
          </div>
          <form id="checkout-form" noValidate onSubmit={submitOrder}>
            <section className="checkout-card">
              <div className="checkout-card-heading"><span>1</span><div><h2>Datos de contacto</h2><p>Los usaremos para confirmar el pago y coordinar la entrega.</p></div></div>
              {accountLoaded && <div className="account-prefill"><CheckCircle2 size={16} /><span>Completamos estos datos desde tu cuenta. Puedes corregirlos si hace falta.</span></div>}
              <div className="field-grid">
                <label className="field field-full"><span className="field-label">Correo electrónico <span className="required-mark" aria-hidden="true">*</span></span><input required type="email" name="email" placeholder="tu@correo.com" autoComplete="email" value={contact.email} onChange={(event) => updateContact("email", event.target.value)} /></label>
                <label className="field"><span className="field-label">Nombre <span className="required-mark" aria-hidden="true">*</span></span><input required minLength={2} name="firstName" placeholder="Tu nombre" autoComplete="given-name" value={contact.firstName} onChange={(event) => updateContact("firstName", event.target.value)} /></label>
                <label className="field"><span className="field-label">Apellido <span className="required-mark" aria-hidden="true">*</span></span><input required minLength={2} name="lastName" placeholder="Tu apellido" autoComplete="family-name" value={contact.lastName} onChange={(event) => updateContact("lastName", event.target.value)} /></label>
                <label className="field field-full"><span className="field-label">Teléfono <span className="required-mark" aria-hidden="true">*</span></span><input required name="phone" inputMode="numeric" pattern="0[0-9]{9}" maxLength={10} title="Ingresa 10 dígitos en formato 0XXXXXXXXX" placeholder="0990000000" autoComplete="tel" value={contact.phone} onChange={(event) => updateContact("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} /><small>Ingresa 10 dígitos: 0XXXXXXXXX. Así podremos llamarte o escribirte por WhatsApp.</small></label>
              </div>
            </section>

            <section className="checkout-card">
              <div className="checkout-card-heading"><span>2</span><div><h2>¿Cómo recibes tu pedido?</h2><p>{fulfillmentDate ? `Preparamos todo para el ${fulfillmentDate}.` : "La fecha se confirmará con el ciclo de venta."}</p></div></div>
              {allowedModes.length === 0 ? (
                <p className="form-error" role="alert">No hay un ciclo de venta abierto en este momento. Vuelve al menú para revisar la próxima fecha.</p>
              ) : (
                <div className="fulfillment-choices" role="radiogroup" aria-label="Modalidad de entrega">
                  {allowedModes.map((option) => (
                    <button key={option} type="button" role="radio" aria-checked={mode === option} className={`fulfillment-option ${mode === option ? "selected" : ""}`} onClick={() => setMode(option)}>
                      {option === "pickup" ? <Store size={21} /> : <Truck size={21} />}
                      <div><strong>{modeCopy[option].title}</strong><span>{modeCopy[option].hint}</span></div>
                      <b>{option === "pickup" ? "Sin costo" : "$0,00"}</b>
                    </button>
                  ))}
                </div>
              )}

              {mode === "pickup" && (
                <div className="location-card pickup-card">
                  <div className="location-card-heading"><div><MapPin size={18} /><span><strong>Punto de retiro</strong><small>{pickup ? "Te avisamos por correo cuando esté listo." : "Te confirmaremos la dirección exacta por correo."}</small></span></div></div>
                  {pickup ? (
                    <dl className="pickup-details">
                      <div><dt>Dirección</dt><dd>{pickup.addressLine}</dd></div>
                      {pickup.reference && <div><dt>Referencia</dt><dd>{pickup.reference}</dd></div>}
                      {pickup.hours && <div><dt>Horario de retiro</dt><dd>{pickup.hours}</dd></div>}
                      {pickup.instructions && <div><dt>Indicaciones</dt><dd>{pickup.instructions}</dd></div>}
                    </dl>
                  ) : <p className="location-status">Ibarra, Ecuador.</p>}
                  {pickup?.mapUrl && <a className="text-link pickup-map-link" href={pickup.mapUrl} target="_blank" rel="noreferrer">Ver en el mapa <ExternalLink size={13} /></a>}
                </div>
              )}

              {mode === "delivery" && <>
                <div className="delivery-banner"><Truck size={21} /><div><strong>Entrega gratuita en Ibarra</strong><span>{fulfillmentDate ?? "Fecha por confirmar"}</span></div><b>$0,00</b></div>
                <div className="field-grid address-fields">
                  <label className="field field-full"><span className="field-label">Dirección completa <span className="required-mark" aria-hidden="true">*</span></span><input required minLength={8} name="addressLine" autoComplete="street-address" placeholder="Ej. Av. Mariano Acosta y Gabriela Mistral, casa 12" /><small>Incluye calle principal, intersección y número de casa, edificio o local.</small></label>
                  <label className="field field-full delivery-time-field"><span className="field-label">Hora aproximada de entrega <span className="required-mark" aria-hidden="true">*</span></span><input required name="requestedDeliveryTime" type="time" /><small>La confirmaremos contigo después de validar el pago.</small></label>
                  <label className="field field-full"><span className="field-label">Sector o barrio <span className="label-optional">Opcional</span></span><input name="sector" autoComplete="address-level3" placeholder="Ej. Los Ceibos, Caranqui, centro de Ibarra" /></label>
                  <label className="field field-full"><span className="field-label">Referencia para encontrar el lugar <span className="label-optional">Opcional</span></span><textarea name="reference" maxLength={500} rows={3} placeholder="Ej. Casa esquinera color blanco, portón negro; junto a la farmacia…" /><small>Si ayuda, describe fachada, piso, entrada o algún local cercano.</small></label>
                </div>
                <div className="location-card">
                  <div className="location-card-heading"><div><Navigation size={18} /><span><strong>Ubicación exacta</strong><small>Opcional, pero recomendada para una entrega más rápida.</small></span></div><button type="button" onClick={useCurrentLocation} disabled={locating}><LocateFixed size={16} /> {locating ? "Obteniendo…" : "Usar mi ubicación"}</button></div>
                  <label className="field">Enlace de Google Maps o coordenadas<input value={locationText} onChange={(event) => { const value = event.target.value; const parsed = extractCoordinates(value); setLocationText(value); setCoordinates(parsed); setLocationStatus(parsed ? "Ubicación reconocida. Revisa el punto en el mapa." : value ? "No encontramos coordenadas en el texto. Puedes escribirlas como latitud, longitud." : ""); }} placeholder="Pega aquí el enlace compartido o -0.3517, -78.1223" /></label>
                  {locationStatus && <p className="location-status" aria-live="polite">{locationStatus}</p>}
                  {mapSrc && <div className="location-map-preview"><iframe title="Vista previa de la ubicación de entrega" src={mapSrc} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups" /><div><span><MapPin size={14} /> Punto de entrega</span>{mapLink && <a href={mapLink} target="_blank" rel="noreferrer">Abrir mapa <ExternalLink size={13} /></a>}</div></div>}
                </div>
              </>}

              <label className="field field-full delivery-note">Nota adicional para el pedido <span className="label-optional">Opcional</span><textarea name="notes" maxLength={500} rows={3} placeholder={mode === "pickup" ? "Ej. Paso a las 12:30; sin cubiertos…" : "Ej. Llamar al llegar; dejar en recepción; sin cubiertos…"} /></label>
            </section>

            <section className="checkout-card">
              <div className="checkout-card-heading"><span>3</span><div><h2>Transferencia bancaria</h2><p>Transfiere el total exacto y sube el comprobante. El pedido se confirma después de validarlo.</p></div></div>
              {payment ? (
                <div className="bank-card">
                  <div className="bank-isotype" aria-hidden="true">{/^banco pichincha/i.test(payment.bankName) ? <Image src="/brand/banco-pichincha.png" alt="" width={640} height={324} /> : <Landmark size={26} />}</div>
                  <div>
                    <strong>{payment.bankName}</strong>
                    <span>{payment.accountType}{payment.holderName ? ` · ${payment.holderName}` : ""}</span>
                    <b className="bank-account-number">{payment.accountNumber}</b>
                    {payment.instructions && <span className="bank-instructions">{payment.instructions}</span>}
                  </div>
                  <button type="button" className="copy-button" onClick={copyAccountNumber} aria-live="polite">{copied ? <><CheckCircle2 size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}</button>
                </div>
              ) : (
                <p className="form-error" role="alert">Todavía no publicamos los datos para la transferencia. Escríbenos antes de hacer tu pedido; no se creará ningún pedido hasta que estén disponibles.</p>
              )}
              <label className={`upload-zone ${fileName ? "has-file" : ""}`}>
                <input required name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { const file = event.target.files?.[0] ?? null; setSelectedFile(file); setFileName(file?.name ?? ""); }} />
                {fileName ? <><CheckCircle2 size={27} /><strong>Comprobante listo <span className="required-mark" aria-hidden="true">*</span></strong><span>{fileName}</span></> : <><FileUp size={27} /><strong>Sube tu comprobante <span className="required-mark" aria-hidden="true">*</span></strong><span>JPG, PNG, WebP o PDF · máximo 8 MB</span></>}
              </label>
            </section>
          </form>
        </>}
      </section>

      <aside className="order-summary">
        <p className="section-kicker">Resumen</p><h2>Tu pedido</h2>
        <div className="summary-cycle"><Clock3 size={18} /><div><strong>{fulfillmentDate ? `${mode === "pickup" ? "Retiro" : "Entrega"} ${fulfillmentDate}` : "Sin ciclo activo"}</strong><span>{mode === "pickup" ? "Retiro en el local, sin costo" : "Entrega gratuita en Ibarra"}</span></div></div>
        <div className="summary-items">{items.length === 0 ? <p className="summary-empty">Aún no hay productos. Vuelve al menú para elegir.</p> : items.map((item) => <div className="summary-item" key={item.id}><Image src={item.image} alt="" width={62} height={54} unoptimized /><div><strong>{item.quantity} × {item.name}</strong><span>{item.modifiers.length ? item.modifiers.map((modifier) => `${modifier.quantity}× ${modifier.optionName}`).join(" · ") : "Sin modificaciones"}</span></div><b>{money.format(item.unitPrice * item.quantity)}</b></div>)}</div>
        <div className="summary-totals">
          <div><span>Subtotal</span><span>{money.format(subtotal)}</span></div>
          <div><span>IVA</span><span>{money.format(tax)}</span></div>
          <div className="delivery-total"><span>{mode === "pickup" ? "Retiro" : "Entrega"}</span><strong>Gratis</strong></div>
          <div className="summary-total"><strong>Total a transferir</strong><strong>{money.format(total)}</strong></div>
        </div>
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
        {sessionResolved && !accountLoaded ? <Link className="place-order checkout-login-button" href="/login?next=/checkout">Crear cuenta para continuar</Link> : <button className="place-order" type="submit" form="checkout-form" disabled={!canSubmit}>{submitting ? "Creando pedido…" : `Enviar pedido · ${money.format(total)}`}</button>}
        <p className="secure-note"><LockKeyhole size={14} /> Tu comprobante y dirección se guardan de forma privada.</p>
      </aside>
    </div>
  </main>;
}
