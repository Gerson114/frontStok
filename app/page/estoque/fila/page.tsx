"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
    assumirTarefa,
    cancelarTarefa,
    concluirTarefa,
    listarTarefas,
    type SituacaoTarefa,
    type Tarefa,
    type TipoTarefa,
} from "@/middleware/wms"
import { ApiError } from "@/middleware/client"
import {
    FiAlertCircle,
    FiArrowRight,
    FiCheckCircle,
    FiClipboard,
    FiClock,
    FiPlay,
    FiUser,
    FiX,
} from "react-icons/fi"

/**
 * A fila de trabalho do estoque.
 *
 * É a tela de quem está no chão da loja com o celular na mão: uma lista e
 * três botões — assumir, concluir, cancelar. Nada aqui decide o que precisa
 * ser feito nem em que ordem; isso já foi decidido pelo servidor quando a
 * tarefa nasceu (ver internal/services/estoque). Reordenar ou filtrar por
 * conta própria seria repetir a regra de prioridade em dois lugares, e no dia
 * em que ela mudasse a tela mandaria alguém à prateleira errada.
 *
 * Concluir não é marcar concluído: é a hora em que a mercadoria se move de
 * verdade — o ressuprimento desce as peças do pulmão, a armazenagem tira da
 * doca. Por isso o botão é o último passo, e não o primeiro.
 */

const FILTROS: { chave: SituacaoTarefa | ""; nome: string }[] = [
    { chave: "", nome: "Por fazer" },
    { chave: "concluida", nome: "Concluídas" },
    { chave: "cancelada", nome: "Canceladas" },
]

const TIPOS: { chave: TipoTarefa | ""; nome: string }[] = [
    { chave: "", nome: "Todos os tipos" },
    { chave: "armazenagem", nome: "Guardar o que chegou" },
    { chave: "ressuprimento", nome: "Repor a prateleira" },
    { chave: "separacao", nome: "Separar pedido" },
    { chave: "inventario", nome: "Contar endereço" },
]

/** A cor da tarja diz o tipo de trabalho antes de a pessoa ler a linha. */
const COR_DO_TIPO: Record<string, string> = {
    armazenagem: "border-l-[#5A6469]",
    ressuprimento: "border-l-[#0086FF]",
    separacao: "border-l-[#08A022]",
    inventario: "border-l-[#FFB800]",
}

