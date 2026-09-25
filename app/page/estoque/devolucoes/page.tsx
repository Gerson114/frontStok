"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
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
import DevolucoesPedidas from "@/app/components/devolucao/pedidas"
import {
    FiAlertCircle,
    FiCalendar,
    FiCheckCircle,
    FiClock,
    FiCornerUpLeft,
    FiPackage,
} from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"
import { useAoVivo } from "@/middleware/aoVivo"
import { Selecao } from "@/app/components/campo/selecao"
import {
    BarraDaLista,
    ListaDeRecursos,
    ListaVazia,
    RodapeDaLista,
    Visoes,
} from "@/app/components/lista/lista"

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
    // A aba aberta e o texto que recorta as duas (ver components/lista/lista.tsx).
    const [visao, setVisao] = useState("aguardando")
    const [busca, setBusca] = useState("")

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

    // A devolução nasce do outro lado: é o cliente que a abre, na loja dele,
    // e ninguém no balcão vai adivinhar que ela chegou. Reaproveita o mesmo
    // contador dos botões desta tela.
    useAoVivo(["devolucao", "estoque"], atualizar)

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
            setErro("Informe quantas unidades voltaram.")
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

            setAviso("Devolução registrada: a unidade está isolada, fora do estoque vendável.")
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
                <div className="card p-8 text-center text-sm text-[var(--ink-2)]">Carregando devoluções...</div>
            </Pagina>
        )
    }

    /*
     * A lista que está na tela: a aba escolhida, recortada pela busca. O texto
     * procura no produto e no motivo, que são as duas coisas pelas quais alguém
     * volta a esta tela ("cadê aquela que voltou furada?").
     */
    const termo = busca.trim().toLowerCase()

    const listaVisivel = (visao === "aguardando" ? aguardando : resolvidas).filter((devolucao) =>
        !termo ||
        (devolucao.produto_nome ?? "").toLowerCase().includes(termo) ||
        (devolucao.produto_codigo ?? "").toLowerCase().includes(termo) ||
        (devolucao.motivo ?? "").toLowerCase().includes(termo)
    )

    return (
        <Pagina
            titulo="Devoluções"
            descricao="O que voltou fica isolado aqui: fora do estoque vendável, sem endereço na prateleira, até você decidir o destino. Nenhuma unidade devolvida volta para a venda sozinha."
        >

            {erro && (
                <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]"
                >
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aviso && (
                <div
                    role="status"
                    className="flex items-start gap-2.5 rounded-lg bg-[var(--verde-suave)] px-4 py-3 text-sm font-semibold text-[var(--verde)]"
                >
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{aviso}</span>
                </div>
            )}

            {/* O QUE OS CLIENTES PEDIRAM

                Vem antes de tudo porque é o que tem gente esperando: do
                outro lado há alguém sem a unidade e sem o dinheiro. O
                componente se esconde sozinho quando não há pedido nenhum —
                loja sem devolução não precisa de uma caixa vazia dizendo
                isso todo dia. */}
            <DevolucoesPedidas aoDecidir={atualizar} />

            {/* RECEBER UMA DEVOLUÇÃO */}
            <section className="card p-5 sm:p-7">

                <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--azul-suave)] text-[var(--azul-escuro)]">
                        <FiCornerUpLeft className="w-4" aria-hidden />
                    </span>
                    <h2 className="font-display text-base text-[var(--ink)]">Receber devolução</h2>
                </div>

                <form onSubmit={registrar} className="mt-5 space-y-4">

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="produto">Produto</label>
                            <Selecao
                                id="produto"
                                value={produtoId}
                                onChange={(e) => setProdutoId(e.target.value)}
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
                            </Selecao>
                        </div>

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="quantidade">Unidades</label>
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
                            placeholder="Por que a unidade voltou?"
                            className="field"
                        />
                        <datalist id="motivos-devolucao">
                            {MOTIVOS.map((item) => (
                                <option key={item} value={item} />
                            ))}
                        </datalist>
                        <p className="text-xs text-[var(--ink-2)]">
                            É o motivo que transforma esta fila em informação: sem ele, ninguém
                            descobre que um fornecedor manda unidade com defeito.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="rotulo" htmlFor="observacao">Observação</label>
                        <input
                            id="observacao"
                            type="text"
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            placeholder="Detalhes do estado da unidade, nome do cliente, nº do pedido..."
                            className="field"
                        />
                    </div>

                    <button type="submit" disabled={enviando} className="btn btn-primario">
                        {enviando ? "Registrando..." : "Receber devolução"}
                    </button>

                </form>

            </section>

            {/* EM QUARENTENA */}
            <ListaDeRecursos>

                <Visoes
                    visoes={[
                        { chave: "aguardando", nome: "Aguardando tratativa", contagem: aguardando.length },
                        { chave: "resolvidas", nome: "Resolvidas", contagem: resolvidas.length },
                    ]}
                    ativa={visao}
                    aoTrocar={(chave) => { setVisao(chave); setEmTratativa(null) }}
                />

                <BarraDaLista
                    busca={busca}
                    aoBuscar={setBusca}
                    placeholder="Buscar por produto, código ou motivo"
                />

                {listaVisivel.length === 0 ? (

                    <ListaVazia
                        icone={visao === "aguardando" ? FiCheckCircle : FiPackage}
                        titulo={
                            busca
                                ? "Nada com esse texto"
                                : visao === "aguardando"
                                    ? "Nenhuma unidade em quarentena"
                                    : "Nenhuma unidade resolvida ainda"
                        }
                    >
                        {busca
                            ? "Nenhuma unidade casa com o que você digitou."
                            : visao === "aguardando"
                                ? "Tudo que voltou já teve destino."
                                : "O que for tratado aparece aqui, com o destino que recebeu."}
                    </ListaVazia>

                ) : visao === "aguardando" ? (

                    <div className="overflow-x-auto">

                        <table className="tabela">

                            <thead>
                                <tr>
                                    <th scope="col">Produto</th>
                                    <th scope="col">Motivo</th>
                                    <th scope="col">Situação</th>
                                    <th scope="col" className="text-right">Parada há</th>
                                    <th scope="col"><span className="sr-only">Ações</span></th>
                                </tr>
                            </thead>

                            <tbody>

                                {listaVisivel.map((devolucao) => {

                                    const variacao = descreverVariacao(
                                        devolucao.produto_variacao_rotulo,
                                        devolucao.produto_variacao
                                    )

                                    const aberta = emTratativa?.id === devolucao.id

                                    return (
                                        <Fragment key={devolucao.id}>

                                            <tr>

                                                <td>
                                                    <p className="font-medium text-[var(--ink)]">
                                                        {devolucao.produto_nome || `Produto #${devolucao.produto_id}`}
                                                    </p>
                                                    <p className="num text-xs text-[var(--ink-3)]">
                                                        {devolucao.produto_codigo}
                                                        {variacao ? ` · ${variacao}` : ""}
                                                    </p>
                                                </td>

                                                <td>
                                                    <span className="text-[var(--ink)]">{devolucao.motivo}</span>
                                                    {devolucao.observacao && (
                                                        <span className="block text-xs text-[var(--ink-2)]">
                                                            {devolucao.observacao}
                                                        </span>
                                                    )}
                                                </td>

                                                <td>
                                                    <span
                                                        className={`tag ${
                                                            devolucao.situacao === "agendada" ? "tag-info" : "tag-neutral"
                                                        }`}
                                                    >
                                                        {ROTULO_SITUACAO[devolucao.situacao] ?? devolucao.situacao}
                                                    </span>

                                                    {devolucao.agendada_para && (
                                                        <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[var(--azul-escuro)]">
                                                            <FiCalendar className="w-3.5" aria-hidden />
                                                            {new Date(devolucao.agendada_para).toLocaleDateString("pt-BR")}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="text-right">
                                                    <span className="num inline-flex items-center gap-1.5 text-[var(--ink-2)]">
                                                        <FiClock className="w-3.5" aria-hidden />
                                                        {devolucao.dias_parada === 0
                                                            ? "hoje"
                                                            : `${devolucao.dias_parada} dia(s)`}
                                                    </span>
                                                </td>

                                                <td className="text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (aberta) {
                                                                setEmTratativa(null)
                                                                return
                                                            }
                                                            setEmTratativa(devolucao)
                                                            setDataAgendada(devolucao.agendada_para?.slice(0, 10) ?? "")
                                                        }}
                                                        className="btn btn-secundario whitespace-nowrap text-xs"
                                                    >
                                                        {aberta ? "Fechar" : "Dar tratativa"}
                                                    </button>
                                                </td>

                                            </tr>

                                            {/* A tratativa abre NA LINHA, e não numa janela por
                                                cima: a decisão depende do motivo e de quantos dias
                                                a unidade está parada, que são as colunas ao lado — e
                                                um modal esconderia justamente isso. */}
                                            {aberta && (
                                                <tr>
                                                    <td colSpan={5} className="bg-[#FAFAFA]">

                                                        <p className="text-sm font-semibold text-[var(--ink)]">
                                                            O que fazer com esta unidade?
                                                        </p>

                                                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                                            {DESTINOS.map((destino) => (
                                                                <button
                                                                    key={destino.chave}
                                                                    type="button"
                                                                    onClick={() => tratar(devolucao, destino.chave)}
                                                                    className="rounded-lg border border-[var(--linha)] bg-[var(--superficie)] p-3 text-left transition-colors hover:border-[var(--azul)]"
                                                                >
                                                                    <span className="block text-sm font-bold text-[var(--ink)]">
                                                                        {destino.rotulo}
                                                                    </span>
                                                                    <span className="mt-0.5 block text-xs text-[var(--ink-2)]">
                                                                        {destino.descricao}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>

                                                        {/* Agendar não decide nada: só tira a unidade da fila de
                                                            "ninguém olhou" e põe dia para olhar. */}
                                                        <div className="mt-3 flex flex-wrap items-end gap-3">

                                                            <div className="min-w-[10rem] space-y-1">
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

                                                    </td>
                                                </tr>
                                            )}

                                        </Fragment>
                                    )
                                })}

                            </tbody>

                        </table>

                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="tabela">

                            <thead>
                                <tr>
                                    <th scope="col">Produto</th>
                                    <th scope="col">Motivo</th>
                                    <th scope="col">Destino</th>
                                    <th scope="col" className="text-right">Resolvida em</th>
                                </tr>
                            </thead>

                            <tbody>

                                {listaVisivel.map((devolucao) => (
                                    <tr key={devolucao.id}>

                                        <td className="text-[var(--ink)]">
                                            {devolucao.produto_nome || `Produto #${devolucao.produto_id}`}
                                        </td>

                                        <td className="text-[var(--ink-2)]">{devolucao.motivo}</td>

                                        <td>
                                            <span className="tag tag-neutral">
                                                {DESTINOS.find((item) => item.chave === devolucao.destino)?.rotulo ??
                                                    devolucao.destino}
                                            </span>
                                        </td>

                                        <td className="num text-right text-[var(--ink-2)]">
                                            {devolucao.resolvida_em
                                                ? new Date(devolucao.resolvida_em).toLocaleDateString("pt-BR")
                                                : "—"}
                                        </td>

                                    </tr>
                                ))}

                            </tbody>

                        </table>

                    </div>

                )}

                <RodapeDaLista
                    primeiro={1}
                    ultimo={listaVisivel.length}
                    total={listaVisivel.length}
                    nome={visao === "aguardando" ? "unidades em quarentena" : "unidades resolvidas"}
                />

            </ListaDeRecursos>

        </Pagina>
    )
}
