import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/header/header";


// Inter é a face do painel do Shopify (e da maior parte do software de
// gestão sério dos últimos anos): altura-x alta, dígitos de largura fixa e
// desenho neutro, que é o que um painel lido oito horas por dia pede. A
// anterior era a Nunito Sans, humanista e arredondada — boa para vitrine,
// simpática demais para uma tela de conferência de estoque.
//
// O mono fica só para códigos e SKU; preços e estatísticas usam a própria
// Inter com dígitos tabulares.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arara | Painel administrativo",
  description: "Painel administrativo para gestão de produtos, pedidos e clientes.",
};

// Necessário para que o nonce de CSP gerado no proxy seja aplicado a cada
// requisição (páginas estáticas são geradas em build, sem acesso a ele).
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Sidebar />
        {children}
      </body>
    </html>
  );
}
