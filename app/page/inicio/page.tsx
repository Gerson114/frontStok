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
    FiUsers,
} from "react-icons/fi"
import type { IconType } from "react-icons"
import { Pagina, Secao, Estado } from "@/app/components/pagina/pagina"
import Preco from "@/app/components/preco/preco"
import GraficoDeVendas from "@/app/components/painel/vendas"
import { consultarResumo } from "@/app/api/servidor"
import type { PeriodoDoPainel, ResumoDoPainel } from "@/app/type/type"

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
    title: "Início | Arara",
}

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
            <p className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                <Icone className="w-3.5" aria-hidden />
                {rotulo}
            </p>

            <p className="num mt-2 text-xl font-bold text-[#303030]">{valor}</p>
            <p className="mt-0.5 text-xs text-[#8A8A8A]">{detalhe}</p>
        </div>
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

            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                {rotulo}
            </p>

            <div className="mt-2">
                <Preco valor={periodo.faturamento} className="text-2xl" />
            </div>

            <dl className="mt-3 space-y-1 text-sm">

                <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[#616161]">Peças</dt>
                    <dd className="num font-semibold text-[#303030]">{periodo.pecas}</dd>
                </div>

                <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[#616161]">Custo</dt>
                    <dd className="num font-semibold text-[#303030]">
                        {periodo.custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </dd>
                </div>

                <div className="flex items-baseline justify-between gap-3 border-t border-[#EBEBEB] pt-1">
                    <dt className="font-semibold text-[#303030]">Margem</dt>
                    <dd className={`num font-semibold ${periodo.margem >= 0 ? "text-[#0C5132]" : "text-[#8E1F0B]"}`}>
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
            rotulo: "Peças sem endereço",
            quantidade: atencao.pecas_sem_endereco,
            rota: "/page/estoque",
            Icone: FiMapPin,
            urgente: true,
        },
        {
            rotulo: "Peças avariadas",
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
            descricao="O que a sua loja fez hoje e neste mês, somado do que já está no sistema — o preço por que cada peça saiu e o custo com que ela entrou."
        >

            {/* ==========================
                O DINHEIRO
            ========================== */}

            <div className="card grid grid-cols-1 divide-[#EBEBEB] sm:grid-cols-2 sm:divide-x">
                <Numero periodo={dia} rotulo="Hoje" />
                <Numero periodo={mes} rotulo="Este mês" />
            </div>

            {!mes.custo_conhecido && mes.pecas > 0 && (
                <p className="flex items-start gap-2.5 rounded-lg border-l-2 border-[#C7920A] bg-[#FFF1E3] px-4 py-3 text-sm text-[#5E4200]">
                    <FiInfo className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>
                        Parte das peças vendidas neste mês saiu sem custo gravado, então a
                        margem acima está maior do que a real. O custo entra em{" "}
                        <Link href="/page/estoque/inserir" className="font-semibold text-[#005BD3] hover:underline">
                            Entrada de mercadoria
                        </Link>
                        , e vale para as peças que entrarem daqui em diante.
                    </span>
                </p>
            )}

            {/* ==========================
                O FECHAMENTO DO DIA

                Duas perguntas diferentes, lado a lado de propósito: o que
                SAIU (mercadoria) e o que ENTROU (dinheiro). Elas não batem, e
                não deviam: a peça sai num dia e o pagamento entra noutro. É
                exatamente essa diferença que o lojista precisa enxergar ao
                fechar o caixa.
            ========================== */}

            <Secao
                titulo="Fechamento de hoje"
                descricao="Por onde a mercadoria saiu, e quanto dinheiro entrou. São contas diferentes: a peça pode sair num dia e o pagamento cair no outro."
            >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                    <Cartao
                        Icone={FiShoppingBag}
                        rotulo="Saiu no balcão"
                        valor={moeda(caixa.balcao.faturamento)}
                        detalhe={`${caixa.balcao.pecas} peça(s)`}
                    />

                    <Cartao
                        Icone={FiPackage}
                        rotulo="Saiu por pedido"
                        valor={moeda(caixa.pedidos.faturamento)}
                        detalhe={`${caixa.pedidos.pecas} peça(s)`}
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
                    <p className="px-5 py-6 text-sm text-[#616161]">
                        Nada parado: nenhum pedido esperando, nenhuma peça sem endereço e
                        nenhuma tarefa aberta.
                    </p>
                ) : (
                    <ul className="divide-y divide-[#EBEBEB]">
                        {pendentes.map(({ rotulo, quantidade, rota, Icone, urgente }) => (
                            <li key={rotulo}>
                                <Link
                                    href={rota}
                                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#F7F7F7]"
                                >
                                    <span
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                            urgente ? "bg-[#FEE9E8] text-[#8E1F0B]" : "bg-[#F7F7F7] text-[#616161]"
                                        }`}
                                    >
                                        <Icone className="w-4" aria-hidden />
                                    </span>

                                    <span className="flex-1 text-sm font-medium text-[#303030]">
                                        {rotulo}
                                    </span>

                                    <span className={`num text-sm font-semibold ${urgente ? "text-[#8E1F0B]" : "text-[#303030]"}`}>
                                        {quantidade}
                                    </span>

                                    <FiArrowRight className="w-4 shrink-0 text-[#B5B5B5]" aria-hidden />
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
                descricao="Pelas peças que deixaram a loja, no balcão e pelo site."
                acoes={
                    <Link href="/page/vendidos" className="btn btn-neutro">
                        Ver tudo
                    </Link>
                }
                plano
            >
                {maisSaem.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-[#616161]">
                        Nenhuma peça saiu neste mês ainda.
                    </p>
                ) : (
                    <ul className="divide-y divide-[#EBEBEB]">
                        {maisSaem.map((item) => (
                            <li key={item.produto_id} className="px-5 py-3">

                                <div className="flex items-baseline justify-between gap-4">
                                    <p className="min-w-0 truncate text-sm font-medium text-[#303030]">
                                        {item.nome}
                                    </p>

                                    <p className="num shrink-0 text-sm text-[#616161]">
                                        <span className="font-semibold text-[#303030]">{item.pecas}</span>
                                        {" peça(s) · "}
                                        {item.faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </p>
                                </div>

                                {/* A barra existe para comparar as cinco linhas de
                                    relance. Sem rótulo próprio: o número já está
                                    escrito ao lado, e repeti-lo dentro da barra só
                                    encheria a linha. */}
                                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EBEBEB]" aria-hidden>
                                    <div
                                        className="h-full rounded-full bg-[#005BD3]"
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
                                <tr className="border-b border-[#E1E1E1] text-left text-xs uppercase tracking-[0.06em] text-[#8A8A8A]">
                                    <th className="px-5 py-2.5 font-semibold">Pessoa</th>
                                    <th className="px-3 py-2.5 text-right font-semibold">Vendeu hoje</th>
                                    <th className="px-3 py-2.5 text-right font-semibold">Vendeu no mês</th>
                                    <th className="px-3 py-2.5 text-right font-semibold">Peças</th>
                                    <th className="px-3 py-2.5 text-right font-semibold">Pedidos</th>
                                    <th className="px-3 py-2.5 text-right font-semibold">Atendimentos</th>
                                    <th className="px-5 py-2.5 text-right font-semibold">Clientes</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-[#EBEBEB]">
                                {equipe.map((pessoa) => (
                                    <tr key={`${pessoa.id}-${pessoa.nome}`}>

                                        <td className="px-5 py-3">
                                            <span className="flex items-center gap-2 font-medium text-[#303030]">
                                                <FiUsers className="w-3.5 shrink-0 text-[#8A8A8A]" aria-hidden />
                                                {pessoa.nome}
                                            </span>
                                        </td>

                                        <td className="num px-3 py-3 text-right text-[#616161]">
                                            {pessoa.faturamento_hoje > 0 ? moeda(pessoa.faturamento_hoje) : "—"}
                                        </td>

                                        <td className="num px-3 py-3 text-right font-semibold text-[#303030]">
                                            {pessoa.faturamento_no_mes > 0 ? moeda(pessoa.faturamento_no_mes) : "—"}
                                        </td>

                                        <td className="num px-3 py-3 text-right text-[#616161]">
                                            {pessoa.pecas_no_mes || "—"}
                                        </td>

                                        <td className="num px-3 py-3 text-right text-[#616161]">
                                            {pessoa.pedidos || "—"}
                                        </td>

                                        <td className="num px-3 py-3 text-right text-[#616161]">
                                            {pessoa.conversas > 0 ? (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <FiMessageSquare className="w-3.5 text-[#8A8A8A]" aria-hidden />
                                                    {pessoa.conversas}
                                                    <span className="text-xs text-[#8A8A8A]">
                                                        ({pessoa.mensagens} msg)
                                                    </span>
                                                </span>
                                            ) : "—"}
                                        </td>

                                        <td className="num px-5 py-3 text-right text-[#616161]">
                                            {pessoa.clientes_ativos || "—"}
                                        </td>

                                    </tr>
                                ))}
                            </tbody>

                        </table>
                    </div>

                    <p className="px-5 py-3 text-xs text-[#8A8A8A]">
                        O nome fica gravado na venda e na mensagem no instante em que
                        acontecem. Quem sai da loja continua aparecendo no mês em que
                        trabalhou.
                    </p>
                </Secao>
            )}

            <p className="flex items-start gap-2 text-xs text-[#8A8A8A]">
                <FiPackage className="mt-0.5 w-3.5 shrink-0" aria-hidden />
                <span>
                    Peça devolvida sai destas contas: ela foi vendida e voltou, e mantê-la
                    no faturamento contaria uma venda que se desfez.
                </span>
            </p>

        </Pagina>
    )
}
