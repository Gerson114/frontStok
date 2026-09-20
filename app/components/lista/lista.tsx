"use client"

import { FiChevronLeft, FiChevronRight, FiPlus, FiSearch, FiX } from "react-icons/fi"
import type { IconType } from "react-icons"
import type { ReactNode } from "react"

/**
 * A lista de recursos do painel — a anatomia da lista do Shopify Admin.
 *
 * Antes disto, cada tela de Estoque montava a própria lista: uma era pilha de
 * cartões, outra tabela, outra blocos com etiquetas soltas; os filtros eram
 * ora abas, ora <select> nativo, ora nada. Telas que respondem à mesma
 * pergunta ("o que existe, e o que eu faço com isso") pareciam nove produtos
 * de nove empresas.
 *
 * A anatomia é sempre esta, de cima para baixo:
 *
 *   1. VISÕES — as abas que recortam a mesma lista (Todas, Sem local,
 *      Reservadas). Cada uma traz a contagem do que ela contém, porque o
 *      número é metade da resposta: "Reservadas 4" já diz se vale clicar.
 *
 *   2. BUSCA — a linha de busca, com filtro e ordenação à direita.
 *
 *   3. AÇÕES EM MASSA — quando alguma linha é marcada, esta barra OCUPA O
 *      LUGAR da linha de busca, em vez de aparecer abaixo dela. É o detalhe
 *      que o Shopify acertou: o que muda é o modo da tela, e a barra que
 *      chega no mesmo lugar diz isso sem empurrar a tabela para baixo.
 *
 *   4. A TABELA — uma linha por registro, com as classes .tabela do painel.
 *
 *   5. O RODAPÉ — "1–25 de 268" com as setas, colado na tabela, para não
 *      restar dúvida sobre estar vendo um pedaço.
 *
 * As peças são soltas de propósito. Um componente único que recebesse
 * colunas e linhas por propriedade caberia na tela de Estoque e apertaria
 * todas as outras — a de Contagem agrupa por endereço, a de Reposição tem
 * duas colunas de números, a de Tarefas tem uma linha de filtros própria. As
 * peças soltas dão a mesma moldura sem obrigar as nove a serem a mesma tabela.
 */

/* ==========================================================================
   A moldura
   ========================================================================== */

export function ListaDeRecursos({ children }: { children: ReactNode }) {

    // `overflow-hidden` é o que faz o cabeçalho das abas e o rodapé
    // respeitarem o raio do cartão; sem ele, a primeira aba vaza o canto.
    return (
        <div className="card overflow-hidden">
            {children}
        </div>
    )
}

/* ==========================================================================
   1. Visões
   ========================================================================== */

export interface Visao {
    chave: string
    nome: string
    /** Quantos registros esta visão contém. Ausente quando a conta é cara. */
    contagem?: number
}

interface VisoesProps {
    visoes: Visao[]
    ativa: string
    aoTrocar: (chave: string) => void
    /** Abre o que cria uma visão nova. Ausente quando a tela não guarda visões. */
    aoCriar?: () => void
}

