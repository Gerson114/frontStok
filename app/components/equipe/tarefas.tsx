"use client"

import { useCallback, useEffect, useState } from "react"
import {
    FiAlertCircle,
    FiCalendar,
    FiCheck,
    FiPlus,
    FiRotateCcw,
    FiTrash2,
    FiUser,
    FiX,
} from "react-icons/fi"
import { Secao } from "@/app/components/pagina/pagina"
import {
    apagarTarefa,
    criarTarefa,
    listarTarefas,
    mudarTarefa,
} from "@/middleware/equipe"
import type {
    MembroDaEquipe,
    PrioridadeDaTarefa,
    SituacaoDaTarefa,
    TarefaDaEquipe,
} from "@/app/type/type"

/**
 * As tarefas da equipe: o que uma pessoa pede à outra.
 *
 * Moram dentro da conversa, e não numa tela do painel, porque são a mesma
 * conversa em outro formato. O que hoje é dito no meio do chat — "confere a
 * devolução da Marta até sexta" — se perde no rolar da tela: quem leu esquece,
 * quem não leu não fica sabendo, e ninguém consegue responder "o que ficou de
 * ser feito". A tarefa é essa frase com prazo, dono e um estado que alguém
 * fecha.
 *
 * Não confundir com a fila do estoque (`/page/estoque/fila`), que continua
 * onde está: lá é trabalho de corredor gerado pelo WMS, amarrado a produto e
 * endereço. Aqui é gente pedindo a gente.
 *
 * A lista mostra as tarefas de TODA a equipe, e não só as de quem abriu.
 * Numa loja pequena, saber o que o colega está fazendo é metade da razão de
 * existir da lista: evita duas pessoas fazendo a mesma coisa, e é como alguém
 * pega o que sobrou.
 */

const PRIORIDADES: { chave: PrioridadeDaTarefa; rotulo: string; tag: string }[] = [
    { chave: "urgente", rotulo: "Urgente", tag: "tag-danger" },
    { chave: "alta", rotulo: "Alta", tag: "tag-warning" },
    { chave: "normal", rotulo: "Normal", tag: "tag-info" },
    { chave: "baixa", rotulo: "Quando der", tag: "tag-neutral" },
]

const FILTROS: { chave: "abertas" | "minhas" | "todas"; rotulo: string }[] = [
    { chave: "abertas", rotulo: "Em aberto" },
    { chave: "minhas", rotulo: "Comigo" },
    { chave: "todas", rotulo: "Todas" },
]

