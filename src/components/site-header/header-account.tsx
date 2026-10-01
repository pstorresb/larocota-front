"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type AuthUser } from "@/lib/api/client";

type SessionState = { status: "loading" } | { status: "anonymous" } | { status: "signed-in"; user: AuthUser };

export function HeaderAccount() {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    api.me()
      .then(({ user }) => { if (active) setSession({ status: "signed-in", user }); })
      .catch(() => { if (active) setSession({ status: "anonymous" }); });
    return () => { active = false; };
  }, []);

  if (session.status === "signed-in") {
    const isAdmin = session.user.role === "admin" || session.user.role === "superadmin";
    return (
      <Link className="header-account" href={isAdmin ? "/admin" : "/account"} aria-label={isAdmin ? "Panel administrativo" : "Mi cuenta"}>
        <UserRound size={18} /><span>Hola, {session.user.firstName}</span>
      </Link>
    );
  }
  const next = pathname && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : "";
  return (
    <Link className="header-account" href={`/login${next}`} aria-label={session.status === "loading" ? "Mi cuenta" : "Ingresar"}>
      <UserRound size={18} /><span>{session.status === "loading" ? "Mi cuenta" : "Ingresar"}</span>
    </Link>
  );
}
