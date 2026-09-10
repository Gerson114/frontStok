import Link from "next/link"
import { FiChevronLeft } from "react-icons/fi"
import type { IconType } from "react-icons"
import type { ReactNode } from "react"

/**
 * A anatomia de uma tela do painel.
 *
 * Antes disto cada tela montava a própria moldura à mão, e elas foram
 * divergindo: umas tinham cabeçalho grudado no topo e outras não, a largura
 * do conteúdo ia de 3xl a 7xl sem critério, o respiro era `p-6` numa e `p-8`
 * na vizinha — e seis telas (assinatura, loja, pagamento, venda e os estados
 * de carregamento das conversas) tinham esquecido de descontar a barra
 * lateral, de modo que em tela de 1024 a 1440px o conteúdo delas passava por
 * baixo do menu.
 *
 * A regra que vale agora: nenhuma tela do painel desenha o próprio <main>.
 * Ela declara o que tem a dizer — título, descrição, de onde se voltou, o que
 * dá para fazer aqui — e a moldura vem pronta e igual à das outras.
 *
 * A anatomia é a do painel do Shopify: cabeçalho de tela com o título à
 * esquerda e as ações à direita, grudado logo abaixo da barra superior, e o
 * conteúdo abaixo dele, ocupando a área inteira de trabalho.
 */

/*
 * A coluna de conteúdo ocupa a largura inteira da área de trabalho.
 *
 * Ela já teve quatro larguras declaradas por tela (estreita para formulário,
 * larga para grade de dados). Saíram: numa tela grande, o que aparecia era
 * uma faixa de conteúdo no meio e dois vazios cinza do lado, e as telas que
 * mais precisam de espaço — separação, agenda, clientes, editor — eram
 * justamente as que ficavam apertadas para caber na régua.
 *
 * O que delimita o conteúdo agora é a moldura da própria área: a barra
 * lateral fecha à esquerda com a borda dela, e o conteúdo fecha à direita com
 * a sua. O respiro continua vindo do padding, que é o que impede o texto de
 * encostar na borda.
 */

interface PaginaProps {
    titulo: string
    /** Uma linha dizendo para que serve a tela. Some quando não há o que dizer. */
    descricao?: ReactNode
    /** A tela de onde esta nasceu, quando ela é filha de outra. */
    volta?: { nome: string; rota: string }
    /** O que dá para fazer aqui, à direita do título. */
    acoes?: ReactNode
    /**
     * Telas que existem para sair na impressora (etiqueta de peça, placa de
     * prateleira). No papel some tudo o que é moldura de painel.
     */
    paraImpressao?: boolean
    children: ReactNode
}

export function Pagina({
    titulo,
    descricao,
    volta,
    acoes,
    paraImpressao = false,
    children,
}: PaginaProps) {

    return (
        <main
            className={`min-h-[calc(100dvh-3.5rem)] bg-[#F1F1F1] text-[#303030] md:ml-64 md:border-r md:border-[#E1E1E1] ${
                paraImpressao ? "print:m-0 print:min-h-0 print:border-0 print:bg-white" : ""
            }`}
        >

            {/* Cabeçalho da tela. Gruda logo abaixo da barra superior escura
                (3.5rem) para que o título e as ações continuem à mão enquanto
                se rola uma lista longa. */}
            <header className="sticky top-14 z-30 border-b border-[#E1E1E1] bg-[#F1F1F1]/95 backdrop-blur print:hidden">

                {/* O mesmo respiro do conteúdo abaixo: é o que faz o título
                    nascer exatamente na mesma vertical da borda esquerda do
                    primeiro cartão. */}
                <div className="px-6 md:px-10">

                    <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">

                        <div className="min-w-0 flex-1">

                            {volta && (
                                <Link
                                    href={volta.rota}
                                    className="-ml-1 mb-0.5 inline-flex items-center gap-1 text-xs font-medium text-[#616161] transition-colors hover:text-[#005BD3]"
                                >
                                    <FiChevronLeft className="w-3.5" aria-hidden />
                                    {volta.nome}
                                </Link>
                            )}

                            <h1 className="font-display truncate text-2xl text-[#303030]">
                                {titulo}
                            </h1>

                            {descricao && (
                                <p className="mt-0.5 max-w-3xl text-sm text-[#616161]">
                                    {descricao}
                                </p>
                            )}

                        </div>

                        {acoes && (
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                {acoes}
                            </div>
                        )}

                    </div>

                </div>

            </header>

            <div className={paraImpressao ? "px-6 py-6 md:px-10 md:py-8 print:p-0" : "px-6 py-6 md:px-10 md:py-8"}>
                <div className="space-y-6">
                    {children}
                </div>
            </div>

        </main>
    )
}

