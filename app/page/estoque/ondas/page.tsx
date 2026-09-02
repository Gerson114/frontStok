"use client"

import { useCallback, useEffect, useState } from "react"
import {
    abrirOnda,
    cancelarOnda,
    listarOndas,
    verOnda,
    type Onda,
    type OndaDetalhada,
    type ParadaDaOnda,
} from "@/middleware/wms"
import { listarPedidos } from "@/middleware/pedidos"
import type { Pedido } from "@/app/type/type"
import { ApiError } from "@/middleware/client"
import {
    FiAlertCircle,
    FiCheckCircle,
    FiChevronDown,
    FiChevronUp,
    FiMapPin,
    FiPlusCircle,
    FiX,
} from "react-icons/fi"

/**
 * Separar pedidos: vários numa volta só pelo estoque — a onda.
 *
 * Era uma de duas telas de separação; a outra, que separava um pedido só,
 * saiu. Duas telas chamadas "separar" não diziam qual era qual, e a onda de
 * um pedido só faz exatamente o mesmo trabalho.
 *
 * Separar pedido por pedido faz a mesma rua ser percorrida uma vez por
 * pedido. A onda junta os pedidos confirmados, soma o que cada endereço tem
 * de entregar e manda buscar tudo de uma vez, na ordem do caminho — a
 * diferença entre cinco voltas pela loja e uma.
 *
 * A onda não mexe em reserva: as peças já estão reservadas para os pedidos
 * desde que eles nasceram. Ela só organiza o trabalho de ir buscá-las, e por
 * isso cancelar a separação não cancela venda nenhuma.
 *
 * Como onda é feita de pedidos, e pedido é coisa da vitrine, esta tela exige
 * o plano com site — quem não tem recebe 402 do servidor e é levado à
 * assinatura pelo cliente HTTP.
 */

const COR_DA_SITUACAO: Record<string, string> = {
    aberta: "tag-info",
    em_separacao: "tag-warning",
    concluida: "tag-success",
    cancelada: "tag-neutral",
}

const NOME_DA_SITUACAO: Record<string, string> = {
    aberta: "aberta",
    em_separacao: "em separação",
    concluida: "concluída",
    cancelada: "cancelada",
}