export default function TarefasDaEquipe({ membros, eu }: {
    membros: MembroDaEquipe[]
    eu: MembroDaEquipe
}) {

    const [tarefas, setTarefas] = useState<TarefaDaEquipe[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [filtro, setFiltro] = useState<"abertas" | "minhas" | "todas">("abertas")
    const [criando, setCriando] = useState(false)
    const [mexendo, setMexendo] = useState(0)

    const recarregar = useCallback(async () => {
        try {
            setTarefas(await listarTarefas())
            setErro("")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível carregar as tarefas.")
        }
    }, [])

    useEffect(() => {

        let cancelado = false

        async function buscar() {
            try {
                const lista = await listarTarefas()

                if (!cancelado) setTarefas(lista)

            } catch (e) {
                if (!cancelado) {
                    setErro(e instanceof Error ? e.message : "Não foi possível carregar as tarefas.")
                }
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        buscar()

        return () => {
            cancelado = true
        }
    }, [])

    async function mover(tarefa: TarefaDaEquipe, situacao: SituacaoDaTarefa) {

        setMexendo(tarefa.id)
        setErro("")

        try {
            await mudarTarefa(tarefa.id, { situacao })
            await recarregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível mudar a tarefa.")
        } finally {
            setMexendo(0)
        }
    }

    async function apagar(tarefa: TarefaDaEquipe) {

        setMexendo(tarefa.id)
        setErro("")

        try {
            await apagarTarefa(tarefa.id)
            await recarregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível apagar a tarefa.")
        } finally {
            setMexendo(0)
        }
    }

    const minhas = (tarefa: TarefaDaEquipe) =>
        tarefa.para_id === eu.id && tarefa.para_dono === eu.dono

    const visiveis = tarefas.filter((tarefa) => {
        if (filtro === "todas") return true
        if (filtro === "minhas") return minhas(tarefa)

        return tarefa.situacao === "aberta" || tarefa.situacao === "em_andamento"
    })

    return (
        <Secao
            titulo="Tarefas da equipe"
            descricao="O que uma pessoa pediu à outra, com prazo e prioridade. É o recado do chat que não se perde no rolar da tela."
            acoes={
                <div className="flex flex-wrap items-center gap-2">

                    <div className="flex rounded-lg border border-[#E1E1E1] p-0.5" role="group" aria-label="Filtro">
                        {FILTROS.map((item) => (
                            <button
                                key={item.chave}
                                type="button"
                                onClick={() => setFiltro(item.chave)}
                                aria-pressed={item.chave === filtro}
                                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                                    item.chave === filtro
                                        ? "bg-[#303030] text-white"
                                        : "text-[#616161] hover:bg-[#F1F1F1]"
                                }`}
                            >
                                {item.rotulo}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => setCriando((v) => !v)}
                        className="btn btn-primario"
                    >
                        <FiPlus className="w-4" aria-hidden />
                        <span>Nova tarefa</span>
                    </button>
                </div>
            }
        >
            {erro && (
                <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg bg-[#FEE9E8] px-3 py-2 text-sm font-semibold text-[#8E1F0B]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </p>
            )}

            {criando && (
                <NovaTarefa
                    membros={membros}
                    eu={eu}
                    aoCriar={async (dados) => {
                        await criarTarefa(dados)
                        setCriando(false)
                        await recarregar()
                    }}
                    aoFechar={() => setCriando(false)}
                />
            )}

            {carregando ? (
                <div className="h-24 animate-pulse rounded-lg bg-[#F1F1F1]" />
            ) : visiveis.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#E1E1E1] px-4 py-8 text-center text-sm text-[#8A8A8A]">
                    {filtro === "minhas"
                        ? "Nada pedido a você por enquanto."
                        : "Nenhuma tarefa em aberto."}
                </p>
            ) : (
                <ul className="divide-y divide-[#EBEBEB]">
                    {visiveis.map((tarefa) => (
                        <Linha
                            key={tarefa.id}
                            tarefa={tarefa}
                            eu={eu}
                            ocupada={mexendo === tarefa.id}
                            aoMover={mover}
                            aoApagar={apagar}
                        />
                    ))}
                </ul>
            )}
        </Secao>
    )
}

/* ==========================================================================
   Uma tarefa
   ========================================================================== */

function Linha({ tarefa, eu, ocupada, aoMover, aoApagar }: {
    tarefa: TarefaDaEquipe
    eu: MembroDaEquipe
    ocupada: boolean
    aoMover: (tarefa: TarefaDaEquipe, situacao: SituacaoDaTarefa) => void
    aoApagar: (tarefa: TarefaDaEquipe) => void
}) {

    const prioridade = PRIORIDADES.find((p) => p.chave === tarefa.prioridade) ?? PRIORIDADES[2]
    const fechada = tarefa.situacao === "concluida" || tarefa.situacao === "cancelada"
    const pediu = tarefa.criada_por_id === eu.id && tarefa.criada_por_dono === eu.dono

    // Mover a tarefa é só de quem a RECEBEU — nem de quem pediu, nem do dono.
    // Começar e concluir são afirmações de fato ("estou nisso", "está feito"),
    // e quem não fez não tem como afirmá-las: uma tarefa que o chefe marca
    // como concluída para limpar a lista é uma tarefa que ninguém fez.
    //
    // O servidor recusa de todo jeito. Isto aqui é para o botão não existir,
    // em vez de existir e dar erro.
    const faz = tarefa.para_id === eu.id && tarefa.para_dono === eu.dono

    return (
        <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">

            <div className="min-w-0 flex-1">

                <p className={`text-sm font-medium ${fechada ? "text-[#8A8A8A] line-through" : "text-[#303030]"}`}>
                    {tarefa.titulo}
                </p>

                {tarefa.descricao && (
                    <p className="mt-0.5 text-sm text-[#616161]">{tarefa.descricao}</p>
                )}

                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8A8A8A]">

                    <span className={`tag ${prioridade.tag}`}>{prioridade.rotulo}</span>

                    <span className="flex items-center gap-1">
                        <FiUser className="w-3.5" aria-hidden />
                        {tarefa.para}
                        {tarefa.criada_por !== tarefa.para && ` · pedida por ${tarefa.criada_por}`}
                    </span>

                    <Prazo tarefa={tarefa} fechada={fechada} />

                    {tarefa.situacao === "em_andamento" && (
                        <span className="tag tag-info">Em andamento</span>
                    )}

                    {tarefa.situacao === "cancelada" && (
                        <span className="tag tag-neutral">Cancelada</span>
                    )}

                    {/* Sem isto, quem pediu abre a lista, não vê botão nenhum
                        e acha que a tela está quebrada. A ausência do botão
                        precisa vir com o motivo. */}
                    {!faz && !fechada && (
                        <span>Só {tarefa.para} pode mover esta tarefa</span>
                    )}
                </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">

                {/* Só os botões que fazem sentido no estado atual: oferecer
                    "concluir" numa tarefa já concluída é oferecer um clique
                    que não faz nada. */}
                {faz && tarefa.situacao === "aberta" && (
                    <button
                        type="button"
                        onClick={() => aoMover(tarefa, "em_andamento")}
                        disabled={ocupada}
                        className="btn btn-neutro px-3 py-1.5 text-xs"
                    >
                        Começar
                    </button>
                )}

                {faz && !fechada && (
                    <button
                        type="button"
                        onClick={() => aoMover(tarefa, "concluida")}
                        disabled={ocupada}
                        className="btn btn-primario px-3 py-1.5 text-xs"
                    >
                        <FiCheck className="w-3.5" aria-hidden />
                        <span>Concluir</span>
                    </button>
                )}

                {faz && !fechada && (
                    <button
                        type="button"
                        onClick={() => aoMover(tarefa, "cancelada")}
                        disabled={ocupada}
                        aria-label="Cancelar tarefa"
                        className="btn btn-neutro px-2 py-1.5 text-xs"
                    >
                        <FiX className="w-3.5" aria-hidden />
                    </button>
                )}

                {faz && fechada && (
                    <button
                        type="button"
                        onClick={() => aoMover(tarefa, "aberta")}
                        disabled={ocupada}
                        className="btn btn-neutro px-3 py-1.5 text-xs"
                    >
                        <FiRotateCcw className="w-3.5" aria-hidden />
                        <span>Reabrir</span>
                    </button>
                )}

                {/* Apagar é de quem PEDIU (e do dono, que pode tudo). Quem vai
                    fazer fecha e cancela, mas não some com o pedido — senão a
                    saída mais fácil para uma tarefa desagradável seria essa.
                    O servidor recusa de todo jeito. */}
                {(pediu || eu.dono) && (
                    <button
                        type="button"
                        onClick={() => aoApagar(tarefa)}
                        disabled={ocupada}
                        aria-label="Apagar tarefa"
                        className="rounded-lg p-1.5 text-[#8E1F0B] transition-colors hover:bg-[#FEE9E8]"
                    >
                        <FiTrash2 className="w-4" aria-hidden />
                    </button>
                )}
            </div>
        </li>
    )
}

/**
 * O prazo, dito como gente lê — e em vermelho quando já passou.
 *
 * "Venceu ontem" diz mais do que "29/09/2026": quem lê a lista está
 * perguntando o que está atrasado, não que dia é hoje.
 */
function Prazo({ tarefa, fechada }: { tarefa: TarefaDaEquipe; fechada: boolean }) {

    if (!tarefa.comeca_em && !tarefa.termina_em) return null

    const atrasada = !fechada && venceu(tarefa.termina_em)

    return (
        <span className={`flex items-center gap-1 ${atrasada ? "font-semibold text-[#8E1F0B]" : ""}`}>
            <FiCalendar className="w-3.5" aria-hidden />

            {tarefa.comeca_em && <span>{dia(tarefa.comeca_em)}</span>}
            {tarefa.comeca_em && tarefa.termina_em && <span>→</span>}
            {tarefa.termina_em && <span>{dia(tarefa.termina_em)}</span>}

            {atrasada && <span>· atrasada</span>}
        </span>
    )
}

/* ==========================================================================
   Nova tarefa
   ========================================================================== */

function NovaTarefa({ membros, eu, aoCriar, aoFechar }: {
    membros: MembroDaEquipe[]
    eu: MembroDaEquipe
    aoCriar: (dados: {
        titulo: string
        descricao?: string
        para?: string
        prioridade: string
        comeca_em?: string
        termina_em?: string
    }) => Promise<void>
    aoFechar: () => void
}) {

    const [titulo, setTitulo] = useState("")
    const [descricao, setDescricao] = useState("")
    const [para, setPara] = useState(eu.cracha)
    const [prioridade, setPrioridade] = useState<PrioridadeDaTarefa>("normal")

    // O início nasce hoje porque é o caso comum — "começa agora, entrega
    // sexta". A entrega nasce vazia: tarefa sem prazo existe, e uma data
    // sugerida ali viraria um prazo que ninguém escolheu.
    const [comeca, setComeca] = useState(hoje())
    const [termina, setTermina] = useState("")
    const [salvando, setSalvando] = useState(false)

    async function salvar(evento: React.FormEvent) {

        evento.preventDefault()

        if (titulo.trim() === "" || salvando) return

        setSalvando(true)

        try {
            await aoCriar({
                titulo: titulo.trim(),
                descricao: descricao.trim() || undefined,
                para,
                prioridade,
                comeca_em: comeca || undefined,
                termina_em: termina || undefined,
            })
        } finally {
            setSalvando(false)
        }
    }

    return (
        <form onSubmit={salvar} className="mb-5 rounded-xl border border-[#E1E1E1] bg-[#F7F7F7] p-4">

            <label htmlFor="titulo" className="mb-1.5 block text-sm font-semibold text-[#303030]">
                O que precisa ser feito
            </label>

            <input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={140}
                placeholder="Conferir a devolução da Marta"
                className="field w-full"
            />

            <label htmlFor="descricao" className="mb-1.5 mt-4 block text-sm font-semibold text-[#303030]">
                Detalhes <span className="font-normal text-[#8A8A8A]">(opcional)</span>
            </label>

            <textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                maxLength={2000}
                className="field w-full resize-y"
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">

                <div>
                    <label htmlFor="para" className="mb-1.5 block text-sm font-semibold text-[#303030]">
                        Para quem
                    </label>

                    <select
                        id="para"
                        value={para}
                        onChange={(e) => setPara(e.target.value)}
                        className="field w-full"
                    >
                        <option value={eu.cracha}>Para mim</option>

                        {/* Só quem já está na conversa: uma tarefa para quem
                            não consegue abrir o chat é um pedido que a pessoa
                            não tem onde ler, e o servidor a recusaria de todo
                            jeito. Quem falta é explicado logo abaixo, em vez
                            de simplesmente sumir. */}
                        {membros
                            .filter((membro) => membro.cracha !== eu.cracha && membro.na_conversa)
                            .map((membro) => (
                                <option key={membro.cracha} value={membro.cracha}>
                                    {membro.nome}
                                </option>
                            ))}
                    </select>

                    <ForaDaConversa membros={membros} eu={eu} />
                </div>

                <div>
                    <label htmlFor="prioridade" className="mb-1.5 block text-sm font-semibold text-[#303030]">
                        Prioridade
                    </label>

                    <select
                        id="prioridade"
                        value={prioridade}
                        onChange={(e) => setPrioridade(e.target.value as PrioridadeDaTarefa)}
                        className="field w-full"
                    >
                        {PRIORIDADES.map((item) => (
                            <option key={item.chave} value={item.chave}>{item.rotulo}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="comeca" className="mb-1.5 block text-sm font-semibold text-[#303030]">
                        Começa em
                    </label>

                    <input
                        id="comeca"
                        type="date"
                        value={comeca}
                        onChange={(e) => setComeca(e.target.value)}
                        className="field w-full"
                    />
                </div>

                <div>
                    <label htmlFor="termina" className="mb-1.5 block text-sm font-semibold text-[#303030]">
                        Entregar até <span className="font-normal text-[#8A8A8A]">(opcional)</span>
                    </label>

                    <input
                        id="termina"
                        type="date"
                        value={termina}
                        min={comeca || undefined}
                        onChange={(e) => setTermina(e.target.value)}
                        className="field w-full"
                    />
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">

                <button
                    type="submit"
                    disabled={salvando || titulo.trim() === ""}
                    className="btn btn-primario"
                >
                    {salvando ? "Criando…" : "Criar tarefa"}
                </button>

                <button type="button" onClick={aoFechar} className="btn btn-neutro">
                    Cancelar
                </button>
            </div>
        </form>
    )
}

/**
 * Quem trabalha aqui mas ainda não entrou na conversa.
 *
 * Existe porque a ausência silenciosa é o pior jeito de informar: sem esta
 * linha, o dono abre o formulário, vê só "Para mim" e conclui que o sistema
 * não achou a equipe dele — quando a verdade é que falta passar o código.
 */
function ForaDaConversa({ membros, eu }: { membros: MembroDaEquipe[]; eu: MembroDaEquipe }) {

    const faltando = membros.filter((m) => m.cracha !== eu.cracha && !m.na_conversa)

    if (faltando.length === 0) return null

    return (
        <p className="mt-1.5 text-xs text-[#8A8A8A]">
            {faltando.map((m) => m.nome).join(", ")}{" "}
            {faltando.length === 1 ? "ainda não entrou" : "ainda não entraram"} na conversa.
            {eu.dono
                ? " Passe o código da loja e confirme a entrada em Código e acessos."
                : " Peça ao dono da loja para liberar."}
        </p>
    )
}

/* ==========================================================================
   Datas
   ========================================================================== */

/**
 * As datas são texto "2026-09-30" e são FATIADAS, nunca convertidas para Date.
 *
 * `new Date("2026-09-30")` é lido como meia-noite UTC, e em fuso brasileiro
 * isso volta um dia: o prazo de trinta viraria vinte e nove na tela.
 */
function dia(iso: string): string {

    const [ano, mes, d] = iso.slice(0, 10).split("-")

    return `${d}/${mes}/${ano.slice(2)}`
}

function hoje(): string {

    const agora = new Date()

    const mes = String(agora.getMonth() + 1).padStart(2, "0")
    const d = String(agora.getDate()).padStart(2, "0")

    return `${agora.getFullYear()}-${mes}-${d}`
}

/** Comparação de texto, pelo mesmo motivo: "2026-09-30" ordena sozinho. */
function venceu(termina?: string): boolean {
    return termina !== undefined && termina.slice(0, 10) < hoje()
}
