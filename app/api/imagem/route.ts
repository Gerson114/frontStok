import { cookies } from "next/headers"
import { lookup as dnsLookup } from "node:dns"
import type { LookupAddress, LookupOptions } from "node:dns"
import { request as httpRequest, type IncomingMessage } from "node:http"
import { request as httpsRequest } from "node:https"

import { enderecoPrivado } from "@/security/rede"

/*
GET /api/imagem?u=<url> — busca uma figura de fora e a serve da nossa origem.

Existe para a CSP do painel poder dizer `img-src 'self' data:`. Enquanto o
navegador ia sozinho buscar a foto no servidor do lojista, `img-src` precisava
liberar `https:` inteiro — e `https:` inteiro é um canal de saída: um script
injetado escreve o que roubou na URL de uma imagem e o dado sai sem que nada
na CSP o impeça.

Só que trocar isso por um proxy cria um risco novo: o servidor passa a buscar
um endereço escolhido por outra pessoa, e o servidor enxerga o que o navegador
dela não enxerga — a rede interna, e o serviço de metadados da nuvem, que
entrega credencial da máquina a quem pedir. É o SSRF, e as defesas abaixo
existem todas por causa dele.

E o atacante a considerar aqui NÃO é um estranho: a rota exige sessão, então
quem a alcança é um lojista pagante. Ele escolhe o domínio, controla o DNS
dele e pode responder uma coisa na conferência e outra na conexão. Por isso a
validação decisiva não está na conferência prévia, e sim no `lookup` abaixo,
que roda no instante de abrir o socket.
*/

/** Só quem está logado no painel. */
const COOKIE_SESSAO = "token"

/**
 * O que pode voltar. Lista fechada, e sem SVG: SVG executa script, e servi-lo
 * da NOSSA origem seria dar a um servidor de terceiro o direito de rodar
 * código na sessão do lojista — o oposto do que a CSP tenta fazer.
 */
const TIPOS_ACEITOS = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
])

/** Teto do arquivo. Foto de produto não chega perto disso. */
const TETO_BYTES = 8 << 20

/** Prazo da busca, para uma origem lenta não segurar o servidor. */
const PRAZO_MS = 8000

/** Quantos desvios se aceita seguir antes de desistir. */
const MAXIMO_DESVIOS = 3

