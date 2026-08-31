"use client"

import { useCallback, useEffect, useState } from "react"
import {
    abrirPortalCobranca,
    avisarAssinaturaAlterada,
    consultarAssinatura,
    consultarPlanosDaLoja,
    descreverPlano,
    descreverStatus,
    formatarCentavos,
    formatarData,
    formatarPreco,
    iniciarPagamento,
    pedirPreviaDaTroca,
    trocarPlano,
} from "@/middleware/assinatura"
import type { Assinatura, Plano, PlanoOferta, PreviaTroca } from "@/app/type/type"
import {
    FiAlertCircle,
    FiAlertTriangle,
    FiCheck,
    FiCheckCircle,
    FiCreditCard,
    FiExternalLink,
    FiGlobe,
    FiLock,
    FiRefreshCw,
} from "react-icons/fi"

export default function AssinaturaPage() {
    const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
    // Planos, preços e o que cada um inclui vêm do backend — nada disso é
    // escrito aqui, para a tela não discordar do que o Stripe cobra.
    const [planos, setPlanos] = useState<PlanoOferta[]>([])
    const [carregando, setCarregando] = useState(true)
    // Guarda qual plano está abrindo o pagamento, para o botão certo mostrar
    // "Abrindo..." quando há dois deles na tela.
    const [enviando, setEnviando] = useState<"" | "portal" | Plano>("")
    const [erro, setErro] = useState("")

    // Contador de recargas: mexer nele é o que dispara o efeito de novo,
    // no lugar de chamar a busca direto do botão. Assim toda a escrita de
    // estado acontece depois do await, dentro do efeito — chamar setState
    // de forma síncrona no corpo de um efeito provoca renders em cascata.
    const [recarregar, setRecarregar] = useState(0)

    // Trocar de plano mexe em dinheiro: sobe cobrando a diferença no cartão
    // na hora, desce tirando telas do painel. Por isso a troca passa por uma
    // confirmação, e o texto dela vem do backend — é lá que se sabe o valor
    // exato, porque é lá que ele é calculado com o Stripe.
    const [previa, setPrevia] = useState<PreviaTroca | null>(null)
    const [confirmando, setConfirmando] = useState(false)

    useEffect(() => {
        let cancelado = false

        async function buscar() {
            try {
                const dados = await consultarAssinatura()

                if (cancelado) return

                setAssinatura(dados)
                setErro("")

                // O catálogo é secundário: se falhar, a tela ainda mostra a
                // situação da assinatura, que é o que mais importa aqui.
                try {
                    const catalogo = await consultarPlanosDaLoja()
                    if (!cancelado) setPlanos(catalogo.planos ?? [])
                } catch {
                    // segue sem a lista de planos
                }
            } catch (e) {
                if (cancelado) return

                setErro(e instanceof Error ? e.message : "Erro ao consultar a assinatura")
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        buscar()

        return () => {
            cancelado = true
        }
    }, [recarregar])

    const carregar = useCallback(() => setRecarregar((n) => n + 1), [])

    // O pagamento acontece numa página do Stripe, fora daqui. Por isso a
    // navegação é uma troca de endereço de verdade (location.assign) e não
    // router.push: o destino é outro domínio.
    async function irParaPagamento(plano: Plano) {
        setErro("")
        setEnviando(plano)

        try {
            window.location.assign(await iniciarPagamento(plano))
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível iniciar o pagamento")
            setEnviando("")
        }
    }

    // Quem já assina não passa por checkout de novo: a assinatura que existe
    // muda de preço. O Stripe acerta a diferença do mês.
    //
    // O clique não troca nada ainda: pede a prévia ao backend e abre o aviso.
    // A troca de verdade só sai de confirmarTroca, com o "eu vi o valor".
    async function irParaTroca(plano: Plano) {
        setErro("")
        setEnviando(plano)

        try {
            setPrevia(await pedirPreviaDaTroca(plano))
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível trocar de plano")
        } finally {
            setEnviando("")
        }
    }

    async function confirmarTroca() {
        if (!previa) return

        setErro("")
        setConfirmando(true)

        try {
            await trocarPlano(previa.plano, true)
            setPrevia(null)
            // O menu lateral muda junto com o plano: telas entram ou saem.
            avisarAssinaturaAlterada()
            carregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível trocar de plano")
            setPrevia(null)
        } finally {
            setConfirmando(false)
        }
    }

    async function irParaPortal() {
        setErro("")
        setEnviando("portal")

        try {
            window.location.assign(await abrirPortalCobranca())
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível abrir o portal de cobrança")
            setEnviando("")
        }
    }

    if (carregando) {
        return (
            <main className="mx-auto max-w-3xl px-4 py-10">
                <div className="card p-8 text-center text-sm text-[#5A6469]">
                    Carregando assinatura...
                </div>
            </main>
        )
    }

    const liberada = assinatura?.liberada ?? false
    const cobrancaAtiva = assinatura?.cobranca_ativa ?? false
    const jaTemCadastroNoStripe = Boolean(assinatura && assinatura.status !== "sem_assinatura")
    const planoAtual: Plano = assinatura?.plano ?? "estoque"
    const temSite = assinatura?.site_liberado ?? false

    return (
        <main className="mx-auto max-w-3xl px-4 py-10">

            <h1 className="font-display text-2xl text-[#1E2428]">
                Assinatura
            </h1>

            <p className="mt-1 text-sm text-[#5A6469]">
                O acesso ao painel depende da assinatura mensal da sua loja, e a
                vitrine pública depende do plano contratado.
            </p>

            {/* SITUAÇÃO ATUAL */}
            <section className="card mt-6 p-6 sm:p-7">

                <div className="flex items-start gap-3">

                    <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                            liberada
                                ? "bg-[#E7F8EE] text-[#1E9E5A]"
                                : "bg-[#FDECEA] text-[#D4351C]"
                        }`}
                    >
                        {liberada
                            ? <FiCheckCircle className="w-5" aria-hidden />
                            : <FiLock className="w-5" aria-hidden />}
                    </div>

                    <div className="min-w-0 flex-1">

                        <p className="font-display text-lg text-[#1E2428]">
                            {assinatura ? descreverStatus(assinatura) : "Situação desconhecida"}
                        </p>

                        <p className="mt-1 text-sm text-[#5A6469]">
                            {liberada
                                ? "Seu painel está liberado."
                                : "Seu painel está bloqueado até o pagamento ser confirmado."}
                        </p>

                        {cobrancaAtiva && liberada && (
                            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#5A6469]">
                                <span>Plano atual:</span>
                                <span className="tag tag-info">{descreverPlano(planoAtual)}</span>
                                <span className={`tag ${temSite ? "tag-success" : "tag-neutral"}`}>
                                    <FiGlobe className="w-3" aria-hidden />
                                    {temSite ? "vitrine no ar" : "sem vitrine"}
                                </span>
                            </p>
                        )}

                        {/* Quem cancelou no meio do mês continua com acesso até o
                            fim do período que já pagou — vale explicar, senão a
                            data parece contradizer o status "cancelada". */}
                        {assinatura?.periodo_fim_em && (
                            <p className="mt-3 text-sm text-[#5A6469]">
                                Período pago até{" "}
                                <strong className="text-[#1E2428]">
                                    {formatarData(assinatura.periodo_fim_em)}
                                </strong>
                            </p>
                        )}

                        {assinatura?.tolerancia_ate && (
                            <p className="mt-1 text-sm text-[#5A6469]">
                                Prazo para regularizar:{" "}
                                <strong className="text-[#1E2428]">
                                    {formatarData(assinatura.tolerancia_ate)}
                                </strong>
                            </p>
                        )}

                    </div>

                    <button
                        type="button"
                        onClick={carregar}
                        title="Atualizar"
                        aria-label="Atualizar situação da assinatura"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5A6469] transition-colors hover:bg-[#F0F3F4]"
                    >
                        <FiRefreshCw className="w-4" aria-hidden />
                    </button>

                </div>

                {erro && (
                    <div
                        role="alert"
                        className="mt-5 flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]"
                    >
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                {!cobrancaAtiva && (
                    <p className="mt-5 rounded-lg bg-[#F0F3F4] px-4 py-3 text-sm text-[#5A6469]">
                        Este servidor está rodando sem cobrança configurada, então o
                        painel fica liberado para todos. É o esperado em
                        desenvolvimento.
                    </p>
                )}

                {cobrancaAtiva && (
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">

                        {jaTemCadastroNoStripe && (
                            <button
                                type="button"
                                onClick={irParaPortal}
                                disabled={enviando !== ""}
                                className="btn btn-secundario flex items-center justify-center gap-2"
                            >
                                <FiExternalLink className="w-4" aria-hidden />
                                {enviando === "portal" ? "Abrindo portal..." : "Gerenciar cobrança"}
                            </button>
                        )}

                    </div>
                )}

            </section>

            {/* PLANOS
                Aparece para todo mundo: quem ainda não assina escolhe aqui, e
                quem já assina troca aqui mesmo. A troca NÃO passa por um
                checkout novo (isso criaria uma segunda cobrança mensal) — ela
                muda o preço da assinatura que já existe. */}
            {cobrancaAtiva && planos.length > 0 && (
                <section className="mt-6">

                    <h2 className="font-display text-lg text-[#1E2428]">
                        {liberada ? "Planos disponíveis" : "Escolha o seu plano"}
                    </h2>

                    <p className="mt-1 text-sm text-[#5A6469]">
                        {liberada
                            ? "Trocar de plano vale na hora. O Stripe acerta a diferença do mês: subindo, cobra a diferença proporcional; descendo, vira crédito na próxima fatura."
                            : "A diferença entre eles é a loja na internet e o limite de peças."}
                    </p>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {planos.map((plano) => {

                            const ehAtual = liberada && plano.chave === planoAtual

                            return (
                                <article key={plano.chave} className="card flex flex-col p-6">

                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-display text-lg text-[#1E2428]">
                                            {plano.nome}
                                        </p>

                                        {ehAtual && (
                                            <span className="tag tag-success shrink-0">
                                                seu plano
                                            </span>
                                        )}
                                    </div>

                                    <p className="mt-1 text-sm text-[#5A6469]">
                                        {plano.descricao}
                                    </p>

                                    <div className="mt-4 flex items-baseline gap-1.5 border-b border-[#E4E9EB] pb-5">
                                        <span className="font-display text-3xl text-[#1E2428]">
                                            {formatarPreco(plano.preco)}
                                        </span>
                                        <span className="text-sm font-bold text-[#5A6469]">/mês</span>
                                    </div>

                                    {plano.teste_dias ? (
                                        <p className="mt-3 text-sm font-semibold text-[#08A022]">
                                            {plano.teste_dias} dias grátis para começar
                                        </p>
                                    ) : null}

                                    <ul className="mt-5 mb-6 space-y-2">
                                        {plano.recursos.map((item) => (
                                            <li
                                                key={item}
                                                className="flex items-start gap-2 text-sm text-[#1E2428]"
                                            >
                                                <FiCheck className="mt-0.5 w-4 shrink-0 text-[#08A022]" aria-hidden />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>

                                    {ehAtual ? (
                                        <p className="mt-auto rounded-lg bg-[#F0F3F4] px-4 py-3 text-center text-sm font-semibold text-[#5A6469]">
                                            É o plano que você usa hoje
                                        </p>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => liberada ? irParaTroca(plano.chave) : irParaPagamento(plano.chave)}
                                            disabled={enviando !== ""}
                                            className={`btn mt-auto w-full items-center justify-center gap-2 ${
                                                plano.chave === "site" ? "btn-primario" : "btn-secundario"
                                            }`}
                                        >
                                            <FiCreditCard className="w-4" aria-hidden />
                                            {enviando === plano.chave
                                                ? (liberada ? "Calculando..." : "Abrindo pagamento...")
                                                : (liberada ? `Trocar para ${plano.nome}` : `Assinar ${plano.nome}`)}
                                        </button>
                                    )}

                                </article>
                            )
                        })}
                    </div>

                </section>
            )}

            {/* AVISO DA TROCA DE PLANO
                Título, texto e rótulo do botão vêm prontos do backend: o
                valor da cobrança é calculado lá, com o Stripe, e escrever a
                frase aqui seria arriscar dizer um número diferente do que a
                fatura cobra. */}
            {previa && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="titulo-troca"
                    className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E2428]/50 p-4 sm:items-center"
                >
                    <div className="card w-full max-w-lg p-6 sm:p-7">

                        <div className="flex items-start gap-3">
                            <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                                    previa.cobra_agora
                                        ? "bg-[#FFF4E5] text-[#B25E00]"
                                        : "bg-[#E6F3FF] text-[#0075E2]"
                                }`}
                            >
                                {previa.cobra_agora
                                    ? <FiAlertTriangle className="w-5" aria-hidden />
                                    : <FiAlertCircle className="w-5" aria-hidden />}
                            </div>

                            <div className="min-w-0 flex-1">
                                <p id="titulo-troca" className="font-display text-lg text-[#1E2428]">
                                    {previa.titulo}
                                </p>

                                <p className="mt-0.5 text-sm text-[#5A6469]">
                                    Saindo do {previa.plano_atual_nome}
                                </p>
                            </div>
                        </div>

                        {/* O valor em destaque: é a informação que o lojista
                            precisa ver antes de qualquer texto. */}
                        {previa.cobra_agora && (
                            <p className="mt-5 rounded-lg bg-[#FFF4E5] px-4 py-3 text-sm font-semibold text-[#B25E00]">
                                Será cobrado agora{" "}
                                <strong className="font-display text-lg">
                                    {formatarCentavos(previa.valor_agora, previa.moeda)}
                                </strong>{" "}
                                no seu cartão.
                            </p>
                        )}

                        <p className="mt-4 text-sm leading-relaxed text-[#1E2428]">
                            {previa.aviso}
                        </p>

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
                            <button
                                type="button"
                                onClick={confirmarTroca}
                                disabled={confirmando}
                                className="btn btn-primario flex flex-1 items-center justify-center gap-2"
                            >
                                <FiCreditCard className="w-4" aria-hidden />
                                {confirmando ? "Trocando..." : previa.rotulo_confirmar}
                            </button>

                            <button
                                type="button"
                                onClick={() => setPrevia(null)}
                                disabled={confirmando}
                                className="btn btn-neutro flex-1"
                            >
                                Cancelar
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* Explicação de onde o cartão é digitado. Não é enfeite: o lojista
                está prestes a sair do domínio do painel e ver outra marca na
                barra de endereço, e sem aviso isso parece golpe. */}
            {cobrancaAtiva && (
                <p className="mt-5 flex items-start gap-2 text-xs text-[#5A6469]">
                    <FiLock className="mt-0.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                        O pagamento é processado pelo Stripe. Os dados do seu cartão
                        são digitados no site dele e nunca passam por este sistema.
                    </span>
                </p>
            )}

        </main>
    )
}
