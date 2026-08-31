// Assinatura mensal que libera o painel. Todo o estado vem do backend, que
// por sua vez só o recebe do Stripe por webhook assinado — nada aqui decide
// se alguém pagou, e nenhum dado de cartão passa pelo navegador ou pelo
// nosso servidor: o cartão é digitado na página do próprio Stripe.

import { ApiError, apiFetch } from "./client"
import type { Assinatura, ItemMenu, Plano, PlanoOferta, PreviaTroca, PrecoPlano } from "@/app/type/type"

interface RespostaLink {
    url: string
}

export async function consultarAssinatura(): Promise<Assinatura> {
    return apiFetch<Assinatura>("/api/assinatura")
}

/**
 * Planos à venda para quem ainda não tem conta, com o preço lido do Stripe
 * pelo backend. É o que a tela de cadastro mostra no passo dos planos.
 */
export async function consultarPlanosPublicos(): Promise<{
    cobranca_ativa: boolean
    teste_dias?: number
    planos: PlanoOferta[]
}> {
    return apiFetch("/api/planos")
}

/** "R$ 99,90" a partir dos centavos que o backend devolve. */
export function formatarPreco(preco?: PrecoPlano): string {
    if (!preco) return "—"

    return formatarCentavos(preco.centavos, preco.moeda)
}

/** O mesmo, para valores soltos (a prévia da troca manda centavos crus). */
export function formatarCentavos(centavos: number, moeda?: string): string {
    return (centavos / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: (moeda || "brl").toUpperCase(),
    })
}

/**
 * Nomes de tela dos planos. Só texto: preço, descrição e o que cada um
 * inclui vêm do backend (ver consultarPlanosPublicos e consultarPlanosDaLoja),
 * que por sua vez lê os valores do próprio Stripe.
 *
 * Preço escrito no front é preço que um dia diverge do que a fatura cobra —
 * foi o que aconteceu aqui quando esta lista dizia "R$ 100" e o Stripe
 * cobrava R$ 99,90.
 */
export const NOMES_DE_PLANO: Record<Plano, string> = {
    gratis: "Grátis",
    estoque: "Estoque",
    site: "Estoque + Site",
}

/** Nome de tela de um plano. */
export function descreverPlano(plano: Plano): string {
    return NOMES_DE_PLANO[plano] ?? "Estoque"
}

/**
 * Abre uma sessão de pagamento para o plano escolhido e devolve a URL
 * hospedada pelo Stripe. Quem chama deve levar o navegador até ela com
 * `window.location.href`.
 *
 * Só o nome do plano é enviado: o preço correspondente é resolvido no
 * backend, para o navegador não ter como assinar um plano pagando o outro.
 */
export async function iniciarPagamento(plano: Plano): Promise<string> {
    const dados = await apiFetch<RespostaLink>("/api/assinatura/checkout", {
        method: "POST",
        body: { plano },
    })
    return dados.url
}

/**
 * Devolve a URL do portal de cobrança do Stripe, onde o lojista troca o
 * cartão, vê as faturas e cancela a assinatura sozinho.
 */
export async function abrirPortalCobranca(): Promise<string> {
    const dados = await apiFetch<RespostaLink>("/api/assinatura/portal", {
        method: "POST",
    })
    return dados.url
}

/**
 * Planos vistos por quem já está logado: a mesma lista pública, com o plano
 * atual marcado.
 */
export async function consultarPlanosDaLoja(): Promise<{
    cobranca_ativa: boolean
    plano_atual: Plano
    tem_assinatura: boolean
    pode_testar?: boolean
    teste_dias?: number
    planos: PlanoOferta[]
}> {
    return apiFetch("/api/assinatura/planos")
}

/**
 * Troca o plano de uma assinatura que já existe, sem passar por checkout
 * novo — abrir um segundo checkout criaria uma segunda cobrança mensal.
 *
 * A diferença proporcional do mês é acertada pelo Stripe: subindo de plano
 * ela é cobrada na hora, descendo vira crédito na fatura seguinte, e durante
 * o teste grátis nada é cobrado.
 *
 * `confirmar` é o "eu vi o aviso". Sem ele o backend recusa a troca com 428 e
 * devolve a prévia da cobrança — ver pedirPreviaDaTroca, que é como a tela
 * consegue o texto a mostrar antes de perguntar.
 */
