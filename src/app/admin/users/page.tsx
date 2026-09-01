"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, Search, UserRound, X } from "lucide-react";
import { api, ApiError, type AdminUser, type UserRole, type UserStatus } from "@/lib/api/client";

const roleLabels: Record<UserRole, string> = { customer: "Cliente", admin: "Administrador", superadmin: "Superadministrador" };
const statusLabels: Record<UserStatus, string> = { active: "Activo", disabled: "Desactivado" };

function money(value: string) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(value));
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  async function load(search = "") {
    setLoading(true); setError("");
    try {
      const [{ users: records }, { user }] = await Promise.all([api.adminUsers(search), api.me()]);
      setUsers(records); setCanManage(user.role === "superadmin");
    } catch { setError("No pudimos cargar los usuarios."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    Promise.all([api.adminUsers(), api.me()]).then(([{ users: records }, { user }]) => {
      if (!active) return;
      setUsers(records); setCanManage(user.role === "superadmin");
    }).catch(() => { if (active) setError("No pudimos cargar los usuarios."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(String(new FormData(event.currentTarget).get("search") ?? ""));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError("");
    const data = new FormData(event.currentTarget);
    try {
      if (editing === "new") {
        await api.createAdminUser({
          firstName: String(data.get("firstName")), lastName: String(data.get("lastName")), email: String(data.get("email")),
          phone: String(data.get("phone") || "") || undefined, password: String(data.get("password")), role: String(data.get("role")) as UserRole,
        });
      } else if (editing) {
        await api.updateAdminUser(editing.id, {
          firstName: String(data.get("firstName")), lastName: String(data.get("lastName")), email: String(data.get("email")),
          phone: String(data.get("phone") || ""), role: String(data.get("role")) as UserRole, status: String(data.get("status")) as UserStatus,
        });
      }
      setEditing(null); await load();
    } catch (reason) { setFormError(reason instanceof ApiError ? reason.message : "No pudimos guardar el usuario."); }
    finally { setSaving(false); }
  }

  return (
    <main className="admin-dashboard admin-list-page">
      <div className="admin-heading"><div><p className="section-kicker">Accesos y clientes</p><h1>Usuarios</h1><p>Gestiona clientes, administradores, permisos y estado de acceso.</p></div>{canManage && <button type="button" onClick={() => setEditing("new")}><Plus size={16} /> Crear usuario</button>}</div>
      {!canManage && !loading && <div className="admin-notice">Puedes consultar usuarios. Solo un superadministrador puede cambiar roles o accesos.</div>}
      <section className="admin-panel list-panel">
        <form className="list-toolbar" onSubmit={search}><label><Search size={17} /><input name="search" placeholder="Buscar por nombre o correo" /></label><button type="submit">Buscar</button></form>
        {loading ? <div className="admin-skeleton">Cargando usuarios…</div> : error ? <div className="admin-empty-state"><strong>{error}</strong></div> : users.length ? <div className="users-admin-table"><div className="users-admin-head"><span>Usuario</span><span>Rol</span><span>Estado</span><span>Pedidos</span><span>Consumo</span><span>Registro</span><span /></div>{users.map((user) => <div className="users-admin-row" key={user.id}><span className="admin-user-cell"><i>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</i><span><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small></span></span><span>{roleLabels[user.role]}</span><span><i className={`user-status user-status-${user.status}`}>{statusLabels[user.status]}</i></span><b>{user.orderCount}</b><b>{money(user.totalSpent)}</b><span>{new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(new Date(user.createdAt))}</span><button type="button" aria-label={`Editar a ${user.firstName}`} disabled={!canManage} onClick={() => setEditing(user)}><Pencil size={16} /></button></div>)}</div> : <div className="admin-empty-state"><UserRound size={24} /><strong>No hay usuarios con ese criterio</strong></div>}
      </section>

      {editing && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="user-form-title"><header><div><span className="section-kicker">Gestión de acceso</span><h2 id="user-form-title">{editing === "new" ? "Crear usuario" : "Editar usuario"}</h2></div><button type="button" aria-label="Cerrar" onClick={() => setEditing(null)}><X size={20} /></button></header><form onSubmit={save}>
        <div className="admin-form-grid"><label>Nombre<input name="firstName" required minLength={2} defaultValue={editing === "new" ? "" : editing.firstName} /></label><label>Apellido<input name="lastName" required minLength={2} defaultValue={editing === "new" ? "" : editing.lastName} /></label><label className="wide">Correo<input name="email" type="email" required defaultValue={editing === "new" ? "" : editing.email} /></label><label className="wide">Teléfono<input name="phone" defaultValue={editing === "new" ? "" : editing.phone ?? ""} /></label>{editing === "new" && <label className="wide">Contraseña temporal<input name="password" type="password" required minLength={14} autoComplete="new-password" /><small>Mínimo 14 caracteres. El usuario podrá iniciar sesión de inmediato.</small></label>}<label>Rol<select name="role" defaultValue={editing === "new" ? "customer" : editing.role}><option value="customer">Cliente</option><option value="admin">Administrador</option><option value="superadmin">Superadministrador</option></select></label>{editing !== "new" && <label>Estado<select name="status" defaultValue={editing.status}><option value="active">Activo</option><option value="disabled">Desactivado</option></select></label>}</div>
        {formError && <p className="form-error" role="alert">{formError}</p>}<footer><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar usuario"}</button></footer>
      </form></section></div>}
    </main>
  );
}
