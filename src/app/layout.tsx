import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "La Rocota | Comida fresca que sí provoca",
  description:
    "Pide con anticipación ensaladas, sánduches, quesadillas y bebidas frescas en Ibarra.",
  openGraph: {
    title: "La Rocota | Comida fresca que sí provoca",
    description: "Comida fresca preparada bajo pedido en Ibarra.",
    type: "website",
    locale: "es_EC",
    images: [{ url: "/og.png", width: 1732, height: 908, alt: "La Rocota — Comida fresca que sí provoca" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "La Rocota | Comida fresca que sí provoca",
    description: "Comida fresca preparada bajo pedido en Ibarra.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" data-theme="light" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">{`try{var t=localStorage.getItem('larocota-theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}`}</Script>
        {children}
      </body>
    </html>
  );
}
