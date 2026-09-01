"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, ApiError } from "@/lib/api/client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const { user } = await api.login({ email: String(data.get("email")), password: String(data.get("password")) });
      router.replace(user.role === "admin" || user.role === "superadmin" ? "/admin" : "/account");
    }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "No pudimos conectar con el servicio."); }
    finally { setLoading(false); }
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <label className="field">Correo electrónico<input type="email" name="email" required autoComplete="email" placeholder="tu@correo.com" /></label>
      <label className="field">Contraseña<input type="password" name="password" required minLength={10} autoComplete="current-password" placeholder="••••••••" /></label>
      <div className="auth-row"><label className="remember"><input type="checkbox" /> Recordarme</label><a href="#">Olvidé mi contraseña</a></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="place-order" type="submit" disabled={loading}>{loading ? "Ingresando…" : "Iniciar sesión"}</button>
    </form>
  );
}
