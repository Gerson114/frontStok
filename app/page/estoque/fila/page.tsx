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
    FiFilter,
    FiPlay,
    FiUser,
    FiX,
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
    type Visao,
} from "@/app/components/lista/lista"

/**
 * A fila de trabalho do estoque.
 *
 * É a tela de quem está no chão da loja com o celular na mão: uma lista e
 * três botões — assumir, concluir, cancelar.
 *
 * ## O defeito que esta versão corrigiu
 *
 * A tela antiga imprimia dois números no topo, "Esperando alguém" e "Em
 * andamento", e oferecia um seletor com três opções: Por fazer, Concluídas,
 * Canceladas. Faltava justamente a que o número anunciava.
 *
 * Quem via "Em andamento 2" e ia procurar aquelas duas não tinha para onde
 * ir: a opção não existia, e escolher qualquer outra fazia os contadores
 * sumirem (eles só apareciam no modo sem filtro). O número existia sem
 * resposta — e a impressão que ficava era a de que o sistema contava tarefas
 * que não mostrava.
 *
 * Aqui o contador e o filtro são a MESMA coisa: cada situação é uma aba, e a
 * contagem vive nela. Clicar em "Em andamento 2" mostra exatamente aquelas
 * duas linhas, porque é a aba que faz a busca. Não há como o número e a lista
 * discordarem quando são o mesmo elemento.
 *
 * A anatomia é a da lista de recursos do Shopify Admin (ver
 * components/lista/lista.tsx).
 */

const COR_DO_TIPO: Record<string, string> = {
    armazenagem: "bg-[var(--azul)]",
    ressuprimento: "bg-[var(--amarelo-forte)]",
    separacao: "bg-[var(--verde)]",
    inventario: "bg-[var(--vermelho)]",
}

const TIPOS: { chave: TipoTarefa | ""; nome: string }[] = [
    { chave: "", nome: "Todos os tipos" },
    { chave: "armazenagem", nome: "Guardar o que chegou" },
    { chave: "ressuprimento", nome: "Repor a prateleira" },
    { chave: "separacao", nome: "Separar pedido" },
    { chave: "inventario", nome: "Contar endereço" },
]

/*
 * As abas.
 *
 * "Em aberto" é a soma das duas seguintes, e é o padrão porque é a pergunta
 * de quem abre a tela para trabalhar: o que há para fazer agora. As duas
 * abaixo dela recortam esse conjunto pela pergunta que vem em seguida — o que
 * ninguém pegou, e o que alguém já está fazendo.
 *
 * Concluídas e canceladas não trazem contagem. Seria uma consulta a mais em
 * cada abertura de tela para informar um número que ninguém usa para decidir
 * nada: elas são histórico, e quem as abre quer a lista, não o total.
 */
const VISOES: { chave: string; nome: string; situacao: SituacaoTarefa | "" }[] = [
    { chave: "aberto", nome: "Em aberto", situacao: "" },
    { chave: "pendente", nome: "Esperando alguém", situacao: "pendente" },
    { chave: "em_andamento", nome: "Em andamento", situacao: "em_andamento" },
    { chave: "concluida", nome: "Concluídas", situacao: "concluida" },
    { chave: "cancelada", nome: "Canceladas", situacao: "cancelada" },
]

