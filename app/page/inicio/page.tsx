import Link from "next/link"
import { unstable_rethrow } from "next/navigation"
import {
    FiAlertTriangle,
    FiArrowRight,
    FiClock,
    FiCornerUpLeft,
    FiInfo,
    FiMapPin,
    FiMessageSquare,
    FiPackage,
    FiShoppingBag,
    FiShoppingCart,
    FiClipboard,
    FiBarChart2,
    FiDollarSign,
    FiTrendingDown,
    FiTrendingUp,
    FiTruck,
    FiUsers,
} from "react-icons/fi"
import type { IconType } from "react-icons"
import { Pagina, Secao, Estado } from "@/app/components/pagina/pagina"
import Preco from "@/app/components/preco/preco"
import GraficoDeVendas from "@/app/components/painel/vendas"
import { consultarResumo } from "@/app/api/servidor"
import type { PeriodoDoPainel, ResumoDoPainel } from "@/app/type/type"
import { tituloDaAba } from "@/app/marca"

/**
 * A tela de início do lojista.
 *
 * Ela existe porque o painel não tinha porta de entrada: quem fazia login
 * caía na lista de produtos, centenas de linhas que não respondem nenhuma
 * pergunta de dono. E porque o sistema já guardava tudo o que ela mostra — o
 * custo de cada peça vem da entrada de mercadoria e o preço de saída é
 * gravado na baixa — sem nunca ter devolvido isso a quem paga a conta.
 *
 * Montada no servidor, como a lista de produtos e pelo mesmo motivo: é a
 * primeira coisa que se vê ao entrar, e "como foi hoje?" é uma pergunta que
 * não admite um esqueleto piscando antes da resposta.
 *
 * O que ela NÃO faz: meta, projeção e comparação com mês anterior. Nada disso
 * está gravado, e número inventado numa tela de dinheiro é pior do que número
 * nenhum.
 */
export const metadata = {
    title: tituloDaAba("Início"),
}

/** As três telas que descem do início, com o que cada uma responde. */
const PAINEIS: { rota: string; titulo: string; descricao: string; Icone: IconType }[] = [
    {
        rota: "/page/inicio/produtos",
        titulo: "Mercadoria",
        descricao: "O que chegou, o que saiu e o que está parado na prateleira.",
        Icone: FiBarChart2,
    },
    {
        rota: "/page/inicio/equipe",
        titulo: "Equipe em números",
        descricao: "Quem vendeu, quem atendeu e quem fechou tarefa do estoque.",
        Icone: FiUsers,
    },
    {
        rota: "/page/inicio/entregas",
        titulo: "Expedição",
        descricao: "Quantos vieram buscar, quantos foram enviados e o que atrasou.",
        Icone: FiTruck,
    },
]

