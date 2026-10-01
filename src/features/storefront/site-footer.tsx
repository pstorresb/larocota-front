import Image from "next/image";
import { AtSign, ExternalLink, MessageCircle } from "lucide-react";
import type { PickupSettings } from "@/lib/api/client";

export function SiteFooter({ pickup }: { pickup: PickupSettings | null }) {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_URL;
  const instagram = process.env.NEXT_PUBLIC_INSTAGRAM_URL;
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <span className="footer-logo"><Image src="/brand/la-rocota-logo-final.png" alt="La Rocota" width={668} height={340} /></span>
        <p className="footer-slogan">Comidita, nomás</p>
        <p>Comida fresca hecha bajo pedido en Ibarra. Abrimos pedidos por ciclos y entregamos en la franja que elijas.</p>
      </div>
      <div className="footer-col">
        <h3>Retiro en el local</h3>
        {pickup ? (
          <ul>
            <li>{pickup.addressLine}</li>
            {pickup.reference && <li>{pickup.reference}</li>}
            {pickup.hours && <li>{pickup.hours}</li>}
            {pickup.mapUrl && <li><a href={pickup.mapUrl} target="_blank" rel="noreferrer">Ver en el mapa <ExternalLink size={14} /></a></li>}
          </ul>
        ) : <p>Te confirmamos la dirección exacta por correo al confirmar tu pedido.</p>}
      </div>
      <div className="footer-col">
        <h3>Escríbenos</h3>
        {whatsapp || instagram ? (
          <ul>
            {whatsapp && <li><a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a></li>}
            {instagram && <li><a href={instagram} target="_blank" rel="noreferrer"><AtSign size={16} /> Instagram</a></li>}
          </ul>
        ) : <p>Respondemos por correo a cada novedad de tu pedido.</p>}
      </div>
      <p className="footer-legal">© {new Date().getFullYear()} La Rocota. Ibarra, Ecuador.</p>
    </footer>
  );
}
