// Identidade pública da loja: o nome que aparece na vitrine e o endereço
// (slug) por onde os clientes chegam nela. Tudo passa pela rota interna
// /api/loja, como o resto do painel.

import { apiFetch } from "./client"
import type { Bloco, Loja } from "@/app/type/type"

export async function consultarLoja(): Promise<Loja> {
    return apiFetch<Loja>("/api/loja")
}

/** O que o formulário da loja grava: identidade e contato público. */
export interface DadosDaLoja {
    nome_loja: string
    slug: string
    whatsapp: string
    telefone: string
    endereco: string
    horario: string
}

/**
 * Grava a identidade e o contato público da loja.
 *
 * Os campos de contato vão sempre, inclusive vazios: em branco é como o
 * lojista apaga um número que mudou, e mandar só o que foi preenchido faria
 * o campo apagado voltar sozinho na próxima leitura.
 */
export async function salvarLoja(dados: DadosDaLoja): Promise<Loja> {
    return apiFetch<Loja>("/api/loja", {
        method: "PUT",
        body: dados,
    })
}

/**
 * O desenho da home da vitrine.
 *
 * O que trafega é uma lista de blocos — dado, não marcação. Quem valida é o
 * servidor: tipo fora do catálogo, propriedade que não pertence ao bloco e
 * texto acima do limite não entram no banco, e o que ele devolve é a página
 * já limpa. A tela mostra o que voltou, e não o que mandou, justamente para o
 * lojista ver o que de fato ficou gravado.
 */
export async function consultarPaginaDaLoja(): Promise<Bloco[]> {
    const dados = await apiFetch<{ blocos?: Bloco[] }>("/api/loja/pagina")
    return Array.isArray(dados.blocos) ? dados.blocos : []
}

export async function salvarPaginaDaLoja(blocos: Bloco[]): Promise<Bloco[]> {
    const dados = await apiFetch<{ blocos?: Bloco[] }>("/api/loja/pagina", {
        method: "PUT",
        body: { blocos },
    })

    return Array.isArray(dados.blocos) ? dados.blocos : []
}

/**
 * Mesma normalização do backend (ver internal/services/loja): tira acentos,
 * troca o que não serve por hífen e junta hifens repetidos.
 *
 * Aqui ela existe só para o lojista ver o endereço se formando enquanto
 * digita — quem valida de verdade é o backend, que também é o único capaz
 * de dizer se o endereço já é de outra loja.
 */
export function normalizarSlug(texto: string): string {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)
}

/**
 * Endereço completo da vitrine desta loja. A base vem do ambiente porque
 * muda entre desenvolvimento e produção; sem ela, cai no endereço local.
 */
export function urlDaVitrine(slug: string): string {
    const base = (process.env.NEXT_PUBLIC_VITRINE_URL ?? "http://localhost:3001").replace(/\/+$/, "")
    return `${base}/${slug}`
}

/**
 * O tema da vitrine: as quatro cores que o lojista escolhe e o logo.
 *
 * São quatro, e não uma paleta inteira, porque o resto a vitrine calcula a
 * partir delas (ver :root em vendas/frontp/app/globals.css) — o cinza do
 * texto secundário e a cor das bordas nascem da mistura do texto com o
 * fundo. É o que permite dar a cor ao lojista sem receber de volta uma loja
 * em que o texto some.
 *
 * Campo vazio quer dizer "de fábrica": apagar a cor é como o lojista desfaz
 * um tema de que se arrependeu, sem ter de acertar o preto-e-branco na mão.
 */
export interface TemaLoja {
    fundo: string
    texto: string
    destaque: string
    palco: string
    logo_url: string
}

export const TEMA_DE_FABRICA: TemaLoja = {
    fundo: "#ffffff",
    texto: "#1a1a1a",
    destaque: "#000000",
    palco: "#efece8",
    logo_url: "",
}

export async function consultarTema(): Promise<TemaLoja> {
    const dados = await apiFetch<{ tema?: Partial<TemaLoja> }>("/api/loja/tema")

    return {
        fundo: dados.tema?.fundo || "",
        texto: dados.tema?.texto || "",
        destaque: dados.tema?.destaque || "",
        palco: dados.tema?.palco || "",
        logo_url: dados.tema?.logo_url || "",
    }
}

export async function salvarTema(tema: TemaLoja): Promise<void> {
    await apiFetch<{ tema?: Partial<TemaLoja> }>("/api/loja/tema", {
        method: "PUT",
        body: tema,
    })
}

/**
 * A luminância relativa de uma cor, na fórmula da WCAG — a mesma conta que a
 * vitrine faz (ver vendas/frontp/lib/tema.ts). Está repetida aqui de
 * propósito: os dois lados precisam dela, e é meia dúzia de linhas sem
 * estado nenhum, o que é bem mais barato do que um pacote compartilhado
 * entre dois projetos que hoje não compartilham nada.
 */
function luminancia(cor: string): number {

    const canal = (inicio: number) => {
        const valor = parseInt(cor.slice(inicio, inicio + 2), 16) / 255

        return valor <= 0.03928
            ? valor / 12.92
            : Math.pow((valor + 0.055) / 1.055, 2.4)
    }

    return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
}

/**
 * O contraste entre duas cores, de 1 (idênticas) a 21 (preto no branco). A
 * WCAG pede 4,5 para texto corrido.
 *
 * O painel não impede o lojista de salvar um contraste ruim — a loja é dele.
 * Ele avisa, que é diferente: ninguém escolhe cinza sobre branco de
 * propósito, escolhe sem ver que ficou assim.
 */
export function contraste(uma: string, outra: string): number {

    if (!/^#[0-9a-fA-F]{6}$/.test(uma) || !/^#[0-9a-fA-F]{6}$/.test(outra)) {
        return 21
    }

    const a = luminancia(uma)
    const b = luminancia(outra)

    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** Preto ou branco — o que for mais legível por cima da cor dada. */
export function sobre(cor: string): string {
    return contraste(cor, "#ffffff") >= contraste(cor, "#000000") ? "#ffffff" : "#000000"
}
