"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { Pedido, StatusPedido } from "@/app/type/type"
import { listarPedidos, atualizarStatusPedido } from "@/middleware/pedidos"
import { ApiError } from "@/middleware/client"
import Pagination from "@/app/components/pagination/pagination"
import Preco, { formatarMoeda } from "@/app/components/preco/preco"
import { FiFileText, FiSearch, FiX, FiAlertTriangle, FiDollarSign, FiTag } from "react-icons/fi"
import { urlDaImagem } from "@/security/imagem"

/**
 * Pedidos: a lista de tudo o que foi pedido, em qualquer situação.
 *
 * Cancelado não é outro assunto, é o mesmo pedido num outro fim — e por isso
 * não tem tela própria. Ter duas telas iguais, uma mostrando o que não foi
 * cancelado e outra só o que foi, obrigava o lojista a adivinhar em qual
 * delas o pedido #48 estava para poder procurá-lo, e fazia a mesma busca, o
 * mesmo cartão e o mesmo seletor de status existirem em dois arquivos.
 *
 * Aqui é uma lista só, com abas de situação em cima. A aba escolhida vai
 * para o endereço (?status=cancelados), então o link continua servindo para
 * mandar alguém direto ao que interessa — inclusive o link antigo de
 * /page/cancelados, que aponta para cá.
 */

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


// ==============================
// ABAS DE SITUAÇÃO
// ==============================

type Filtro = "andamento" | "entregues" | "cancelados" | "todos"

const FILTROS: { chave: Filtro; nome: string }[] = [
    { chave: "andamento", nome: "Em andamento" },
    { chave: "entregues", nome: "Entregues" },
    { chave: "cancelados", nome: "Cancelados" },
    { chave: "todos", nome: "Todos" },
]

/** A aba padrão é "em andamento": é o que ainda dá trabalho hoje. */
function filtroDoEndereco(valor: string | null): Filtro {
    return FILTROS.some((filtro) => filtro.chave === valor) ? (valor as Filtro) : "andamento"
}

function pertenceAoFiltro(pedido: Pedido, filtro: Filtro): boolean {

    switch (filtro) {
        case "entregues":
            return pedido.status === "entregue"
        case "cancelados":
            return pedido.status === "cancelado"
        case "todos":
            return true
        default:
            return pedido.status !== "entregue" && pedido.status !== "cancelado"
    }
}

/** O texto da tela muda com a aba — o resto dela, não. */
const TEXTOS: Record<Filtro, { titulo: string; explicacao: string; rotulo: string; vazio: string }> = {
    andamento: {
        titulo: "Pedidos em andamento",
        explicacao: "O que ainda passa pela sua mão: acompanhe e atualize a situação de cada pedido.",
        rotulo: "Em andamento",
        vazio: "Nenhum pedido em andamento no momento.",
    },
    entregues: {
        titulo: "Pedidos entregues",
        explicacao: "Pedidos que chegaram ao cliente. As peças que saíram estão em Vendidos.",
        rotulo: "Entregues",
        vazio: "Nenhum pedido entregue até agora.",
    },
    cancelados: {
        titulo: "Pedidos cancelados",
        explicacao: "Pedidos que não vão ser atendidos. Mudar a situação aqui traz o pedido de volta.",
        rotulo: "Cancelados",
        vazio: "Nenhum pedido foi cancelado até agora.",
    },
    todos: {
        titulo: "Todos os pedidos",
        explicacao: "A lista inteira, em qualquer situação — é aqui que se acha um pedido antigo.",
        rotulo: "Pedidos",
        vazio: "Ainda não há pedidos de clientes registrados.",
    },
}


