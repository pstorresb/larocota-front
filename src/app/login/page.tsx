import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { LoginForm } from "@/features/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; google_error?: string }> }) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/account";
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="header-back" href="/"><ArrowLeft size={18} /> Volver al menú</Link>
        <div className="auth-brand"><Image src="/brand/la-rocota-logo-final.png" alt="La Rocota" width={668} height={340} /></div>
        <div className="auth-copy"><p className="section-kicker">Tu cuenta La Rocota</p><h1>Entra o crea tu cuenta</h1><p>Consulta tus pedidos y sigue cada entrega.</p></div>
        <LoginForm nextPath={nextPath} googleError={params.google_error} />
        <p className="auth-switch">Google crea tu cuenta de forma segura en el primer acceso. Con correo, confirmamos primero que sea tuyo.</p>
        <small className="secure-note"><LockKeyhole size={14} /> Sesión protegida con cookie segura.</small>
      </section>
      <aside className="auth-image"><Image src="/brand/hero-food.png" alt="Comida fresca de La Rocota" fill sizes="50vw" preload /><blockquote>“Tu almuerzo del viernes, listo sin correr ni improvisar.”</blockquote></aside>
    </main>
  );
}
