"use client"

import { useEffect, useState } from "react"
import {
    FiAlertCircle,
    FiCheckCircle,
    FiClock,
    FiCreditCard,
    FiPackage,
    FiTruck,
    FiUser,
} from "react-icons/fi"
import { ApiError } from "@/middleware/client"
import {
    decidirDevolucaoPedida,
    listarDevolucoesPedidas,
    type CausaDevolucao,
    type DevolucaoPedida,
    type SituacaoPedidoDevolucao,
} from "@/middleware/estoque"

/**
 * A fila de devoluções que os CLIENTES pediram.
 *
 * Vive no topo da tela de devoluções porque é o que precisa de gente hoje: do
 * outro lado tem uma pessoa esperando resposta sobre dinheiro que ela já
 * pagou. A fila de baixo — as peças em quarentena — é trabalho de estoque, e
 * espera.
 *
 * Chegam aqui só duas coisas, porque são as duas únicas que a vitrine
 * oferece: o pedido que não chegou no prazo e o que chegou danificado.
 * Devolução por arrependimento ou "não serviu" não passa por esta fila — o
 * cliente fala direto com a loja, que é onde dá para ver a peça, pedir foto e
 * negociar. Um formulário automatizaria só a fraude: receber a mercadoria
 * inteira e pedir o dinheiro de volta assim mesmo.
 *
 * As duas causas pedem providências diferentes antes de decidir, e a tela diz
 * qual é qual: no atraso, rastrear o pacote; na avaria, olhar a peça.
 *
 * Aceitar devolve o dinheiro na hora, pela conta da própria loja no provedor
 * de pagamento. Quando o provedor não faz estorno por API, a devolução é
 * aceita do mesmo jeito e a linha fica marcada: o dinheiro precisa ser
 * devolvido no painel dele, e esta tela não deixa isso ser esquecido.
 *
 * Recusar exige uma frase. Um "não" sem explicação é o que transforma uma
 * devolução em reclamação no Reclame Aqui.
 */

