"use client"

/**
 * As peças que todas as telas de painel repetem.
 *
 * Elas nasceram dentro do gráfico de vendas, que por um tempo foi a única
 * tela com régua de tempo. Quando apareceram as três telas por assunto —
 * mercadoria, equipe e expedição —, copiar o seletor de régua e a conversão
 * de rótulo em cada uma seria ter quatro versões da mesma coisa para
 * divergirem: bastaria alguém corrigir o fuso do eixo em um arquivo e
 * esquecer os outros três para o mesmo painel mostrar duas datas diferentes
 * para o mesmo dia.
 *
 * O que mora aqui é só o que as quatro telas compartilham de verdade. O
 * desenho de cada gráfico continua em components/grafico, e o que cada tela
 * pergunta ao servidor continua nela.
 */

import type { IconType } from "react-icons"
import type { GranularidadeDeVendas } from "@/app/type/type"

/** As três réguas, com o que cada uma alcança. */
export const REGUAS: { chave: GranularidadeDeVendas; rotulo: string; descricao: string }[] = [
    { chave: "dia", rotulo: "Por dia", descricao: "Os últimos 30 dias." },
    { chave: "mes", rotulo: "Por mês", descricao: "Os últimos 12 meses." },
    { chave: "ano", rotulo: "Por ano", descricao: "Os últimos 5 anos." },
]

/**
 * O seletor de régua, que vai nas ações do cartão.
 *
 * Três botões à vista, e não um menu suspenso: são três opções que se leem de
 * uma vez, e trocar de régua é o gesto mais repetido destas telas — esconder
 * isso atrás de um clique a mais seria cobrar pedágio no caminho principal.
 */
export function SeletorDeRegua({ regua, aoTrocar }: {
    regua: GranularidadeDeVendas
    aoTrocar: (nova: GranularidadeDeVendas) => void
}) {
    return (
        <div className="flex rounded-lg border border-[#E1E1E1] p-0.5" role="group" aria-label="Régua do painel">
            {REGUAS.map((item) => (
                <button
                    key={item.chave}
                    type="button"
                    onClick={() => aoTrocar(item.chave)}
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
    )
}

/** Um número grande do topo da tela. */
export function Cartao({ Icone, rotulo, valor, detalhe, tom }: {
    Icone: IconType
    rotulo: string
    valor: string
    detalhe?: string

    /** "bom" e "ruim" pintam só o NÚMERO, nunca o cartão inteiro. */
    tom?: "bom" | "ruim"
}) {
    return (
        <div className="card p-4">
            <p className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                <Icone className="w-3.5" aria-hidden />
                {rotulo}
            </p>

            <p
                className={`num mt-2 text-xl font-bold ${
                    tom === "bom" ? "text-[#0C5132]" : tom === "ruim" ? "text-[#8E1F0B]" : "text-[#303030]"
                }`}
            >
                {valor}
            </p>

            {detalhe ? <p className="mt-0.5 text-xs text-[#8A8A8A]">{detalhe}</p> : null}
        </div>
    )
}

/** Um total escrito acima do gráfico. */
export function Total({ rotulo, valor }: { rotulo: string; valor: string }) {
    return (
        <p>
            <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                {rotulo}
            </span>
            <span className="num text-lg font-bold text-[#303030]">{valor}</span>
        </p>
    )
}

/**
 * Uma lista de "os que mais": nome à esquerda, número à direita.
 *
 * Tabela e não gráfico de pizza, que é o que costuma aparecer aqui: a
 * pergunta é "quais são e quanto", e fatia de pizza responde mal as duas —
 * ninguém compara ângulos, e o nome não cabe dentro da fatia.
 */
export function Ranking({ linhas, vazio }: {
    linhas: { chave: string | number; nome: string; detalhe?: string; valor: string; barra: number }[]
    vazio: string
}) {

    if (linhas.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-[#E1E1E1] px-4 py-8 text-center text-sm text-[#8A8A8A]">
                {vazio}
            </p>
        )
    }

    const maior = Math.max(...linhas.map((linha) => linha.barra), 1)

    return (
        <ul className="space-y-2.5">
            {linhas.map((linha) => (
                <li key={linha.chave}>
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm text-[#303030]" title={linha.nome}>
                            {linha.nome}
                            {linha.detalhe ? (
                                <span className="num ml-1.5 text-xs text-[#8A8A8A]">{linha.detalhe}</span>
                            ) : null}
                        </span>

                        <span className="num shrink-0 text-sm font-semibold text-[#303030]">{linha.valor}</span>
                    </div>

                    {/* A barra é a comparação; o número é o valor. Ela fica
                        fina e cinza de propósito — quem lê a lista lê os
                        números, e a barra só diz de relance quem é o dobro de
                        quem. */}
                    <div className="mt-1 h-1.5 w-full rounded-full bg-[#F1F1F1]" aria-hidden>
                        <div
                            className="h-full rounded-full bg-[#005BD3]"
                            style={{ width: `${Math.max(2, (linha.barra / maior) * 100)}%` }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    )
}

/** O dinheiro escrito como gente lê. */
export function moeda(valor: number): string {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/**
 * O dinheiro do eixo, curto.
 *
 * "R$ 12.000,00" repetido cinco vezes na lateral come um terço da largura do
 * gráfico, e nenhuma dessas casas decimais é lida — o eixo serve para
 * estimar, e o valor exato está na caixa do cursor.
 */
export function moedaCurta(valor: number): string {

    if (valor >= 1000) return `${Math.round(valor / 100) / 10}k`

    return String(Math.round(valor))
}

/** Contagem inteira, para o eixo dos gráficos que contam peças. */
export function inteiro(valor: number): string {
    return String(Math.round(valor))
}

/**
 * O rótulo do eixo horizontal, escrito como se lê.
 *
 * O texto é fatiado, e nunca convertido para Date: "2026-09-09" virando data
 * no navegador é interpretado como meia-noite UTC, e em fuso brasileiro isso
 * volta um dia — o gráfico inteiro andaria para trás.
 */
export function rotuloDoEixo(rotulo: string, regua: GranularidadeDeVendas): string {

    if (regua === "ano") return rotulo

    const [ano, mes, dia] = rotulo.split("-")

    if (regua === "mes") return `${MESES[Number(mes) - 1] ?? mes}/${ano.slice(2)}`

    return `${dia}/${mes}`
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
