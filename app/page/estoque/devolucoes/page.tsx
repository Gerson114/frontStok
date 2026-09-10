"use client"

import { useEffect, useMemo, useState } from "react"
import type { Produto } from "@/app/type/type"
import { listarProdutos } from "@/middleware/produtos"
import {
    DESTINOS,
    agendarDevolucao,
    listarDevolucoes,
    registrarDevolucao,
    tratarDevolucao,
    type Devolucao,
    type DestinoDevolucao,
} from "@/middleware/estoque"
import { ApiError } from "@/middleware/client"
import { descreverVariacao } from "@/app/components/produto/campos"
import {
    FiAlertCircle,
    FiCalendar,
    FiCheckCircle,
    FiClock,
    FiCornerUpLeft,
    FiPackage,
    FiX,
} from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"

/**
 * Devoluções: o que voltou para a loja e ainda não tem destino.
 *
 * A peça devolvida não volta para a arara sozinha. Ela sai do vendável, perde
 * o endereço e fica nesta fila até alguém olhar — porque peça devolvida pode
 * estar suja, rasgada ou ser outra que não a vendida, e quem descobre isso
 * quando ela volta direto para a prateleira é o próximo cliente.
 *
 * Daqui saem quatro caminhos: voltar ao estoque, virar avaria, voltar ao
 * fornecedor ou ir para o descarte. Enquanto nenhum for escolhido, dá para
 * marcar o dia da tratativa — o conserto, a coleta, a visita do
 * representante —, que é o que separa um problema agendado de um esquecido.
 */

/** Motivos que cobrem quase toda devolução de balcão. */
const MOTIVOS = [
    "Defeito",
    "Tamanho errado",
    "Desistência do cliente",
    "Produto trocado",
    "Chegou danificado",
]

const ROTULO_SITUACAO: Record<string, string> = {
    aguardando: "Aguardando tratativa",
    agendada: "Tratativa agendada",
    resolvida: "Resolvida",
}