export async function trocarPlano(plano: Plano, confirmar = false): Promise<Assinatura> {
    return apiFetch<Assinatura>("/api/assinatura/plano", {
        method: "POST",
        body: { plano, confirmar },
    })
}

/** Status que o backend usa para "confirme antes de eu cobrar". */
const STATUS_CONFIRMACAO_NECESSARIA = 428

/**
 * Pergunta ao backend o que aconteceria ao trocar de plano, sem trocar nada:
 * quanto entra no cartão agora, quanto passa a custar por mês e quais telas
 * a loja ganha ou perde.
 *
 * A pergunta é a própria troca sem confirmação: o backend a recusa com 428 e
 * responde a prévia. Assim não existe caminho em que a tela mostre um valor
 * calculado de um jeito e a troca cobre de outro — é a mesma conta, do mesmo
 * pedido.
 */
export async function pedirPreviaDaTroca(plano: Plano): Promise<PreviaTroca> {
    try {
        await trocarPlano(plano)
    } catch (e) {
        if (e instanceof ApiError && e.status === STATUS_CONFIRMACAO_NECESSARIA) {
            const previa = (e.dados as { previa?: PreviaTroca } | null)?.previa

            if (previa) return previa
        }

        throw e
    }

    // Chegar aqui significa que a troca aconteceu sem confirmação, o que o
    // backend não deveria permitir. Melhor falhar alto do que seguir como se
    // o lojista tivesse confirmado algo.
    throw new Error("O servidor trocou o plano sem pedir confirmação")
}

/**
 * Nome do evento que o painel dispara quando o plano da loja muda. O menu
 * lateral escuta e se remonta: a troca de plano acabou de tirar (ou pôr)
 * telas, e deixá-las na tela até o próximo F5 é oferecer o que não existe.
 */
export const EVENTO_ASSINATURA_ALTERADA = "assinatura-alterada"

/** Avisa o painel de que o plano mudou (ver EVENTO_ASSINATURA_ALTERADA). */
export function avisarAssinaturaAlterada(): void {
    if (typeof window === "undefined") return

    window.dispatchEvent(new Event(EVENTO_ASSINATURA_ALTERADA))
}

/**
 * O menu do painel desta loja: só as telas que o plano contratado inclui,
 * já na ordem e nas seções em que devem aparecer.
 *
 * Quem monta é o backend (ver internal/services/assinatura/recursos.go).
 * Uma lista fixa aqui teria de repetir a regra de plano — e ofereceria ao
 * lojista telas que a API recusaria abrir.
 */
export async function consultarMenu(): Promise<ItemMenu[]> {
    const assinatura = await consultarAssinatura()
    return assinatura.menu ?? []
}

/** Texto amigável para cada status vindo do Stripe. */
export function descreverStatus(assinatura: Assinatura): string {
    if (!assinatura.cobranca_ativa) {
        return "Cobrança desativada neste servidor"
    }

    switch (assinatura.status) {
        case "active":
            return "Assinatura ativa"
        case "trialing":
            return "Período de teste"
        case "past_due":
            return "Pagamento atrasado"
        case "unpaid":
            return "Assinatura não paga"
        case "canceled":
            return "Assinatura cancelada"
        case "incomplete":
        case "incomplete_expired":
            return "Pagamento não concluído"
        case "paused":
            return "Assinatura pausada"
        case "sem_assinatura":
            return "Sem assinatura"
        default:
            return assinatura.status || "Desconhecido"
    }
}

/** dd/mm/aaaa a partir do ISO devolvido pelo backend. */
export function formatarData(iso: string | null | undefined): string {
    if (!iso) return "—"

    const data = new Date(iso)

    if (Number.isNaN(data.getTime())) return "—"

    return data.toLocaleDateString("pt-BR")
}
