"use client"

import { useEffect, useMemo, useState } from "react"
import { FiAlertCircle } from "react-icons/fi"
import { Secao } from "@/app/components/pagina/pagina"
import {
    BarraDeEstados,
    BarrasPorPessoa,
    Fluxo,
    Linhas,
    type Fita,
    type LinhaDePessoa,
} from "@/app/components/grafico/grafico"
import { consultarFluxoDeAtendimento } from "@/middleware/painel"
import type { FluxoDeAtendimento } from "@/app/type/type"

/**
 * O que a equipe fez com as conversas — as duas portas somadas.
 *
 * Fica nesta tela, e não na de início, porque é aqui que se decide sobre
 * gente: quem cadastra, quem tira, quem recebe qual permissão. A tela de
 * início mostra quanto cada um vendeu; esta mostra como o atendimento anda
 * entre as mãos da equipe, que é a informação que muda uma decisão de
 * distribuição de trabalho.
 *
 * São quatro perguntas e quatro desenhos, e cada um responde uma:
 *
 *   QUEM PEGA O QUÊ — barras por pessoa. Separa "assumiu da fila" de "recebeu
 *   de alguém" de propósito: pegar é iniciativa, receber é distribuição, e
 *   somá-los num "atendimentos" só esconderia justamente a diferença entre
 *   quem puxa trabalho e quem recebe trabalho empurrado.
 *
 *   QUEM PASSA PARA QUEM — fitas entre duas colunas. A pergunta é direcional,
 *   e é como se descobre que o cliente difícil sempre acaba na mesma mesa.
 *
 *   COMO ESTÁ A FILA AGORA — uma barra repartida. É fotografia, não série.
 *
 *   COMO FOI O MÊS — linhas. É onde se vê se as encerradas acompanham as
 *   assumidas, ou se a pilha de conversa aberta está crescendo.
 *
 * O que ele NÃO faz: nota, ranking de produtividade e média de tempo. Nada
 * disso está gravado, e número inventado numa tela que decide sobre o trabalho
 * das pessoas é pior do que número nenhum.
 */

const JANELAS = [
    { dias: 7, rotulo: "7 dias" },
    { dias: 30, rotulo: "30 dias" },
    { dias: 90, rotulo: "90 dias" },
]

const SERIES_DA_PESSOA = [
    { rotulo: "Assumiu da fila", cor: "var(--serie-1)" },
    { rotulo: "Recebeu de alguém", cor: "var(--serie-2)" },
]

const SERIES_DO_TEMPO = [
    { rotulo: "Assumidas", cor: "var(--serie-1)" },
    { rotulo: "Passadas adiante", cor: "var(--serie-2)" },
    { rotulo: "Encerradas", cor: "var(--serie-3)" },
    { rotulo: "Reabertas pelo cliente", cor: "var(--serie-4)" },
]

/** As cores das fitas, na ordem em que as pessoas aparecem na coluna. */
const CORES_DO_FLUXO = [
    "var(--serie-1)",
    "var(--serie-2)",
    "var(--serie-3)",
    "var(--serie-4)",
    "var(--serie-5)",
    "var(--serie-6)",
]

