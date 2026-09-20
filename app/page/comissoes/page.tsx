"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FiAlertCircle, FiLock, FiUnlock, FiUsers } from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"
import { formatarMoeda } from "@/app/components/preco/preco"
import { consultarComissoes, fecharComissoes, reabrirComissoes } from "@/middleware/comissoes"
import type { FechamentoDeComissao } from "@/app/type/type"

/**
 * A comissão do mês de quem vende por percentual.
 *
 * O que esta tela resolve: o sistema já sabia quem vendeu cada peça e por
 * quanto — "Equipe em números" mostra isso desde sempre. O que faltava era a
 * conta que vira pagamento, e ela era feita fora, em planilha, com o dono
 * copiando faturamento por pessoa e torcendo para não ter esquecido uma
 * devolução.
 *
 * A base é a mesma do painel da equipe, de propósito: peça vendida com nome
 * gravado, menos as devolvidas. Duas bases diferentes fariam o dono ver um
 * número numa tela e outro na de baixo, sem nada que explicasse a diferença.
 *
 * O que esta tela NÃO faz, e é deliberado: meta, faixa de aceleração e
 * ranking de desempenho. A tela da equipe já recusa inventar régua para o
 * trabalho de alguém (ver services/painel/pessoas.go), e uma comissão que
 * muda de percentual conforme a pessoa bate ou não bate um número seria a
 * mesma régua entrando pela porta do dinheiro. A ordem da lista é pelo maior
 * cheque porque é assim que se confere um pagamento — não é pódio.
 *
 * O FECHAMENTO é o centro da tela. Enquanto o mês está aberto, os números se
 * movem: uma devolução de hoje muda o que a pessoa vendeu em setembro, e
 * mudar o percentual na ficha muda o valor inteiro. Fechado, eles viram
 * números mortos no banco — e é por isso que o mês em curso não fecha:
 * assinar hoje o que ainda vai vender até o dia 30 é pagar pela metade.
 */

