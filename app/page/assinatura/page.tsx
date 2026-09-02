"use client"

import { useCallback, useEffect, useState } from "react"
import {
    abrirPortalCobranca,
    consultarAssinatura,
    consultarOferta,
    descreverStatus,
    formatarData,
    formatarPreco,
    iniciarPagamento,
} from "@/middleware/assinatura"
import type { Assinatura, Oferta } from "@/app/type/type"
import { irParaPaginaExterna } from "@/security/navegacao"
import {
    FiAlertCircle,
    FiCheck,
    FiCheckCircle,
    FiCreditCard,
    FiExternalLink,
    FiLock,
    FiRefreshCw,
} from "react-icons/fi"

export default function AssinaturaPage() {
    const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
    // Preço e o que a assinatura inclui vêm do backend — nada disso é escrito
    // aqui, para a tela não discordar do que a fatura cobra.
    const [oferta, setOferta] = useState<Oferta | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [enviando, setEnviando] = useState<"" | "portal" | "assinar">("")
    const [erro, setErro] = useState("")

    // Contador de recargas: mexer nele é o que dispara o efeito de novo,
    // no lugar de chamar a busca direto do botão. Assim toda a escrita de
    // estado acontece depois do await, dentro do efeito — chamar setState
    // de forma síncrona no corpo de um efeito provoca renders em cascata.
    const [recarregar, setRecarregar] = useState(0)

    useEffect(() => {
        let cancelado = false

        async function buscar() {
            try {
                const dados = await consultarAssinatura()

                if (cancelado) return

                setAssinatura(dados)
                setErro("")

                // A oferta é secundária: se falhar, a tela ainda mostra a
                // situação da assinatura, que é o que mais importa aqui.
                try {
                    const catalogo = await consultarOferta()
                    if (!cancelado) setOferta(catalogo.oferta ?? null)
                } catch {
                    // segue sem a descrição da oferta
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

    // O pagamento acontece fora daqui, na página do provedor de cobrança. Por
    // isso a navegação é uma troca de endereço de verdade (location.assign) e
    // não router.push: o destino é outro domínio.
    async function irParaPagamento() {
        setErro("")
        setEnviando("assinar")

        try {
            irParaPaginaExterna(await iniciarPagamento())
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível iniciar o pagamento")
            setEnviando("")
        }
    }

    async function irParaPortal() {
        setErro("")
        setEnviando("portal")

        try {
            irParaPaginaExterna(await abrirPortalCobranca())
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

    // Assinatura correndo no Stripe: é só nesses dois status que existe uma
    // próxima cobrança marcada.
    const emCobranca = assinatura?.status === "active" || assinatura?.status === "trialing"
    return (
        <main className="mx-auto max-w-3xl px-4 py-10">

            <h1 className="font-display text-2xl text-[#1E2428]">
                Assinatura
            </h1>

            <p className="mt-1 text-sm text-[#5A6469]">
                O painel e a sua loja na internet dependem da assinatura mensal
                estar em dia.
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

                        {/* Quem cancelou no meio do mês continua com acesso até o
                            fim do período que já pagou — vale explicar, senão a
                            data parece contradizer o status "cancelada". */}
                        {assinatura?.pago_ate && (
                            <p className="mt-3 text-sm text-[#5A6469]">
                                Período pago até{" "}
                                <strong className="text-[#1E2428]">
                                    {formatarData(assinatura.pago_ate)}
                                </strong>
                            </p>
                        )}

                        {/* Outra data, outro assunto: esta é a da próxima
                            cobrança, e só faz sentido enquanto a assinatura
                            está correndo. Chamá-la de "período pago", como já
                            se chamou aqui, dizia a quem estava com a fatura
                            vencida que ele tinha o mês inteiro pago. */}
                        {emCobranca && assinatura?.periodo_fim_em && (
                            <p className="mt-1 text-sm text-[#5A6469]">
                                Próxima cobrança em{" "}
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

            {/* A ASSINATURA
                Uma só, com tudo dentro. Quem ainda não assina contrata aqui;
                quem já assina vê o que está pagando — o que muda entre os dois
                casos é só o botão no fim do cartão. */}
            {cobrancaAtiva && oferta && (
                <section className="mt-6">

                    <h2 className="font-display text-lg text-[#1E2428]">
                        {liberada ? "A sua assinatura" : "Assine para liberar o painel"}
                    </h2>

                    <article className="card mt-4 flex flex-col p-6">

                        <div className="flex items-start justify-between gap-2">
                            <p className="font-display text-lg text-[#1E2428]">
                                {oferta.nome}
                            </p>

                            {liberada && (
                                <span className="tag tag-success shrink-0">
                                    ativa
                                </span>
                            )}
                        </div>

                        <p className="mt-1 text-sm text-[#5A6469]">
                            {oferta.descricao}
                        </p>

                        <div className="mt-4 flex items-baseline gap-1.5 border-b border-[#E4E9EB] pb-5">
                            <span className="font-display text-3xl text-[#1E2428]">
                                {formatarPreco(oferta.preco)}
                            </span>
                            <span className="text-sm font-bold text-[#5A6469]">/mês</span>
                        </div>

                        <ul className="mt-5 mb-6 grid gap-2 sm:grid-cols-2">
                            {oferta.recursos.map((item) => (
                                <li
                                    key={item}
                                    className="flex items-start gap-2 text-sm text-[#1E2428]"
                                >
                                    <FiCheck className="mt-0.5 w-4 shrink-0 text-[#08A022]" aria-hidden />
                                    {item}
                                </li>
                            ))}
                        </ul>

                        {liberada ? (
                            <p className="mt-auto rounded-lg bg-[#F0F3F4] px-4 py-3 text-center text-sm font-semibold text-[#5A6469]">
                                Você já tem tudo isso liberado
                            </p>
                        ) : (
                            <button
                                type="button"
                                onClick={irParaPagamento}
                                disabled={enviando !== ""}
                                className="btn btn-primario mt-auto w-full items-center justify-center gap-2"
                            >
                                <FiCreditCard className="w-4" aria-hidden />
                                {enviando === "assinar" ? "Abrindo pagamento..." : "Assinar agora"}
                            </button>
                        )}

                    </article>

                </section>
            )}

            {/* Explicação de onde o cartão é digitado. Não é enfeite: o lojista
                está prestes a sair do domínio do painel e ver outra marca na
                barra de endereço, e sem aviso isso parece golpe. */}
            {cobrancaAtiva && (
                <p className="mt-5 flex items-start gap-2 text-xs text-[#5A6469]">
                    <FiLock className="mt-0.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                        Os dados do seu cartão são digitados numa página segura do
                        processador de cobrança e nunca passam por este sistema.
                    </span>
                </p>
            )}

        </main>
    )
}