export default function FluxoDoAtendimento() {

    const [dias, setDias] = useState(30)
    const [dados, setDados] = useState<FluxoDeAtendimento | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    useEffect(() => {

        let valeu = true

        consultarFluxoDeAtendimento(dias)
            .then((resposta) => {
                if (valeu) setDados(resposta)
            })
            .catch((e: unknown) => {
                if (valeu) {
                    setErro(e instanceof Error ? e.message : "Não foi possível carregar o atendimento.")
                }
            })
            .finally(() => {
                if (valeu) setCarregando(false)
            })

        return () => {
            valeu = false
        }
    }, [dias])

    /**
     * Trocar de período marca o carregamento AQUI, no clique, e não dentro do
     * efeito: setState síncrono no corpo de um efeito faz o React renderizar
     * duas vezes por mudança, e é o que a regra `set-state-in-effect` acusa.
     */
    function trocarJanela(novos: number) {

        if (novos === dias) return

        setCarregando(true)
        setErro("")
        setDias(novos)
    }

    // Só quem mexeu em conversa entra no gráfico. Quem não mexeu continua na
    // lista da equipe logo abaixo, que é onde a ausência dele significa
    // alguma coisa — no gráfico ela seria só uma linha vazia ocupando altura.
    const linhas: LinhaDePessoa[] = useMemo(() => (
        (dados?.pessoas ?? [])
            .filter((pessoa) => pessoa.assumiu + pessoa.recebeu + pessoa.encerrou > 0)
            .map((pessoa) => ({
                nome: pessoa.nome,
                partes: [pessoa.assumiu, pessoa.recebeu],
                marca: `${pessoa.encerrou} enc.`,
            }))
    ), [dados])

    const fitas: Fita[] = useMemo(() => (
        (dados?.passagens ?? []).map((passagem) => ({
            de: passagem.de,
            para: passagem.para,
            total: passagem.total,
        }))
    ), [dados])

    const semRastro = dados !== null && !dados.desde

    return (
        <Secao
            titulo="O atendimento da equipe"
            descricao="O chat do site e o WhatsApp somados: quem pega conversa, quem passa para quem, e quem encerra."
            acoes={
                <div className="flex rounded-lg border border-[#E1E1E1] p-0.5" role="group" aria-label="Período do relatório">
                    {JANELAS.map((janela) => (
                        <button
                            key={janela.dias}
                            type="button"
                            onClick={() => trocarJanela(janela.dias)}
                            aria-pressed={janela.dias === dias}
                            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                                janela.dias === dias
                                    ? "bg-[#303030] text-white"
                                    : "text-[#616161] hover:bg-[#F1F1F1]"
                            }`}
                        >
                            {janela.rotulo}
                        </button>
                    ))}
                </div>
            }
        >
            {erro && (
                <p className="mb-4 flex items-center gap-2 rounded-lg bg-[#FEE9E8] px-3 py-2 text-sm text-[#8E1F0B]">
                    <FiAlertCircle className="w-4 shrink-0" aria-hidden />
                    {erro}
                </p>
            )}

            {/* O aviso existe para o dono não ler "ninguém fez nada" onde a
                verdade é "ainda não havia registro". O rastro do atendimento
                começa a ser gravado a partir do dia em que esta tela subiu:
                o que aconteceu antes não foi guardado por ninguém, e
                preencher gráfico com número estimado é o contrário do que
                este painel faz. */}
            {semRastro && !erro && (
                <p className="mb-4 rounded-lg bg-[#FFF1E3] px-3 py-2 text-sm text-[#5E4200]">
                    O registro de quem pega, passa e encerra conversa começa agora. Os gráficos
                    se enchem conforme a equipe atende — o que aconteceu antes não ficou gravado.
                </p>
            )}

            {carregando && !dados ? (
                <div className="h-64 animate-pulse rounded-lg bg-[#F1F1F1]" />
            ) : dados && (
                <div className={`space-y-8 ${carregando ? "opacity-60 transition-opacity" : "transition-opacity"}`}>

                    <div>
                        <Titulo>Quem pegou conversa</Titulo>
                        <Explicacao>
                            Assumir é pegar da fila por conta própria; receber é ganhar de
                            outra pessoa. O número à direita é quantas essa pessoa encerrou.
                        </Explicacao>

                        <BarrasPorPessoa linhas={linhas} series={SERIES_DA_PESSOA} />
                    </div>

                    <div>
                        <Titulo>Quem passou para quem</Titulo>
                        <Explicacao>
                            Cada fita é uma transferência, e a espessura dela é quantas vezes
                            aconteceu. Só o dono da loja pode passar um cliente de uma pessoa
                            para outra.
                        </Explicacao>

                        <Fluxo fitas={fitas} cores={CORES_DO_FLUXO} />

                        {fitas.length > 0 && <TabelaDePassagens fitas={fitas} />}
                    </div>

                    <div>
                        <Titulo>A fila agora</Titulo>
                        <Explicacao>
                            Não é do período: é o que está na mesa neste momento, somando o
                            chat do site e o WhatsApp. Livre é o que espera alguém pegar.
                        </Explicacao>

                        <BarraDeEstados
                            partes={[
                                { rotulo: "Livres", valor: dados.fila.livres, cor: "var(--situacao-livre)" },
                                { rotulo: "Com dono", valor: dados.fila.atribuidos, cor: "var(--situacao-atribuido)" },
                                { rotulo: "Em atendimento", valor: dados.fila.em_atendimento, cor: "var(--situacao-atendendo)" },
                            ]}
                        />
                    </div>

                    <div>
                        <Titulo>O movimento do período</Titulo>
                        <Explicacao>
                            Reaberta é a conversa que o cliente voltou a escrever depois de
                            encerrada — ela volta para a fila da equipe inteira.
                        </Explicacao>

                        <Linhas
                            rotulos={dados.linha_do_dia.map((dia) => dia.dia)}
                            series={SERIES_DO_TEMPO}
                            valores={[
                                dados.linha_do_dia.map((dia) => dia.assumidas),
                                dados.linha_do_dia.map((dia) => dia.passadas),
                                dados.linha_do_dia.map((dia) => dia.encerradas),
                                dados.linha_do_dia.map((dia) => dia.reabertas),
                            ]}
                            formatar={(valor) => String(Math.round(valor))}
                            rotuloDoEixo={(rotulo) => {
                                const [, mes, dia] = rotulo.split("-")
                                return `${dia}/${mes}`
                            }}
                        />
                    </div>
                </div>
            )}
        </Secao>
    )
}

function Titulo({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
            {children}
        </h3>
    )
}

function Explicacao({ children }: { children: React.ReactNode }) {
    return <p className="mb-3 mt-0.5 text-sm text-[#616161]">{children}</p>
}

/**
 * As mesmas transferências escritas.
 *
 * Não é redundância: duas cores da paleta ficam abaixo de 3:1 de contraste
 * sobre o branco, e um gráfico cuja leitura dependesse só delas seria ilegível
 * para quem não distingue as cores, para quem imprime a tela e para o modo de
 * alto contraste do sistema.
 */
function TabelaDePassagens({ fitas }: { fitas: Fita[] }) {
    return (
        <table className="mt-4 w-full text-sm">

            <thead>
                <tr className="border-b border-[#E1E1E1] text-left text-xs uppercase tracking-[0.06em] text-[#8A8A8A]">
                    <th className="py-2 font-semibold">Passou</th>
                    <th className="py-2 font-semibold">Recebeu</th>
                    <th className="py-2 text-right font-semibold">Vezes</th>
                </tr>
            </thead>

            <tbody className="divide-y divide-[#EBEBEB]">
                {fitas.map((fita) => (
                    <tr key={`${fita.de}->${fita.para}`}>
                        <td className="py-2 text-[#303030]">{fita.de}</td>
                        <td className="py-2 text-[#303030]">{fita.para}</td>
                        <td className="num py-2 text-right font-semibold text-[#303030]">{fita.total}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}
