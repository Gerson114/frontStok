"use client"

import { useEffect, useState } from "react"
import { FiAlertCircle, FiCopy, FiKey, FiRefreshCw } from "react-icons/fi"
import { Secao } from "@/app/components/pagina/pagina"
import { consultarCodigoDaLoja, trocarCodigoDaLoja } from "@/middleware/equipe"
import type { CodigoDaLoja } from "@/app/type/type"

/**
 * O código único da loja, o que a equipe digita para entrar na conversa
 * interna.
 *
 * Fica nesta tela, e não numa de configuração, porque é aqui que ele é usado:
 * quem acabou de cadastrar um funcionário precisa passar o código para ele na
 * mesma visita. Uma tela à parte só para mostrar doze caracteres seria uma
 * segunda porta para a mesma tarefa.
 *
 * Por que ele existe, já que a pessoa já entra com senha própria: são dois
 * fatores independentes. A sessão diz de que loja ela é; o código diz que foi
 * autorizada a entrar na conversa. Assim, o vazamento de um deles não abre
 * nada — quem descobre o código não tem conta na loja, e quem rouba uma
 * sessão não sabe o código.
 *
 * Trocar derruba TODO MUNDO, inclusive o dono. É de propósito, e é a razão de
 * o botão existir: é o que se faz no dia em que alguém sai da loja de mal.
 */
export default function CodigoDaEquipe() {

    const [dados, setDados] = useState<CodigoDaLoja | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [confirmando, setConfirmando] = useState(false)
    const [trocando, setTrocando] = useState(false)
    const [copiado, setCopiado] = useState(false)

    useEffect(() => {

        let cancelado = false

        async function buscar() {
            try {
                const resposta = await consultarCodigoDaLoja()

                if (!cancelado) setDados(resposta)

            } catch (e) {
                if (!cancelado) {
                    setErro(e instanceof Error ? e.message : "Não foi possível ler o código da loja.")
                }
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        buscar()

        return () => {
            cancelado = true
        }
    }, [])

    async function trocar() {

        setTrocando(true)
        setErro("")

        try {
            setDados(await trocarCodigoDaLoja())
            setConfirmando(false)

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível trocar o código.")
        } finally {
            setTrocando(false)
        }
    }

    async function copiar() {

        if (!dados) return

        try {
            await navigator.clipboard.writeText(dados.codigo)
            setCopiado(true)

            // Volta ao normal sozinho: um "copiado!" que fica para sempre
            // deixa de dizer que a última ação deu certo.
            setTimeout(() => setCopiado(false), 2000)

        } catch {
            // Sem permissão de área de transferência o código continua na
            // tela para ser lido e digitado — que é o caminho pelo qual ele
            // costuma chegar à equipe de qualquer jeito.
            setErro("Não foi possível copiar. O código está aí ao lado para ser lido.")
        }
    }

    return (
        <Secao
            titulo="Código da conversa da equipe"
            descricao="Quem trabalha aqui digita este código uma vez para entrar na conversa interna, e continua entrando com a própria senha. São duas chaves diferentes de propósito: a senha diz quem é a pessoa, o código diz que ela pode entrar na conversa."
            acoes={
                dados && (
                    <button
                        type="button"
                        onClick={() => setConfirmando(true)}
                        className="btn btn-neutro"
                        disabled={trocando}
                    >
                        <FiRefreshCw className="w-4" aria-hidden />
                        <span>Trocar código</span>
                    </button>
                )
            }
        >
            {erro && (
                <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg bg-[var(--vermelho-fundo)] px-3 py-2 text-sm font-semibold text-[var(--vermelho)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </p>
            )}

            {carregando ? (
                <div className="h-10 w-64 animate-pulse rounded-lg bg-[var(--fundo)]" />
            ) : dados && (
                <>
                    <div className="flex flex-wrap items-center gap-3">

                        <span className="flex items-center gap-2 rounded-lg border border-[var(--linha)] bg-[var(--superficie-2)] px-4 py-2.5">
                            <FiKey className="w-4 text-[var(--ink-3)]" aria-hidden />
                            <span className="num text-lg font-bold tracking-[0.14em] text-[var(--ink)]">
                                {dados.codigo}
                            </span>
                        </span>

                        <button type="button" onClick={copiar} className="btn btn-neutro">
                            <FiCopy className="w-4" aria-hidden />
                            <span>{copiado ? "Copiado" : "Copiar"}</span>
                        </button>
                    </div>

                    <p className="mt-3 text-sm text-[var(--ink-2)]">
                        Passe-o de viva voz ou por um canal que só a equipe leia. O acesso de cada
                        pessoa vale por doze horas — depois disso, ela digita de novo, o que
                        também fecha a conversa no computador do balcão no fim do expediente.
                    </p>

                    {confirmando && (
                        <div className="mt-4 rounded-lg border border-[var(--linha)] bg-[var(--amarelo-fundo)] p-4">

                            <p className="text-sm font-semibold text-[var(--amarelo)]">
                                Trocar o código tira todo mundo da conversa — você inclusive.
                            </p>

                            <p className="mt-1 text-sm text-[var(--amarelo)]">
                                Cada pessoa da equipe volta a entrar digitando o código novo. É o
                                que se faz quando alguém sai da loja ou o código foi parar onde
                                não devia. As mensagens continuam onde estão.
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">

                                <button
                                    type="button"
                                    onClick={trocar}
                                    disabled={trocando}
                                    className="btn btn-primario"
                                >
                                    {trocando ? "Trocando…" : "Trocar mesmo assim"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setConfirmando(false)}
                                    className="btn btn-neutro"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {dados.aviso && (
                        <p role="status" className="mt-3 rounded-lg bg-[var(--verde-fundo)] px-3 py-2 text-sm font-semibold text-[var(--verde)]">
                            {dados.aviso}
                        </p>
                    )}
                </>
            )}
        </Secao>
    )
}
