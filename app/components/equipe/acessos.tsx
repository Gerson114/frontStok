"use client"

import { useCallback, useEffect, useState } from "react"
import { FiAlertCircle, FiCheck, FiClock, FiUserCheck, FiUserX, FiX } from "react-icons/fi"
import { Secao } from "@/app/components/pagina/pagina"
import { consultarAcessos, decidirAcesso } from "@/middleware/equipe"
import { escutarLoja } from "@/middleware/whatsapp"
import type { PedidoDeAcesso } from "@/app/type/type"

/**
 * Quem pediu para entrar na conversa da equipe.
 *
 * É a metade da porta que fica com o dono. A outra metade é o código, logo
 * acima nesta tela — e as duas são separadas de propósito: o código prova que
 * alguém de dentro o passou adiante, e prova só isso. Código é lido por cima
 * do ombro, fotografado, repassado num grupo e esquecido num papel do balcão.
 * Quem diz que uma pessoa é da empresa é quem responde pela empresa.
 *
 * Recusado não some da lista. Apagar a linha faria a pessoa pedir de novo no
 * minuto seguinte, e o dono decidiria a mesma coisa para sempre — e tiraria
 * dele a única forma de voltar atrás num "não" dado sem querer.
 */
export default function AcessosDaConversa() {

    const [pedidos, setPedidos] = useState<PedidoDeAcesso[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [decidindo, setDecidindo] = useState("")

    const recarregar = useCallback(async () => {
        try {
            setPedidos(await consultarAcessos())
            setErro("")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível listar quem pediu para entrar.")
        }
    }, [])

    useEffect(() => {

        let cancelado = false

        async function buscar() {
            try {
                const lista = await consultarAcessos()

                if (!cancelado) setPedidos(lista)

            } catch (e) {
                if (!cancelado) {
                    setErro(e instanceof Error ? e.message : "Não foi possível listar quem pediu para entrar.")
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

    // O pedido chega enquanto o dono está com esta tela aberta: sem isto, ele
    // veria a lista de quando abriu a página e o funcionário ficaria esperando
    // do outro lado sem que nada aparecesse.
    useEffect(() => escutarLoja((aviso) => {
        if (aviso.tipo === "equipe") recarregar()
    }), [recarregar])

    async function decidir(cracha: string, situacao: "aprovado" | "recusado") {

        setDecidindo(cracha)
        setErro("")

        try {
            await decidirAcesso(cracha, situacao)
            await recarregar()

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível salvar a decisão.")
        } finally {
            setDecidindo("")
        }
    }

    const pendentes = pedidos.filter((p) => p.situacao === "pendente")
    const decididos = pedidos.filter((p) => p.situacao !== "pendente")

    return (
        <Secao
            titulo="Quem entra na conversa da equipe"
            descricao="Acertar o código abre um pedido, não a porta. Você confirma quem é da empresa — assim o código que vazou não vira uma pessoa a mais na conversa."
            acoes={
                pendentes.length > 0 && (
                    <span className="tag tag-warning">
                        <FiClock className="w-3.5" aria-hidden />
                        {pendentes.length} esperando
                    </span>
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
                <div className="h-16 animate-pulse rounded-lg bg-[var(--fundo)]" />
            ) : pedidos.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--linha)] px-4 py-6 text-center text-sm text-[var(--ink-3)]">
                    Você ainda não cadastrou ninguém na equipe.
                </p>
            ) : (
                <ul className="divide-y divide-[var(--linha-suave)]">

                    {[...pendentes, ...decididos].map((pedido) => (
                        <li
                            key={pedido.cracha}
                            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
                        >
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-[var(--ink)]">
                                    {pedido.nome || "Sem nome"}
                                    {pedido.dono && (
                                        <span className="ml-2 text-xs font-normal text-[var(--ink-3)]">dono</span>
                                    )}
                                </span>

                                <span className="text-xs text-[var(--ink-3)]">
                                    {estadoEmTexto(pedido)}
                                </span>
                            </span>

                            <span className="flex shrink-0 items-center gap-2">

                                {pedido.situacao === "aprovado" && (
                                    <span className="tag tag-success">
                                        <FiUserCheck className="w-3.5" aria-hidden />
                                        Na conversa
                                    </span>
                                )}

                                {/* Quem nunca digitou o código não tem o que
                                    decidir: o que falta acontece FORA desta
                                    tela, e é isso que a etiqueta diz. */}
                                {pedido.situacao === "" && !pedido.dono && (
                                    <span className="tag tag-warning">
                                        <FiClock className="w-3.5" aria-hidden />
                                        Não entrou
                                    </span>
                                )}

                                {pedido.situacao === "recusado" && (
                                    <span className="tag tag-neutral">
                                        <FiUserX className="w-3.5" aria-hidden />
                                        Fora
                                    </span>
                                )}

                                {/* O botão que falta é sempre o do outro lado da
                                    decisão: quem está dentro só pode ser tirado,
                                    quem está fora só pode ser posto. Mostrar os
                                    dois sempre convidaria a clicar em "aprovar"
                                    num já aprovado, que não faz nada. */}
                                {pedido.situacao !== "aprovado" && pedido.situacao !== "" && (
                                    <button
                                        type="button"
                                        onClick={() => decidir(pedido.cracha, "aprovado")}
                                        disabled={decidindo === pedido.cracha}
                                        className="btn btn-primario px-3 py-1.5 text-xs"
                                    >
                                        <FiCheck className="w-3.5" aria-hidden />
                                        <span>Confirmar</span>
                                    </button>
                                )}

                                {pedido.situacao !== "recusado" && pedido.situacao !== "" && !pedido.dono && (
                                    <button
                                        type="button"
                                        onClick={() => decidir(pedido.cracha, "recusado")}
                                        disabled={decidindo === pedido.cracha}
                                        className="btn btn-neutro px-3 py-1.5 text-xs"
                                    >
                                        <FiX className="w-3.5" aria-hidden />
                                        <span>{pedido.situacao === "aprovado" ? "Tirar" : "Recusar"}</span>
                                    </button>
                                )}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </Secao>
    )
}

/**
 * A linha de baixo de cada pessoa, dizendo o que falta.
 *
 * "Ainda não digitou o código" é o estado mais comum no primeiro dia, e é
 * justamente o que a tela escondia antes — a pessoa nem aparecia, e o dono
 * concluía que o sistema não tinha achado a equipe dele.
 */
function estadoEmTexto(pedido: PedidoDeAcesso): string {

    if (pedido.dono) return "Sempre na conversa — o dono não sai"

    if (pedido.situacao === "") return "Ainda não digitou o código da loja"

    if (pedido.situacao === "pendente") {
        return `Pediu em ${data(pedido.pedido_em)} — esperando você confirmar`
    }

    const verbo = pedido.situacao === "aprovado" ? "Confirmado" : "Recusado"

    return `${verbo} em ${data(pedido.decidido_em ?? pedido.pedido_em)}`
}

function data(quando?: string): string {

    if (!quando) return "—"

    const d = new Date(quando)

    if (Number.isNaN(d.getTime())) return "—"

    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}
