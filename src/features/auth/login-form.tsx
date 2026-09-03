"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, ApiError, googleAuthUrl } from "@/lib/api/client";

const googleErrors: Record<string, string> = {
  admin_link_blocked: "Por seguridad, las cuentas administrativas deben ingresar con contraseña.", account_disabled: "Esta cuenta se encuentra desactivada.", cancelled_or_invalid: "El acceso con Google fue cancelado o expiró. Inténtalo nuevamente.", authentication_failed: "No pudimos validar tu cuenta de Google.", token_exchange_failed: "Google no pudo completar el acceso. Inténtalo nuevamente.",
};
function destination(role: string) { return role === "admin" || role === "superadmin" ? "/admin" : "/account"; }

export function LoginForm({ nextPath = "/account", googleError }: { nextPath?: string; googleError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup" | "verify">("login");
  const [error, setError] = useState(googleError ? (googleErrors[googleError] ?? "No pudimos completar el acceso con Google.") : "");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const message = (reason: unknown) => reason instanceof ApiError ? reason.message : "No pudimos conectar con el servicio.";

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); const data = new FormData(event.currentTarget);
    try { const { user } = await api.login({ email: String(data.get("email")), password: String(data.get("password")) }); router.replace(destination(user.role)); }
    catch (reason) { setError(message(reason)); } finally { setLoading(false); }
  }
  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); const data = new FormData(event.currentTarget); const signupEmail = String(data.get("email")).trim().toLowerCase();
    try {
      await api.requestSignupCode({ firstName: String(data.get("firstName")), lastName: String(data.get("lastName")), email: signupEmail, phone: String(data.get("phone") || "") || undefined, password: String(data.get("password")) });
      setEmail(signupEmail); setMode("verify");
    } catch (reason) { setError(message(reason)); } finally { setLoading(false); }
  }
  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); const data = new FormData(event.currentTarget);
    try { const { user } = await api.verifySignupCode({ email, code: String(data.get("code")).trim() }); router.replace(destination(user.role)); }
    catch (reason) { setError(message(reason)); } finally { setLoading(false); }
  }

  if (mode === "verify") return <form className="auth-form" onSubmit={verifyCode}>
    <div className="auth-verification-copy"><strong>Revisa tu correo</strong><span>Enviamos un PIN de seis dígitos a <b>{email}</b>. Vence en 10 minutos.</span></div>
    <label className="field">Código de confirmación<input className="pin-input" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus placeholder="000000" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="place-order" type="submit" disabled={loading}>{loading ? "Confirmando…" : "Confirmar y crear cuenta"}</button>
    <button className="auth-text-button" type="button" onClick={() => { setError(""); setMode("signup"); }}>Usar otro correo o solicitar otro código</button>
  </form>;

  return <>
    <a className="google-auth-button" href={googleAuthUrl(nextPath)}><svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.5H3.2a10 10 0 0 0 0 9.1L6.5 14Z"/><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.2 7.5l3.3 2.6A5.8 5.8 0 0 1 12 6.1Z"/></svg>Continuar con Google</a>
    <div className="auth-divider"><span>o {mode === "login" ? "ingresa con tu contraseña" : "crea tu cuenta con correo"}</span></div>
    {mode === "login" ? <form className="auth-form" onSubmit={login}>
      <label className="field">Correo electrónico<input type="email" name="email" required autoComplete="email" placeholder="tu@correo.com" /></label><label className="field">Contraseña<input type="password" name="password" required minLength={10} autoComplete="current-password" placeholder="••••••••" /></label>
      <div className="auth-row"><label className="remember"><input type="checkbox" /> Recordarme</label><button type="button" className="auth-link-button">Olvidé mi contraseña</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}<button className="place-order" type="submit" disabled={loading}>{loading ? "Ingresando…" : "Iniciar sesión"}</button><button className="auth-text-button" type="button" onClick={() => { setError(""); setMode("signup"); }}>Crear cuenta con correo</button>
    </form> : <form className="auth-form" onSubmit={requestCode}>
      <div className="auth-verification-copy"><strong>Crea tu cuenta</strong><span>Te enviaremos un PIN a tu correo para confirmar que es tuyo.</span></div>
      <div className="auth-two-fields"><label className="field">Nombre<input name="firstName" required minLength={2} autoComplete="given-name" /></label><label className="field">Apellido<input name="lastName" required minLength={2} autoComplete="family-name" /></label></div>
      <label className="field">Correo electrónico<input type="email" name="email" required autoComplete="email" placeholder="tu@correo.com" /></label><label className="field">Teléfono <small>Opcional</small><input name="phone" inputMode="tel" autoComplete="tel" placeholder="099 000 0000" /></label><label className="field">Crea una contraseña<input type="password" name="password" required minLength={10} autoComplete="new-password" placeholder="Mínimo 10 caracteres" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}<button className="place-order" type="submit" disabled={loading}>{loading ? "Enviando PIN…" : "Enviar PIN de confirmación"}</button><button className="auth-text-button" type="button" onClick={() => { setError(""); setMode("login"); }}>Ya tengo una cuenta</button>
    </form>}
  </>;
}