export default function FilaDoEstoque() {

    const [tarefas, setTarefas] = useState<Tarefa[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    const [situacao, setSituacao] = useState<SituacaoTarefa | "">("")
    const [tipo, setTipo] = useState<TipoTarefa | "">("")

    // Quem está mexendo agora, para o botão da linha desabilitar sozinho sem
    // travar a lista inteira.
    const [ocupada, setOcupada] = useState<number | null>(null)

    // O nome de quem está trabalhando. Não é login: numa loja pequena quem
    // separa nem sempre tem conta no sistema, e exigir uma faria a fila ser
    // preenchida no nome de quem tem a senha — o que é pior que não saber.
    const [responsavel, setResponsavel] = useState("")

    const carregar = useCallback(async () => {

        try {
            const lista = await listarTarefas({
                situacao: situacao || undefined,
                tipo: tipo || undefined,
            })

            setTarefas(lista)
            setErro("")

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível carregar a fila do estoque.")
        } finally {
            setCarregando(false)
        }

    }, [situacao, tipo])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca ao abrir e a cada troca de filtro
        carregar()
    }, [carregar])

    async function executar(id: number, acao: () => Promise<unknown>, mensagem: string) {

        setErro("")
        setAviso("")
        setOcupada(id)

        try {
            await acao()
            setAviso(mensagem)
            await carregar()

        } catch (e) {
            // 409 é o caso normal aqui: outra pessoa pegou a mesma tarefa
            // primeiro. A fila é recarregada para a tela mostrar quem está
            // com ela em vez de insistir no botão.
            setErro(e instanceof ApiError ? e.message : "Não foi possível atualizar a tarefa.")
            await carregar()

        } finally {
            setOcupada(null)
        }
    }

    const pendentes = tarefas.filter((tarefa) => tarefa.situacao === "pendente").length
    const emAndamento = tarefas.filter((tarefa) => tarefa.situacao === "em_andamento").length

    return (
        <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">
            <div className="mx-auto max-w-4xl space-y-6">

                <div>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5A6469]">
                        Estoque
                    </p>
                    <h1 className="font-display text-2xl text-[#1E2428]">
                        Fila de trabalho
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-[#5A6469]">
                        O que precisa ser feito no estoque, do mais urgente para o menos. Quem decide
                        a ordem é o sistema; aqui se assume, se conclui e se cancela. Concluir move a
                        mercadoria de verdade — não é só marcar feito.
                    </p>
                </div>

                {!carregando && situacao === "" && (
                    <div className="grid grid-cols-2 gap-4">

                        <div className="card p-5">
                            <p className="text-sm text-[#5A6469]">Esperando alguém</p>
                            <p className="num mt-1 text-3xl font-bold text-[#1E2428]">{pendentes}</p>
                        </div>

                        <div className="card p-5">
                            <p className="text-sm text-[#5A6469]">Em andamento</p>
                            <p className="num mt-1 text-3xl font-bold text-[#1E2428]">{emAndamento}</p>
                        </div>

                    </div>
                )}

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

                <div className="card space-y-4 p-5">

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="situacao">Mostrar</label>
                            <select
                                id="situacao"
                                value={situacao}
                                onChange={(e) => setSituacao(e.target.value as SituacaoTarefa | "")}
                                className="field cursor-pointer"
                            >
                                {FILTROS.map((filtro) => (
                                    <option key={filtro.chave} value={filtro.chave}>{filtro.nome}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="tipo">Tipo</label>
                            <select
                                id="tipo"
                                value={tipo}
                                onChange={(e) => setTipo(e.target.value as TipoTarefa | "")}
                                className="field cursor-pointer"
                            >
                                {TIPOS.map((item) => (
                                    <option key={item.chave} value={item.chave}>{item.nome}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="responsavel">Quem está trabalhando</label>
                            <input
                                id="responsavel"
                                type="text"
                                value={responsavel}
                                onChange={(e) => setResponsavel(e.target.value)}
                                placeholder="Opcional — um nome, uma inicial"
                                className="field"
                            />
                        </div>

                    </div>

                </div>

                {carregando ? (

                    <p className="text-[#5A6469]">Carregando a fila...</p>

                ) : tarefas.length === 0 ? (

                    <div className="rounded-lg border border-dashed border-[#D3DADD] bg-white p-12 text-center">

                        <FiClipboard className="mx-auto w-9 text-[#8C969B]" aria-hidden />

                        <h2 className="font-display mt-4 text-lg text-[#1E2428]">
                            {situacao === "" ? "Nada na fila" : "Nada por aqui"}
                        </h2>

                        <p className="mt-2 text-sm text-[#5A6469]">
                            {situacao === ""
                                ? "Ninguém tem trabalho pendente no estoque agora. A fila enche sozinha quando chega mercadoria, quando a prateleira baixa do mínimo ou quando o inventário vence."
                                : "Nenhuma tarefa nesta situação."}
                        </p>

                        {situacao === "" && (
                            <div className="mt-6 flex flex-wrap justify-center gap-3">
                                <Link href="/page/estoque/reposicao" className="btn btn-neutro text-sm">
                                    Ver o que falta na prateleira
                                </Link>
                                <Link href="/page/estoque/inventario" className="btn btn-neutro text-sm">
                                    Ver contagens atrasadas
                                </Link>
                            </div>
                        )}

                    </div>

                ) : (

                    <ul className="space-y-3">

                        {tarefas.map((tarefa) => {

                            const encerrada = tarefa.situacao === "concluida" || tarefa.situacao === "cancelada"
                            const trabalhando = ocupada === tarefa.id

                            return (
                                <li
                                    key={tarefa.id}
                                    className={`card border-l-4 p-5 ${COR_DO_TIPO[tarefa.tipo] ?? "border-l-[#D3DADD]"}`}
                                >

                                    <div className="flex flex-wrap items-start justify-between gap-3">

                                        <div className="min-w-0">

                                            <p className="font-display text-base text-[#1E2428]">
                                                {tarefa.tipo_nome}
                                            </p>

                                            {tarefa.produto_nome && (
                                                <p className="mt-0.5 text-sm text-[#1E2428]">
                                                    <span className="num text-[#5A6469]">{tarefa.quantidade}x</span>{" "}
                                                    {tarefa.produto_nome}
                                                    {tarefa.produto_variacao ? ` · ${tarefa.produto_variacao}` : ""}
                                                </p>
                                            )}

                                            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#5A6469]">

                                                {tarefa.origem && (
                                                    <span className="num font-medium text-[#1E2428]">{tarefa.origem}</span>
                                                )}

                                                {tarefa.origem && tarefa.destino && (
                                                    <FiArrowRight className="w-3.5" aria-hidden />
                                                )}

                                                {tarefa.destino && (
                                                    <span className="num font-medium text-[#1E2428]">{tarefa.destino}</span>
                                                )}

                                                {!tarefa.origem && !tarefa.destino && <span>sem endereço</span>}

                                            </p>

                                            <p className="mt-2 flex flex-wrap items-center gap-2">

                                                {tarefa.situacao === "em_andamento" && (
                                                    <span className="tag tag-info">
                                                        <FiPlay className="w-3" aria-hidden />
                                                        em andamento
                                                    </span>
                                                )}

                                                {tarefa.situacao === "concluida" && (
                                                    <span className="tag tag-success">concluída</span>
                                                )}

                                                {tarefa.situacao === "cancelada" && (
                                                    <span className="tag tag-neutral">cancelada</span>
                                                )}

                                                {tarefa.responsavel && (
                                                    <span className="tag tag-neutral">
                                                        <FiUser className="w-3" aria-hidden />
                                                        {tarefa.responsavel}
                                                    </span>
                                                )}

                                                {tarefa.pedido_id && (
                                                    <span className="tag tag-neutral num">
                                                        pedido #{tarefa.pedido_id}
                                                    </span>
                                                )}

                                                {tarefa.onda_id && (
                                                    <span className="tag tag-neutral num">
                                                        onda #{tarefa.onda_id}
                                                    </span>
                                                )}

                                                <span className="tag tag-neutral">
                                                    <FiClock className="w-3" aria-hidden />
                                                    prioridade {tarefa.prioridade}
                                                </span>

                                            </p>

                                            {tarefa.observacao && (
                                                <p className="mt-2 text-sm text-[#5A6469]">{tarefa.observacao}</p>
                                            )}

                                        </div>

                                        {!encerrada && (

                                            <div className="flex shrink-0 flex-wrap gap-2">

                                                {tarefa.situacao === "pendente" && (
                                                    <button
                                                        type="button"
                                                        disabled={trabalhando}
                                                        onClick={() => executar(
                                                            tarefa.id,
                                                            () => assumirTarefa(tarefa.id, responsavel.trim()),
                                                            "Tarefa assumida."
                                                        )}
                                                        className="btn btn-neutro text-sm"
                                                    >
                                                        Assumir
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    disabled={trabalhando}
                                                    onClick={() => executar(
                                                        tarefa.id,
                                                        () => concluirTarefa(tarefa.id),
                                                        "Tarefa concluída: a mercadoria foi movida."
                                                    )}
                                                    className="btn btn-primario text-sm"
                                                >
                                                    {trabalhando ? "..." : "Concluir"}
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={trabalhando}
                                                    aria-label="Cancelar tarefa"
                                                    onClick={() => executar(
                                                        tarefa.id,
                                                        () => cancelarTarefa(tarefa.id),
                                                        "Tarefa cancelada."
                                                    )}
                                                    className="btn btn-neutro text-sm"
                                                >
                                                    <FiX className="w-4" aria-hidden />
                                                </button>

                                            </div>

                                        )}

                                    </div>

                                </li>
                            )
                        })}

                    </ul>

                )}

            </div>
        </main>
    )
}
