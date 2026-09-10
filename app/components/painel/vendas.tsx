"use client"

import { useEffect, useState } from "react"
import { FiAlertCircle } from "react-icons/fi"
import { Secao } from "@/app/components/pagina/pagina"
import { BarrasEmpilhadas, type Coluna } from "@/app/components/grafico/grafico"
import { consultarVendas } from "@/middleware/painel"
import type { GranularidadeDeVendas, SerieDeVendas } from "@/app/type/type"

/**
 * O faturamento ao longo do tempo, na régua que o lojista escolher.
 *
 * A tela de início já dizia quanto saiu hoje e quanto saiu no mês. São dois
 * números certos e nenhuma resposta para a pergunta seguinte, que é sempre a
 * mesma: está melhor ou pior? Um número sozinho não responde isso — R$ 4.200
 * num dia só vira informação ao lado dos trinta anteriores.
 *
 * Três réguas e não uma porque são três perguntas, feitas em momentos
 * diferentes: o dia diz que dia da semana vende, o mês diz como foi o ano, o
 * ano diz se a loja está crescendo.
 *
 * É o único pedaço da tela de início que roda no navegador. O resto é montado
 * no servidor de propósito (ver app/page/inicio/page.tsx), mas aqui trocar de
 * régua é um clique que muda os dados — carregar as três de uma vez para
 * evitar isso seria pedir três consultas das quais duas ninguém vai olhar.
 */

const REGUAS: { chave: GranularidadeDeVendas; rotulo: string; descricao: string }[] = [
    { chave: "dia", rotulo: "Por dia", descricao: "Os últimos 30 dias." },
    { chave: "mes", rotulo: "Por mês", descricao: "Os últimos 12 meses." },
    { chave: "ano", rotulo: "Por ano", descricao: "Os últimos 5 anos." },
]

const SERIES = [
    { rotulo: "Balcão", cor: "var(--serie-1)" },
    { rotulo: "Pedidos", cor: "var(--serie-2)" },
]

export default function GraficoDeVendas() {

    const [regua, setRegua] = useState<GranularidadeDeVendas>("dia")
    const [serie, setSerie] = useState<SerieDeVendas | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    useEffect(() => {

        let valeu = true

        consultarVendas(regua)
            .then((dados) => {
                // A resposta da régua anterior pode chegar depois da atual se
                // o lojista clicar duas vezes seguidas. Sem esta guarda, o
                // gráfico do mês apareceria rotulado como o do ano.
                if (valeu) setSerie(dados)
            })
            .catch((e: unknown) => {
                if (valeu) setErro(e instanceof Error ? e.message : "Não foi possível carregar as vendas.")
            })
            .finally(() => {
                if (valeu) setCarregando(false)
            })

        return () => {
            valeu = false
        }
    }, [regua])

    const colunas: Coluna[] = (serie?.pontos ?? []).map((ponto) => ({
        rotulo: ponto.rotulo,
        partes: [ponto.balcao, ponto.pedidos],
        detalhe: [
            { rotulo: "Faturamento", valor: moeda(ponto.faturamento) },
            { rotulo: "Balcão", valor: moeda(ponto.balcao), cor: "var(--serie-1)" },
            { rotulo: "Pedidos", valor: moeda(ponto.pedidos), cor: "var(--serie-2)" },
            { rotulo: "Peças", valor: String(ponto.pecas) },
        ],
    }))

    /**
     * Trocar de régua marca o carregamento AQUI, no clique, e não dentro do
     * efeito: setState síncrono no corpo de um efeito faz o React renderizar
     * duas vezes por mudança, e é o que a regra `set-state-in-effect` acusa.
     * O efeito abaixo só mexe em estado nas respostas, que é o que ele
     * existe para fazer.
     */
    function trocarRegua(chave: GranularidadeDeVendas) {

        if (chave === regua) return

        setCarregando(true)
        setErro("")
        setRegua(chave)
    }

    const escolhida = REGUAS.find((r) => r.chave === regua)

    return (
        <Secao
            titulo="Vendas ao longo do tempo"
            descricao={`${escolhida?.descricao ?? ""} O que saiu pelo balcão e o que saiu por pedido, somado do preço gravado em cada baixa.`}
            acoes={
                <div className="flex rounded-lg border border-[#E1E1E1] p-0.5" role="group" aria-label="Régua do gráfico">
                    {REGUAS.map((item) => (
                        <button
                            key={item.chave}
                            type="button"
                            onClick={() => trocarRegua(item.chave)}
                            aria-pressed={item.chave === regua}
                            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                                item.chave === regua
                                    ? "bg-[#303030] text-white"
                                    : "text-[#616161] hover:bg-[#F1F1F1]"
                            }`}
                        >
                            {item.rotulo}
                        </button>
                    ))}
                </div>
            }
        >
            {erro && (
                <p className="mb-3 flex items-center gap-2 rounded-lg bg-[#FEE9E8] px-3 py-2 text-sm text-[#8E1F0B]">
                    <FiAlertCircle className="w-4 shrink-0" aria-hidden />
                    {erro}
                </p>
            )}

            {serie && (
                <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
                    <Total rotulo="Faturamento no período" valor={moeda(serie.faturamento)} />
                    <Total rotulo="Peças" valor={String(serie.pecas)} />
                    <Total rotulo="Margem" valor={moeda(serie.margem)} />
                </div>
            )}

            {/* O esqueleto só aparece na PRIMEIRA carga. Trocando de régua o
                gráfico anterior fica na tela até o novo chegar — apagá-lo
                faria a tela piscar a cada clique, e o que se está comparando é
                justamente uma régua com a outra. */}
            {carregando && !serie ? (
                <div className="h-[220px] animate-pulse rounded-lg bg-[#F1F1F1]" />
            ) : (
                <div className={carregando ? "opacity-60 transition-opacity" : "transition-opacity"}>
                    <BarrasEmpilhadas
                        colunas={colunas}
                        series={SERIES}
                        formatar={moedaCurta}
                        rotuloDoEixo={(rotulo) => rotuloDoEixo(rotulo, regua)}
                    />
                </div>
            )}
        </Secao>
    )
}

function Total({ rotulo, valor }: { rotulo: string; valor: string }) {
    return (
        <p>
            <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                {rotulo}
            </span>
            <span className="num text-lg font-bold text-[#303030]">{valor}</span>
        </p>
    )
}

function moeda(valor: number): string {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/**
 * O dinheiro do eixo, curto.
 *
 * "R$ 12.000,00" repetido cinco vezes na lateral come um terço da largura do
 * gráfico, e nenhuma dessas casas decimais é lida — o eixo serve para estimar,
 * e o valor exato está na caixa do cursor.
 */
function moedaCurta(valor: number): string {

    if (valor >= 1000) return `${Math.round(valor / 100) / 10}k`

    return String(Math.round(valor))
}

/**
 * O rótulo do eixo horizontal, escrito como se lê.
 *
 * O texto é fatiado, e nunca convertido para Date: "2026-09-09" virando data
 * no navegador é interpretado como meia-noite UTC, e em fuso brasileiro isso
 * volta um dia — o gráfico inteiro andaria para trás.
 */
function rotuloDoEixo(rotulo: string, regua: GranularidadeDeVendas): string {

    if (regua === "ano") return rotulo

    const [ano, mes, dia] = rotulo.split("-")

    if (regua === "mes") return `${MESES[Number(mes) - 1] ?? mes}/${ano.slice(2)}`

    return `${dia}/${mes}`
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
