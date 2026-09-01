import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="header-back" href="/"><ArrowLeft size={18} /> Volver al menú</Link>
        <div className="auth-brand"><Image src="/brand/la-rocota-logo.png" alt="La Rocota" width={420} height={140} /></div>
        <div className="auth-copy"><p className="section-kicker">Bienvenido de vuelta</p><h1>Entra a tu cuenta</h1><p>Consulta tus pedidos y sigue cada entrega.</p></div>
        <LoginForm />
        <p className="auth-switch">¿Aún no tienes cuenta? <a href="#">Créala aquí</a></p>
        <small className="secure-note"><LockKeyhole size={14} /> Sesión protegida con cookie segura.</small>
      </section>
      <aside className="auth-image"><Image src="/brand/hero-food.png" alt="Comida fresca de La Rocota" fill sizes="50vw" preload /><blockquote>“Tu almuerzo del viernes, listo sin correr ni improvisar.”</blockquote></aside>
    </main>
  );
}