function PedidosInterno() {

    const router = useRouter()
    const parametros = useSearchParams()

    const filtro = filtroDoEndereco(parametros.get("status"))

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

    // Trocar de aba volta para a primeira página: a página 3 da lista de
    // andamento não quer dizer nada na lista de cancelados.
    function trocarFiltro(novo: Filtro) {

        if (novo === filtro) return

        setPaginaAtual(1)
        router.replace(novo === "andamento" ? "/page/pedidos" : `/page/pedidos?status=${novo}`, { scroll: false })
    }

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
    // A LISTA DA ABA ESCOLHIDA
    // ==============================

    // O pedido que muda de situação troca de aba na hora, sem recarregar:
    // confirmar um cancelamento aqui faz o cartão sair da lista de andamento
    // e aparecer na de cancelados, que é o que acabou de acontecer com ele.
    const daAba = useMemo(
        () => pedidos.filter((pedido) => pertenceAoFiltro(pedido, filtro)),
        [pedidos, filtro]
    )

    // Quantos há em cada aba, para o lojista ver o que existe antes de clicar.
    const contagens = useMemo(() => {

        const conta = {} as Record<Filtro, number>

        for (const { chave } of FILTROS) {
            conta[chave] = pedidos.filter((pedido) => pertenceAoFiltro(pedido, chave)).length
        }

        return conta

    }, [pedidos])


    // ==============================
    // ESTATÍSTICAS
    // ==============================

    const textos = TEXTOS[filtro]

    const pendentes = daAba.filter((pedido) => pedido.status === "pendente").length

    // Pendentes só aparece onde pode haver algum: em Entregues e Cancelados
    // seria um cartão fixo em zero ocupando um terço da linha.
    const mostraPendentes = filtro === "andamento" || filtro === "todos"

    function totalDoPedido(pedido: Pedido): number {
        return pedido.itens.reduce((total, item) => total + item.quantidade * item.preco_unitario, 0)
    }

    const valorTotal = daAba.reduce((total, pedido) => total + totalDoPedido(pedido), 0)

    const formatarData = (iso: string) =>
        new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })


    // ==============================
    // FILTRO DE BUSCA
    // ==============================

    const termoBusca = busca.trim().toLowerCase()

    const pedidosFiltrados = termoBusca
        ? daAba.filter((pedido) => {
            return (
                pedido.cliente_nome.toLowerCase().includes(termoBusca) ||
                pedido.cliente_contato.toLowerCase().includes(termoBusca) ||
                pedido.codigo.toLowerCase().includes(termoBusca) ||
                String(pedido.id).includes(termoBusca)
            )
        })
        : daAba


    // ==============================
    // PAGINAÇÃO
    // ==============================

    const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / ITENS_POR_PAGINA))
    const paginaAtualCorrigida = Math.min(paginaAtual, totalPaginas)

    const pedidosDaPagina = pedidosFiltrados.slice(
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

                    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">

                        {[1, 2, 3].map(item => (

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
                        Erro ao carregar pedidos
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
                            Pedidos
                        </h1>

                    </div>

                    {/* Pedido confirmado vira etiqueta: o caminho natural
                        daqui é a fila de impressão. */}
                    <Link
                        href="/page/etiquetas"
                        className="btn btn-secundario flex shrink-0 items-center gap-2"
                    >
                        <FiTag className="w-4" aria-hidden />
                        <span className="hidden sm:inline">Etiquetas</span>
                    </Link>

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
                            {textos.titulo}
                        </h2>

                        <p className="mt-2 max-w-md text-[#5A6469]">
                            {textos.explicacao}
                        </p>

                    </div>


                    {/* ==========================
                        ABAS DE SITUAÇÃO
                    ========================== */}

                    <div
                        role="tablist"
                        aria-label="Situação dos pedidos"
                        className="mb-8 flex flex-wrap gap-2 border-b border-[#D3DADD] pb-px"
                    >

                        {FILTROS.map(({ chave, nome }) => {

                            const ativa = chave === filtro

                            return (

                                <button
                                    key={chave}
                                    type="button"
                                    role="tab"
                                    aria-selected={ativa}
                                    onClick={() => trocarFiltro(chave)}
                                    className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                                        ativa
                                            ? "border-[#0086FF] text-[#0086FF]"
                                            : "border-transparent text-[#5A6469] hover:text-[#1E2428]"
                                    }`}
                                >

                                    {nome}

                                    <span className={`num rounded-full px-2 py-0.5 text-xs font-bold ${
                                        ativa ? "bg-[#E6F3FF] text-[#0086FF]" : "bg-[#F0F3F4] text-[#5A6469]"
                                    }`}>
                                        {contagens[chave]}
                                    </span>

                                </button>

                            )

                        })}

                    </div>


                    {/* ==========================
                        ESTATÍSTICAS
                    ========================== */}

                    <div className={`grid grid-cols-1 gap-5 ${mostraPendentes ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>

                        <div className="card p-6">

                            <div className="flex items-center justify-between">

                                <div>
                                    <p className="text-sm text-[#5A6469]">
                                        {textos.rotulo}
                                    </p>
                                    <p className="num mt-2 text-3xl font-bold text-[#1E2428]">
                                        {daAba.length}
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E6F3FF] text-[#0086FF]">
                                    <FiFileText className="w-5" aria-hidden />
                                </div>

                            </div>

                        </div>

                        {mostraPendentes && (

                            <div className="card p-6">

                                <div className="flex items-center justify-between">

                                    <div>
                                        <p className="text-sm text-[#5A6469]">
                                            Pendentes
                                        </p>
                                        <p className={`num mt-2 text-3xl font-bold ${pendentes > 0 ? "text-[#8A6C1B]" : "text-[#1E2428]"}`}>
                                            {pendentes}
                                        </p>
                                    </div>

                                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${pendentes > 0 ? "bg-[#FFF6E0] text-[#8A6C1B]" : "bg-[#F0F3F4] text-[#5A6469]"}`}>
                                        <FiAlertTriangle className="w-5" aria-hidden />
                                    </div>

                                </div>

                            </div>

                        )}

                        <div className="card p-6">

                            <div className="flex items-center justify-between gap-3">

                                <div className="min-w-0">
                                    <p className="text-sm text-[#5A6469]">
                                        Valor total
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
                            {pedidosFiltrados.length} de {daAba.length} pedido(s) encontrado(s)
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
                        LISTA DE PEDIDOS
                    ========================== */}

                    {pedidosFiltrados.length === 0 ? (

                        <div className="mt-10 rounded-lg border border-dashed border-[#D3DADD] bg-white p-16 text-center">

                            <FiFileText className="mx-auto w-10 text-[#8C969B]" aria-hidden />

                            <h3 className="font-display mt-5 text-xl text-[#1E2428]">
                                Nenhum pedido encontrado
                            </h3>

                            <p className="mt-2 text-sm text-[#5A6469]">
                                {daAba.length === 0
                                    ? textos.vazio
                                    : "Nenhum pedido corresponde à busca."}
                            </p>

                            {daAba.length > 0 && (

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

                            {pedidosDaPagina.map((pedido) => (

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

                                        {pedido.itens.map((item) => {

                                            const detalhes = [item.produto_categoria, item.produto_tamanho, item.produto_tecido, item.produto_cor]
                                                .filter(Boolean)

                                            return (

                                                <li
                                                    key={item.id}
                                                    className="flex items-start gap-3 py-3.5 text-sm"
                                                >

                                                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#F0F3F4]">
                                                        {item.produto_imagem_url ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={urlDaImagem(item.produto_imagem_url)}
                                                                alt={item.produto_nome}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : null}
                                                    </div>

                                                    <div className="min-w-0 flex-1">

                                                        <p className="truncate font-medium text-[#1E2428]">
                                                            {item.produto_nome || `Produto #${item.produto_id}`}
                                                            {item.produto_codigo && (
                                                                <span className="font-mono ml-1.5 text-xs font-normal text-[#8C969B]">
                                                                    #{item.produto_codigo}
                                                                </span>
                                                            )}
                                                        </p>

                                                        {detalhes.length > 0 && (
                                                            <div className="mt-1 flex flex-wrap gap-1.5">
                                                                {detalhes.map((detalhe, indice) => (
                                                                    <span
                                                                        key={indice}
                                                                        className="rounded-full bg-[#F0F3F4] px-2 py-0.5 text-xs text-[#5A6469]"
                                                                    >
                                                                        {detalhe}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {item.produto_descricao && (
                                                            <p className="mt-1 line-clamp-2 text-xs text-[#8C969B]">
                                                                {item.produto_descricao}
                                                            </p>
                                                        )}

                                                        <p className="mt-1 text-xs text-[#5A6469]">
                                                            {item.quantidade}x {formatarMoeda(item.preco_unitario)}
                                                        </p>

                                                    </div>

                                                    <span className="shrink-0">
                                                        <Preco
                                                            valor={item.quantidade * item.preco_unitario}
                                                            className="text-sm"
                                                        />
                                                    </span>

                                                </li>

                                            )

                                        })}

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

// A aba vem do endereço, e ler o endereço exige Suspense no App Router.
export default function Pedidos() {
    return (
        <Suspense fallback={<main className="min-h-screen bg-[#F0F3F4] md:ml-64" />}>
            <PedidosInterno />
        </Suspense>
    )
}