/**
 * A moldura das telas de volta do processador de cobrança.
 *
 * "Pagamento confirmado" e "pagamento não concluído" não são telas de
 * trabalho: são um cartão só, e um cabeçalho de tela com título e ações em
 * cima delas seria moldura para nada. Mas elas moram dentro de /page/, então
 * o menu está desenhado ao lado — e por isso precisam descontar a barra
 * lateral igual às outras, que era justamente o que faltava nelas.
 */
export function PaginaCentrada({ children }: { children: ReactNode }) {
    return (
        <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[#F1F1F1] px-4 py-16 text-[#303030] md:ml-64">
            <div className="w-full max-w-md">
                {children}
            </div>
        </main>
    )
}

interface SecaoProps {
    /** Sem título a seção é só um cartão — e é assim que ela nasce. */
    titulo?: string
    descricao?: ReactNode
    /** Ações do canto superior direito do cartão. */
    acoes?: ReactNode
    /**
     * Corpo sem respiro interno, para o que precisa encostar na borda do
     * cartão: tabela, lista de linhas divididas por fio.
     */
    plano?: boolean
    className?: string
    children: ReactNode
}

/**
 * Um bloco de assunto dentro da tela.
 *
 * É o cartão branco do painel do Shopify: uma pergunta por cartão, o título
 * dizendo qual é, e o corpo respondendo. Duas perguntas diferentes no mesmo
 * cartão é o que faz uma tela de configuração virar um paredão.
 */
export function Secao({ titulo, descricao, acoes, plano = false, className = "", children }: SecaoProps) {
    return (
        <section className={`card ${className}`}>

            {(titulo || acoes) && (
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-[#EBEBEB] px-5 py-3.5">

                    <div className="min-w-0">
                        {titulo && (
                            <h2 className="font-display text-base text-[#303030]">
                                {titulo}
                            </h2>
                        )}

                        {descricao && (
                            <p className="mt-0.5 text-sm text-[#616161]">
                                {descricao}
                            </p>
                        )}
                    </div>

                    {acoes && (
                        <div className="flex flex-wrap items-center gap-2">
                            {acoes}
                        </div>
                    )}

                </div>
            )}

            <div className={plano ? "" : "p-5"}>
                {children}
            </div>

        </section>
    )
}

interface EstadoProps {
    Icone: IconType
    titulo: string
    texto?: ReactNode
    /** O caminho de saída: um botão que resolve, ou leva a quem resolve. */
    acao?: ReactNode
    /** `erro` pinta o ícone de vermelho; `neutro` é a lista que ainda está vazia. */
    tom?: "neutro" | "erro"
}

/**
 * A tela que não tem o que mostrar — porque deu errado, ou porque ainda não
 * há nada ali.
 *
 * Cada tela desenhava a sua, e por isso a lista vazia de Pedidos não se
 * parecia com a de Avarias. Um estado vazio sem caminho de saída é uma porta
 * fechada: por isso `acao` existe e deve ser preenchida sempre que houver o
 * que fazer a respeito.
 */
export function Estado({ Icone, titulo, texto, acao, tom = "neutro" }: EstadoProps) {
    return (
        <div className="card flex flex-col items-center px-6 py-12 text-center">

            <span
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    tom === "erro" ? "bg-[#FEE9E8] text-[#8E1F0B]" : "bg-[#F7F7F7] text-[#8A8A8A]"
                }`}
            >
                <Icone className="w-5" aria-hidden />
            </span>

            <h2 className="font-display mt-4 text-base text-[#303030]">
                {titulo}
            </h2>

            {texto && (
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#616161]">
                    {texto}
                </p>
            )}

            {acao && <div className="mt-5 flex flex-wrap justify-center gap-2">{acao}</div>}

        </div>
    )
}
