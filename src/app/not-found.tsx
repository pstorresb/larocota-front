import { UtensilsCrossed } from "lucide-react";
import { SiteHeader } from "@/components/site-header/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="site-shell">
      <SiteHeader />
      <section className="page-state">
        <UtensilsCrossed size={40} />
        <h1>Esta página no existe.</h1>
        <p>Quizá el enlace cambió. El menú de esta semana te espera en el inicio.</p>
        <Button href="/">Volver al menú</Button>
      </section>
    </main>
  );
}