/** O mês de hoje, escrito como o backend o entende. */
function mesCorrente(): string {
    const agora = new Date()
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`
}

/** "2026-09" escrito como se fala. */
function porExtenso(mes: string): string {

    const [ano, numero] = mes.split("-")
    const data = new Date(Number(ano), Number(numero) - 1, 1)

    if (Number.isNaN(data.getTime())) return mes

    return data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
}

export default function Comissoes() {

    const [mes, setMes] = useState("")
    const [dados, setDados] = useState<FechamentoDeComissao | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [ocupado, setOcupado] = useState(false)

    /**
     * Busca um mês.
     *
     * Não acende o "carregando" aqui dentro, e isso é de propósito: esta
     * função é chamada de dentro de um efeito, e mexer no estado antes do
     * `await` dispara uma cascata de renders que o lint do React recusa. Quem
     * chama a partir de um clique acende a espera por conta própria — no
     * primeiro desenho ela já nasce acesa.
     */
    const buscar = useCallback(async (qual?: string) => {

        try {
            const resposta = await consultarComissoes(qual)

            setDados(resposta)

            // O mês do campo vem da RESPOSTA, e não do que foi pedido: a tela
            // abre sem mês nenhum, e é o backend que decide que o mês a
            // fechar é o passado.
            setMes(resposta.mes)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Erro ao consultar as comissões")
        } finally {
            setCarregando(false)
        }
    }, [])

    // A primeira busca é escrita aqui dentro, e não numa chamada a `buscar`,
    // pelo mesmo motivo que na tela de Lojas: o efeito não pode mexer no
    // estado antes do `await`, e a bandeira `cancelado` evita escrever numa
    // tela que já saiu do ar enquanto a resposta vinha.
    useEffect(() => {

        let cancelado = false

        async function primeira() {
            try {
                const resposta = await consultarComissoes()

                if (!cancelado) {
                    setDados(resposta)
                    setMes(resposta.mes)
                }
            } catch (e) {
                if (!cancelado) {
                    setErro(e instanceof Error ? e.message : "Erro ao consultar as comissões")
                }
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        primeira()

        return () => {
            cancelado = true
        }
    }, [])

    async function fechar() {

        if (!dados) return

        setOcupado(true)
        setErro("")

        try {
            await fecharComissoes(dados.mes)
            setCarregando(true)
            await buscar(dados.mes)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível fechar o mês")
        } finally {
            setOcupado(false)
        }
    }

    async function reabrir() {

        if (!dados) return

        setOcupado(true)
        setErro("")

        try {
            await reabrirComissoes(dados.mes)
            setCarregando(true)
            await buscar(dados.mes)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível reabrir o mês")
        } finally {
            setOcupado(false)
        }
    }

    const emCurso = dados ? dados.mes >= mesCorrente() : false

    // Quem vendeu e não recebe: ou não tem percentual na ficha, ou não está
    // mais no cadastro. Os dois são dito em voz alta — a pessoa aparece na
    // lista com zero, e o aviso explica por quê. Uma linha zerada sem
    // explicação faz o dono achar que a conta está errada.
    const semPercentual = dados?.linhas.filter((linha) => linha.cadastrada && linha.percentual <= 0) ?? []
    const foraDoCadastro = dados?.linhas.filter((linha) => !linha.cadastrada) ?? []

    return (
        <Pagina
            titulo="Comissões"
            descricao="O que cada vendedor tem a receber sobre o que vendeu no mês, já sem as unidades devolvidas."
            acoes={
                dados && !carregando ? (
                    dados.fechado ? (
                        <button type="button" onClick={reabrir} disabled={ocupado} className="btn btn-neutro">
                            <FiUnlock className="w-4" aria-hidden />
                            <span>{ocupado ? "Reabrindo…" : "Reabrir mês"}</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={fechar}
                            disabled={ocupado || emCurso || dados.valor <= 0}
                            title={emCurso ? "Este mês ainda não terminou" : undefined}
                            className="btn btn-primario"
                        >
                            <FiLock className="w-4" aria-hidden />
                            <span>{ocupado ? "Fechando…" : "Fechar mês"}</span>
                        </button>
                    )
                ) : undefined
            }
        >

            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            <div className="card flex flex-wrap items-end justify-between gap-4 p-4">

                <div>
                    <label htmlFor="mes" className="rotulo">Mês de competência</label>

                    <input
                        id="mes"
                        type="month"
                        value={mes}
                        max={mesCorrente()}
                        onChange={(e) => {
                            setMes(e.target.value)

                            if (e.target.value) {
                                setCarregando(true)
                                setErro("")
                                buscar(e.target.value)
                            }
                        }}
                        className="field"
                    />
                </div>

                {dados && (
                    <div className="text-right">
                        <p className="text-[0.6875rem] font-semibold text-[var(--ink-3)]">
                            A pagar em {porExtenso(dados.mes)}
                        </p>

                        <p className="num font-display text-2xl text-[var(--ink)]">{formatarMoeda(dados.valor)}</p>

                        <p className="text-xs text-[var(--ink-2)]">
                            sobre {formatarMoeda(dados.base)} vendidos
                        </p>
                    </div>
                )}
            </div>

            {/* A situação do mês, dita antes da tabela: ela muda o sentido de
                todo número abaixo. */}
            {dados?.fechado && (
                <p className="rounded-lg bg-[#E3F5E1] px-4 py-3 text-sm text-[var(--verde)]">
                    Mês fechado{dados.fechada_por ? ` por ${dados.fechada_por}` : ""}
                    {dados.fechada_em ? ` em ${new Date(dados.fechada_em).toLocaleDateString("pt-BR")}` : ""}.
                    Estes valores são os que foram pagos e não mudam mais, nem se uma unidade
                    deste mês for devolvida agora.
                </p>
            )}

            {dados && !dados.fechado && emCurso && (
                <p className="rounded-lg bg-[var(--amarelo-fundo)] px-4 py-3 text-sm text-[var(--amarelo)]">
                    Este mês ainda está correndo. Os valores mudam a cada venda e a cada
                    devolução — ele só fecha depois do último dia.
                </p>
            )}

            {carregando ? (
                <div className="card p-8 text-center text-sm text-[var(--ink-2)]">Somando o mês…</div>
            ) : !dados || dados.linhas.length === 0 ? (
                <div className="card flex flex-col items-center justify-center p-10 text-center">
                    <FiUsers className="w-8 text-[var(--ink-4)]" aria-hidden />

                    <p className="mt-3 font-display text-base text-[var(--ink)]">
                        Ninguém vendeu com nome gravado neste mês
                    </p>

                    <p className="mt-1 max-w-md text-sm text-[var(--ink-2)]">
                        A comissão sai da unidade que saiu com o nome de quem a vendeu. Venda do
                        site e baixa automática não têm dono, e por isso não geram comissão.
                    </p>
                </div>
            ) : (
                <div className="card overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--linha-suave)] text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--ink-3)]">
                                    <th className="px-4 py-2.5">Vendedor</th>
                                    <th className="px-4 py-2.5 text-right">Unidades</th>
                                    <th className="px-4 py-2.5 text-right">Vendeu</th>
                                    <th className="px-4 py-2.5 text-right">%</th>
                                    <th className="px-4 py-2.5 text-right">A receber</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-[var(--fundo)]">
                                {dados.linhas.map((linha) => (
                                    <tr key={linha.nome} className={linha.valor > 0 ? "" : "text-[var(--ink-3)]"}>

                                        <td className="px-4 py-2.5">
                                            <span className="font-semibold text-[var(--ink)]">{linha.nome}</span>

                                            {!linha.cadastrada && (
                                                <span className="ml-2 tag tag-neutral">fora do cadastro</span>
                                            )}

                                            {linha.cadastrada && !linha.ativo && (
                                                <span className="ml-2 tag tag-neutral">sem acesso</span>
                                            )}
                                        </td>

                                        <td className="num px-4 py-2.5 text-right">{linha.pecas || "—"}</td>
                                        <td className="num px-4 py-2.5 text-right">{formatarMoeda(linha.base)}</td>

                                        <td className="num px-4 py-2.5 text-right">
                                            {linha.percentual > 0 ? `${linha.percentual}%` : "—"}
                                        </td>

                                        <td className={`num px-4 py-2.5 text-right ${linha.valor > 0 ? "font-semibold text-[var(--ink)]" : ""}`}>
                                            {formatarMoeda(linha.valor)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>

                            <tfoot>
                                <tr className="border-t border-[var(--linha-suave)] bg-[var(--superficie-2)] font-semibold text-[var(--ink)]">
                                    <td className="px-4 py-2.5">Total</td>
                                    <td className="num px-4 py-2.5 text-right" />
                                    <td className="num px-4 py-2.5 text-right">{formatarMoeda(dados.base)}</td>
                                    <td className="px-4 py-2.5" />
                                    <td className="num px-4 py-2.5 text-right">{formatarMoeda(dados.valor)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* ---------------------------------------------------------------
                O QUE NÃO FECHA, DITO EM VOZ ALTA

                Três buracos possíveis entre "a loja vendeu" e "isto é o que se
                paga". Cada um aparece só quando existe, e cada um leva à tela
                onde se resolve — avisar sem dizer onde consertar é só
                preocupar o dono.
                --------------------------------------------------------------- */}
            {dados && !dados.fechado && semPercentual.length > 0 && (
                <p className="rounded-lg bg-[var(--fundo)] px-4 py-3 text-sm text-[var(--ink-2)]">
                    {semPercentual.length === 1
                        ? `${semPercentual[0].nome} vendeu e não tem percentual na ficha.`
                        : `${semPercentual.length} pessoas venderam e não têm percentual na ficha.`}{" "}
                    Isso é o normal de quem não trabalha por comissão — se não for o caso,
                    o percentual se ajusta em{" "}
                    <Link href="/page/funcionarios" className="font-semibold text-[var(--azul)] hover:underline">
                        Funcionários
                    </Link>.
                </p>
            )}

            {dados && !dados.fechado && foraDoCadastro.length > 0 && (
                <p className="rounded-lg bg-[var(--amarelo-fundo)] px-4 py-3 text-sm text-[var(--amarelo)]">
                    {foraDoCadastro.length === 1
                        ? `${foraDoCadastro[0].nome} vendeu neste mês e não está mais no cadastro.`
                        : `${foraDoCadastro.length} pessoas venderam neste mês e não estão mais no cadastro.`}{" "}
                    A venda delas continua valendo, mas o sistema não sabe o percentual de
                    quem saiu — essa conta é sua.
                </p>
            )}

            {dados && dados.sem_dono > 0 && (
                <p className="text-xs text-[var(--ink-3)]">
                    {dados.sem_dono} unidade{dados.sem_dono > 1 ? "s" : ""} ({formatarMoeda(dados.sem_dono_valor)})
                    {dados.sem_dono > 1 ? " saíram" : " saiu"} sem nome gravado — venda do site ou
                    baixa automática. Não é comissão de ninguém, e está aqui para a soma acima
                    fechar com o faturamento do mês.
                </p>
            )}

        </Pagina>
    )
}