export function Visoes({ visoes, ativa, aoTrocar, aoCriar }: VisoesProps) {

    return (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--linha)] px-2 py-1.5">

            {visoes.map((visao) => {

                const escolhida = visao.chave === ativa

                return (
                    <button
                        key={visao.chave}
                        type="button"
                        onClick={() => aoTrocar(visao.chave)}
                        aria-current={escolhida ? "true" : undefined}
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                            escolhida
                                ? "bg-[#E3E3E3] text-[var(--ink)]"
                                : "text-[var(--ink-2)] hover:bg-[var(--fundo)] hover:text-[var(--ink)]"
                        }`}
                    >
                        {visao.nome}

                        {visao.contagem !== undefined && (
                            // A contagem é da mesma família do rótulo, um tom
                            // mais clara: ela acompanha o nome, não compete
                            // com ele.
                            <span className={`num text-xs ${escolhida ? "text-[var(--ink-2)]" : "text-[var(--ink-3)]"}`}>
                                {visao.contagem}
                            </span>
                        )}
                    </button>
                )
            })}

            {aoCriar && (
                <button
                    type="button"
                    onClick={aoCriar}
                    title="Nova visão"
                    aria-label="Nova visão"
                    className="ml-0.5 shrink-0 rounded-lg p-1.5 text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)] hover:text-[var(--ink)]"
                >
                    <FiPlus className="w-4" aria-hidden />
                </button>
            )}

        </div>
    )
}

/* ==========================================================================
   2 e 3. Busca e ações em massa
   ========================================================================== */

interface BarraDaListaProps {
    busca: string
    aoBuscar: (texto: string) => void
    placeholder?: string

    /** Botões à direita da busca: filtrar, ordenar, o que a tela tiver. */
    controles?: ReactNode

    /** Quantas linhas estão marcadas. Zero esconde a barra de ações. */
    marcadas?: number
    aoDesmarcar?: () => void
    /** Os botões que agem sobre as linhas marcadas. */
    acoesEmMassa?: ReactNode
}

export function BarraDaLista({
    busca,
    aoBuscar,
    placeholder = "Buscar",
    controles,
    marcadas = 0,
    aoDesmarcar,
    acoesEmMassa,
}: BarraDaListaProps) {

    // Com linhas marcadas, a tela entra em outro modo: o que importa deixa de
    // ser achar e passa a ser agir sobre o que já foi achado. A barra toma o
    // lugar da busca em vez de somar-se a ela — é o que mantém a tabela na
    // mesma altura e diz, sem texto, que a tela mudou de modo.
    if (marcadas > 0) {

        return (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--linha)] bg-[var(--fundo)] px-3 py-2">

                <span className="text-[0.8125rem] font-medium text-[var(--ink)]">
                    <span className="num">{marcadas}</span>{" "}
                    {marcadas === 1 ? "selecionada" : "selecionadas"}
                </span>

                <div className="flex flex-wrap items-center gap-2">
                    {acoesEmMassa}
                </div>

                {aoDesmarcar && (
                    <button
                        type="button"
                        onClick={aoDesmarcar}
                        className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-[#E3E3E3] hover:text-[var(--ink)]"
                    >
                        <FiX className="w-3.5" aria-hidden />
                        Limpar
                    </button>
                )}

            </div>
        )
    }

    return (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--linha)] px-3 py-2">

            <div className="relative min-w-56 flex-1">

                <FiSearch
                    className="pointer-events-none absolute left-2.5 top-1/2 w-4 -translate-y-1/2 text-[var(--ink-3)]"
                    aria-hidden
                />

                <input
                    type="search"
                    value={busca}
                    onChange={(evento) => aoBuscar(evento.target.value)}
                    placeholder={placeholder}
                    className="field pl-8"
                />

            </div>

            {controles && (
                <div className="flex shrink-0 items-center gap-2">
                    {controles}
                </div>
            )}

        </div>
    )
}

/**
 * Um botão de controle da lista (filtrar, ordenar).
 *
 * Discreto por definição: ele não é o que a pessoa veio fazer na tela, é como
 * ela chega lá. Por isso não tem cor de ação — só ganha peso quando está
 * `ativo`, que é quando há um filtro valendo e a tela precisa dizer isso.
 */
export function ControleDaLista({
    icone: Icone,
    children,
    ativo = false,
    ...resto
}: {
    icone: IconType
    children?: ReactNode
    ativo?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {

    return (
        <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[0.8125rem] font-medium transition-colors ${
                ativo
                    ? "border-[var(--azul)] bg-[#EBF5FF] text-[var(--azul)]"
                    : "border-[var(--linha)] bg-[var(--superficie)] text-[var(--ink-2)] hover:border-[var(--ink-3)] hover:text-[var(--ink)]"
            }`}
            {...resto}
        >
            <Icone className="w-4" aria-hidden />
            {children}
        </button>
    )
}

/* ==========================================================================
   5. O rodapé
   ========================================================================== */

interface RodapeDaListaProps {
    /** Índice do primeiro registro mostrado, começando em 1. */
    primeiro: number
    /** Índice do último. */
    ultimo: number
    total: number
    /** O nome do que está sendo contado, no plural: "peças", "endereços". */
    nome?: string
    /** Um segundo número que vale a pena dizer aqui ("268 peças ao todo"). */
    extra?: ReactNode
    aoVoltar?: () => void
    aoAvancar?: () => void
}

