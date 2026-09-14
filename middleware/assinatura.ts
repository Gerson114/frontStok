// Assinatura mensal que libera o painel. É uma só, com tudo dentro: não há
// plano a escolher nem nível a trocar.
//
// Todo o estado vem do backend, que por sua vez só o recebe do provedor de
// cobrança por webhook assinado — nada aqui decide se alguém pagou, e nenhum
// dado de cartão passa pelo navegador ou pelo nosso servidor.

import { apiFetch } from "./client"
import type { Assinatura, ItemMenu, Oferta, PrecoPlano } from "@/app/type/type"

interface RespostaLink {
    url: string
}

export async function consultarAssinatura(): Promise<Assinatura> {
    return apiFetch<Assinatura>("/api/assinatura")
}

/**
 * O que está à venda para quem ainda não tem conta, com o preço lido pelo
 * backend. É o que a tela de cadastro mostra no passo do pagamento.
 */
export async function consultarOfertaPublica(): Promise<{
    cobranca_ativa: boolean
    oferta: Oferta
}> {
    return apiFetch("/api/oferta")
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
 * Abre uma sessão de pagamento e devolve a URL hospedada pelo provedor de
 * cobrança. Quem chama deve levar o navegador até ela com
 * `window.location.href`.
 *
 * Vai só QUAL PLANO, nunca o preço: quem traduz "pro" em id de cobrança é o
 * backend, para o navegador não ter como assinar por um valor que não é o
 * nosso. Sem argumento é o base.
 */
export async function iniciarPagamento(plano: "base" | "pro" = "base"): Promise<string> {
    const dados = await apiFetch<RespostaLink>("/api/assinatura/checkout", {
        method: "POST",
        body: { plano },
    })
    return dados.url
}

/**
 * Troca o plano de quem JÁ assina — do base para o Pro, ou de volta.
 *
 * Não é o checkout, e não é o portal: o checkout criaria uma segunda
 * assinatura na mesma loja, e o portal tem a troca de plano desligada de
 * propósito no servidor (lá a subida não seria cobrada na hora). Aqui a
 * assinatura existente muda de item, e subir é faturado imediatamente.
 *
 * Depois de trocar, a página precisa ser RECARREGADA de verdade: o menu do
 * painel vem do servidor já resolvido para o plano, e o que está em memória
 * continuaria mostrando as telas do Pro bloqueadas.
 */
export async function trocarDePlano(plano: "base" | "pro"): Promise<void> {
    await apiFetch("/api/assinatura/plano", {
        method: "POST",
        body: { plano },
    })
}

/**
 * Devolve a URL do portal de cobrança, onde o lojista troca o cartão, vê as
 * faturas e cancela a assinatura sozinho.
 */
export async function abrirPortalCobranca(): Promise<string> {
    const dados = await apiFetch<RespostaLink>("/api/assinatura/portal", {
        method: "POST",
    })
    return dados.url
}

/**
 * A oferta vista por quem já está logado: a mesma do cadastro, com a
 * informação de a loja já ter assinatura em dia ou não.
 */
export async function consultarOferta(): Promise<{
    cobranca_ativa: boolean
    tem_assinatura: boolean
    /** Esta loja já está no Pro? Decide se o cartão dele oferece assinar. */
    plano_pro?: boolean
    oferta: Oferta
}> {
    return apiFetch("/api/assinatura/oferta")
}

/**
 * O menu do painel desta loja, já na ordem e nas seções em que deve
 * aparecer, com o que está bloqueado por mensalidade atrasada marcado como
 * tal.
 *
 * Quem monta é o backend (ver internal/services/assinatura/recursos.go).
 * Uma lista fixa aqui seria uma segunda verdade sobre o que o painel tem.
 */
export async function consultarMenu(): Promise<ItemMenu[]> {
    const assinatura = await consultarAssinatura()
    return assinatura.menu ?? []
}

/** Texto amigável para cada status vindo do provedor de cobrança. */
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
