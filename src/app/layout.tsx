import type { Metadata } from "next";
import { Noto_Sans_Lao_Looped, Nunito_Sans } from "next/font/google";
import { ConnectionStatusBanner } from "@/components/ConnectionStatusBanner";
import { AuthProvider } from "@/lib/auth-context";
import { ProfileProvider } from "@/lib/profile-context";
import { ThemeProvider } from "@/lib/theme-context";
import { buildThemeInitScript } from "@/lib/theme";
import "./globals.css";

// Brokaza Visual Brain v1.0 — mismo par tipográfico que el dashboard legacy
// (matchouse/src/dashboard/index.html): Nunito Sans para texto de cuerpo,
// Noto Sans Lao Looped para headings.
const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: "variable",
});

const notoSansLaoLooped = Noto_Sans_Lao_Looped({
  variable: "--font-noto-sans-lao-looped",
  subsets: ["latin"],
  weight: "variable",
});

export const metadata: Metadata = {
  title: "Brokaza",
  description: "Dashboard de Brokaza — matching inmobiliario multi-tenant.",
  icons: {
    icon: "/logo_brokaza.png",
    apple: "/logo_brokaza.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // El script sin-FOUC de abajo pisa `data-theme` antes del primer paint — React nunca
      // vio ese valor en su árbol renderizado, así que sin esto tira warning de hidratación
      // por un mismatch que en realidad es intencional (KAN-256).
      suppressHydrationWarning
      className={`${nunitoSans.variable} ${notoSansLaoLooped.variable} h-full antialiased`}
    >
      <head>
        {/* KAN-298: le pide a Google Translate que no ofrezca traducir la página — complementa
            los `translate="no"`/`notranslate` puntuales en los términos críticos (ver
            `components/ui/NoTranslate.tsx`), que siguen protegiendo esos términos si el usuario
            fuerza la traducción igual (este meta solo evita que el navegador la *sugiera*). */}
        <meta name="google" content="notranslate" />
        {/* Corre antes de que el navegador pinte el <body> — evita el flash del tema
            equivocado (FOUC) que un `useEffect` no puede evitar porque llega tarde. */}
        <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ConnectionStatusBanner />
        <ThemeProvider>
          <AuthProvider>
            <ProfileProvider>{children}</ProfileProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