export function RodapeDaLista({
    primeiro,
    ultimo,
    total,
    nome = "registros",
    extra,
    aoVoltar,
    aoAvancar,
}: RodapeDaListaProps) {

    // Some quando não há o que paginar. Um rodapé dizendo "1–3 de 3" com as
    // duas setas apagadas é ruído: ele ocupa uma linha para informar que não
    // há nada a informar.
    if (total === 0) {
        return null
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--linha)] bg-[#FAFAFA] px-3 py-2">

            <p className="text-xs text-[var(--ink-2)]">
                Mostrando <span className="num text-[var(--ink)]">{primeiro}</span>–
                <span className="num text-[var(--ink)]">{ultimo}</span> de{" "}
                <span className="num text-[var(--ink)]">{total}</span> {nome}
                {extra && <span className="text-[var(--ink-3)]"> · {extra}</span>}
            </p>

            {(aoVoltar || aoAvancar) && (
                <div className="flex items-center gap-1">

                    <button
                        type="button"
                        onClick={aoVoltar}
                        disabled={!aoVoltar}
                        aria-label="Página anterior"
                        className="rounded-lg border border-[var(--linha)] bg-[var(--superficie)] p-1.5 text-[var(--ink-2)] transition-colors hover:border-[var(--ink-3)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:border-[var(--linha)] disabled:text-[#C9C9C9] disabled:hover:border-[var(--linha)]"
                    >
                        <FiChevronLeft className="w-4" aria-hidden />
                    </button>

                    <button
                        type="button"
                        onClick={aoAvancar}
                        disabled={!aoAvancar}
                        aria-label="Próxima página"
                        className="rounded-lg border border-[var(--linha)] bg-[var(--superficie)] p-1.5 text-[var(--ink-2)] transition-colors hover:border-[var(--ink-3)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:border-[var(--linha)] disabled:text-[#C9C9C9] disabled:hover:border-[var(--linha)]"
                    >
                        <FiChevronRight className="w-4" aria-hidden />
                    </button>

                </div>
            )}

        </div>
    )
}

/* ==========================================================================
   A lista vazia
   ========================================================================== */

/**
 * O que aparece no lugar das linhas quando não há nenhuma.
 *
 * Fica DENTRO da moldura da lista, e não no lugar dela: as abas e a busca
 * continuam à vista, porque quase sempre o vazio é resultado do filtro
 * escolhido — e a saída é trocar o filtro, que está bem ali em cima.
 */
export function ListaVazia({
    icone: Icone,
    titulo,
    children,
    acao,
}: {
    icone: IconType
    titulo: string
    children?: ReactNode
    acao?: ReactNode
}) {

    return (
        <div className="px-6 py-14 text-center">

            <Icone className="mx-auto w-6 text-[var(--ink-3)]" aria-hidden />

            <p className="mt-3 text-sm font-medium text-[var(--ink)]">{titulo}</p>

            {children && (
                <p className="mx-auto mt-1 max-w-md text-[0.8125rem] text-[var(--ink-2)]">
                    {children}
                </p>
            )}

            {acao && <div className="mt-4 flex justify-center gap-2">{acao}</div>}

        </div>
    )
}

/* ==========================================================================
   A faixa de números do topo
   ========================================================================== */

export interface Numero {
    rotulo: string
    valor: ReactNode
    icone?: IconType
    /** Destaca o número quando ele é um problema a resolver (avarias, atrasos). */
    alerta?: boolean
}

/**
 * A faixa de contagens acima da lista.
 *
 * Existe porque as telas tinham três formatos diferentes para a mesma coisa:
 * quatro cartões com ícone em Estoque, dois retângulos enormes com um "0"
 * gigante em Tarefas, e nada em Contagem. Um "0" de 36 pixels ocupando meia
 * tela é o oposto de informação — ele grita o que não aconteceu.
 *
 * Aqui é uma faixa só, de altura fixa, com os números na fonte mono para
 * alinharem entre si. O que muda entre as telas é quantos números ela tem.
 */
export function FaixaDeNumeros({ numeros }: { numeros: Numero[] }) {

    if (numeros.length === 0) {
        return null
    }

    return (
        <div className="card grid grid-cols-2 divide-x divide-y divide-[var(--linha)] overflow-hidden sm:grid-cols-4 sm:divide-y-0">

            {numeros.map((numero) => (
                <div key={numero.rotulo} className="flex items-center gap-3 px-4 py-3">

                    {numero.icone && (
                        <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                numero.alerta ? "bg-[#FFF0F0] text-[var(--vermelho)]" : "bg-[var(--fundo)] text-[var(--ink-2)]"
                            }`}
                        >
                            <numero.icone className="w-4" aria-hidden />
                        </span>
                    )}

                    <div className="min-w-0">
                        <p className="truncate text-xs text-[var(--ink-2)]">{numero.rotulo}</p>
                        <p className={`num text-lg font-semibold ${numero.alerta ? "text-[var(--vermelho)]" : "text-[var(--ink)]"}`}>
                            {numero.valor}
                        </p>
                    </div>

                </div>
            ))}

        </div>
    )
}
