"use client"

import { useEffect, useState } from "react"
import {
    FiAlertCircle,
    FiCheckSquare,
    FiDollarSign,
    FiMessageCircle,
    FiPackage,
    FiShoppingCart,
    FiUserCheck,
    FiUsers,
} from "react-icons/fi"
import { Pagina, Secao } from "@/app/components/pagina/pagina"
import { BarrasPorPessoa } from "@/app/components/grafico/grafico"
import {
    Cartao,
    REGUAS,
    SeletorDeRegua,
    inteiro,
    moeda,
} from "@/app/components/painel/moldura"
import { consultarPainelDaEquipe } from "@/middleware/painel"
import type { GranularidadeDeVendas, PainelDaEquipe } from "@/app/type/type"

/**
 * O painel da equipe: quem fez o quê.
 *
 * A tela de Funcionários responde "quem pode abrir o quê" — é cadastro e
 * permissão. Esta responde a pergunta do fim do mês: quem vendeu, quem
 * atendeu, quem tirou trabalho da fila.
 *
 * O que ela NÃO faz, de propósito: pódio, meta e comparação com o mês
 * passado. O sistema não conhece a meta de ninguém, e a pessoa do balcão da
 * tarde vende menos que a da manhã por motivo que o banco não sabe — inventar
 * uma régua aqui é o jeito mais rápido de um painel virar injustiça.
 *
 * Por isso a lista é ordenável pelo que o dono quiser olhar, e não fixada num
 * "ranking de vendas": cada coluna é um trabalho diferente, e quem vende
 * pouco pode ser justamente quem fecha a fila do estoque.
 */

const SERIE_PECAS = [{ rotulo: "Unidades vendidas", cor: "var(--serie-1)" }]

type Coluna = "pecas_vendidas" | "faturamento" | "pedidos_assumidos" | "conversas_atendidas" | "tarefas_concluidas"

const COLUNAS: { chave: Coluna; rotulo: string; curto: string }[] = [
    { chave: "pecas_vendidas", rotulo: "Unidades vendidas", curto: "Unidades" },
    { chave: "faturamento", rotulo: "Faturamento", curto: "Faturamento" },
    { chave: "pedidos_assumidos", rotulo: "Pedidos assumidos", curto: "Pedidos" },
    { chave: "conversas_atendidas", rotulo: "Conversas do site", curto: "Conversas" },
    { chave: "tarefas_concluidas", rotulo: "Tarefas do estoque", curto: "Tarefas" },
]

