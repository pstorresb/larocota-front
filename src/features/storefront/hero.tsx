import Image from "next/image";
import { ArrowRight, CalendarClock, ChefHat, Landmark, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CatalogCycle } from "@/lib/api/client";
import { shortTime, weekdayLongDate } from "@/lib/order-status";

function cycleChip(cycle: CatalogCycle | null) {
  if (!cycle) {
    return { closed: true, title: "Pronto publicaremos el próximo menú.", detail: "Vuelve en unos días o escríbenos para enterarte de la próxima fecha." };
  }
  const delivery = `${weekdayLongDate.format(new Date(cycle.fulfillmentStartsAt))}, de ${shortTime.format(new Date(cycle.fulfillmentStartsAt))} a ${shortTime.format(new Date(cycle.fulfillmentEndsAt))}`;
  const modes = cycle.fulfillmentModes.includes("pickup") && cycle.fulfillmentModes.includes("delivery")
    ? "Retiro en el local o a domicilio."
    : cycle.fulfillmentModes.includes("pickup") ? "Retiro en el local." : "Entrega a domicilio.";
  if (cycle.isOpen) {
    return {
      closed: false,
      title: `Pedidos abiertos hasta el ${weekdayLongDate.format(new Date(cycle.closesAt))}, ${shortTime.format(new Date(cycle.closesAt))}`,
      detail: `Entrega el ${delivery}. ${modes}`,
    };
  }
  return {
    closed: true,
    title: `Abrimos pedidos el ${weekdayLongDate.format(new Date(cycle.opensAt))}, ${shortTime.format(new Date(cycle.opensAt))}`,
    detail: `Entrega el ${delivery}. Ya puedes mirar el menú.`,
  };
}

export function Hero({ cycle }: { cycle: CatalogCycle | null }) {
  const chip = cycleChip(cycle);
  const deliveryDay = cycle ? weekdayLongDate.format(new Date(cycle.fulfillmentStartsAt)) : null;
  return (
    <section className="hero" id="inicio">
      <div className="hero-copy">
        <p className="hero-eyebrow"><MapPin size={16} /> Pedidos por ciclo en Ibarra</p>
        <h1>Comidita, nomás.</h1>
        <p className="hero-subtitle">
          {deliveryDay
            ? <>Pide hoy y recíbelo el <strong>{deliveryDay}</strong> recién hecho, en tu casa o en el local.</>
            : <>Ensaladas, sánduches y quesadillas hechas bajo pedido, sin apuro y sin sorpresas.</>}
        </p>
        <div className="hero-actions">
          <Button href="/#menu" variant="on-brand" size="lg">Ver el menú <ArrowRight size={18} /></Button>
          <Button href="/#como-funciona" variant="on-brand-ghost" size="lg">Cómo funciona</Button>
        </div>
        <ul className="hero-trust">
          <li><ChefHat size={17} /> Cocinamos bajo pedido</li>
          <li><Truck size={17} /> Entrega gratis en Ibarra</li>
          <li><Landmark size={17} /> Pago por transferencia</li>
        </ul>
      </div>
      <div className="hero-visual">
        <div className="hero-photo">
          <Image src="/brand/hero-food.png" alt="Ensalada, sánduche, quesadillas y jugo fresco de La Rocota" fill priority sizes="(max-width: 950px) 100vw, 46vw" />
        </div>
        <div className={`cycle-chip ${chip.closed ? "cycle-chip-closed" : ""}`}>
          <CalendarClock size={20} />
          <div><strong>{chip.title}</strong><span>{chip.detail}</span></div>
        </div>
      </div>
    </section>
  );
}
