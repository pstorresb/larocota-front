"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock3, FileCheck2, Mail, Utensils } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export default function OrderConfirmationPage() {
  const params = useParams<{ orderNumber: string }>();
  return (
    <main className="confirmation-page">
      <SiteHeader />
      <section className="confirmation-card">
        <div className="confirmation-icon"><CheckCircle2 size={38} /></div>
        <p className="section-kicker">Pedido recibido</p>
        <h1>¡Gracias! Ya estamos revisando tu pago.</h1>
        <p className="confirmation-lead">Guardamos tu pedido con el número <strong>{params.orderNumber}</strong>. Te avisaremos apenas validemos el comprobante.</p>
        <div className="confirmation-details"><div><Clock3 size={20} /><span><b>Entrega</b>Viernes 4 de septiembre · 12:00–14:00</span></div><div><Mail size={20} /><span><b>Confirmación</b>Recibirás las novedades en tu correo.</span></div></div>
        <ol className="order-steps"><li className="done"><FileCheck2 size={18} /><span><b>Pedido recibido</b><small>Comprobante en revisión</small></span></li><li><CheckCircle2 size={18} /><span><b>Pago confirmado</b><small>Te avisaremos por correo</small></span></li><li><Utensils size={18} /><span><b>En preparación</b><small>El viernes por la mañana</small></span></li></ol>
        <div className="confirmation-actions"><Link className="primary-button" href="/account">Ver mis pedidos</Link><Link className="text-link" href="/">Volver al inicio</Link></div>
      </section>
    </main>
  );
}
