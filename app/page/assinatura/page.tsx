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
    trocarDePlano,
} from "@/middleware/assinatura"
import type { Assinatura, Oferta } from "@/app/type/type"
import { Pagina } from "@/app/components/pagina/pagina"
import { irParaPaginaExterna } from "@/security/navegacao"
import {
    FiAlertCircle,
    FiArrowUpRight,
    FiCheck,
    FiCheckCircle,
    FiCreditCard,
    FiExternalLink,
    FiLock,
    FiPlus,
    FiRefreshCw,
} from "react-icons/fi"

export default function AssinaturaPage() {
    const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
    // Preço e o que a assinatura inclui vêm do backend — nada disso é escrito
    // aqui, para a tela não discordar do que a fatura cobra.
    const [oferta, setOferta] = useState<Oferta | null>(null)
    // Esta loja já está no Pro? Quem responde é o backend, a partir do preço
    // gravado na assinatura — a tela não deduz isso de ter mais de uma loja.
    const [noPro, setNoPro] = useState(false)
    const [carregando, setCarregando] = useState(true)
    const [enviando, setEnviando] = useState<"" | "portal" | "assinar" | "pro">("")
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

                    if (!cancelado) {
                        setOferta(catalogo.oferta ?? null)
                        setNoPro(catalogo.plano_pro ?? false)
                    }
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
    async function irParaPagamento(plano: "base" | "pro" = "base") {
        setErro("")
        setEnviando(plano === "pro" ? "pro" : "assinar")

        try {
            irParaPaginaExterna(await iniciarPagamento(plano))
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível iniciar o pagamento")
            setEnviando("")
        }
    }

    /**
     * Troca o plano de quem já assina, e recarrega a página inteira.
     *
     * O reload é de verdade (location.reload) e não um re-render: o menu do
     * painel vem do servidor já resolvido para o plano contratado, e sem
     * recarregar o lojista pagaria o Pro e continuaria vendo "Minhas lojas"
     * em cinza.
     */
    async function mudarDePlano(plano: "base" | "pro") {
        setErro("")
        setEnviando(plano === "pro" ? "pro" : "assinar")

        try {
            await trocarDePlano(plano)
            window.location.reload()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível trocar de plano")
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
            <Pagina titulo="Assinatura">
                <div className="card p-8 text-center text-sm text-[#616161]">
                    Carregando assinatura...
                </div>
            </Pagina>
        )
    }

    const liberada = assinatura?.liberada ?? false
    const cobrancaAtiva = assinatura?.cobranca_ativa ?? false
    const jaTemCadastroNoStripe = Boolean(assinatura && assinatura.status !== "sem_assinatura")

    // Assinatura correndo no Stripe: é só nesses dois status que existe uma
    // próxima cobrança marcada.
    const emCobranca = assinatura?.status === "active" || assinatura?.status === "trialing"

    // Em teste o painel abre inteiro e nada foi cobrado ainda — e é
    // justamente por isso que o aviso precisa estar à vista: quem não vê a
    // data descobre que o teste acabou no dia em que o sistema fecha.
    const emTeste = assinatura?.em_teste ?? assinatura?.status === "trialing"
    return (
        <Pagina
            titulo="Assinatura"
            descricao="O painel e a sua loja na internet dependem da assinatura mensal estar em dia."
        >

            {/* SITUAÇÃO ATUAL */}
            <section className="card p-6 sm:p-7">

                <div className="flex items-start gap-3">

                    <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                            liberada
                                ? "bg-[#EAFBF1] text-[#0C5132]"
                                : "bg-[#FEE9E8] text-[#8E1F0B]"
                        }`}
                    >
                        {liberada
                            ? <FiCheckCircle className="w-5" aria-hidden />
                            : <FiLock className="w-5" aria-hidden />}
                    </div>

                    <div className="min-w-0 flex-1">

                        <p className="font-display text-lg text-[#303030]">
                            {assinatura ? descreverStatus(assinatura) : "Situação desconhecida"}
                        </p>

                        <p className="mt-1 text-sm text-[#616161]">
                            {emTeste
                                ? "Seu teste está valendo: o painel abre inteiro e nada foi cobrado até aqui."
                                : liberada
                                    ? "Seu painel está liberado."
                                    : "Seu painel está bloqueado até o pagamento ser confirmado."}
                        </p>

                        {/* Quem cancelou no meio do mês continua com acesso até o
                            fim do período que já pagou — vale explicar, senão a
                            data parece contradizer o status "cancelada". */}
                        {assinatura?.pago_ate && (
                            <p className="mt-3 text-sm text-[#616161]">
                                Período pago até{" "}
                                <strong className="text-[#303030]">
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
                            <p className="mt-1 text-sm text-[#616161]">
                                {emTeste ? "Teste até" : "Próxima cobrança em"}{" "}
                                <strong className="text-[#303030]">
                                    {formatarData(assinatura.periodo_fim_em)}
                                </strong>
                                {emTeste ? " — é nesse dia que a primeira cobrança acontece." : ""}
                            </p>
                        )}

                        {assinatura?.tolerancia_ate && (
                            <p className="mt-1 text-sm text-[#616161]">
                                Prazo para regularizar:{" "}
                                <strong className="text-[#303030]">
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
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[#616161] transition-colors hover:bg-[#F1F1F1]"
                    >
                        <FiRefreshCw className="w-4" aria-hidden />
                    </button>

                </div>

                {erro && (
                    <div
                        role="alert"
                        className="mt-5 flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]"
                    >
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                {!cobrancaAtiva && (
                    <p className="mt-5 rounded-lg bg-[#F1F1F1] px-4 py-3 text-sm text-[#616161]">
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
                Quem ainda não assina contrata aqui; quem já assina vê o que
                está pagando — o que muda entre os dois casos é só o botão no
                fim do cartão.
                O Pro vem logo abaixo, e só quando este servidor o tem à
                venda. Embaixo e não ao lado porque os dois cartões não são
                comparáveis em tamanho: o base lista o sistema inteiro, e o
                Pro lista o punhado de telas que ele acrescenta. */}
            {cobrancaAtiva && oferta && (
                <section>

                    <h2 className="font-display text-lg text-[#303030]">
                        {emTeste
                            ? "Continuar depois do teste"
                            : liberada
                                ? "A sua assinatura"
                                : "Assine para liberar o painel"}
                    </h2>

                    <article className="card mt-4 flex flex-col p-6">

                        <div className="flex items-start justify-between gap-2">
                            <p className="font-display text-lg text-[#303030]">
                                {oferta.nome}
                            </p>

                            {liberada && (
                                <span className={`shrink-0 tag ${emTeste ? "tag-info" : "tag-success"}`}>
                                    {emTeste ? "em teste" : "ativa"}
                                </span>
                            )}
                        </div>

                        <p className="mt-1 text-sm text-[#616161]">
                            {oferta.descricao}
                        </p>

                        <div className="mt-4 flex items-baseline gap-1.5 border-b border-[#EBEBEB] pb-5">
                            <span className="font-display text-3xl text-[#303030]">
                                {formatarPreco(oferta.preco)}
                            </span>
                            <span className="text-sm font-bold text-[#616161]">/mês</span>
                        </div>

                        <ul className="mt-5 mb-6 grid gap-2 sm:grid-cols-2">
                            {oferta.recursos.map((item) => (
                                <li
                                    key={item}
                                    className="flex items-start gap-2 text-sm text-[#303030]"
                                >
                                    <FiCheck className="mt-0.5 w-4 shrink-0 text-[#0C5132]" aria-hidden />
                                    {item}
                                </li>
                            ))}
                        </ul>

                        {liberada && !emTeste ? (
                            <p className="mt-auto rounded-lg bg-[#F1F1F1] px-4 py-3 text-center text-sm font-semibold text-[#616161]">
                                Você já tem tudo isso liberado
                            </p>
                        ) : (
                            /* Em teste o caminho é o portal, e não um checkout
                               novo: a assinatura JÁ existe (é ela que está
                               correndo o teste), e abrir outro criaria uma
                               segunda cobrança mensal na mesma loja — o
                               servidor recusa isso, com razão. No portal o
                               lojista só acrescenta o cartão que faltava. */
                            <button
                                type="button"
                                onClick={() => (emTeste ? irParaPortal() : irParaPagamento("base"))}
                                disabled={enviando !== ""}
                                className="btn btn-primario mt-auto w-full items-center justify-center gap-2"
                            >
                                <FiCreditCard className="w-4" aria-hidden />
                                {enviando !== ""
                                    ? emTeste ? "Abrindo portal..." : "Abrindo pagamento..."
                                    : emTeste
                                        ? "Cadastrar cartão e continuar"
                                        : "Assinar agora"}
                            </button>
                        )}

                    </article>

                    {/* O PRO
                        Só existe quando o servidor tem o preço dele
                        configurado — sem isso o cartão não apareceria com
                        valor nenhum, e anunciar um plano que o checkout não
                        consegue cobrar é pior do que não anunciar. */}
                    {oferta.pro && (
                        <article className="card mt-4 flex flex-col p-6">

                            <div className="flex items-start justify-between gap-2">
                                <p className="font-display text-lg text-[#303030]">
                                    {oferta.nome} Pro
                                </p>

                                {noPro && (
                                    <span className="shrink-0 tag tag-success">seu plano</span>
                                )}
                            </div>

                            <p className="mt-1 text-sm text-[#616161]">
                                Tudo do {oferta.nome}, mais a sua equipe dentro do painel
                                e até {oferta.pro.lojas} lojas na mesma conta.
                            </p>

                            <div className="mt-4 flex items-baseline gap-1.5 border-b border-[#EBEBEB] pb-5">
                                <span className="font-display text-3xl text-[#303030]">
                                    {formatarPreco(oferta.pro.preco)}
                                </span>
                                <span className="text-sm font-bold text-[#616161]">/mês</span>
                            </div>

                            <ul className="mt-5 mb-6 grid gap-2 sm:grid-cols-2">
                                {oferta.pro.recursos.map((item) => (
                                    <li
                                        key={item}
                                        className="flex items-start gap-2 text-sm text-[#303030]"
                                    >
                                        <FiPlus className="mt-0.5 w-4 shrink-0 text-[#0C5132]" aria-hidden />
                                        {item}
                                    </li>
                                ))}
                            </ul>

                            {noPro ? (
                                <p className="mt-auto rounded-lg bg-[#F1F1F1] px-4 py-3 text-center text-sm font-semibold text-[#616161]">
                                    Você já está no Pro
                                </p>
                            ) : (
                                /* Dois caminhos, e a diferença é ter ou não
                                   assinatura correndo.

                                   Quem já tem TROCA o plano da que existe: um
                                   checkout novo criaria uma segunda cobrança
                                   mensal na mesma loja, e o servidor o recusa.
                                   A troca acontece aqui e não no portal de
                                   cobrança porque só aqui a subida é faturada
                                   na hora — no portal ela ficaria para a
                                   fatura seguinte, que o lojista evita
                                   descendo de plano antes de ela fechar.

                                   Quem ainda não assina vai para o checkout,
                                   já no preço do Pro. */
                                <button
                                    type="button"
                                    onClick={() => (liberada ? mudarDePlano("pro") : irParaPagamento("pro"))}
                                    disabled={enviando !== ""}
                                    className="btn btn-neutro mt-auto w-full items-center justify-center gap-2"
                                >
                                    <FiArrowUpRight className="w-4" aria-hidden />
                                    {enviando !== ""
                                        ? liberada ? "Trocando de plano..." : "Abrindo pagamento..."
                                        : liberada
                                            ? "Mudar para o Pro"
                                            : "Assinar o Pro"}
                                </button>
                            )}

                        </article>
                    )}

                </section>
            )}

            {/* Explicação de onde o cartão é digitado. Não é enfeite: o lojista
                está prestes a sair do domínio do painel e ver outra marca na
                barra de endereço, e sem aviso isso parece golpe. */}
            {cobrancaAtiva && (
                <p className="flex items-start gap-2 text-xs text-[#616161]">
                    <FiLock className="mt-0.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                        Os dados do seu cartão são digitados numa página segura do
                        processador de cobrança e nunca passam por este sistema.
                    </span>
                </p>
            )}

        </Pagina>
    )
}
