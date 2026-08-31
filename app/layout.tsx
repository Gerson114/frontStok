import type { Metadata } from "next";
import { Nunito_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/header/header";


// Nunito Sans aproxima a "Magalu UI" (proprietária): humanista, altura-x
// alta e aberturas generosas. O mono fica só para códigos/SKU — preços e
// estatísticas usam o próprio Nunito com dígitos tabulares.
const nunito = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Minha Loja | Painel administrativo",
  description: "Painel administrativo para gestão de produtos, pedidos e clientes.",
};

// Necessário para que o nonce de CSP gerado no proxy seja aplicado a cada
// requisição (páginas estáticas são geradas em build, sem acesso a ele).
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${nunito.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Sidebar />
        {children}
      </body>
    </html>
  );
}