export default function FilaDoEstoque() {

    const [tarefas, setTarefas] = useState<Tarefa[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    const [visao, setVisao] = useState("aberto")
    const [tipo, setTipo] = useState<TipoTarefa | "">("")
    const [busca, setBusca] = useState("")

    /*
     * As contagens das abas, de uma consulta própria.
     *
     * Elas NÃO saem da lista que está na tela: se saíssem, a aba "Em
     * andamento" mostraria zero enquanto se olha as concluídas — e voltaria a
     * ser um número que não corresponde ao que existe. Uma consulta separada,
     * sempre da fila em aberto, mantém as duas contagens verdadeiras
     * independentemente da aba aberta.
     */
    const [contagens, setContagens] = useState({ aberto: 0, pendente: 0, em_andamento: 0 })

    const [ocupada, setOcupada] = useState<number | null>(null)

    // Quem está mexendo agora. Não é login: numa loja pequena quem separa nem
    // sempre tem conta no sistema, e exigir uma faria a fila ser preenchida no
    // nome de quem tem a senha — o que é pior que não saber.
    const [responsavel, setResponsavel] = useState("")

    const situacaoDaVisao = VISOES.find((v) => v.chave === visao)?.situacao ?? ""

    const contar = useCallback(async () => {

        try {
            const emAberto = await listarTarefas({})

            setContagens({
                aberto: emAberto.length,
                pendente: emAberto.filter((t) => t.situacao === "pendente").length,
                em_andamento: emAberto.filter((t) => t.situacao === "em_andamento").length,
            })

        } catch {
            // Contagem é enfeite informativo: falhar aqui não pode tirar a
            // lista da tela, que é o que a pessoa veio ver.
        }

    }, [])

    const carregar = useCallback(async () => {

        try {
            const lista = await listarTarefas({
                situacao: situacaoDaVisao || undefined,
                tipo: tipo || undefined,
            })

            setTarefas(lista)
            setErro("")

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível carregar a fila do estoque.")
        } finally {
            setCarregando(false)
        }

    }, [situacaoDaVisao, tipo])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca ao abrir e a cada troca de aba
        carregar()
    }, [carregar])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- contagem das abas, uma vez ao abrir
        contar()
    }, [contar])

    // Esta é a tela mais compartilhada do sistema: várias pessoas no corredor
    // pegando tarefa da mesma fila. Sem o aviso ao vivo, duas vão atrás da
    // mesma peça porque a lista de cada uma ficou parada no que era antes.
    //
    // A contagem das abas também recarrega: o número em "Pendentes" faz parte
    // da tela e envelheceria junto.
    useAoVivo(["separacao", "estoque", "pedido"], () => {
        carregar()
        contar()
    })

    async function executar(id: number, acao: () => Promise<unknown>, mensagem: string) {

        setErro("")
        setAviso("")
        setOcupada(id)

        try {
            await acao()
            setAviso(mensagem)
            await Promise.all([carregar(), contar()])

        } catch (e) {
            // 409 é o caso normal aqui: outra pessoa pegou a mesma tarefa
            // primeiro. A fila é recarregada para a tela mostrar quem está
            // com ela em vez de insistir no botão.
            setErro(e instanceof ApiError ? e.message : "Não foi possível atualizar a tarefa.")
            await Promise.all([carregar(), contar()])

        } finally {
            setOcupada(null)
        }
    }

    /*
     * A busca é local, sobre o que já veio.
     *
     * A fila de um dia de trabalho tem dezenas de linhas, não milhares, e o
     * servidor não tem busca por texto nesta rota. Filtrar aqui responde
     * enquanto se digita; mandar para o servidor seria uma ida de rede por
     * tecla para varrer a mesma lista que já está na memória.
     */
    const filtradas = busca.trim()
        ? tarefas.filter((tarefa) => {
            const alvo = [
                tarefa.tipo_nome,
                tarefa.produto_nome,
                tarefa.produto_variacao,
                tarefa.origem,
                tarefa.destino,
                tarefa.responsavel,
            ].filter(Boolean).join(" ").toLowerCase()

            return alvo.includes(busca.trim().toLowerCase())
        })
        : tarefas

    const visoes: Visao[] = VISOES.map((v) => ({
        chave: v.chave,
        nome: v.nome,
        contagem: v.chave in contagens ? contagens[v.chave as keyof typeof contagens] : undefined,
    }))

    return (
        <Pagina
            titulo="Fila de trabalho"
            descricao="O que precisa ser feito no estoque, do mais urgente para o menos. Quem decide a ordem é o sistema; aqui se assume, se conclui e se cancela. Concluir move a mercadoria de verdade — não é só marcar feito."
        >

            {erro && (
                <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aviso && (
                <div role="status" className="mb-4 flex items-start gap-2.5 rounded-lg bg-[var(--verde-fundo)] px-4 py-3 text-sm font-semibold text-[var(--verde)]">
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{aviso}</span>
                </div>
            )}

            <ListaDeRecursos>

                <Visoes visoes={visoes} ativa={visao} aoTrocar={setVisao} />

                <BarraDaLista
                    busca={busca}
                    aoBuscar={setBusca}
                    placeholder="Buscar por produto, endereço ou responsável"
                    controles={
                        // w-full sm:w-* nos dois: esta é a tela de quem está
                        // no chão da loja com o celular na mão (ver o
                        // comentário grande no topo do arquivo) — e a régua
                        // do BarraDaLista não quebra o que está dentro de
                        // `controles` (ele não tem flex-wrap próprio, só o
                        // contêiner da busca tem). Sem empilhar aqui, o tipo
                        // e o campo de responsável ficavam espremidos ou
                        // cortados pelo `overflow-hidden` da lista, num
                        // telefone estreito.
                        <div className="flex w-full flex-wrap gap-2 sm:w-auto">

                            {/* O tipo fica como controle da lista, e não como
                                campo de formulário: ele recorta o que já está
                                na tela, como o filtro do Shopify. */}
                            <div className="w-full sm:w-52">
                                <Selecao
                                    aria-label="Tipo de tarefa"
                                    value={tipo}
                                    onChange={(e) => setTipo(e.target.value as TipoTarefa | "")}
                                >
                                    {TIPOS.map((item) => (
                                        <option key={item.chave} value={item.chave}>{item.nome}</option>
                                    ))}
                                </Selecao>
                            </div>

                            <div className="w-full sm:w-44">
                                <input
                                    type="text"
                                    value={responsavel}
                                    onChange={(e) => setResponsavel(e.target.value)}
                                    placeholder="Quem está trabalhando"
                                    aria-label="Quem está trabalhando"
                                    className="field"
                                />
                            </div>
                        </div>
                    }
                />

                {carregando ? (

                    <p className="px-4 py-14 text-center text-sm text-[var(--ink-2)]">
                        Carregando a fila...
                    </p>

                ) : filtradas.length === 0 ? (

                    <ListaVazia
                        icone={busca ? FiFilter : FiClipboard}
                        titulo={
                            busca
                                ? "Nada com esse texto"
                                : visao === "aberto"
                                    ? "Nada na fila"
                                    : "Nada nesta aba"
                        }
                        acao={
                            !busca && visao === "aberto" ? (
                                <>
                                    <Link href="/page/estoque/reposicao" className="btn btn-neutro text-sm">
                                        Ver o que falta na prateleira
                                    </Link>
                                    <Link href="/page/estoque/inventario" className="btn btn-neutro text-sm">
                                        Ver contagens atrasadas
                                    </Link>
                                </>
                            ) : undefined
                        }
                    >
                        {busca
                            ? "Nenhuma tarefa desta aba casa com o que você digitou."
                            : visao === "aberto"
                                ? "Ninguém tem trabalho pendente no estoque agora. A fila enche sozinha quando chega mercadoria, quando a prateleira baixa do mínimo ou quando o inventário vence."
                                : "Nenhuma tarefa nesta situação."}
                    </ListaVazia>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="tabela">

                            <thead>
                                <tr>
                                    <th scope="col">Tarefa</th>
                                    <th scope="col">Percurso</th>
                                    <th scope="col">Situação</th>
                                    <th scope="col" className="text-right">Prioridade</th>
                                    <th scope="col"><span className="sr-only">Ações</span></th>
                                </tr>
                            </thead>

                            <tbody>

                                {filtradas.map((tarefa) => {

                                    const encerrada = tarefa.situacao === "concluida" || tarefa.situacao === "cancelada"
                                    const trabalhando = ocupada === tarefa.id

                                    return (
                                        <tr key={tarefa.id}>

                                            <td>
                                                <div className="flex items-start gap-2.5">

                                                    {/* A cor do tipo era uma borda de 4px no
                                                        cartão. Numa tabela ela vira este traço:
                                                        mesma informação, sem engordar a linha. */}
                                                    <span
                                                        className={`mt-0.5 h-8 w-1 shrink-0 rounded-full ${COR_DO_TIPO[tarefa.tipo] ?? "bg-[var(--linha)]"}`}
                                                        aria-hidden
                                                    />

                                                    <div className="min-w-0">

                                                        <p className="font-medium text-[var(--ink)]">
                                                            {tarefa.tipo_nome}
                                                        </p>

                                                        {tarefa.produto_nome ? (
                                                            <p className="mt-0.5 truncate text-[var(--ink-2)]">
                                                                <span className="num">{tarefa.quantidade}x</span>{" "}
                                                                {tarefa.produto_nome}
                                                                {tarefa.produto_variacao ? ` · ${tarefa.produto_variacao}` : ""}
                                                            </p>
                                                        ) : null}

                                                        {tarefa.observacao && (
                                                            <p className="mt-0.5 truncate text-xs text-[var(--ink-3)]">
                                                                {tarefa.observacao}
                                                            </p>
                                                        )}

                                                    </div>

                                                </div>
                                            </td>

                                            <td>
                                                {tarefa.origem || tarefa.destino ? (
                                                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                                                        {tarefa.origem && (
                                                            <span className="num text-[var(--ink)]">{tarefa.origem}</span>
                                                        )}
                                                        {tarefa.origem && tarefa.destino && (
                                                            <FiArrowRight className="w-3.5 text-[var(--ink-3)]" aria-hidden />
                                                        )}
                                                        {tarefa.destino && (
                                                            <span className="num text-[var(--ink)]">{tarefa.destino}</span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-[var(--ink-3)]">sem endereço</span>
                                                )}
                                            </td>

                                            <td>
                                                <div className="flex flex-wrap items-center gap-1.5">

                                                    {tarefa.situacao === "pendente" && (
                                                        <span className="tag tag-warning">esperando</span>
                                                    )}

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
                                                        <span className="tag tag-neutral num">pedido #{tarefa.pedido_id}</span>
                                                    )}

                                                    {tarefa.onda_id && (
                                                        <span className="tag tag-neutral num">onda #{tarefa.onda_id}</span>
                                                    )}

                                                </div>
                                            </td>

                                            <td className="text-right">
                                                <span className="num inline-flex items-center gap-1 text-[var(--ink-2)]">
                                                    <FiClock className="w-3.5" aria-hidden />
                                                    {tarefa.prioridade}
                                                </span>
                                            </td>

                                            <td>
                                                {!encerrada && (

                                                    <div className="flex justify-end gap-1.5 whitespace-nowrap">

                                                        {tarefa.situacao === "pendente" && (
                                                            <button
                                                                type="button"
                                                                disabled={trabalhando}
                                                                onClick={() => executar(
                                                                    tarefa.id,
                                                                    () => assumirTarefa(tarefa.id, responsavel.trim()),
                                                                    "Tarefa assumida."
                                                                )}
                                                                className="btn btn-neutro text-xs"
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
                                                            className="btn btn-primario text-xs"
                                                        >
                                                            {trabalhando ? "..." : "Concluir"}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={trabalhando}
                                                            aria-label="Cancelar tarefa"
                                                            title="Cancelar tarefa"
                                                            onClick={() => executar(
                                                                tarefa.id,
                                                                () => cancelarTarefa(tarefa.id),
                                                                "Tarefa cancelada."
                                                            )}
                                                            className="btn btn-neutro px-2 text-xs"
                                                        >
                                                            <FiX className="w-3.5" aria-hidden />
                                                        </button>

                                                    </div>

                                                )}
                                            </td>

                                        </tr>
                                    )
                                })}

                            </tbody>

                        </table>

                    </div>

                )}

                {!carregando && filtradas.length > 0 && (
                    <RodapeDaLista
                        primeiro={1}
                        ultimo={filtradas.length}
                        total={filtradas.length}
                        nome="tarefas"
                    />
                )}

            </ListaDeRecursos>

        </Pagina>
    )
}
