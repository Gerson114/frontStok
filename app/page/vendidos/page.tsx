"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto, Unidade } from "@/app/type/type"
import { listarProdutos, listarTodasUnidades, identificarPeca } from "@/middleware/produtos"
import Pagination from "@/app/components/pagination/pagination"
import Preco, { formatarMoeda } from "@/app/components/preco/preco"
import { FiFileText, FiSearch, FiX, FiAlertTriangle, FiCheck, FiDollarSign, FiShoppingBag } from "react-icons/fi"
import { urlDaImagem } from "@/security/imagem"
import { Pagina, Estado } from "@/app/components/pagina/pagina"
import { useAoVivo } from "@/middleware/aoVivo"

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

            setErro("Não foi possível carregar as unidades vendidas.")

        } finally {

            setLoading(false)

        }
    }

    useEffect(() => {

        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()

    }, [])

    // A venda sai do balcão ou do site e a peça muda de dono: os dois avisos
    // interessam a esta lista.
    useAoVivo(["estoque", "pedido"], carregar)

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

            <Pagina titulo="Vendidos">

                <div className="space-y-3">
                    {[1, 2, 3, 4].map(item => (
                        <div key={item} className="card h-16 animate-pulse" />
                    ))}
                </div>

            </Pagina>

        )
    }


    // ==============================
    // ERRO
    // ==============================

    if (erro) {

        return (

            <Pagina titulo="Vendidos">

                <Estado
                    Icone={FiAlertTriangle}
                    tom="erro"
                    titulo="Erro ao carregar vendidos"
                    texto={erro}
                    acao={
                        <button onClick={() => window.location.reload()} className="btn btn-primario">
                            Tentar novamente
                        </button>
                    }
                />

            </Pagina>

        )
    }


    // ==============================
    // PÁGINA
    // ==============================

    return (

        <Pagina
            titulo="Vendidos"
            descricao="Unidades que já saíram do estoque — vendidas no caixa ou por pedidos confirmados."
            acoes={
                <Link href="/page/pedidos" className="btn btn-neutro">
                    <FiFileText className="w-4" aria-hidden />
                    <span>Ver pedidos</span>
                </Link>
            }
        >
            {/* ==========================
                ESTATÍSTICAS
            ========================== */}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                <div className="card p-4 sm:p-6">

                    <div className="flex items-center justify-between">

                        <div>
                            <p className="text-sm text-[var(--ink-2)]">
                                Total de unidades vendidas
                            </p>
                            <p className="num mt-2 text-3xl font-bold text-[var(--ink)]">
                                {vendidas.length}
                            </p>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--azul-suave)] text-[var(--azul)]">
                            <FiCheck className="w-5" aria-hidden />
                        </div>

                    </div>

                </div>

                <div className="card p-4 sm:p-6">

                    <div className="flex items-center justify-between gap-3">

                        <div className="min-w-0">
                            <p className="text-sm text-[var(--ink-2)]">
                                Valor total vendido
                            </p>
                            <p className="num mt-2 truncate text-2xl font-bold text-[var(--ink)]">
                                {formatarMoeda(valorTotal)}
                            </p>
                        </div>

                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--azul-suave)] text-[var(--azul)]">
                            <FiDollarSign className="w-5" aria-hidden />
                        </div>

                    </div>

                </div>

            </div>


            {/* ==========================
                BUSCA
            ========================== */}

            <div className="relative w-full sm:w-80">

                <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[var(--ink-3)]" aria-hidden />

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
                        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--ink-2)] transition hover:bg-[var(--fundo)]"
                    >
                        <FiX className="w-4" aria-hidden />
                    </button>
                )}

            </div>


            {/* ==========================
                LISTA
            ========================== */}

            {vendidasFiltradas.length === 0 ? (

                <Estado
                    Icone={FiShoppingBag}
                    titulo="Nenhuma unidade vendida ainda"
                    texto={vendidas.length === 0
                        ? "Quando uma unidade for vendida, ela aparece aqui."
                        : "Nenhuma unidade vendida corresponde à busca."}
                />

            ) : (

                <div className="card overflow-hidden">

                    <ul className="divide-y divide-[var(--linha)] px-5">

                        {vendidasDaPagina.map(({ unidade, produto }) => (

                            <li
                                key={unidade.id}
                                className="flex items-center gap-3 py-3.5"
                            >

                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--fundo)]">
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

                                    <p className="truncate text-sm font-medium text-[var(--ink)]">
                                        {produto?.nome ?? `Produto #${unidade.produto_id}`}
                                    </p>

                                    <p className="font-mono text-xs text-[var(--ink-2)]">
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

        </Pagina>

    )
}