/** O dinheiro escrito como gente lê. */
function moeda(valor: number): string {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/** Um número do fechamento do dia. */
function Cartao({ Icone, rotulo, valor, detalhe }: {
    Icone: IconType
    rotulo: string
    valor: string
    detalhe: string
}) {
    return (
        <div className="card p-4">
            <p className="flex items-center gap-2 text-[0.6875rem] font-semibold text-[var(--ink-3)]">
                <Icone className="w-3.5" aria-hidden />
                {rotulo}
            </p>

            <p className="num mt-2 text-xl font-bold text-[var(--ink)]">{valor}</p>
            <p className="mt-0.5 text-xs text-[var(--ink-3)]">{detalhe}</p>
        </div>
    )
}

/**
 * Como foi contra o mesmo intervalo de antes.
 *
 * O intervalo é o MESMO dos dois lados — hoje até esta hora contra ontem até
 * a mesma hora, este mês até hoje contra o mês passado até o mesmo dia. É o
 * que torna o número honesto: treze dias contra um mês inteiro faria toda
 * loja parecer em queda até o dia 28.
 *
 * Sem período anterior não escreve nada. "0% sobre um mês sem venda" é uma
 * frase que não diz nada, e a loja que abriu semana passada não precisa ler
 * que caiu 100%.
 */
function Comparacao({ periodo, rotulo }: { periodo: PeriodoDoPainel; rotulo: string }) {

    const antes = periodo.faturamento_anterior

    if (antes <= 0) return null

    const variacao = ((periodo.faturamento - antes) / antes) * 100
    const subiu = variacao >= 0

    const contra = rotulo === "Hoje" ? "ontem até esta hora" : "o mesmo período do mês passado"

    return (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs">
            {subiu ? (
                <FiTrendingUp className="w-3.5 shrink-0 text-[var(--verde)]" aria-hidden />
            ) : (
                <FiTrendingDown className="w-3.5 shrink-0 text-[var(--vermelho)]" aria-hidden />
            )}

            <span className={`num font-semibold ${subiu ? "text-[var(--verde)]" : "text-[var(--vermelho)]"}`}>
                {subiu ? "+" : ""}{Math.round(variacao)}%
            </span>

            <span className="text-[var(--ink-3)]">
                sobre {contra} ({moeda(antes)})
            </span>
        </p>
    )
}

/** Um item da lista do que está esperando alguém. */
interface Pendencia {
    rotulo: string
    quantidade: number
    rota: string
    Icone: IconType

    /** Vermelho é o que trava a venda; o resto é trabalho normal de corredor. */
    urgente?: boolean
}

function Numero({ periodo, rotulo }: { periodo: PeriodoDoPainel; rotulo: string }) {
    return (
        <div className="p-5">

            <p className="text-[0.6875rem] font-semibold text-[var(--ink-3)]">
                {rotulo}
            </p>

            <div className="mt-2">
                <Preco valor={periodo.faturamento} className="text-2xl" />
            </div>

            <Comparacao periodo={periodo} rotulo={rotulo} />

            <dl className="mt-3 space-y-1 text-sm">

                <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[var(--ink-2)]">Unidades</dt>
                    <dd className="num font-semibold text-[var(--ink)]">{periodo.pecas}</dd>
                </div>

                <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[var(--ink-2)]">Custo</dt>
                    <dd className="num font-semibold text-[var(--ink)]">
                        {periodo.custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </dd>
                </div>

                <div className="flex items-baseline justify-between gap-3 border-t border-[var(--linha-suave)] pt-1">
                    <dt className="font-semibold text-[var(--ink)]">Margem</dt>
                    <dd className={`num font-semibold ${periodo.margem >= 0 ? "text-[var(--verde)]" : "text-[var(--vermelho)]"}`}>
                        {periodo.margem.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </dd>
                </div>

            </dl>

        </div>
    )
}

export default async function Inicio() {

    let resumo: ResumoDoPainel | null = null

    try {
        resumo = await consultarResumo()
    } catch (erro) {
        // `redirect()` do Next funciona LANÇANDO um erro interno: sem isto, o
        // catch prenderia o desvio para o login e a tela tentaria desenhar
        // sem sessão.
        unstable_rethrow(erro)
    }

    if (!resumo) {
        return (
            <Pagina titulo="Início">
                <Estado
                    Icone={FiAlertTriangle}
                    tom="erro"
                    titulo="Não foi possível montar o resumo"
                    texto="Os números vêm do servidor e ele não respondeu agora. O resto do painel continua funcionando — recarregue esta tela em instantes."
                    acao={
                        <Link href="/page/produtos" className="btn btn-neutro">
                            Ir para Produtos
                        </Link>
                    }
                />
            </Pagina>
        )
    }

    const { dia, mes, caixa, atencao, mais_saem: maisSaem, equipe } = resumo

    const pendencias: Pendencia[] = [
        {
            // A primeira da lista porque é a única que é DÍVIDA: a loja
            // aceitou devolver e o dinheiro não saiu. Do outro lado há uma
            // pessoa com nome e endereço esperando um valor prometido.
            rotulo: atencao.valor_a_pagar > 0
                ? `Devoluções aceitas e não pagas — ${moeda(atencao.valor_a_pagar)}`
                : "Devoluções aceitas e não pagas",
            quantidade: atencao.devolucoes_a_pagar,
            rota: "/page/estoque/devolucoes",
            Icone: FiDollarSign,
            urgente: true,
        },
        {
            // Cliente esperando é venda indo embora, e era a pendência mais
            // escondida do painel: só aparecia no sino da barra de cima.
            rotulo: "Clientes esperando resposta",
            quantidade: atencao.clientes_esperando,
            rota: "/page/conversas",
            Icone: FiMessageSquare,
            urgente: true,
        },
        {
            // Separado de "em andamento": aquele junta o pedido de cinco
            // minutos atrás com o que venceu há três dias.
            rotulo: "Pedidos que passaram do prazo",
            quantidade: atencao.pedidos_atrasados,
            rota: "/page/entregas",
            Icone: FiTruck,
            urgente: true,
        },
        {
            rotulo: "Pedidos esperando pagamento",
            quantidade: atencao.pedidos_aguardando_pagamento,
            rota: "/page/pedidos?status=aguardando",
            Icone: FiClock,
        },
        {
            rotulo: "Pedidos em andamento",
            quantidade: atencao.pedidos_em_andamento,
            rota: "/page/pedidos",
            Icone: FiShoppingCart,
        },
        {
            // A mais séria da lista: a peça existe no sistema e ninguém a
            // encontra no corredor. Toda venda dela vira uma procura.
            rotulo: "Unidades sem endereço",
            quantidade: atencao.pecas_sem_endereco,
            rota: "/page/estoque",
            Icone: FiMapPin,
            urgente: true,
        },
        {
            rotulo: "Unidades avariadas",
            quantidade: atencao.pecas_avariadas,
            rota: "/page/avarias",
            Icone: FiAlertTriangle,
        },
        {
            rotulo: "Tarefas de estoque abertas",
            quantidade: atencao.tarefas_abertas,
            rota: "/page/estoque/fila",
            Icone: FiClipboard,
        },
        {
            rotulo: "Devoluções sem tratativa",
            quantidade: atencao.devolucoes_abertas,
            rota: "/page/estoque/devolucoes",
            Icone: FiCornerUpLeft,
        },
    ]

    const pendentes = pendencias.filter((p) => p.quantidade > 0)

    // A barra de cada produto é proporcional ao primeiro da lista, e não ao
    // total: o que se quer enxergar aqui é a distância entre o primeiro e o
    // quinto, e contra o total todas as barras ficariam curtas e iguais.
    const maiorVenda = maisSaem.reduce((maior, item) => Math.max(maior, item.pecas), 0)

    return (
        <Pagina
            titulo="Início"
            descricao="O que a sua loja fez hoje e neste mês, somado do que já está no sistema — o preço por que cada unidade saiu e o custo com que ela entrou."
        >

            {/* ==========================
                O DINHEIRO
            ========================== */}

            <div className="card grid grid-cols-1 divide-[var(--linha-suave)] sm:grid-cols-2 sm:divide-x">
                <Numero periodo={dia} rotulo="Hoje" />
                <Numero periodo={mes} rotulo="Este mês" />
            </div>

            {!mes.custo_conhecido && mes.pecas > 0 && (
                <p className="flex items-start gap-2.5 rounded-lg border-l-2 border-[var(--amarelo-forte)] bg-[var(--amarelo-fundo)] px-4 py-3 text-sm text-[var(--amarelo)]">
                    <FiInfo className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>
                        Parte das unidades vendidas neste mês saiu sem custo gravado, então a
                        margem acima está maior do que a real. O custo entra em{" "}
                        <Link href="/page/estoque/inserir" className="font-semibold text-[var(--azul)] hover:underline">
                            Entrada de mercadoria
                        </Link>
                        , e vale para as unidades que entrarem daqui em diante.
                    </span>
                </p>
            )}

            {/* ==========================
                OS PAINÉIS POR ASSUNTO

                Três portas, logo abaixo do dinheiro: esta tela responde "como
                foi", e cada uma delas responde um "por quê" que não cabe aqui
                sem virar rolagem infinita. Ficam à vista porque menu lateral
                não é lugar de descobrir tela nova — é lugar de voltar a ela.
            ========================== */}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PAINEIS.map((painel) => (
                    <Link
                        key={painel.rota}
                        href={painel.rota}
                        className="card flex items-start gap-3 p-4 transition-colors hover:border-[var(--ink-4)]"
                    >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--azul-suave)] text-[var(--azul-escuro)]">
                            <painel.Icone className="w-4" aria-hidden />
                        </span>

                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[var(--ink)]">
                                {painel.titulo}
                            </span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-2)]">
                                {painel.descricao}
                            </span>
                        </span>

                        <FiArrowRight className="ml-auto mt-1 w-4 shrink-0 text-[var(--ink-3)]" aria-hidden />
                    </Link>
                ))}
            </div>

            {/* ==========================
                O FECHAMENTO DO DIA

                Duas perguntas diferentes, lado a lado de propósito: o que
                SAIU (mercadoria) e o que ENTROU (dinheiro). Elas não batem, e
                não deviam: a unidade sai num dia e o pagamento entra noutro. É
                exatamente essa diferença que o lojista precisa enxergar ao
                fechar o caixa.
            ========================== */}

            <Secao
                titulo="Fechamento de hoje"
                descricao="Por onde a mercadoria saiu, e quanto dinheiro entrou. São contas diferentes: a unidade pode sair num dia e o pagamento cair no outro."
            >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                    <Cartao
                        Icone={FiShoppingBag}
                        rotulo="Saiu no balcão"
                        valor={moeda(caixa.balcao.faturamento)}
                        detalhe={`${caixa.balcao.pecas} unidade(s)`}
                    />

                    <Cartao
                        Icone={FiPackage}
                        rotulo="Saiu por pedido"
                        valor={moeda(caixa.pedidos.faturamento)}
                        detalhe={`${caixa.pedidos.pecas} unidade(s)`}
                    />

                    <Cartao
                        Icone={FiShoppingCart}
                        rotulo="Pagamentos confirmados"
                        valor={moeda(caixa.valor_recebido)}
                        detalhe={`${caixa.pedidos_pagos} pedido(s)`}
                    />

                    <Cartao
                        Icone={FiClock}
                        rotulo="Ticket médio do dia"
                        valor={moeda(caixa.ticket_medio_do_dia)}
                        detalhe={caixa.pedidos_pagos > 0 ? "por pedido pago hoje" : "nenhum pedido pago hoje"}
                    />

                </div>

                {/* O balcão aberto por forma de pagamento.
                
                    É a linha que faltava para o dia fechar: o total do balcão
                    sozinho não se confere com nada, e esta quebra é o que se
                    compara com a gaveta contada e com o extrato da maquininha.
                
                    Fica como uma faixa embaixo dos cartões, e não como quatro
                    cartões a mais: são pedaços de um número que já está na
                    tela, e cartão de tamanho igual ao "Saiu no balcão" faria
                    a parte parecer do mesmo peso que o todo.
                
                    Some quando não houve venda no balcão hoje — uma faixa de
                    zeros é linha para ler sem nada a dizer. */}
                {(caixa.balcao_por_meio ?? []).length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--linha-suave)] pt-3">

                        <span className="text-[0.6875rem] font-semibold text-[var(--ink-3)]">
                            Balcão por pagamento
                        </span>

                        {(caixa.balcao_por_meio ?? []).map((meio) => (
                            <span key={meio.chave} className="flex items-baseline gap-1.5 text-sm">
                                <span className="text-[var(--ink-2)]">{meio.nome}</span>

                                <span className="num font-semibold text-[var(--ink)]">
                                    {moeda(meio.faturamento)}
                                </span>

                                <span className="num text-xs text-[var(--ink-3)]">
                                    ({meio.pecas})
                                </span>
                            </span>
                        ))}
                    </div>
                )}
            </Secao>

            {/* ==========================
                O QUE ESPERA ALGUÉM
            ========================== */}

            <Secao
                titulo="Precisa de você"
                descricao={pendentes.length === 0 ? undefined : "Cada linha abre a tela onde se resolve."}
                plano
            >
                {pendentes.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-[var(--ink-2)]">
                        Nada parado: nenhum pedido esperando, nenhuma unidade sem endereço e
                        nenhuma tarefa aberta.
                    </p>
                ) : (
                    <ul className="divide-y divide-[var(--linha-suave)]">
                        {pendentes.map(({ rotulo, quantidade, rota, Icone, urgente }) => (
                            <li key={rotulo}>
                                <Link
                                    href={rota}
                                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--superficie-2)]"
                                >
                                    <span
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                            urgente ? "bg-[var(--vermelho-fundo)] text-[var(--vermelho)]" : "bg-[var(--superficie-2)] text-[var(--ink-2)]"
                                        }`}
                                    >
                                        <Icone className="w-4" aria-hidden />
                                    </span>

                                    <span className="flex-1 text-sm font-medium text-[var(--ink)]">
                                        {rotulo}
                                    </span>

                                    <span className={`num text-sm font-semibold ${urgente ? "text-[var(--vermelho)]" : "text-[var(--ink)]"}`}>
                                        {quantidade}
                                    </span>

                                    <FiArrowRight className="w-4 shrink-0 text-[var(--ink-4)]" aria-hidden />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </Secao>

            {/* ==========================
                A CURVA

                O fechamento acima responde "como foi hoje". Esta parte
                responde a pergunta que vem logo em seguida e que nenhum
                número sozinho responde: está melhor ou pior? É o único
                pedaço da tela que roda no navegador — trocar de régua muda
                os dados, e carregar as três de uma vez seria pedir três
                consultas das quais duas ninguém olha.
            ========================== */}

            <GraficoDeVendas />

            {/* ==========================
                O QUE GIRA
            ========================== */}

            <Secao
                titulo="O que mais sai neste mês"
                descricao="Pelas unidades que deixaram a loja, no balcão e pelo site."
                acoes={
                    <Link href="/page/vendidos" className="btn btn-neutro">
                        Ver tudo
                    </Link>
                }
                plano
            >
                {maisSaem.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-[var(--ink-2)]">
                        Nenhuma unidade saiu neste mês ainda.
                    </p>
                ) : (
                    <ul className="divide-y divide-[var(--linha-suave)]">
                        {maisSaem.map((item) => (
                            <li key={item.produto_id} className="px-5 py-3">

                                <div className="flex items-baseline justify-between gap-4">
                                    <p className="min-w-0 truncate text-sm font-medium text-[var(--ink)]">
                                        {item.nome}
                                    </p>

                                    <p className="num shrink-0 text-sm text-[var(--ink-2)]">
                                        <span className="font-semibold text-[var(--ink)]">{item.pecas}</span>
                                        {" unidade(s) · "}
                                        {item.faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </p>
                                </div>

                                {/* A barra existe para comparar as cinco linhas de
                                    relance. Sem rótulo próprio: o número já está
                                    escrito ao lado, e repeti-lo dentro da barra só
                                    encheria a linha. */}
                                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--linha-suave)]" aria-hidden>
                                    <div
                                        className="h-full rounded-full bg-[var(--azul)]"
                                        style={{ width: `${maiorVenda > 0 ? (item.pecas / maiorVenda) * 100 : 0}%` }}
                                    />
                                </div>

                            </li>
                        ))}
                    </ul>
                )}
            </Secao>

            {/* ==========================
                A EQUIPE

                Só o dono recebe esta lista do servidor (ver painel.Resumo):
                o número de cada um na tela de todo mundo é constrangimento,
                e um funcionário não precisa saber quanto o colega vendeu
                para fazer o trabalho dele.
            ========================== */}
            {equipe && equipe.length > 0 && (
                <Secao
                    titulo="Sua equipe neste mês"
                    descricao="Quem vendeu o quê, quem está atendendo quem, e quantos clientes estão na mão de cada um agora."
                    acoes={
                        <Link href="/page/funcionarios" className="btn btn-neutro">
                            Gerenciar equipe
                        </Link>
                    }
                    plano
                >
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[46rem] text-sm">

                            <thead>
                                <tr className="border-b border-[var(--linha)] text-left text-xs uppercase tracking-[0.06em] text-[var(--ink-3)]">
                                    <th className="px-5 py-2.5 font-semibold">Pessoa</th>
                                    <th className="px-3 py-2.5 text-right font-semibold">Vendeu hoje</th>
                                    <th className="px-3 py-2.5 text-right font-semibold">Vendeu no mês</th>
                                    <th className="px-3 py-2.5 text-right font-semibold">Unidades</th>
                                    <th className="px-3 py-2.5 text-right font-semibold">Pedidos</th>
                                    <th className="px-3 py-2.5 text-right font-semibold">Atendimentos</th>
                                    <th className="px-5 py-2.5 text-right font-semibold">Clientes</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-[var(--linha-suave)]">
                                {equipe.map((pessoa) => (
                                    <tr key={`${pessoa.id}-${pessoa.nome}`}>

                                        <td className="px-5 py-3">
                                            <span className="flex items-center gap-2 font-medium text-[var(--ink)]">
                                                <FiUsers className="w-3.5 shrink-0 text-[var(--ink-3)]" aria-hidden />
                                                {pessoa.nome}
                                            </span>
                                        </td>

                                        <td className="num px-3 py-3 text-right text-[var(--ink-2)]">
                                            {pessoa.faturamento_hoje > 0 ? moeda(pessoa.faturamento_hoje) : "—"}
                                        </td>

                                        <td className="num px-3 py-3 text-right font-semibold text-[var(--ink)]">
                                            {pessoa.faturamento_no_mes > 0 ? moeda(pessoa.faturamento_no_mes) : "—"}
                                        </td>

                                        <td className="num px-3 py-3 text-right text-[var(--ink-2)]">
                                            {pessoa.pecas_no_mes || "—"}
                                        </td>

                                        <td className="num px-3 py-3 text-right text-[var(--ink-2)]">
                                            {pessoa.pedidos || "—"}
                                        </td>

                                        <td className="num px-3 py-3 text-right text-[var(--ink-2)]">
                                            {pessoa.conversas > 0 ? (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <FiMessageSquare className="w-3.5 text-[var(--ink-3)]" aria-hidden />
                                                    {pessoa.conversas}
                                                    <span className="text-xs text-[var(--ink-3)]">
                                                        ({pessoa.mensagens} msg)
                                                    </span>
                                                </span>
                                            ) : "—"}
                                        </td>

                                        <td className="num px-5 py-3 text-right text-[var(--ink-2)]">
                                            {pessoa.clientes_ativos || "—"}
                                        </td>

                                    </tr>
                                ))}
                            </tbody>

                        </table>
                    </div>

                    <p className="px-5 py-3 text-xs text-[var(--ink-3)]">
                        O nome fica gravado na venda e na mensagem no instante em que
                        acontecem. Quem sai da loja continua aparecendo no mês em que
                        trabalhou.
                    </p>
                </Secao>
            )}

            <p className="flex items-start gap-2 text-xs text-[var(--ink-3)]">
                <FiPackage className="mt-0.5 w-3.5 shrink-0" aria-hidden />
                <span>
                    Unidade devolvida sai destas contas: ela foi vendida e voltou, e mantê-la
                    no faturamento contaria uma venda que se desfez.
                </span>
            </p>

        </Pagina>
    )
}
