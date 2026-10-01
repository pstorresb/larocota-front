import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { CartHydration } from "@/features/cart/cart-hydration";
import "./globals.css";

const dmSans = localFont({
  src: "./fonts/DM_Sans/DMSans-VariableFont_opsz,wght.ttf",
  variable: "--font-dm-sans",
  display: "swap",
});

const poppins = localFont({
  src: [
    { path: "./fonts/Poppins/Poppins-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Poppins/Poppins-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

const allison = localFont({
  src: "./fonts/Allison/Allison-Regular.ttf",
  variable: "--font-allison",
  display: "swap",
});

const description = "Ensaladas, sánduches y quesadillas hechas bajo pedido en Ibarra. Pide en el ciclo abierto, paga por transferencia y recibe en tu franja: retiro en el local o entrega gratis.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "La Rocota · Comidita, nomás",
  description,
  openGraph: {
    title: "La Rocota · Comidita, nomás",
    description,
    type: "website",
    locale: "es_EC",
    images: [{ url: "/og.png", width: 1732, height: 908, alt: "La Rocota, comidita nomás" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "La Rocota · Comidita, nomás",
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" data-theme="light" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${poppins.variable} ${allison.variable}`}>
        <Script id="theme-init" strategy="beforeInteractive">{`try{var t=localStorage.getItem('larocota-theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}`}</Script>
        <CartHydration />
        {children}
      </body>
    </html>
  );
}