export async function GET(request: Request) {

    const cookieStore = await cookies()

    if (!cookieStore.get(COOKIE_SESSAO)) {
        return new Response("Não autenticado", { status: 401 })
    }

    const bruto = new URL(request.url).searchParams.get("u") ?? ""

    let alvo: URL

    try {
        alvo = new URL(bruto)
    } catch {
        return new Response("Endereço inválido", { status: 400 })
    }

    if (!enderecoBemFormado(alvo)) {
        return new Response("Endereço inválido", { status: 400 })
    }

    if (enderecoLiteralInterno(alvo.hostname)) {
        return new Response("Endereço não permitido", { status: 400 })
    }

    try {
        const resposta = await buscarConferindoCadaSalto(alvo)

        if (!resposta) {
            return new Response("Endereço não permitido", { status: 400 })
        }

        const status = resposta.statusCode ?? 0

        if (status < 200 || status >= 300) {
            resposta.destroy()
            return new Response("Imagem não encontrada", { status: 502 })
        }

        const tipo = (resposta.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase()

        if (!TIPOS_ACEITOS.has(tipo)) {
            resposta.destroy()
            return new Response("Isto não é uma imagem", { status: 415 })
        }

        const declarado = Number(resposta.headers["content-length"] ?? "")

        if (Number.isFinite(declarado) && declarado > TETO_BYTES) {
            resposta.destroy()
            return new Response("Imagem grande demais", { status: 413 })
        }

        // Conferido de novo enquanto se lê: Content-Length é o que a outra
        // ponta AFIRMA, e ela não tem obrigação de dizer a verdade.
        const conteudo = await lerAteOTeto(resposta)

        if (!conteudo) {
            return new Response("Imagem grande demais", { status: 413 })
        }

        return new Response(conteudo, {
            status: 200,
            headers: {
                "Content-Type": tipo,
                "Content-Length": String(conteudo.length),
                // O tipo é o da lista fechada acima; nosniff impede o
                // navegador de discordar dele olhando o conteúdo.
                "X-Content-Type-Options": "nosniff",
                "Cross-Origin-Resource-Policy": "same-origin",
                // Privada: a foto foi buscada com a sessão de um lojista e não
                // deve ficar num cache compartilhado.
                "Cache-Control": "private, max-age=300",
            },
        })

    } catch {
        return new Response("Não foi possível buscar a imagem", { status: 502 })
    }
}

/** Esquema e forma da URL — vale para o endereço inicial e para cada desvio. */
function enderecoBemFormado(url: URL): boolean {

    // http/https e nada mais: file:, gopher: e afins leriam disco e falariam
    // protocolos que ninguém aqui quis falar.
    if (url.protocol !== "http:" && url.protocol !== "https:") return false

    // Credencial embutida ("https://user:senha@host") vira credencial nossa
    // mandada para fora. Não há foto de produto que precise disso.
    if (url.username || url.password) return false

    return true
}

/**
 * Recusa host que JÁ É um IP interno escrito na URL.
 *
 * Parece redundante diante do `lookupSeguro` abaixo, e não é: o Node só chama
 * o lookup quando há nome a resolver. Com "http://127.0.0.1:8080" ele conecta
 * direto, o lookup nunca roda, e confiar só nele deixava a porta escancarada
 * — foi exatamente o que aconteceu quando esta conferência saiu daqui.
 *
 * As duas se completam e nenhuma cobre a outra: esta pega o IP literal, o
 * lookup pega o nome que resolve para dentro (inclusive o que troca de
 * resposta entre a conferência e a conexão).
 */
function enderecoLiteralInterno(hostname: string): boolean {

    const nome = hostname.replace(/^\[|\]$/g, "")

    if (!nome) return true

    // Só decide sobre o que é literalmente um endereço; nome fica para o lookup.
    if (/^[\d.]+$/.test(nome) || nome.includes(":")) {
        return enderecoPrivado(nome)
    }

    return false
}

/**
 * Resolve o nome e recusa se QUALQUER endereço devolvido for privado.
 *
 * Vai como `lookup` da própria conexão, e é isso que importa: conferir o DNS
 * antes e conectar depois deixa uma janela entre as duas coisas, e quem
 * controla o domínio pode responder um IP público na conferência e
 * 169.254.169.254 na conexão — o DNS rebinding. Aqui não há duas resoluções:
 * o endereço aprovado é o mesmo que o socket usa.
 *
 * Recusa se algum for privado, em vez de escolher um público da lista: uma
 * resposta que mistura os dois não é uma resposta em que se confie.
 */
function lookupSeguro(
    hostname: string,
    opcoes: LookupOptions,
    retorno: (erro: NodeJS.ErrnoException | null, endereco: string | LookupAddress[], familia?: number) => void
): void {

    dnsLookup(hostname, { ...opcoes, all: true }, (erro, enderecos) => {

        if (erro) return retorno(erro, "")

        const lista = enderecos as LookupAddress[]

        if (lista.length === 0 || lista.some((item) => enderecoPrivado(item.address))) {
            return retorno(Object.assign(new Error("endereço não permitido"), { code: "EACCES" }), "")
        }

        if (opcoes.all) return retorno(null, lista)

        retorno(null, lista[0].address, lista[0].family)
    })
}

/** Uma requisição, com o IP conferido na hora de abrir o socket. */
function pedir(url: URL): Promise<IncomingMessage> {

    return new Promise((resolver, recusar) => {

        const cliente = url.protocol === "https:" ? httpsRequest : httpRequest

        const requisicao = cliente(
            url,
            { method: "GET", headers: { Accept: "image/*" }, lookup: lookupSeguro, timeout: PRAZO_MS },
            resolver
        )

        requisicao.on("error", recusar)
        requisicao.on("timeout", () => requisicao.destroy(new Error("tempo esgotado")))
        requisicao.end()
    })
}

/**
 * Busca a imagem seguindo desvios, conferindo o destino a CADA salto.
 *
 * Recusar todo desvio fecharia o buraco, mas quebraria os CDNs de imagem, que
 * redirecionam por motivo honesto. Então segue-se — e cada destino passa pelo
 * mesmo `lookup` do primeiro, que é o que torna o exame não-contornável.
 */
async function buscarConferindoCadaSalto(inicial: URL): Promise<IncomingMessage | null> {

    let atual = inicial

    for (let salto = 0; salto <= MAXIMO_DESVIOS; salto++) {

        const resposta = await pedir(atual)
        const status = resposta.statusCode ?? 0

        if (status < 300 || status >= 400) {
            return resposta
        }

        const destino = resposta.headers.location

        resposta.resume() // descarta o corpo do desvio
        resposta.destroy()

        if (!destino) return null

        let proximo: URL

        try {
            // Relativo ao endereço atual, como manda o HTTP.
            proximo = new URL(destino, atual)
        } catch {
            return null
        }

        if (!enderecoBemFormado(proximo)) return null
        if (enderecoLiteralInterno(proximo.hostname)) return null

        atual = proximo
    }

    return null
}

/** Lê o corpo até o teto; devolve null se passar dele. */
async function lerAteOTeto(corpo: IncomingMessage): Promise<Uint8Array<ArrayBuffer> | null> {

    const pedacos: Buffer[] = []

    let total = 0

    for await (const pedaco of corpo) {

        const bloco = pedaco as Buffer

        total += bloco.length

        if (total > TETO_BYTES) {
            corpo.destroy()
            return null
        }

        pedacos.push(bloco)
    }

    const inteiro = new Uint8Array(new ArrayBuffer(total))

    let posicao = 0

    for (const pedaco of pedacos) {
        inteiro.set(pedaco, posicao)
        posicao += pedaco.length
    }

    return inteiro
}