export default function Ondas() {

    const [ondas, setOndas] = useState<Onda[]>([])
    const [pedidos, setPedidos] = useState<Pedido[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    const [escolhidos, setEscolhidos] = useState<number[]>([])
    const [abrindo, setAbrindo] = useState(false)

    // A volta pronta, parada a parada, logo depois de abrir a onda: é o que
    // quem separa lê no celular enquanto anda.
    const [paradas, setParadas] = useState<ParadaDaOnda[]>([])

    const [aberta, setAberta] = useState<OndaDetalhada | null>(null)
    const [carregandoOnda, setCarregandoOnda] = useState<number | null>(null)

    const carregar = useCallback(async () => {

        try {
            const [lista, listaPedidos] = await Promise.all([listarOndas(), listarPedidos()])

            setOndas(lista)
            setPedidos(listaPedidos)
            setErro("")

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível carregar as ondas.")
        } finally {
            setCarregando(false)
        }

    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()
    }, [carregar])

    // Só pedido confirmado entra: antes disso não há o que separar, e depois
    // o pacote já saiu da loja.
    const separaveis = pedidos.filter((pedido) => pedido.status === "confirmado")

    function alternar(id: number) {
        setEscolhidos((atual) =>
            atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]
        )
    }

    async function abrir() {

        setErro("")
        setAviso("")

        if (escolhidos.length === 0) {
            setErro("Escolha os pedidos que entram na onda.")
            return
        }

        try {
            setAbrindo(true)

            const resultado = await abrirOnda(escolhidos)

            setParadas(resultado.paradas)
            setAviso(
                `Onda ${resultado.onda.codigo} aberta: ${resultado.onda.pecas} peça(s) em ${resultado.onda.paradas} parada(s).`
            )
            setEscolhidos([])

            await carregar()

        } catch (e) {
            // Pedido já separado em outra onda e onda sem peça reservada são
            // recusas do servidor (409), não erro de tela.
            setErro(e instanceof ApiError ? e.message : "Não foi possível abrir a onda.")
        } finally {
            setAbrindo(false)
        }
    }

    async function alternarDetalhe(onda: Onda) {

        if (aberta?.onda.id === onda.id) {
            setAberta(null)
            return
        }

        setErro("")
        setCarregandoOnda(onda.id)

        try {
            setAberta(await verOnda(onda.id))
        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível abrir a onda.")
        } finally {
            setCarregandoOnda(null)
        }
    }

    async function cancelar(onda: Onda) {

        setErro("")
        setAviso("")

        try {
            await cancelarOnda(onda.id)
            setAviso("Onda cancelada: as reservas dos pedidos continuam de pé.")
            setAberta(null)
            await carregar()

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível cancelar a onda.")
        }
    }

    return (
        <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">
            <div className="mx-auto max-w-4xl space-y-6">

                <div>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5A6469]">
                        Pedidos
                    </p>
                    <h1 className="font-display text-2xl text-[#1E2428]">
                        Separar pedidos
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-[#5A6469]">
                        Vários pedidos separados numa volta só. O sistema soma o que cada endereço
                        tem de entregar e ordena as paradas pelo caminho do estoque — em vez de uma
                        ida e volta por pedido.
                    </p>
                </div>

                {erro && (
                    <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]">
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                {aviso && (
                    <div role="status" className="flex items-start gap-2.5 rounded-lg bg-[#E0FFEE] px-4 py-3 text-sm font-semibold text-[#08A022]">
                        <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{aviso}</span>
                    </div>
                )}

                {/* ==========================
                    ABRIR UMA ONDA
                ========================== */}

                <section className="card space-y-4 p-5 sm:p-7">

                    <div className="flex flex-wrap items-end justify-between gap-4">

                        <div>
                            <h2 className="font-display text-base text-[#1E2428]">
                                Pedidos prontos para separar
                                {separaveis.length > 0 && (
                                    <span className="num ml-2 text-sm font-bold text-[#5A6469]">
                                        {separaveis.length}
                                    </span>
                                )}
                            </h2>
                            <p className="mt-1 text-sm text-[#5A6469]">
                                Marque <strong className="font-bold text-[#1E2428]">quantos pedidos quiser</strong>:
                                a onda junta todos numa volta só pelo estoque. Só aparecem os
                                confirmados — antes disso não há o que separar, depois o pacote já
                                saiu da loja.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">

                            {separaveis.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setEscolhidos(
                                            escolhidos.length === separaveis.length
                                                ? []
                                                : separaveis.map((pedido) => pedido.id)
                                        )
                                    }
                                    className="btn btn-neutro text-sm"
                                >
                                    {escolhidos.length === separaveis.length ? "Desmarcar todos" : "Marcar todos"}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={abrir}
                                disabled={abrindo || escolhidos.length === 0}
                                className="btn btn-primario"
                            >
                                <FiPlusCircle className="w-4" aria-hidden />
                                {abrindo
                                    ? "Abrindo..."
                                    : escolhidos.length === 0
                                        ? "Abrir onda"
                                        : `Abrir onda com ${escolhidos.length} pedido(s)`}
                            </button>

                        </div>

                    </div>

                    {carregando ? (

                        <p className="text-[#5A6469]">Carregando...</p>

                    ) : separaveis.length === 0 ? (

                        <p className="rounded-lg border border-dashed border-[#D3DADD] p-8 text-center text-sm text-[#5A6469]">
                            Nenhum pedido confirmado esperando separação.
                        </p>

                    ) : (

                        <ul className="divide-y divide-[#D3DADD]">

                            {separaveis.map((pedido) => (

                                <li key={pedido.id}>

                                    <label className="flex cursor-pointer items-center gap-3 py-3">

                                        <input
                                            type="checkbox"
                                            checked={escolhidos.includes(pedido.id)}
                                            onChange={() => alternar(pedido.id)}
                                            className="h-4 w-4 shrink-0 cursor-pointer accent-[#0086FF]"
                                        />

                                        <span className="min-w-0 flex-1">
                                            <span className="num block text-sm font-medium text-[#1E2428]">
                                                #{pedido.codigo}
                                            </span>
                                            <span className="block truncate text-xs text-[#5A6469]">
                                                {pedido.cliente_nome}
                                            </span>
                                        </span>

                                    </label>

                                </li>

                            ))}

                        </ul>

                    )}

                    {paradas.length > 0 && (

                        <div className="rounded-lg bg-[#E6F3FF] p-4">

                            <p className="font-display flex items-center gap-2 text-sm text-[#1E2428]">
                                <FiMapPin className="w-4 text-[#0086FF]" aria-hidden />
                                A volta, parada a parada
                            </p>

                            <ul className="mt-2 space-y-1.5">
                                {paradas.map((parada, indice) => (
                                    <li
                                        key={`${parada.endereco_id}-${parada.produto_id}-${indice}`}
                                        className="flex items-center justify-between gap-3 text-sm"
                                    >
                                        <span className="min-w-0 truncate text-[#1E2428]">
                                            <span className="num text-[#5A6469]">{parada.quantidade}x</span>{" "}
                                            {parada.produto_nome}
                                            {parada.variacao ? ` · ${parada.variacao}` : ""}
                                        </span>

                                        <span className="num shrink-0 font-bold text-[#0075E2]">
                                            {parada.endereco}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                        </div>

                    )}

                </section>

                {/* ==========================
                    ONDAS DA LOJA
                ========================== */}

                {!carregando && ondas.length > 0 && (

                    <ul className="space-y-3">

                        {ondas.map((onda) => {

                            const detalhada = aberta?.onda.id === onda.id ? aberta : null
                            const encerrada = onda.situacao === "concluida" || onda.situacao === "cancelada"

                            return (
                                <li key={onda.id} className="card p-5">

                                    <div className="flex flex-wrap items-start justify-between gap-3">

                                        <div className="min-w-0">

                                            <p className="font-display num text-base text-[#1E2428]">
                                                {onda.codigo}
                                            </p>

                                            <p className="mt-1.5 flex flex-wrap items-center gap-2">

                                                <span className={`tag ${COR_DA_SITUACAO[onda.situacao] ?? "tag-neutral"}`}>
                                                    {NOME_DA_SITUACAO[onda.situacao] ?? onda.situacao}
                                                </span>

                                                <span className="tag tag-neutral num">
                                                    {onda.pedidos} pedido(s)
                                                </span>

                                                <span className="tag tag-neutral num">
                                                    {onda.pecas} peça(s)
                                                </span>

                                                <span className="tag tag-neutral num">
                                                    {onda.paradas} parada(s)
                                                </span>

                                            </p>

                                        </div>

                                        <div className="flex shrink-0 gap-2">

                                            <button
                                                type="button"
                                                onClick={() => alternarDetalhe(onda)}
                                                disabled={carregandoOnda === onda.id}
                                                className="btn btn-neutro text-sm"
                                            >
                                                {detalhada ? (
                                                    <FiChevronUp className="w-4" aria-hidden />
                                                ) : (
                                                    <FiChevronDown className="w-4" aria-hidden />
                                                )}
                                                {carregandoOnda === onda.id ? "..." : "Ver"}
                                            </button>

                                            {!encerrada && (
                                                <button
                                                    type="button"
                                                    onClick={() => cancelar(onda)}
                                                    aria-label="Cancelar onda"
                                                    className="btn btn-neutro text-sm"
                                                >
                                                    <FiX className="w-4" aria-hidden />
                                                </button>
                                            )}

                                        </div>

                                    </div>

                                    {detalhada && (

                                        <div className="mt-4 border-t border-[#D3DADD] pt-4">

                                            <p className="text-sm text-[#5A6469]">
                                                Pedidos:{" "}
                                                <span className="num text-[#1E2428]">
                                                    {detalhada.pedidos.join(", ") || "—"}
                                                </span>
                                            </p>

                                            <ul className="mt-3 space-y-2">

                                                {detalhada.tarefas.map((tarefa) => (

                                                    <li
                                                        key={tarefa.id}
                                                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                                                    >

                                                        <span className="min-w-0 truncate text-[#1E2428]">
                                                            <span className="num text-[#5A6469]">{tarefa.quantidade}x</span>{" "}
                                                            {tarefa.produto_nome ?? `Produto #${tarefa.produto_id}`}
                                                        </span>

                                                        <span className="flex shrink-0 items-center gap-2">

                                                            {tarefa.origem && (
                                                                <span className="num font-medium text-[#0075E2]">
                                                                    {tarefa.origem}
                                                                </span>
                                                            )}

                                                            <span className="tag tag-neutral">
                                                                {tarefa.situacao === "em_andamento"
                                                                    ? "em andamento"
                                                                    : tarefa.situacao}
                                                            </span>

                                                        </span>

                                                    </li>

                                                ))}

                                            </ul>

                                            {detalhada.tarefas.length === 0 && (
                                                <p className="mt-3 text-sm text-[#5A6469]">
                                                    Esta onda não tem tarefas na fila.
                                                </p>
                                            )}

                                        </div>

                                    )}

                                </li>
                            )
                        })}

                    </ul>

                )}

            </div>
        </main>
    )
}
