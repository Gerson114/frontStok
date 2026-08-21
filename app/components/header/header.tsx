"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { logout } from "@/middleware/auth"

const menu = [
    { nome: "Dashboard", href: "/page/home", icone: "⌂" },
    { nome: "Cadastrar produto", href: "/page/produto", icone: "＋" },
    { nome: "Estoque", href: "/page/estoque", icone: "📍" },
    { nome: "Avarias", href: "/page/avarias", icone: "⚠" },
]

const emBreve = [
    { nome: "Pedidos", icone: "🛒" },
    { nome: "Clientes", icone: "👥" },
    { nome: "Relatórios", icone: "📊" },
]

export default function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const [aberto, setAberto] = useState(false)
    const [saindo, setSaindo] = useState(false)

    // O painel administrativo só faz sentido dentro de /page/*.
    // A tela de login (rota pública "/") não deve exibir o menu.
    if (!pathname.startsWith("/page/")) {
        return null
    }

    async function handleSair() {
        setSaindo(true)

        try {
            await logout()
        } finally {
            router.push("/")
        }
    }

    function itemAtivo(href: string) {
        return pathname === href || pathname.startsWith(href + "/")
    }

    const marca = (
        <div className="flex items-center gap-3 px-1">
            <div className="font-display flex h-8 w-8 items-center justify-center rounded-md bg-[#2F5D4E] text-sm font-semibold text-[#F6F5F1]">
                M
            </div>
            <div>
                <p className="font-display text-[1.05rem] leading-tight tracking-tight text-white">
                    Minha Loja
                </p>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#8A8778]">
                    Painel administrativo
                </p>
            </div>
        </div>
    )

    const conteudoMenu = (
        <>
            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
                <p className="font-mono mb-3 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#6F6C61]">
                    Menu
                </p>

                {menu.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setAberto(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                            itemAtivo(item.href)
                                ? "bg-[#2F5D4E] text-white"
                                : "text-[#9C998F] hover:bg-white/5 hover:text-white"
                        }`}
                    >
                        <span className="flex w-6 justify-center text-base">{item.icone}</span>
                        <span>{item.nome}</span>
                    </Link>
                ))}

                <p className="font-mono mb-3 mt-6 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#6F6C61]">
                    Em breve
                </p>

                {emBreve.map((item) => (
                    <div
                        key={item.nome}
                        aria-disabled
                        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#5C594F]"
                    >
                        <span className="flex w-6 justify-center text-base opacity-60">{item.icone}</span>
                        <span>{item.nome}</span>
                    </div>
                ))}
            </nav>

            <div className="p-4">
                <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                    <div className="font-mono flex h-8 w-8 items-center justify-center rounded-full bg-[#C9A227]/20 text-xs font-semibold text-[#C9A227]">
                        AD
                    </div>
                    <div className="min-w-0 text-xs">
                        <p className="truncate font-medium text-white">Administrador</p>
                        <p className="truncate text-[#8A8778]">Loja única</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleSair}
                    disabled={saindo}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#E1876B] transition-colors hover:bg-white/5 disabled:opacity-50"
                >
                    <span className="text-base">↪</span>
                    <span>{saindo ? "Saindo..." : "Sair"}</span>
                </button>
            </div>
        </>
    )

    return (
        <>
            {/* Sidebar - desktop */}
            <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col bg-[#161510] md:flex print:hidden">
                <div className="flex h-20 items-center border-b border-white/10 px-6">
                    {marca}
                </div>

                {conteudoMenu}
            </aside>

            {/* Topbar - mobile */}
            <div className="sticky top-0 z-40 flex h-16 items-center justify-between bg-[#161510] px-4 md:hidden print:hidden">
                <div className="flex items-center gap-2.5">
                    <div className="font-display flex h-7 w-7 items-center justify-center rounded-md bg-[#2F5D4E] text-xs font-semibold text-[#F6F5F1]">
                        M
                    </div>
                    <span className="font-display text-sm tracking-tight text-white">Minha Loja</span>
                </div>

                <button
                    type="button"
                    onClick={() => setAberto((v) => !v)}
                    aria-label="Abrir menu"
                    className="rounded-lg p-2 text-[#C9C6BC] hover:bg-white/10"
                >
                    {aberto ? "✕" : "☰"}
                </button>
            </div>

            {aberto && (
                <div className="fixed inset-0 z-30 md:hidden print:hidden">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setAberto(false)}
                    />

                    <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-[#161510] shadow-xl">
                        <div className="flex h-16 items-center border-b border-white/10 px-6">
                            {marca}
                        </div>

                        {conteudoMenu}
                    </aside>
                </div>
            )}
        </>
    )
}
