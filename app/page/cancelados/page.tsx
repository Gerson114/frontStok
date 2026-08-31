"use client"

import { useState, useEffect } from "react"
import type { Pedido, StatusPedido } from "@/app/type/type"
import { listarPedidos, atualizarStatusPedido } from "@/middleware/pedidos"
import { ApiError } from "@/middleware/client"
import Pagination from "@/app/components/pagination/pagination"
import Preco, { formatarMoeda } from "@/app/components/preco/preco"
import { FiSearch, FiX, FiAlertTriangle, FiDollarSign } from "react-icons/fi"

const ITENS_POR_PAGINA = 10

const STATUS_OPCOES: StatusPedido[] = ["pendente", "confirmado", "enviado", "entregue", "cancelado"]

const STATUS_LABEL: Record<StatusPedido, string> = {
    pendente: "Pendente",
    confirmado: "Confirmado",
    enviado: "Enviado",
    entregue: "Entregue",
    cancelado: "Cancelado",
}

const STATUS_TAG: Record<StatusPedido, string> = {
    pendente: "tag-warning",
    confirmado: "tag-info",
    enviado: "tag-info",
    entregue: "tag-success",
    cancelado: "tag-danger",
}

export default function Cancelados() {

    const [pedidos, setPedidos] = useState<Pedido[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    const [busca, setBusca] = useState("")
    const [paginaAtual, setPaginaAtual] = useState(1)

    const [atualizandoId, setAtualizandoId] = useState<number | null>(null)
    const [erroAtualizacao, setErroAtualizacao] = useState("")

    async function carregar() {

        try {

            const lista = await listarPedidos()
            setPedidos(lista)

        } catch (error) {

            console.error("Erro ao buscar pedidos:", error)

            setErro("Não foi possível carregar os pedidos.")

        } finally {

            setLoading(false)

        }
    }

    useEffect(() => {

        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()

    }, [])

    function aoMudarBusca(valor: string) {
        setBusca(valor)
        setPaginaAtual(1)
    }

    async function mudarStatus(pedido: Pedido, novoStatus: StatusPedido) {

        if (novoStatus === pedido.status) return

        try {

            setAtualizandoId(pedido.id)
            setErroAtualizacao("")

            const pedidoAtualizado = await atualizarStatusPedido(pedido.id, novoStatus)

            setPedidos((atual) =>
                atual.map((item) => (item.id === pedido.id ? pedidoAtualizado : item))
            )

        } catch (error) {

            console.error("Erro ao atualizar status do pedido:", error)

            setErroAtualizacao(
                error instanceof ApiError ? error.message : "Não foi possível atualizar o status."
            )

        } finally {

            setAtualizandoId(null)

        }
    }


    // ==============================
    // SÓ CANCELADOS
    // ==============================

    // Espelha o filtro inverso da página de Pedidos: lá "cancelado" some da
    // lista, aqui é a única coisa que aparece.
    const cancelados = pedidos.filter((pedido) => pedido.status === "cancelado")


    // ==============================
    // ESTATÍSTICAS
    // ==============================

    function totalDoPedido(pedido: Pedido): number {
        return pedido.itens.reduce((total, item) => total + item.quantidade * item.preco_unitario, 0)
    }

    const valorTotal = cancelados.reduce((total, pedido) => total + totalDoPedido(pedido), 0)

    const formatarData = (iso: string) =>
        new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })


    // ==============================
    // FILTRO DE BUSCA
    // ==============================

    const termoBusca = busca.trim().toLowerCase()

    const canceladosFiltrados = termoBusca
        ? cancelados.filter((pedido) => {
            return (
                pedido.cliente_nome.toLowerCase().includes(termoBusca) ||
                pedido.cliente_contato.toLowerCase().includes(termoBusca) ||
                pedido.codigo.toLowerCase().includes(termoBusca) ||
                String(pedido.id).includes(termoBusca)
            )
        })
        : cancelados


    // ==============================
    // PAGINAÇÃO
    // ==============================

    const totalPaginas = Math.max(1, Math.ceil(canceladosFiltrados.length / ITENS_POR_PAGINA))
    const paginaAtualCorrigida = Math.min(paginaAtual, totalPaginas)

    const canceladosDaPagina = canceladosFiltrados.slice(
        (paginaAtualCorrigida - 1) * ITENS_POR_PAGINA,
        paginaAtualCorrigida * ITENS_POR_PAGINA
    )


    // ==============================
    // LOADING
    // ==============================

    if (loading) {

        return (

            <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">

                <div className="mx-auto max-w-7xl">

                    <div className="h-9 w-64 animate-pulse rounded-lg bg-[#D3DADD]" />

                    <div className="mt-3 h-4 w-80 animate-pulse rounded bg-[#D3DADD]" />

                    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">

                        {[1, 2].map(item => (

                            <div
                                key={item}
                                className="card h-28 animate-pulse"
                            />

                        ))}

                    </div>

                    <div className="mt-10 space-y-4">

                        {[1, 2, 3, 4].map(item => (

                            <div
                                key={item}
                                className="card h-32 animate-pulse"
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
                        Erro ao carregar cancelados
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
                            Cancelados
                        </h1>

                    </div>

                </div>

            </header>


            {/* ==========================
                CONTEÚDO
            ========================== */}

            <div className="p-6 md:p-10">

                <div className="mx-auto max-w-7xl">

                    {/* INTRODUÇÃO */}

                    <div className="mb-8">

                        <h2 className="font-display text-3xl text-[#1E2428] sm:text-4xl">
                            Pedidos cancelados
                        </h2>

                        <p className="mt-2 max-w-md text-[#5A6469]">
                            Pedidos que saíram da lista de Pedidos por terem sido cancelados.
                        </p>

                    </div>


                    {/* ==========================
                        ESTATÍSTICAS
                    ========================== */}

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                        <div className="card p-6">

                            <div className="flex items-center justify-between">

                                <div>
                                    <p className="text-sm text-[#5A6469]">
                                        Pedidos cancelados
                                    </p>
                                    <p className="num mt-2 text-3xl font-bold text-[#1E2428]">
                                        {cancelados.length}
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FDECEA] text-[#D4351C]">
                                    <FiX className="w-5" aria-hidden />
                                </div>

                            </div>

                        </div>

                        <div className="card p-6">

                            <div className="flex items-center justify-between gap-3">

                                <div className="min-w-0">
                                    <p className="text-sm text-[#5A6469]">
                                        Valor cancelado
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

                    <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                        <p className="text-sm text-[#5A6469]">
                            {canceladosFiltrados.length} de {cancelados.length} pedido(s) encontrado(s)
                        </p>

                        <div className="relative w-full sm:w-72">

                            <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8C969B]" aria-hidden />

                            <input
                                type="text"
                                value={busca}
                                onChange={(e) => aoMudarBusca(e.target.value)}
                                placeholder="Buscar por cliente, código ou nº do pedido"
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

                    </div>

                    {erroAtualizacao && (
                        <div className="mt-4 rounded-lg bg-[#FDECEA] px-4 py-2.5 text-sm font-semibold text-[#D4351C]">
                            {erroAtualizacao}
                        </div>
                    )}


                    {/* ==========================
                        LISTA
                    ========================== */}

                    {canceladosFiltrados.length === 0 ? (

                        <div className="mt-10 rounded-lg border border-dashed border-[#D3DADD] bg-white p-16 text-center">

                            <FiX className="mx-auto w-10 text-[#8C969B]" aria-hidden />

                            <h3 className="font-display mt-5 text-xl text-[#1E2428]">
                                Nenhum pedido cancelado
                            </h3>

                            <p className="mt-2 text-sm text-[#5A6469]">
                                {cancelados.length === 0
                                    ? "Nenhum pedido foi cancelado até agora."
                                    : "Nenhum pedido corresponde à busca."}
                            </p>

                            {cancelados.length > 0 && (

                                <button
                                    type="button"
                                    onClick={() => aoMudarBusca("")}
                                    className="btn btn-neutro mt-6"
                                >
                                    Limpar busca
                                </button>

                            )}

                        </div>

                    ) : (

                        <div className="mt-10 space-y-4">

                            {canceladosDaPagina.map((pedido) => (

                                <div
                                    key={pedido.id}
                                    className="card overflow-hidden"
                                >

                                    <div className="flex flex-col gap-4 border-b border-[#D3DADD] p-5 sm:flex-row sm:items-center sm:justify-between">

                                        <div>

                                            <div className="flex items-center gap-2">

                                                <span className="font-mono text-sm font-semibold text-[#1E2428]">
                                                    Pedido #{pedido.id}
                                                </span>

                                                {pedido.codigo && (
                                                    <span className="font-mono text-xs text-[#8C969B]">
                                                        · código {pedido.codigo}
                                                    </span>
                                                )}

                                                <span className={`tag ${STATUS_TAG[pedido.status]}`}>
                                                    {STATUS_LABEL[pedido.status]}
                                                </span>

                                            </div>

                                            <p className="mt-1 text-sm text-[#5A6469]">
                                                {pedido.cliente_nome || `Cliente #${pedido.cliente_id}`}
                                                {pedido.cliente_contato ? ` · ${pedido.cliente_contato}` : ""}
                                            </p>

                                            <p className="mt-0.5 text-xs text-[#8C969B]">
                                                {formatarData(pedido.created_at)}
                                            </p>

                                        </div>

                                        <div className="flex items-center gap-2">

                                            <label className="sr-only" htmlFor={`status-${pedido.id}`}>
                                                Status do pedido
                                            </label>

                                            <select
                                                id={`status-${pedido.id}`}
                                                value={pedido.status}
                                                onChange={(e) => mudarStatus(pedido, e.target.value as StatusPedido)}
                                                disabled={atualizandoId === pedido.id}
                                                className="field cursor-pointer py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {STATUS_OPCOES.map((status) => (
                                                    <option key={status} value={status}>
                                                        {STATUS_LABEL[status]}
                                                    </option>
                                                ))}
                                            </select>

                                        </div>

                                    </div>

                                    <ul className="divide-y divide-[#D3DADD] px-5">

                                        {pedido.itens.map((item) => (

                                            <li
                                                key={item.id}
                                                className="flex items-center justify-between gap-3 py-3 text-sm"
                                            >

                                                <span className="min-w-0 truncate text-[#1E2428]">
                                                    {item.quantidade}x {item.produto_nome || `Produto #${item.produto_id}`}
                                                    {item.produto_codigo && (
                                                        <span className="font-mono ml-1.5 text-xs text-[#8C969B]">
                                                            #{item.produto_codigo}
                                                        </span>
                                                    )}
                                                </span>

                                                <span className="shrink-0">
                                                    <Preco
                                                        valor={item.quantidade * item.preco_unitario}
                                                        className="text-sm"
                                                    />
                                                </span>

                                            </li>

                                        ))}

                                    </ul>

                                    <div className="flex items-center justify-between gap-3 bg-[#F0F3F4] px-5 py-3">

                                        <span className="text-xs font-semibold uppercase tracking-wide text-[#5A6469]">
                                            Total
                                        </span>

                                        <Preco valor={totalDoPedido(pedido)} className="text-lg" />

                                    </div>

                                </div>

                            ))}

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