export default function PainelDaEquipeTela() {

    const [regua, setRegua] = useState<GranularidadeDeVendas>("mes")
    const [dados, setDados] = useState<PainelDaEquipe | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    // Por qual coluna a lista está ordenada. Começa pelas peças porque é a
    // pergunta mais comum — e muda no clique do cabeçalho, porque ela não é a
    // única.
    const [ordem, setOrdem] = useState<Coluna>("pecas_vendidas")

    useEffect(() => {

        let valeu = true

        consultarPainelDaEquipe(regua)
            .then((resposta) => {
                if (valeu) setDados(resposta)
            })
            .catch((e: unknown) => {
                if (valeu) setErro(e instanceof Error ? e.message : "Não foi possível carregar o painel.")
            })
            .finally(() => {
                if (valeu) setCarregando(false)
            })

        return () => {
            valeu = false
        }
    }, [regua])

    const escolhida = REGUAS.find((item) => item.chave === regua)
    const resumo = dados?.resumo

    const pessoas = [...(dados?.pessoas ?? [])].sort((a, b) => b[ordem] - a[ordem])

    // O gráfico mostra só quem vendeu: uma barra de comprimento zero não diz
    // nada e ainda ocupa uma linha. Quem não vendeu continua na tabela
    // abaixo, com o resto do trabalho dele.
    const comVenda = pessoas.filter((pessoa) => pessoa.pecas_vendidas > 0)

    return (
        <Pagina
            titulo="Equipe em números"
            descricao="O que cada pessoa fez no período: o que vendeu, os pedidos que assumiu, as conversas que atendeu e as tarefas que fechou."
            volta={{ nome: "Início", rota: "/page/inicio" }}
            acoes={<SeletorDeRegua regua={regua} aoTrocar={setRegua} />}
        >

            {erro && (
                <p className="flex items-center gap-2 rounded-lg bg-[var(--vermelho-fundo)] px-3 py-2 text-sm text-[var(--vermelho)]">
                    <FiAlertCircle className="w-4 shrink-0" aria-hidden />
                    {erro}
                </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Cartao
                    Icone={FiUsers}
                    rotulo="Pessoas na loja"
                    valor={inteiro(resumo?.pessoas ?? 0)}
                    detalhe={`${inteiro(resumo?.ativos ?? 0)} com acesso ativo`}
                />
                <Cartao
                    Icone={FiUserCheck}
                    rotulo="Gerentes"
                    valor={inteiro(resumo?.gerentes ?? 0)}
                    detalhe="abrem a loja e cuidam da equipe"
                />
                <Cartao
                    Icone={FiPackage}
                    rotulo="Unidades vendidas"
                    valor={inteiro(resumo?.pecas_vendidas ?? 0)}
                    detalhe={escolhida?.descricao ?? ""}
                />
                <Cartao
                    Icone={FiDollarSign}
                    rotulo="Faturamento do período"
                    valor={moeda(resumo?.faturamento ?? 0)}
                    detalhe="somado do preço gravado em cada baixa"
                />
            </div>

            <Secao
                titulo="Quem vendeu quanto"
                descricao="Unidades baixadas por cada pessoa, com o faturamento escrito na ponta da barra."
            >
                {carregando && !dados ? (
                    <div className="h-[180px] animate-pulse rounded-lg bg-[var(--fundo)]" />
                ) : (
                    <BarrasPorPessoa
                        series={SERIE_PECAS}
                        linhas={comVenda.map((pessoa) => ({
                            nome: pessoa.nome,
                            partes: [pessoa.pecas_vendidas],
                            marca: `${pessoa.pecas_vendidas} · ${moeda(pessoa.faturamento)}`,
                        }))}
                    />
                )}

                {/* O número que faz a soma fechar.

                    Sem ele, o dono soma as barras, compara com o faturamento
                    da tela de início e encontra uma diferença sem explicação —
                    que é a venda do site e a baixa automática, que não têm
                    nome de vendedor gravado. Dizer isso é mais barato do que
                    responder à pergunta depois. */}
                {(resumo?.sem_dono ?? 0) > 0 && (
                    <p className="mt-4 border-t border-[var(--linha-suave)] pt-4 text-xs leading-relaxed text-[var(--ink-3)]">
                        <span className="num font-semibold text-[var(--ink-2)]">{resumo?.sem_dono}</span>{" "}
                        unidade(s) saíram sem nome de quem baixou — venda do site e baixa automática de
                        pedido não têm vendedor. Elas entram no total da loja e não aparecem em
                        nenhuma barra acima.
                    </p>
                )}
            </Secao>

            <Secao
                titulo="Cada pessoa, por inteiro"
                descricao="Clique no título de uma coluna para ordenar por ela. Quem não vendeu continua aqui: vender não é o único trabalho da loja."
            >
                {carregando && !dados ? (
                    <div className="h-[200px] animate-pulse rounded-lg bg-[var(--fundo)]" />
                ) : pessoas.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[var(--linha)] px-4 py-8 text-center text-sm text-[var(--ink-3)]">
                        Nenhuma pessoa cadastrada nesta loja ainda.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="tabela w-full">
                            <thead>
                                <tr>
                                    <th scope="col" className="text-left">Pessoa</th>

                                    {COLUNAS.map((coluna) => (
                                        <th key={coluna.chave} scope="col" className="text-right">
                                            <button
                                                type="button"
                                                onClick={() => setOrdem(coluna.chave)}
                                                aria-pressed={ordem === coluna.chave}
                                                className={`transition-colors hover:text-[var(--ink)] ${
                                                    ordem === coluna.chave ? "text-[var(--azul)]" : ""
                                                }`}
                                            >
                                                {coluna.curto}
                                            </button>
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {pessoas.map((pessoa) => (
                                    <tr key={`${pessoa.id}-${pessoa.nome}`}>
                                        <td>
                                            <span className="block font-medium text-[var(--ink)]">
                                                {pessoa.nome}
                                            </span>

                                            <span className="block text-xs text-[var(--ink-3)]">
                                                {pessoa.dono
                                                    ? "dono da loja"
                                                    : pessoa.gerente
                                                        ? "gerente"
                                                        : `${pessoa.telas} tela(s) liberada(s)`}
                                                {!pessoa.ativo && " · sem acesso"}
                                            </span>
                                        </td>

                                        <td className="num text-right">{pessoa.pecas_vendidas}</td>
                                        <td className="num text-right">{moeda(pessoa.faturamento)}</td>
                                        <td className="num text-right">{pessoa.pedidos_assumidos}</td>
                                        <td className="num text-right">{pessoa.conversas_atendidas}</td>
                                        <td className="num text-right">{pessoa.tarefas_concluidas}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Secao>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Cartao
                    Icone={FiShoppingCart}
                    rotulo="Pedidos assumidos"
                    valor={inteiro(pessoas.reduce((soma, p) => soma + p.pedidos_assumidos, 0))}
                    detalhe="quem mexe primeiro fica com o pedido"
                />
                <Cartao
                    Icone={FiMessageCircle}
                    rotulo="Conversas atendidas"
                    valor={inteiro(pessoas.reduce((soma, p) => soma + p.conversas_atendidas, 0))}
                    detalhe="no chat da vitrine"
                />
                <Cartao
                    Icone={FiCheckSquare}
                    rotulo="Tarefas do estoque"
                    valor={inteiro(pessoas.reduce((soma, p) => soma + p.tarefas_concluidas, 0))}
                    detalhe="fechadas no período"
                />
            </div>

        </Pagina>
    )
}
