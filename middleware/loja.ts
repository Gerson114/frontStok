// Identidade pública da loja: o nome que aparece na vitrine e o endereço
// (slug) por onde os clientes chegam nela. Tudo passa pela rota interna
// /api/loja, como o resto do painel.

import { apiFetch } from "./client"
import type { Bloco, Cartao, Loja } from "@/app/type/type"

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

    /** Onde a loja fica no mapa. Nulo apaga o que estava lá. */
    latitude: number | null
    longitude: number | null
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
/**
 * Uma palavra editável da vitrine, como o servidor a descreve.
 *
 * O catálogo inteiro vem de lá — rótulo, explicação, PADRÃO e limite de cada
 * chave. O painel não guarda uma segunda cópia desses textos de propósito:
 * duas listas das mesmas frases é como uma delas passa a mostrar ao lojista um
 * padrão que a loja dele não usa mais. Palavra nova aparece nesta tela assim
 * que o servidor a conhece.
 */
export interface TextoEditavel {
    chave: string
    area: string
    rotulo: string
    ajuda?: string
    padrao: string
    maximo: number
}

export interface AreaDeTexto {
    chave: string
    nome: string
}

/** A home da loja: os blocos, as palavras reescritas e o catálogo delas. */
export interface PaginaDaLoja {
    blocos: Bloco[]

    /** Só o que a loja reescreveu. Chave ausente quer dizer "use o padrão". */
    textos: Record<string, string>

    catalogo: TextoEditavel[]
    areas: AreaDeTexto[]

    /** Os cartões de fábrica, para o botão de recomeçar a faixa. */
    cartoes_padrao: Cartao[]
}

export async function consultarPaginaDaLoja(): Promise<PaginaDaLoja> {

    const dados = await apiFetch<Partial<PaginaDaLoja>>("/api/loja/pagina")

    return {
        blocos: Array.isArray(dados.blocos) ? dados.blocos : [],
        textos: dados.textos && typeof dados.textos === "object" ? dados.textos : {},
        catalogo: Array.isArray(dados.catalogo) ? dados.catalogo : [],
        areas: Array.isArray(dados.areas) ? dados.areas : [],
        cartoes_padrao: Array.isArray(dados.cartoes_padrao) ? dados.cartoes_padrao : [],
    }
}

/**
 * Grava a página inteira: o que ela mostra e com que palavras.
 *
 * Os dois juntos, numa requisição só, porque são a mesma página para a loja —
 * salvar o layout sem os textos poria no ar a faixa nova escrita com as
 * palavras velhas.
 */
export async function salvarPaginaDaLoja(
    blocos: Bloco[],
    textos: Record<string, string>,
): Promise<Bloco[]> {

    const dados = await apiFetch<{ blocos?: Bloco[] }>("/api/loja/pagina", {
        method: "PUT",
        body: { blocos, textos },
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

/* ==========================================================================
   O CABEÇALHO E O RODAPÉ

   O mesmo desenho da home (ver PaginaDaLoja acima), mas para o topo e o
   rodapé — faixas com três áreas (esquerda, centro, direita), cada área uma
   lista de peças de um catálogo fechado. Os nomes dos campos batem com o que
   o servidor manda (ver services/paginas/moldura.go): não há tradução no
   meio, porque o meio é só um servidor de HTTP repassando JSON.
   ========================================================================== */

/** Um elemento do topo ou do rodapé — o selo, o link, o ícone da sacola. */
export interface PecaDaMoldura {
    id: string
    tipo: string
    texto?: string
    link?: string
    icone?: string
    /** Só nas peças que podem crescer — a marca e a busca. */
    tamanho?: string
    /** "sempre" | "so-desktop" | "so-celular". */
    aparicao?: string
}

/** Uma linha horizontal do topo, com o que está à esquerda, no meio e à direita. */
export interface FaixaDoTopo {
    id: string
    tipo: string
    ligada: boolean
    fundo?: string
    esquerda: PecaDaMoldura[]
    centro: PecaDaMoldura[]
    direita: PecaDaMoldura[]
}

/** Uma coluna do rodapé, com o título dela. */
export interface ColunaDoRodape {
    id: string
    titulo?: string
    largura?: string
    pecas: PecaDaMoldura[]
}

export interface Cabecalho {
    faixas: FaixaDoTopo[]
}

export interface Rodape {
    ligado: boolean
    colunas: ColunaDoRodape[]
    /** A linha de baixo, na cor da marca: direitos autorais e privacidade. */
    barra: PecaDaMoldura[]
}

/**
 * O que dá para pôr em cada lugar do topo e do rodapé — a mesma ideia do
 * catálogo de blocos da home: vem do servidor, com rótulo e regra de onde
 * cabe, para o editor não guardar uma segunda cópia da mesma lista.
 */
export interface CatalogoDaMoldura {
    /** Chave da faixa ("servico", "marca", "navegacao") → tipos que cabem nela. */
    pecas_da_faixa: Record<string, Record<string, boolean>>
    pecas_do_rodape: string[]
    pecas_da_barra: string[]
    fundos: string[]
    tamanhos: string[]
    aparicoes: string[]
    larguras_da_coluna: string[]
    icones: string[]
}

export interface MolduraDaLoja {
    cabecalho: Cabecalho
    rodape: Rodape
    catalogo: CatalogoDaMoldura
    /** O de fábrica, para o botão de "voltar ao padrão" de cada peça. */
    padrao: { cabecalho: Cabecalho; rodape: Rodape }
}

export async function consultarMoldura(): Promise<MolduraDaLoja> {

    const dados = await apiFetch<Partial<MolduraDaLoja>>("/api/loja/moldura")

    const catalogoVazio: CatalogoDaMoldura = {
        pecas_da_faixa: {}, pecas_do_rodape: [], pecas_da_barra: [],
        fundos: [], tamanhos: [], aparicoes: [], larguras_da_coluna: [], icones: [],
    }

    const cabecalhoVazio: Cabecalho = { faixas: [] }
    const rodapeVazio: Rodape = { ligado: true, colunas: [], barra: [] }

    return {
        cabecalho: dados.cabecalho ?? cabecalhoVazio,
        rodape: dados.rodape ?? rodapeVazio,
        catalogo: dados.catalogo ?? catalogoVazio,
        padrao: dados.padrao ?? { cabecalho: cabecalhoVazio, rodape: rodapeVazio },
    }
}

/**
 * Grava o topo, o rodapé, ou os dois — um ponteiro que falta é "não mexi
 * nisto" para o servidor (ver entradaMoldura em moldura.go), então só manda
 * quem de fato mudou.
 */
export async function salvarMoldura(mudancas: {
    cabecalho?: Cabecalho
    rodape?: Rodape
}): Promise<{ cabecalho: Cabecalho; rodape: Rodape }> {

    const dados = await apiFetch<{ cabecalho?: Cabecalho; rodape?: Rodape }>("/api/loja/moldura", {
        method: "PUT",
        body: mudancas,
    })

    return {
        cabecalho: dados.cabecalho ?? { faixas: [] },
        rodape: dados.rodape ?? { ligado: true, colunas: [], barra: [] },
    }
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
