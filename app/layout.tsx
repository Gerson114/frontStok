import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import Sidebar from "./components/header/header";
import { MARCA } from "@/app/marca"


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
  title: `${MARCA} | Painel administrativo`,
  description: "Painel administrativo para gestão de produtos, pedidos e clientes.",
};

// Necessário para que o nonce de CSP gerado no proxy seja aplicado a cada
// requisição (páginas estáticas são geradas em build, sem acesso a ele).
export const dynamic = "force-dynamic";

// O tema (claro/escuro) é escolhido no cabeçalho (ver header.tsx) e guardado
// no localStorage — não no cookie, que o proxy já usa para o token, e não na
// preferência do sistema, que o painel decidiu não seguir (ver o comentário
// grande em globals.css, "MODO ESCURO").
//
// Só vale dentro do painel (/page/*). A landing, o login e o cadastro têm a
// própria paleta, cheia de cor escrita à mão para o hero e a marca — girar
// esse conjunto para escuro é outro projeto, e diferente do painel: aqui
// quem entrou não escolheu tema nenhum, e sem o interruptor (que só existe
// dentro do painel) ele não teria como voltar ao claro. Nascer sempre claro
// fora do painel é o que evita a tela ficar presa no escuro sem saída.
//
// Este script roda ANTES da primeira pintura, direto no <head>, porque sem
// ele a página nasceria sempre clara e trocaria de cor um instante depois de
// carregar o React — o "flash" que todo site com tema escuro mal feito tem.
// Precisa do nonce da CSP (ver proxy.ts) para não ser bloqueado: o
// script-src daqui só aceita inline com o nonce da requisição.
const SCRIPT_TEMA = `
try {
  if (
    localStorage.getItem("tema") === "escuro" &&
    location.pathname.startsWith("/page/")
  ) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
} catch (e) {}
`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Sidebar />
        {children}
      </body>
    </html>
  );
}
