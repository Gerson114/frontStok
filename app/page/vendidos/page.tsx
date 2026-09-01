"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto, Unidade } from "@/app/type/type"
import { listarProdutos, listarTodasUnidades, identificarPeca } from "@/middleware/produtos"
import Pagination from "@/app/components/pagination/pagination"
import Preco, { formatarMoeda } from "@/app/components/preco/preco"
import { FiFileText, FiSearch, FiX, FiAlertTriangle, FiCheck, FiDollarSign, FiShoppingBag } from "react-icons/fi"
import { urlDaImagem } from "@/security/imagem"

const ITENS_POR_PAGINA = 10

export default function Vendidos() {

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [unidades, setUnidades] = useState<Unidade[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    const [busca, setBusca] = useState("")
    const [paginaAtual, setPaginaAtual] = useState(1)

    async function carregar() {

        try {

            const [listaProdutos, listaUnidades] = await Promise.all([
                listarProdutos(),
                listarTodasUnidades(),
            ])

            setProdutos(listaProdutos)
            setUnidades(listaUnidades)

        } catch (error) {

            console.error("Erro ao buscar vendidos:", error)

            setErro("Não foi possível carregar as peças vendidas.")

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

    const vendidas = useMemo(() => {

        return unidades
            .filter((unidade) => unidade.vendida)
            .map((unidade) => ({
                unidade,
                produto: produtosPorId.get(unidade.produto_id),
            }))
            .sort((a, b) => {
                const dataA = a.unidade.vendida_em ?? ""
                const dataB = b.unidade.vendida_em ?? ""
                return dataB.localeCompare(dataA)
            })

    }, [unidades, produtosPorId])

    const valorTotal = vendidas.reduce(
        (total, { produto }) => total + Number(produto?.preco ?? 0),
        0
    )

    function formatarData(data: string | null | undefined): string {
        if (!data) return "—"
        return new Date(data).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    }


    // ==============================
    // FILTRO DE BUSCA
    // ==============================

    const termoBusca = busca.trim().toLowerCase()

    const vendidasFiltradas = termoBusca
        ? vendidas.filter(({ produto }) => {
            return (
                (produto?.nome.toLowerCase().includes(termoBusca) ?? false) ||
                (produto?.codigo.toLowerCase().includes(termoBusca) ?? false)
            )
        })
        : vendidas

    function aoMudarBusca(valor: string) {
        setBusca(valor)
        setPaginaAtual(1)
    }


    // ==============================
    // PAGINAÇÃO
    // ==============================

    const totalPaginas = Math.max(1, Math.ceil(vendidasFiltradas.length / ITENS_POR_PAGINA))
    const paginaAtualCorrigida = Math.min(paginaAtual, totalPaginas)

    const vendidasDaPagina = vendidasFiltradas.slice(
        (paginaAtualCorrigida - 1) * ITENS_POR_PAGINA,
        paginaAtualCorrigida * ITENS_POR_PAGINA
    )


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

                <div className="mx-auto max-w-xl card p-10 text-center">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FDECEA] text-[#D4351C]">
                        <FiAlertTriangle className="w-7" aria-hidden />
                    </div>

                    <h1 className="font-display mt-5 text-2xl text-[#1E2428]">
                        Erro ao carregar vendidos
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

                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5A6469]">
                            Painel administrativo
                        </p>

                        <h1 className="font-display text-2xl text-[#1E2428]">
                            Vendidos
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
                                Peças vendidas
                            </h2>

                            <p className="mt-2 max-w-md text-[#5A6469]">
                                Unidades que já saíram do estoque — vendidas no caixa ou por pedidos confirmados.
                            </p>

                        </div>

                        <Link
                            href="/page/pedidos"
                            className="btn btn-neutro shrink-0"
                        >
                            <FiFileText className="w-4" aria-hidden />
                            <span>Ver pedidos</span>
                        </Link>

                    </div>


                    {/* ==========================
                        ESTATÍSTICAS
                    ========================== */}

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                        <div className="card p-6">

                            <div className="flex items-center justify-between">

                                <div>
                                    <p className="text-sm text-[#5A6469]">
                                        Total de peças vendidas
                                    </p>
                                    <p className="num mt-2 text-3xl font-bold text-[#1E2428]">
                                        {vendidas.length}
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E6F3FF] text-[#0086FF]">
                                    <FiCheck className="w-5" aria-hidden />
                                </div>

                            </div>

                        </div>

                        <div className="card p-6">

                            <div className="flex items-center justify-between gap-3">

                                <div className="min-w-0">
                                    <p className="text-sm text-[#5A6469]">
                                        Valor total vendido
                                    </p>
                                    <p className="num mt-2 truncate text-2xl font-bold text-[#1E2428]">
                                        {formatarMoeda(valorTotal)}
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E6F3FF] text-[#0086FF]">
                                    <FiDollarSign className="w-5" aria-hidden />
                                </div>

                            </div>

                        </div>

                    </div>


                    {/* ==========================
                        BUSCA
                    ========================== */}

                    <div className="mt-8 relative w-full sm:w-80">

                        <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8C969B]" aria-hidden />

                        <input
                            type="text"
                            value={busca}
                            onChange={(e) => aoMudarBusca(e.target.value)}
                            placeholder="Buscar por nome ou código"
                            className="field"
                            style={{ paddingLeft: "2.25rem", paddingRight: busca ? "2.25rem" : undefined }}
                        />

                        {busca && (
                            <button
                                type="button"
                                onClick={() => aoMudarBusca("")}
                                aria-label="Limpar busca"
                                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#5A6469] transition hover:bg-[#F0F3F4]"
                            >
                                <FiX className="w-4" aria-hidden />
                            </button>
                        )}

                    </div>


                    {/* ==========================
                        LISTA
                    ========================== */}

                    {vendidasFiltradas.length === 0 ? (

                        <div className="mt-10 rounded-lg border border-dashed border-[#D3DADD] bg-white p-16 text-center">

                            <FiShoppingBag className="mx-auto w-10 text-[#8C969B]" aria-hidden />

                            <h3 className="font-display mt-5 text-xl text-[#1E2428]">
                                Nenhuma peça vendida ainda
                            </h3>

                            <p className="mt-2 text-sm text-[#5A6469]">
                                {vendidas.length === 0
                                    ? "Quando uma peça for vendida, ela aparece aqui."
                                    : "Nenhuma peça vendida corresponde à busca."}
                            </p>

                        </div>

                    ) : (

                        <div className="mt-10 card overflow-hidden">

                            <ul className="divide-y divide-[#D3DADD] px-5">

                                {vendidasDaPagina.map(({ unidade, produto }) => (

                                    <li
                                        key={unidade.id}
                                        className="flex items-center gap-3 py-3.5"
                                    >

                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F0F3F4]">
                                            {produto?.imagem_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={urlDaImagem(produto.imagem_url)}
                                                    alt={produto.nome}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : null}
                                        </div>

                                        <div className="min-w-0 flex-1">

                                            <p className="truncate text-sm font-medium text-[#1E2428]">
                                                {produto?.nome ?? `Produto #${unidade.produto_id}`}
                                            </p>

                                            <p className="font-mono text-xs text-[#5A6469]">
                                                {identificarPeca(produto?.codigo, unidade.sequencia)}
                                                {" · "}
                                                {formatarData(unidade.vendida_em)}
                                            </p>

                                        </div>

                                        <span className="shrink-0">
                                            <Preco valor={Number(produto?.preco ?? 0)} className="text-sm" />
                                        </span>

                                    </li>

                                ))}

                            </ul>

                            <div className="h-5" />

                        </div>

                    )}

                    <Pagination
                        paginaAtual={paginaAtualCorrigida}
                        totalPaginas={totalPaginas}
                        aoMudarPagina={setPaginaAtual}
                    />

                </div>

            </div>

        </main>

    )
}
