"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto, Unidade } from "@/app/type/type"
import { listarProdutos, listarTodasUnidades, restaurarUnidade, identificarPeca } from "@/middleware/produtos"
import { ApiError } from "@/middleware/client"
import { FiMapPin, FiAlertTriangle, FiCheck } from "react-icons/fi"

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

            <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">

                <div className="mx-auto max-w-5xl">

                    <div className="h-9 w-64 animate-pulse rounded-lg bg-[#D3DADD]" />

                    <div className="mt-3 h-4 w-80 animate-pulse rounded bg-[#D3DADD]" />

                    <div className="mt-10 space-y-3">

                        {[1, 2, 3, 4].map(item => (

                            <div
                                key={item}
                                className="card h-16 animate-pulse"
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

            <main className="min-h-screen bg-[#F0F3F4] p-8 md:ml-64">

                <div className="card mx-auto max-w-xl p-10 text-center">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FDECEA] text-[#D4351C]">
                        <FiAlertTriangle className="w-7" aria-hidden />
                    </div>

                    <h1 className="font-display mt-5 text-2xl text-[#1E2428]">
                        Erro ao carregar avarias
                    </h1>

                    <p className="mt-2 text-[#5A6469]">
                        {erro}
                    </p>

                    <button
                        onClick={() => window.location.reload()}
                        className="btn btn-primario mt-6"
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

        <main className="min-h-screen bg-[#F0F3F4] text-[#1E2428] md:ml-64">

            {/* ==========================
                HEADER
            ========================== */}

            <header className="sticky top-16 z-30 border-b border-[#D3DADD] bg-[#F0F3F4]/95 backdrop-blur md:top-0">

                <div className="flex min-h-20 items-center justify-between gap-6 px-6 md:px-10">

                    <div>

                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#8C969B]">
                            Painel administrativo
                        </p>

                        <h1 className="font-display text-2xl text-[#1E2428]">
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

                            <h2 className="font-display text-3xl text-[#1E2428] sm:text-4xl">
                                Peças avariadas
                            </h2>

                            <p className="mt-2 max-w-md text-[#5A6469]">
                                Unidades marcadas como avariadas saem do estoque vendável, mas continuam registradas aqui.
                            </p>

                        </div>

                        <Link
                            href="/page/estoque"
                            className="btn btn-neutro shrink-0"
                        >
                            <FiMapPin className="w-4" aria-hidden />
                            <span>Ver estoque</span>
                        </Link>

                    </div>


                    {/* ESTATÍSTICA */}

                    <div className="card mb-8 p-6">

                        <div className="flex items-center justify-between">

                            <div>
                                <p className="text-sm text-[#5A6469]">
                                    Total de peças avariadas
                                </p>
                                <p className="num mt-2 text-3xl font-extrabold text-[#1E2428]">
                                    {avariadas.length}
                                </p>
                            </div>

                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FDECEA] text-[#D4351C]">
                                <FiAlertTriangle className="w-5" aria-hidden />
                            </div>

                        </div>

                    </div>


                    {erroRestaurar && (
                        <div role="alert" className="mb-6 rounded-lg bg-[#FDECEA] px-4 py-2.5 text-sm font-semibold text-[#D4351C]">
                            {erroRestaurar}
                        </div>
                    )}


                    {/* ==========================
                        LISTA
                    ========================== */}

                    {avariadas.length === 0 ? (

                        <div className="rounded-lg border border-dashed border-[#D3DADD] bg-white p-16 text-center">

                            <FiCheck className="mx-auto w-10 text-[#8C969B]" aria-hidden />

                            <h3 className="font-display mt-5 text-xl text-[#1E2428]">
                                Nenhuma avaria registrada
                            </h3>

                            <p className="mt-2 text-sm text-[#5A6469]">
                                Quando uma peça for avariada, ela aparece aqui.
                            </p>

                        </div>

                    ) : (

                        <div className="card overflow-hidden">

                            <ul className="divide-y divide-[#E4E9EB] px-5">

                                {avariadas.map(({ unidade, produto }) => (

                                    <li
                                        key={unidade.id}
                                        className="flex items-center gap-3 py-3.5"
                                    >

                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F0F3F4]">
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

                                            <p className="truncate text-sm font-semibold text-[#1E2428]">
                                                {produto?.nome ?? `Produto #${unidade.produto_id}`}
                                            </p>

                                            <p className="text-xs text-[#5A6469]">
                                                <span className="font-mono">{identificarPeca(produto?.codigo, unidade.sequencia)}</span>
                                                {" · "}
                                                {unidade.endereco_nome || "sem lugar definido"}
                                                {" · "}
                                                {formatarData(unidade.avariada_em)}
                                            </p>

                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleRestaurar(unidade.id)}
                                            disabled={restaurando === unidade.id}
                                            className="shrink-0 rounded-lg border border-[#D3DADD] bg-white px-3.5 py-2 text-xs font-bold text-[#1E2428] transition-colors hover:bg-[#F0F3F4] disabled:cursor-not-allowed disabled:opacity-50"
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
