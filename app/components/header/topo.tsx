"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// Âncoras das seções da landing. Fora de "/" elas viram links para a página
// inicial com o hash, para o topo funcionar igual em login e cadastro.
const SECOES: { nome: string; hash: string }[] = [
    { nome: "Como funciona", hash: "#como-funciona" },
    { nome: "Recursos", hash: "#recursos" },
    { nome: "Vitrine", hash: "#vitrine" },
    { nome: "Assinatura", hash: "#assinatura" },
]

/**
 * Topo das páginas públicas (landing, login e cadastro).
 *
 * Barra branca com borda fria — a mesma anatomia de cabeçalho do painel
 * (referência: Magalu). O botão de conta da página em que o visitante já
 * está sai de cena: em /login sobra "Criar conta", em /cadastro sobra
 * "Entrar", e na landing aparecem os dois.
 */
export default function Topo() {
    const pathname = usePathname()

    const naLanding = pathname === "/"

    return (
        <header className="sticky top-0 z-40 border-b border-[#D3DADD] bg-white">
            <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">

                <Link href="/" className="flex shrink-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0086FF] text-base font-extrabold text-white">
                        M
                    </span>
                    <span className="font-display text-lg text-[#1E2428]">
                        Minha Loja
                    </span>
                </Link>

                <nav className="ml-4 hidden items-center gap-6 lg:flex">
                    {SECOES.map(({ nome, hash }) => (
                        <Link
                            key={hash}
                            href={naLanding ? hash : `/${hash}`}
                            className="text-sm font-semibold text-[#5A6469] hover:text-[#0086FF]"
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