function formatarMoeda(valor: number): string {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatarData(iso?: string | null): string {
    if (!iso) return ""

    const data = new Date(iso)

    return Number.isNaN(data.getTime())
        ? ""
        : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

/** Como cada causa se lê na fila, e o que ela pede de quem vai responder. */
const CAUSAS: Record<CausaDevolucao, { rotulo: string; confira: string; Icone: typeof FiTruck }> = {
    atraso: {
        rotulo: "não chegou",
        confira: "O prazo de entrega venceu e o pedido não foi entregue. Confira o rastreio antes de decidir: pacote extraviado é prejuízo da transportadora, não do cliente.",
        Icone: FiTruck,
    },
    danificado: {
        rotulo: "chegou danificado",
        confira: "A mercadoria chegou avariada. Peça foto pela conversa se precisar ver o dano — e guarde a embalagem, que é o que a transportadora cobra num pedido de indenização.",
        Icone: FiPackage,
    },
}

/** Há quantos dias o cliente está esperando resposta. */
function diasEsperando(iso: string): number {
    const data = new Date(iso)

    if (Number.isNaN(data.getTime())) return 0

    return Math.floor((Date.now() - data.getTime()) / 86_400_000)
}

export default function DevolucoesPedidas({ aoDecidir }: { aoDecidir?: () => void }) {

    const [lista, setLista] = useState<DevolucaoPedida[]>([])
    const [situacao, setSituacao] = useState<SituacaoPedidoDevolucao | "todas">("pedida")
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    // Qual linha está com o campo da recusa aberto, e o que já foi escrito.
    const [recusando, setRecusando] = useState<number | null>(null)
    const [resposta, setResposta] = useState("")
    const [enviando, setEnviando] = useState<number | null>(null)

    const [recarregar, setRecarregar] = useState(0)

    useEffect(() => {
        let cancelado = false

        async function carregar() {
            try {
                const fila = await listarDevolucoesPedidas(situacao)

                if (cancelado) return

                setLista(fila)
                setErro("")
            } catch (e) {
                if (!cancelado) {
                    setErro(e instanceof Error ? e.message : "Não foi possível carregar os pedidos de devolução")
                }
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        carregar()

        return () => {
            cancelado = true
        }
    }, [situacao, recarregar])

    async function decidir(devolucao: DevolucaoPedida, aceitar: boolean) {

        if (!aceitar && !resposta.trim()) {
            setErro("Escreva o motivo da recusa — é o que o cliente vai ler.")
            return
        }

        setErro("")
        setAviso("")
        setEnviando(devolucao.id)

        try {
            const { mensagem } = await decidirDevolucaoPedida(devolucao.id, aceitar, resposta.trim())

            // A frase vem do servidor porque só ele sabe o que aconteceu com o
            // dinheiro: estornado agora, ou esperando o painel do provedor.
            setAviso(mensagem ?? (aceitar ? "Devolução aceita." : "Devolução recusada."))

            setRecusando(null)
            setResposta("")
            setRecarregar((n) => n + 1)

            aoDecidir?.()

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível registrar a decisão")
        } finally {
            setEnviando(null)
        }
    }

    const esperando = lista.filter((devolucao) => devolucao.situacao === "pedida").length

    // Aceitas cujo dinheiro ainda não saiu. Elas continuam na fila aberta de
    // propósito (ver ListarDevolucoesPedidas): é dinheiro prometido ao
    // cliente e não pago, e some da vista é justamente o que não pode
    // acontecer com ele.
    const aDevolver = lista.filter(
        (devolucao) => devolucao.situacao === "aceita" && !devolucao.estornado_em,
    )

    const somaADevolver = aDevolver.reduce((soma, devolucao) => soma + devolucao.valor, 0)

    // Nada pedido e nada no histórico: a seção some. Loja que nunca teve
    // devolução não precisa de uma caixa vazia dizendo isso todo dia.
    if (!carregando && lista.length === 0 && situacao === "pedida") return null

    return (
        <section className="card p-5 sm:p-7">

            <div className="flex flex-wrap items-center justify-between gap-3">

                <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF1E3] text-[#B98900]">
                        <FiCreditCard className="w-4" aria-hidden />
                    </span>

                    <div>
                        <h2 className="font-display text-base text-[#303030]">
                            Devoluções pedidas pelos clientes
                        </h2>

                        <p className="text-xs text-[#616161]">
                            {esperando > 0 && (
                                <>
                                    {esperando} {esperando === 1 ? "pessoa espera" : "pessoas esperam"} sua
                                    resposta sobre o dinheiro.
                                </>
                            )}

                            {esperando > 0 && aDevolver.length > 0 ? " " : null}

                            {aDevolver.length > 0 && (
                                <span className="font-semibold text-[#B98900]">
                                    {formatarMoeda(somaADevolver)} já{" "}
                                    {aDevolver.length === 1 ? "foi aceito" : "foram aceitos"} e{" "}
                                    {aDevolver.length === 1 ? "falta" : "faltam"} devolver.
                                </span>
                            )}

                            {esperando === 0 && aDevolver.length === 0 && "Nenhuma espera resposta agora."}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setSituacao(situacao === "pedida" ? "todas" : "pedida")}
                    className="text-sm font-semibold text-[#005BD3] transition-colors hover:text-[#004299]"
                >
                    {situacao === "pedida" ? "ver todas" : "ver só as que esperam"}
                </button>

            </div>

            {erro && (
                <div
                    role="alert"
                    className="mt-4 flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]"
                >
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aviso && (
                <div
                    role="status"
                    className="mt-4 flex items-start gap-2.5 rounded-lg bg-[#EAFBF1] px-4 py-3 text-sm font-semibold text-[#0C5132]"
                >
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{aviso}</span>
                </div>
            )}

            {carregando ? (
                <p className="mt-5 text-sm text-[#616161]">Carregando...</p>
            ) : lista.length === 0 ? (
                <p className="mt-5 text-sm text-[#616161]">
                    Nenhum pedido de devolução por aqui.
                </p>
            ) : (
                <ul className="mt-5 space-y-3">
                    {lista.map((devolucao) => (
                        <li
                            key={devolucao.id}
                            className="rounded-xl border border-[#EBEBEB] p-4 sm:p-5"
                        >

                            <div className="flex flex-wrap items-start justify-between gap-3">

                                <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#303030]">
                                        <span className="num">Pedido {devolucao.codigo}</span>

                                        {CAUSAS[devolucao.causa] && (
                                            <span className="tag inline-flex items-center gap-1 bg-[#FFF1E3] text-[#B98900]">
                                                {(() => {
                                                    const { Icone } = CAUSAS[devolucao.causa]
                                                    return <Icone className="w-3" aria-hidden />
                                                })()}
                                                {CAUSAS[devolucao.causa].rotulo}
                                            </span>
                                        )}

                                        {devolucao.situacao === "aceita" && (
                                            <span className="tag bg-[#CDFEE1] text-[#0C5132]">aceita</span>
                                        )}

                                        {devolucao.situacao === "recusada" && (
                                            <span className="tag bg-[#FEE9E8] text-[#8E1F0B]">recusada</span>
                                        )}
                                    </p>

                                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#616161]">
                                        <span className="inline-flex items-center gap-1.5">
                                            <FiUser className="w-3.5" aria-hidden />
                                            {devolucao.cliente_nome || "cliente"}
                                            {devolucao.cliente_contato ? ` · ${devolucao.cliente_contato}` : ""}
                                        </span>

                                        <span className="inline-flex items-center gap-1.5">
                                            <FiClock className="w-3.5" aria-hidden />
                                            pedida em {formatarData(devolucao.created_at)}
                                            {devolucao.situacao === "pedida" && diasEsperando(devolucao.created_at) > 0
                                                ? ` · esperando há ${diasEsperando(devolucao.created_at)} ${diasEsperando(devolucao.created_at) === 1 ? "dia" : "dias"}`
                                                : ""}
                                        </span>
                                    </p>
                                </div>

                                <p className="shrink-0 text-right">
                                    <span className="num font-display text-lg text-[#303030]">
                                        {formatarMoeda(devolucao.valor)}
                                    </span>

                                    <span className="block text-xs text-[#8A8A8A]">
                                        {devolucao.frete > 0 ? "com o frete" : "só as peças"}
                                    </span>
                                </p>

                            </div>

                            <ul className="mt-3 space-y-1">
                                {devolucao.itens.map((peca) => (
                                    <li key={peca.item_pedido_id} className="text-sm text-[#616161]">
                                        <span className="num">{peca.quantidade}×</span>{" "}
                                        {peca.produto_nome || `produto #${peca.produto_id}`}
                                        {peca.produto_codigo ? (
                                            <span className="num text-[#8A8A8A]"> ({peca.produto_codigo})</span>
                                        ) : null}
                                        {" · "}
                                        <span className="num">{formatarMoeda(peca.preco_unitario)}</span>
                                    </li>
                                ))}
                            </ul>

                            <p className="mt-3 rounded-lg bg-[#F7F7F7] px-4 py-3 text-sm leading-relaxed text-[#303030]">
                                &ldquo;{devolucao.motivo}&rdquo;
                            </p>

                            {/* O que conferir ANTES de decidir, que muda com a
                                causa. Sem isto, a fila vira dois botões sem
                                contexto — e a decisão de devolver dinheiro é
                                exatamente a que não deve ser tomada no
                                automático. */}
                            {devolucao.situacao === "pedida" && CAUSAS[devolucao.causa] && (
                                <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[#616161]">
                                    <FiAlertCircle className="mt-0.5 w-3.5 shrink-0 text-[#B98900]" aria-hidden />
                                    {CAUSAS[devolucao.causa].confira}
                                </p>
                            )}

                            {devolucao.situacao === "pedida" ? (
                                <div className="mt-4">

                                    {recusando === devolucao.id ? (
                                        <div className="space-y-2">
                                            <label className="rotulo" htmlFor={`resposta-${devolucao.id}`}>
                                                Por que você está recusando?
                                            </label>

                                            <input
                                                id={`resposta-${devolucao.id}`}
                                                type="text"
                                                value={resposta}
                                                maxLength={500}
                                                onChange={(e) => setResposta(e.target.value)}
                                                placeholder="A peça foi usada, o prazo venceu, a etiqueta foi retirada..."
                                                className="field"
                                            />

                                            <p className="text-xs text-[#616161]">
                                                O cliente lê esta frase na tela do pedido dele.
                                            </p>

                                            <div className="flex flex-wrap gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    disabled={enviando === devolucao.id}
                                                    onClick={() => decidir(devolucao, false)}
                                                    className="btn btn-perigo px-4 py-2 text-sm"
                                                >
                                                    {enviando === devolucao.id ? "enviando..." : "confirmar recusa"}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setRecusando(null)
                                                        setResposta("")
                                                    }}
                                                    className="btn btn-neutro px-4 py-2 text-sm"
                                                >
                                                    voltar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                disabled={enviando === devolucao.id}
                                                onClick={() => decidir(devolucao, true)}
                                                className="btn btn-primario px-4 py-2 text-sm"
                                            >
                                                {enviando === devolucao.id
                                                    ? "devolvendo..."
                                                    : `aceitar e devolver ${formatarMoeda(devolucao.valor)}`}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRecusando(devolucao.id)
                                                    setResposta("")
                                                }}
                                                className="btn btn-neutro px-4 py-2 text-sm"
                                            >
                                                recusar
                                            </button>
                                        </div>
                                    )}

                                </div>
                            ) : (
                                <div className="mt-3 space-y-2">

                                    {devolucao.resposta && (
                                        <p className="border-l-2 border-[#EBEBEB] pl-3 text-sm leading-relaxed text-[#616161]">
                                            {devolucao.resposta}
                                        </p>
                                    )}

                                    <p className="text-xs text-[#8A8A8A]">
                                        {devolucao.situacao === "aceita" ? "Aceita" : "Recusada"}
                                        {devolucao.decidida_em ? ` em ${formatarData(devolucao.decidida_em)}` : ""}
                                        {devolucao.decidida_por ? ` por ${devolucao.decidida_por}` : ""}
                                        {devolucao.estornado_em
                                            ? ` · dinheiro devolvido em ${formatarData(devolucao.estornado_em)}`
                                            : ""}
                                    </p>

                                    {/* Dinheiro prometido e não devolvido. Fica em
                                        destaque até alguém resolver: é a única
                                        pendência desta tela que o sistema não
                                        consegue fechar sozinho. */}
                                    {devolucao.situacao === "aceita" && !devolucao.estornado_em && (
                                        <p className="flex items-start gap-2 rounded-lg bg-[#FFF1E3] px-4 py-3 text-sm font-semibold leading-relaxed text-[#B98900]">
                                            <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                                            {devolucao.estorno_manual
                                                ? `Devolva ${formatarMoeda(devolucao.valor)} pelo painel do seu provedor de pagamento: ele não faz estorno por aqui. O cliente já foi avisado de que a devolução foi aceita.`
                                                : "O estorno foi pedido e ainda não voltou confirmado pelo provedor."}
                                        </p>
                                    )}

                                </div>
                            )}

                            {devolucao.situacao === "aceita" && devolucao.estornado_em && (
                                <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-[#616161]">
                                    <FiCheckCircle className="mt-0.5 w-3.5 shrink-0 text-[#0C5132]" aria-hidden />
                                    Quando a peça chegar, registre-a na fila de quarentena abaixo — é lá que se
                                    decide se ela volta para a venda.
                                </p>
                            )}

                        </li>
                    ))}
                </ul>
            )}

        </section>
    )
}
