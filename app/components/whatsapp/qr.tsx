"use client"

import { useCallback, useEffect, useState } from "react"
import {
    consultarAparelho,
    desvincularAparelho,
    gerarQR,
    type AparelhoWhatsApp,
} from "@/middleware/whatsapp"
import { ApiError } from "@/middleware/client"
import {
    FiAlertCircle,
    FiAlertTriangle,
    FiCheckCircle,
    FiRefreshCw,
    FiSmartphone,
} from "react-icons/fi"

/**
 * Conectar o WhatsApp lendo o QR.
 *
 * É o mesmo pareamento do WhatsApp Web: o lojista abre o WhatsApp do celular,
 * vai em "Aparelhos conectados" e lê o código. Daí em diante o sistema manda
 * e recebe pelo número normal dele — sem conta Business, sem token, sem custo
 * por conversa.
 *
 * O aviso do que isso custa fica na tela, e não escondido na documentação: o
 * lojista está apostando o número da loja dele, e tem de saber disso antes de
 * ler o código, não depois de o número ser banido.
 *
 * A tela pergunta o estado de dois em dois segundos enquanto o pareamento
 * está aberto, porque a Meta troca o código a cada poucos segundos.
 */

/** De quanto em quanto tempo se pergunta pelo código novo. */
const INTERVALO_MS = 2000

interface Props {
    aoConectar: () => void
}

export default function ConectarPorQR({ aoConectar }: Props) {

    const [aparelho, setAparelho] = useState<AparelhoWhatsApp | null>(null)
    const [gerando, setGerando] = useState(false)
    const [desvinculando, setDesvinculando] = useState(false)
    const [erro, setErro] = useState("")

    const atualizar = useCallback(async () => {
        try {
            const dados = await consultarAparelho()
            setAparelho(dados)
            return dados
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Erro ao consultar o WhatsApp da loja")
            return null
        }
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta async: o estado só muda depois do await
        atualizar()
    }, [atualizar])

    // Só se pergunta de dois em dois segundos enquanto há QR na tela. Ficar
    // batendo no servidor com a conexão já feita seria trabalho por nada.
    useEffect(() => {
        if (aparelho?.estado !== "esperando_leitura") return

        const timer = setInterval(async () => {
            const dados = await atualizar()

            if (dados?.conectado) aoConectar()
        }, INTERVALO_MS)

        return () => clearInterval(timer)

    }, [aparelho?.estado, atualizar, aoConectar])

    async function conectar() {
        setErro("")

        try {
            setGerando(true)
            await gerarQR()
            await atualizar()
        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível gerar o código")
        } finally {
            setGerando(false)
        }
    }

    async function desvincular() {
        setErro("")

        try {
            setDesvinculando(true)
            await desvincularAparelho()
            await atualizar()
        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível desvincular")
        } finally {
            setDesvinculando(false)
        }
    }

    const esperando = aparelho?.estado === "esperando_leitura"

    return (
        <section className="card p-6 sm:p-7">

            <div className="flex items-start gap-3">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E0FFEE] text-[#08A022]">
                    <FiSmartphone className="w-5" aria-hidden />
                </div>

                <div className="min-w-0 flex-1">
                    <h2 className="font-display text-lg text-[#1E2428]">
                        Conectar lendo o QR
                    </h2>

                    <p className="mt-1 text-sm text-[#5A6469]">
                        Usa o WhatsApp que você já tem no celular. Sem conta Business,
                        sem token e sem custo por conversa.
                    </p>
                </div>

            </div>

            {aparelho?.conectado && (
                <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-[#E0FFEE] px-4 py-3 text-sm font-semibold text-[#08A022]">
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>
                        Conectado{aparelho.numero ? ` no número ${aparelho.numero}` : ""}.
                    </span>
                </div>
            )}

            {/* O que este caminho custa, dito antes de o lojista ler o código.
                Ele está apostando o número da loja: tem de saber disso agora,
                e não depois. */}
            {!aparelho?.conectado && (
                <div className="mt-5 rounded-lg bg-[#FFF6E0] px-4 py-3 text-sm text-[#8A6C1B]">
                    <p className="flex items-center gap-2 font-semibold">
                        <FiAlertTriangle className="w-4 shrink-0" aria-hidden />
                        Antes de ler, saiba de duas coisas
                    </p>

                    <ul className="mt-1.5 list-disc space-y-1 pl-8">
                        <li>
                            Este jeito de conectar não é autorizado pela Meta. Ela bane
                            números que detecta, e o número banido é o da sua loja.
                        </li>
                        <li>
                            A conexão cai de tempos em tempos e você precisa ler o código
                            de novo. Enquanto estiver caída, as mensagens continuam
                            chegando no seu celular — só não aparecem aqui.
                        </li>
                    </ul>

                    <p className="mt-2">
                        Quem quiser a conexão oficial da Meta, sem esses dois problemas,
                        usa a opção abaixo.
                    </p>
                </div>
            )}

            {esperando && aparelho?.qr && (
                <div className="mt-6 flex flex-col items-center">

                    {/* eslint-disable-next-line @next/next/no-img-element -- o QR vem pronto do servidor, como data URI */}
                    <img
                        src={aparelho.qr}
                        alt="Código QR para conectar o WhatsApp"
                        className="h-64 w-64 rounded-lg border border-[#D3DADD] bg-white p-2"
                    />

                    <ol className="mt-5 max-w-sm list-decimal space-y-1.5 pl-5 text-sm text-[#5A6469]">
                        <li>Abra o WhatsApp no celular da loja.</li>
                        <li>
                            Toque em <strong>Mais opções</strong> (ou <strong>Ajustes</strong>,
                            no iPhone) e depois em <strong>Aparelhos conectados</strong>.
                        </li>
                        <li>Toque em <strong>Conectar aparelho</strong> e aponte para esta tela.</li>
                    </ol>

                    <p className="mt-3 text-xs text-[#8C969B]">
                        O código muda sozinho a cada poucos segundos — não precisa
                        atualizar a página.
                    </p>

                </div>
            )}

            {esperando && !aparelho?.qr && (
                <p className="mt-6 text-center text-sm text-[#5A6469]">
                    Gerando o código...
                </p>
            )}

            {aparelho?.estado === "erro" && aparelho.erro && (
                <div
                    role="alert"
                    className="mt-5 flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]"
                >
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{aparelho.erro}</span>
                </div>
            )}

            {erro && (
                <div
                    role="alert"
                    className="mt-5 flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]"
                >
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">

                <button
                    type="button"
                    onClick={conectar}
                    disabled={gerando}
                    className="btn btn-primario"
                >
                    <FiRefreshCw className="w-4" aria-hidden />
                    {gerando
                        ? "Gerando..."
                        : esperando
                            ? "Gerar outro código"
                            : aparelho?.conectado
                                ? "Reconectar"
                                : "Gerar código QR"}
                </button>

                {aparelho?.conectado && (
                    <button
                        type="button"
                        onClick={desvincular}
                        disabled={desvinculando}
                        className="ml-auto rounded-lg px-3 py-2 text-sm font-bold text-[#D4351C] transition-colors hover:bg-[#FDECEA] disabled:opacity-50"
                    >
                        {desvinculando ? "Desvinculando..." : "Desvincular"}
                    </button>
                )}

            </div>

        </section>
    )
}
