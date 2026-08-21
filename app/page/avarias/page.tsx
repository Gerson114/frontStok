"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto, Unidade } from "@/app/type/type"
import { listarProdutos, listarTodasUnidades, restaurarUnidade } from "@/middleware/produtos"
import { ApiError } from "@/middleware/client"

export default function Avarias() {

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [unidades, setUnidades] = useState<Unidade[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    const [restaurando, setRestaurando] = useState<number | null>(null)
    const [erroRestaurar, setErroRestaurar] = useState("")

    async function carregar() {

        try {

            const [listaProdutos, listaUnidades] = await Promise.all([
                listarProdutos(),
                listarTodasUnidades(),
            ])

            setProdutos(listaProdutos)
            setUnidades(listaUnidades)

        } catch (error) {

            console.error("Erro ao buscar avarias:", error)

            setErro("Não foi possível carregar as avarias.")

        } finally {

            setLoading(false)

        }
    }

    useEffect(() => {

        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()

    }, [])

    const produtosPorId = useMemo(() => {
        const mapa = new Map<number, Produto>()
        for (const produto of produtos) mapa.set(produto.id, produto)
        return mapa
    }, [produtos])

    const avariadas = useMemo(() => {

        return unidades
            .filter((unidade) => unidade.avariada)
            .map((unidade) => ({
                unidade,
                produto: produtosPorId.get(unidade.produto_id),
            }))
            .sort((a, b) => {
                const dataA = a.unidade.avariada_em ?? ""
                const dataB = b.unidade.avariada_em ?? ""
                return dataB.localeCompare(dataA)
            })

    }, [unidades, produtosPorId])

    async function handleRestaurar(unidadeId: number) {

        try {

            setRestaurando(unidadeId)
            setErroRestaurar("")

            await restaurarUnidade(unidadeId)

            await carregar()

        } catch (error) {

            console.error("Erro ao restaurar unidade:", error)

            setErroRestaurar(
                error instanceof ApiError ? error.message : "Não foi possível restaurar a unidade."
            )

        } finally {

            setRestaurando(null)

        }
    }

    function formatarData(data: string | null | undefined): string {
        if (!data) return "—"
        return new Date(data).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        })
    }


    // ==============================
    // LOADING
    // ==============================

    if (loading) {

        return (

            <main className="min-h-screen bg-[#F6F5F1] p-6 md:ml-64 md:p-10">

                <div className="mx-auto max-w-5xl">

                    <div className="h-9 w-64 animate-pulse rounded-lg bg-[#EAE7DE]" />

                    <div className="mt-3 h-4 w-80 animate-pulse rounded bg-[#EAE7DE]" />

                    <div className="mt-10 space-y-3">

                        {[1, 2, 3, 4].map(item => (

                            <div
                                key={item}
                                className="h-16 animate-pulse rounded-2xl border border-[#EAE7DE] bg-white"
                            />

                        ))}

                    </div>

                </div>

            </main>

        )
    }


    // ==============================
    // ERRO
    // ==============================

    if (erro) {

        return (

            <main className="min-h-screen bg-[#F6F5F1] p-8 md:ml-64">

                <div className="mx-auto max-w-xl rounded-2xl border border-[#EAE7DE] bg-white p-10 text-center">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
                        !
                    </div>

                    <h1 className="font-display mt-5 text-2xl font-medium text-[#1C1B19]">
                        Erro ao carregar avarias
                    </h1>

                    <p className="mt-2 text-[#6F6C61]">
                        {erro}
                    </p>

                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 rounded-lg bg-[#2F5D4E] px-6 py-3 font-medium text-white transition hover:bg-[#264C40]"
                    >
                        Tentar novamente
                    </button>

                </div>

            </main>

        )
    }


    // ==============================
    // PÁGINA
    // ==============================

    return (

        <main className="min-h-screen bg-[#F6F5F1] text-[#1C1B19] md:ml-64">

            {/* ==========================
                HEADER
            ========================== */}

            <header className="sticky top-16 z-30 border-b border-[#EAE7DE] bg-[#F6F5F1]/95 backdrop-blur md:top-0">

                <div className="flex min-h-20 items-center justify-between gap-6 px-6 md:px-10">

                    <div>

                        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8E8B80]">
                            Painel administrativo
                        </p>

                        <h1 className="font-display text-2xl font-medium text-[#1C1B19]">
                            Avarias
                        </h1>

                    </div>

                </div>

            </header>


            {/* ==========================
                CONTEÚDO
            ========================== */}

            <div className="p-6 md:p-10">

                <div className="mx-auto max-w-5xl">

                    {/* INTRODUÇÃO */}

                    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                        <div>

                            <h2 className="font-display text-3xl font-medium tracking-tight text-[#1C1B19] sm:text-4xl">
                                Peças avariadas
                            </h2>

                            <p className="mt-2 max-w-md text-[#6F6C61]">
                                Unidades marcadas como avariadas saem do estoque vendável, mas continuam registradas aqui.
                            </p>

                            <div className="mt-6 h-2 stitch max-w-xs opacity-70" />

                        </div>

                        <Link
                            href="/page/estoque"
                            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#EAE7DE] bg-white px-4 py-2.5 text-sm font-medium text-[#1C1B19] transition hover:bg-[#EFEDE6]"
                        >
                            <span>📍</span>
                            <span>Ver estoque</span>
                        </Link>

                    </div>


                    {/* ESTATÍSTICA */}

                    <div className="mb-8 rounded-2xl border border-[#EAE7DE] bg-white p-6">

                        <div className="flex items-center justify-between">

                            <div>
                                <p className="text-sm text-[#8E8B80]">
                                    Total de peças avariadas
                                </p>
                                <p className="font-mono mt-2 text-3xl font-semibold text-[#1C1B19]">
                                    {avariadas.length}
                                </p>
                            </div>

                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-xl">
                                !
                            </div>

                        </div>

                    </div>


                    {erroRestaurar && (
                        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                            {erroRestaurar}
                        </div>
                    )}


                    {/* ==========================
                        LISTA
                    ========================== */}

                    {avariadas.length === 0 ? (

                        <div className="rounded-2xl border border-dashed border-[#D9D5C8] bg-white p-16 text-center">

                            <div className="text-5xl">
                                ✓
                            </div>

                            <h3 className="font-display mt-5 text-xl font-medium text-[#1C1B19]">
                                Nenhuma avaria registrada
                            </h3>

                            <p className="mt-2 text-sm text-[#8E8B80]">
                                Quando uma peça for avariada, ela aparece aqui.
                            </p>

                        </div>

                    ) : (

                        <div className="overflow-hidden rounded-2xl border border-[#EAE7DE] bg-white">

                            <ul className="divide-y divide-[#EAE7DE] px-5">

                                {avariadas.map(({ unidade, produto }) => (

                                    <li
                                        key={unidade.id}
                                        className="flex items-center gap-3 py-3.5"
                                    >

                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F6F5F1]">
                                            {produto?.imagem_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={produto.imagem_url}
                                                    alt={produto.nome}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : null}
                                        </div>

                                        <div className="min-w-0 flex-1">

                                            <p className="truncate text-sm font-medium text-[#1C1B19]">
                                                {produto?.nome ?? `Produto #${unidade.produto_id}`}
                                            </p>

                                            <p className="font-mono text-xs text-[#8E8B80]">
                                                {unidade.codigo}
                                                {" · "}
                                                {unidade.rua > 0 ? `Rua ${unidade.rua} · Bloco ${unidade.bloco}` : "sem local"}
                                                {" · "}
                                                {formatarData(unidade.avariada_em)}
                                            </p>

                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleRestaurar(unidade.id)}
                                            disabled={restaurando === unidade.id}
                                            className="shrink-0 rounded-lg border border-[#EAE7DE] px-3.5 py-2 text-xs font-medium text-[#1C1B19] transition hover:bg-[#EFEDE6] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {restaurando === unidade.id ? "Restaurando..." : "Restaurar ao estoque"}
                                        </button>

                                    </li>

                                ))}

                            </ul>

                            <div className="h-5" />

                        </div>

                    )}

                </div>

            </div>

        </main>

    )
}
