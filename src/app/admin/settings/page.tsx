import Link from "next/link";
import { Building2, CalendarDays, Landmark, MapPin, ShieldCheck, Truck } from "lucide-react";

export default function AdminSettingsPage() {
  return <main className="admin-dashboard admin-list-page">
    <div className="admin-heading"><div><p className="section-kicker">Operación</p><h1>Configuración</h1><p>Una vista clara de los datos generales que usa la tienda y de dónde se administra cada uno.</p></div></div>

    <section className="settings-overview">
      <article className="settings-card settings-card-priority">
        <div className="settings-card-icon"><Landmark size={21} /></div>
        <div><span className="settings-eyebrow">Transferencias</span><h2>Cuenta de cobro</h2><p>Esta es la cuenta que el cliente consulta en checkout antes de subir su comprobante.</p></div>
        <dl><div><dt>Banco</dt><dd>Banco Pichincha</dd></div><div><dt>Tipo</dt><dd>Cuenta de ahorros</dd></div><div><dt>Número de cuenta</dt><dd className="settings-pending">Pendiente de configurar</dd></div></dl>
        <div className="settings-security"><ShieldCheck size={17} /><span>No se ha inventado ni publicado un número. Debe registrarse el dato real antes de recibir pagos.</span></div>
      </article>

      <article className="settings-card">
        <div className="settings-card-icon"><Truck size={21} /></div>
        <div><span className="settings-eyebrow">Logística</span><h2>Entrega</h2><p>La modalidad, fecha, cupos y mensaje público se configuran por ciclo de venta.</p></div>
        <dl><div><dt>Modalidad actual</dt><dd>Entrega gratuita</dd></div><div><dt>Ciudad</dt><dd><MapPin size={14} /> Ibarra</dd></div></dl>
        <Link className="settings-link" href="/admin/cycles"><CalendarDays size={16} /> Gestionar ciclos</Link>
      </article>

      <article className="settings-card">
        <div className="settings-card-icon"><Building2 size={21} /></div>
        <div><span className="settings-eyebrow">Identidad</span><h2>Datos del negocio</h2><p>Información estable que identifica la tienda en el panel y en la experiencia del cliente.</p></div>
        <dl><div><dt>Nombre</dt><dd>La Rocota</dd></div><div><dt>Dominio</dt><dd>larocota.com</dd></div><div><dt>Operación</dt><dd>Ibarra, Ecuador</dd></div></dl>
      </article>
    </section>

    <section className="settings-explanation"><h2>¿Qué debe vivir aquí?</h2><p>Configuración reúne datos globales del negocio: cuenta bancaria, identidad, contactos y reglas generales. Los elementos que cambian cada semana —fechas, productos disponibles y capacidad— se gestionan en <Link href="/admin/cycles">Ciclos</Link>. La aprobación de transferencias se realiza dentro de <Link href="/admin/orders">Pedidos</Link>, junto al comprobante y al total correspondiente.</p></section>
  </main>;
}
