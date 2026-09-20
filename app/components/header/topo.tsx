"use client"

import Link from "next/link"
import { Marca } from "@/app/components/marca/marca"
import { usePathname } from "next/navigation"
import { MARCA } from "@/app/marca"

// Âncoras das seções da landing. Fora de "/" elas viram links para a página
// inicial com o hash, para o topo funcionar igual em login e cadastro.
const SECOES: { nome: string; hash: string }[] = [
    // O fundamento vem primeiro no menu como vem na página: é a ideia que
    // explica por que as telas são as que são.
    { nome: "O fundamento", hash: "#fundamento" },
    { nome: "Como funciona", hash: "#como-funciona" },
    { nome: "Recursos", hash: "#recursos" },
    { nome: "Vitrine", hash: "#vitrine" },

    // "Planos", e não "Assinatura": são dois agora — o de entrada e o Pro —, e
    // a palavra no menu é a pergunta que o visitante está fazendo.
    { nome: "Planos", hash: "#planos" },
    { nome: "Perguntas", hash: "#perguntas" },
]

/**
 * Topo das páginas públicas (landing, login e cadastro).
 *
 * Barra branca com borda fria — a mesma anatomia de cabeçalho do painel
 * (referência: Shopify Admin/Polaris). O botão de conta da página em que o
 * visitante já está sai de cena: em /login sobra "Criar conta", em /cadastro sobra
 * "Entrar", e na landing aparecem os dois.
 */
export default function Topo() {
    const pathname = usePathname()

    const naLanding = pathname === "/"

    return (
        <header className="sticky top-0 z-40 border-b border-[var(--linha)] bg-white">
            <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">

                <Link href="/" className="flex shrink-0 items-center gap-2.5">
                    <Marca />
                    <span className="font-display text-lg text-[var(--ink)]">
                        {MARCA}
                    </span>
                </Link>

                <nav className="ml-4 hidden items-center gap-6 lg:flex">
                    {SECOES.map(({ nome, hash }) => (
                        <Link
                            key={hash}
                            href={naLanding ? hash : `/${hash}`}
                            className="text-sm font-semibold text-[var(--ink-2)] hover:text-[var(--azul)]"
                        >
                            {nome}
                        </Link>
                    ))}
                </nav>

                <div className="ml-auto flex shrink-0 items-center gap-2">
                    {pathname !== "/login" && (
                        <Link href="/login" className="btn btn-neutro px-4 py-2 text-sm">
                            Entrar
                        </Link>
                    )}

                    {pathname !== "/cadastro" && (
                        <Link href="/cadastro" className="btn btn-primario px-4 py-2 text-sm">
                            Criar conta
                        </Link>
                    )}
                </div>

            </div>
        </header>
    )
}
