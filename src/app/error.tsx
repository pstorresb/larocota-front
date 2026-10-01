"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="site-shell">
      <section className="page-state">
        <AlertTriangle size={40} />
        <h1>No pudimos cargar La Rocota.</h1>
        <p>Revisa tu conexión e intenta de nuevo. Si el problema sigue, vuelve en unos minutos.</p>
        <Button onClick={reset}>Reintentar</Button>
      </section>
    </main>
  );
}