export default function DevolucoesPage() {
    const [devolucoes, setDevolucoes] = useState<Devolucao[]>([])
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")
    const [recarregar, setRecarregar] = useState(0)

    // Formulário de entrada da devolução.
    const [produtoId, setProdutoId] = useState("")
    const [quantidade, setQuantidade] = useState("1")
    const [motivo, setMotivo] = useState("")
    const [observacao, setObservacao] = useState("")
    const [enviando, setEnviando] = useState(false)

    // Qual devolução está com o painel de tratativa aberto.
    const [emTratativa, setEmTratativa] = useState<Devolucao | null>(null)
    const [dataAgendada, setDataAgendada] = useState("")

    useEffect(() => {
        let cancelado = false

        async function carregar() {
            try {
                const [fila, listaProdutos] = await Promise.all([listarDevolucoes(), listarProdutos()])

                if (cancelado) return

                setDevolucoes(fila)
                setProdutos(listaProdutos)
                setErro("")
            } catch (e) {
                if (!cancelado) setErro(e instanceof Error ? e.message : "Não foi possível carregar as devoluções")
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        carregar()

        return () => {
            cancelado = true
        }
    }, [recarregar])

    const atualizar = () => setRecarregar((n) => n + 1)

    const aguardando = useMemo(
        () => devolucoes.filter((devolucao) => devolucao.situacao !== "resolvida"),
        [devolucoes]
    )

    const resolvidas = useMemo(
        () => devolucoes.filter((devolucao) => devolucao.situacao === "resolvida"),
        [devolucoes]
    )

    async function registrar(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault()

        setErro("")
        setAviso("")

        const id = Number(produtoId)
        const quantas = parseInt(quantidade, 10)

        if (!Number.isFinite(id) || id <= 0) {
            setErro("Escolha o produto devolvido.")
            return
        }

        if (!Number.isFinite(quantas) || quantas <= 0) {
            setErro("Informe quantas peças voltaram.")
            return
        }

        if (!motivo.trim()) {
            setErro("Informe o motivo da devolução.")
            return
        }

        try {
            setEnviando(true)

            await registrarDevolucao({
                produto_id: id,
                quantidade: quantas,
                motivo: motivo.trim(),
                observacao: observacao.trim(),
            })

            setAviso("Devolução registrada: a peça está isolada, fora do estoque vendável.")
            setProdutoId("")
            setQuantidade("1")
            setMotivo("")
            setObservacao("")
            atualizar()

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível registrar a devolução")
        } finally {
            setEnviando(false)
        }
    }

    async function agendar(devolucao: Devolucao) {
        if (!dataAgendada) {
            setErro("Escolha a data da tratativa.")
            return
        }

        setErro("")

        try {
            await agendarDevolucao(devolucao.id, dataAgendada)
            setAviso("Tratativa agendada.")
            setEmTratativa(null)
            setDataAgendada("")
            atualizar()
        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível agendar")
        }
    }

    async function tratar(devolucao: Devolucao, destino: DestinoDevolucao) {
        setErro("")

        try {
            await tratarDevolucao(devolucao.id, destino)
            setAviso("Tratativa registrada.")
            setEmTratativa(null)
            atualizar()
        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível registrar a tratativa")
        }
    }

    if (carregando) {
        return (
            <Pagina titulo="Devoluções">
                <div className="card p-8 text-center text-sm text-[#616161]">Carregando devoluções...</div>
            </Pagina>
        )
    }

    return (
        <Pagina
            titulo="Devoluções"
            descricao="O que voltou fica isolado aqui: fora do estoque vendável, sem endereço na prateleira, até você decidir o destino. Nenhuma peça devolvida volta para a venda sozinha."
        >

            {erro && (
                <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]"
                >
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aviso && (
                <div
                    role="status"
                    className="flex items-start gap-2.5 rounded-lg bg-[#EAFBF1] px-4 py-3 text-sm font-semibold text-[#0C5132]"
                >
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{aviso}</span>
                </div>
            )}

            {/* RECEBER UMA DEVOLUÇÃO */}
            <section className="card p-5 sm:p-7">

                <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF4FF] text-[#00369B]">
                        <FiCornerUpLeft className="w-4" aria-hidden />
                    </span>
                    <h2 className="font-display text-base text-[#303030]">Receber devolução</h2>
                </div>

                <form onSubmit={registrar} className="mt-5 space-y-4">

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="produto">Produto</label>
                            <select
                                id="produto"
                                value={produtoId}
                                onChange={(e) => setProdutoId(e.target.value)}
                                className="field cursor-pointer"
                            >
                                <option value="">Selecione...</option>
                                {produtos.map((produto) => {
                                    const variacao = descreverVariacao(produto.variacao_rotulo, produto.variacao)

                                    return (
                                        <option key={produto.id} value={produto.id}>
                                            {produto.nome}
                                            {variacao ? ` · ${variacao}` : ""}
                                            {produto.codigo ? ` (${produto.codigo})` : ""}
                                        </option>
                                    )
                                })}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="quantidade">Peças</label>
                            <input
                                id="quantidade"
                                type="number"
                                min="1"
                                value={quantidade}
                                onChange={(e) => setQuantidade(e.target.value)}
                                className="field num"
                            />
                        </div>

                    </div>

                    <div className="space-y-1.5">
                        <label className="rotulo" htmlFor="motivo">Motivo</label>
                        <input
                            id="motivo"
                            type="text"
                            list="motivos-devolucao"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Por que a peça voltou?"
                            className="field"
                        />
                        <datalist id="motivos-devolucao">
                            {MOTIVOS.map((item) => (
                                <option key={item} value={item} />
                            ))}
                        </datalist>
                        <p className="text-xs text-[#616161]">
                            É o motivo que transforma esta fila em informação: sem ele, ninguém
                            descobre que um fornecedor manda peça com defeito.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="rotulo" htmlFor="observacao">Observação</label>
                        <input
                            id="observacao"
                            type="text"
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            placeholder="Detalhes do estado da peça, nome do cliente, nº do pedido..."
                            className="field"
                        />
                    </div>

                    <button type="submit" disabled={enviando} className="btn btn-primario">
                        {enviando ? "Registrando..." : "Receber devolução"}
                    </button>

                </form>

            </section>

            {/* EM QUARENTENA */}
            <section className="space-y-3">

                <h2 className="font-display text-lg text-[#303030]">
                    Aguardando tratativa
                    <span className="num ml-2 text-sm font-bold text-[#616161]">
                        {aguardando.length}
                    </span>
                </h2>

                {aguardando.length === 0 && (
                    <p className="card p-8 text-center text-sm text-[#616161]">
                        Nenhuma peça em quarentena. Tudo que voltou já teve destino.
                    </p>
                )}

                {aguardando.map((devolucao) => {

                    const variacao = descreverVariacao(
                        devolucao.produto_variacao_rotulo,
                        devolucao.produto_variacao
                    )

                    const aberta = emTratativa?.id === devolucao.id

                    return (
                        <article key={devolucao.id} className="card p-5">

                            <div className="flex flex-wrap items-start justify-between gap-3">

                                <div className="min-w-0">
                                    <p className="font-display text-base text-[#303030]">
                                        {devolucao.produto_nome || `Produto #${devolucao.produto_id}`}
                                    </p>

                                    <p className="num text-xs text-[#616161]">
                                        {devolucao.produto_codigo}
                                        {variacao ? ` · ${variacao}` : ""}
                                    </p>

                                    <p className="mt-2 text-sm text-[#303030]">
                                        {devolucao.motivo}
                                    </p>

                                    {devolucao.observacao && (
                                        <p className="text-sm text-[#616161]">{devolucao.observacao}</p>
                                    )}
                                </div>

                                <div className="shrink-0 text-right">
                                    <span
                                        className={`tag ${
                                            devolucao.situacao === "agendada" ? "tag-info" : "tag-neutral"
                                        }`}
                                    >
                                        {ROTULO_SITUACAO[devolucao.situacao] ?? devolucao.situacao}
                                    </span>

                                    <p className="mt-2 flex items-center justify-end gap-1.5 text-xs text-[#616161]">
                                        <FiClock className="w-3.5" aria-hidden />
                                        {devolucao.dias_parada === 0
                                            ? "Chegou hoje"
                                            : `Parada há ${devolucao.dias_parada} dia(s)`}
                                    </p>

                                    {devolucao.agendada_para && (
                                        <p className="mt-1 flex items-center justify-end gap-1.5 text-xs font-semibold text-[#00369B]">
                                            <FiCalendar className="w-3.5" aria-hidden />
                                            {new Date(devolucao.agendada_para).toLocaleDateString("pt-BR")}
                                        </p>
                                    )}
                                </div>

                            </div>

                            {!aberta ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEmTratativa(devolucao)
                                        setDataAgendada(devolucao.agendada_para?.slice(0, 10) ?? "")
                                    }}
                                    className="btn btn-secundario mt-4 text-sm"
                                >
                                    Dar tratativa
                                </button>
                            ) : (
                                <div className="mt-4 space-y-4 border-t border-[#EBEBEB] pt-4">

                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-semibold text-[#303030]">
                                            O que fazer com esta peça?
                                        </p>

                                        <button
                                            type="button"
                                            onClick={() => setEmTratativa(null)}
                                            aria-label="Fechar tratativa"
                                            className="rounded-lg p-1.5 text-[#8A8A8A] transition-colors hover:bg-[#F1F1F1]"
                                        >
                                            <FiX className="w-4" aria-hidden />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {DESTINOS.map((destino) => (
                                            <button
                                                key={destino.chave}
                                                type="button"
                                                onClick={() => tratar(devolucao, destino.chave)}
                                                className="rounded-lg border border-[#E1E1E1] p-3 text-left transition-colors hover:border-[#005BD3]"
                                            >
                                                <span className="block text-sm font-bold text-[#303030]">
                                                    {destino.rotulo}
                                                </span>
                                                <span className="mt-0.5 block text-xs text-[#616161]">
                                                    {destino.descricao}
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Agendar não decide nada: só tira a peça da fila de
                                        "ninguém olhou" e põe dia para olhar. */}
                                    <div className="flex flex-wrap items-end gap-3 rounded-lg bg-[#F1F1F1] p-3">

                                        <div className="min-w-[10rem] flex-1 space-y-1">
                                            <label className="rotulo text-xs" htmlFor={`data-${devolucao.id}`}>
                                                Ou agende a tratativa
                                            </label>
                                            <input
                                                id={`data-${devolucao.id}`}
                                                type="date"
                                                value={dataAgendada}
                                                onChange={(e) => setDataAgendada(e.target.value)}
                                                className="field"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => agendar(devolucao)}
                                            className="btn btn-neutro flex items-center gap-2 text-sm"
                                        >
                                            <FiCalendar className="w-4" aria-hidden />
                                            Agendar
                                        </button>

                                    </div>

                                </div>
                            )}

                        </article>
                    )
                })}

            </section>

            {/* JÁ RESOLVIDAS */}
            {resolvidas.length > 0 && (
                <section className="space-y-3">

                    <h2 className="font-display text-lg text-[#303030]">Resolvidas</h2>

                    <ul className="card divide-y divide-[#EBEBEB] p-2">
                        {resolvidas.map((devolucao) => (
                            <li
                                key={devolucao.id}
                                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm"
                            >
                                <span className="min-w-0 truncate text-[#303030]">
                                    <FiPackage className="mr-2 inline w-3.5 text-[#8A8A8A]" aria-hidden />
                                    {devolucao.produto_nome || `Produto #${devolucao.produto_id}`}
                                    <span className="text-[#616161]"> · {devolucao.motivo}</span>
                                </span>

                                <span className="shrink-0 text-[#616161]">
                                    {DESTINOS.find((item) => item.chave === devolucao.destino)?.rotulo ??
                                        devolucao.destino}
                                    {devolucao.resolvida_em
                                        ? ` · ${new Date(devolucao.resolvida_em).toLocaleDateString("pt-BR")}`
                                        : ""}
                                </span>
                            </li>
                        ))}
                    </ul>

                </section>
            )}

        </Pagina>
    )
}
