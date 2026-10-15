// O canal ao vivo do painel: o que faz pedido novo, mensagem de cliente e
// tarefa de estoque aparecerem na tela sem ninguém apertar F5.
//
// O desenho, numa frase: o navegador abre um EventSource para ESTE servidor, e
// este servidor mantém um WebSocket com o backend Go.
//
// Antes o navegador abria o socket do Go direto, pelo endereço que vinha em
// NEXT_PUBLIC_WS_URL. Isso tem três problemas, e os três custaram caro:
//
//   - a variável é CONGELADA no build (ver o Dockerfile). Um painel publicado
//     com o endereço antigo continua tentando o servidor antigo para sempre, e
//     o sintoma é exatamente este: a tela só mostra o pedido depois do F5;
//   - o backend precisa estar publicado num domínio que o navegador alcance.
//     Aqui ele não está — e não precisa estar, porque quem fala com ele é este
//     servidor, pela rede interna;
//   - o endereço da API e o bilhete do socket passavam pelo JavaScript da
//     página. Agora o bilhete é pedido aqui, com o cookie httpOnly da sessão, e
//     morre no primeiro uso.
//
// É o mesmo desenho que o painel adm já usa (ver o repositório do adm,
// app/api/aovivo/route.ts).
//
// O que trafega: só o assunto, {"tipo":"pedido","pedido_id":12}. Nenhum dado.
// Quem busca o conteúdo é a chamada REST de sempre, que é onde a sessão e a
// permissão são conferidas — e é isso que faz este canal não ser um caminho
// para ler o que a pessoa não poderia ver.

import { url, cabecalhosDaSessao, API_BASE } from "@/app/api/backend"
import { whatsapp } from "@/app/api/rotas"

/**
 * O comentário que mantém a conexão viva.
 *
 * Proxy e balanceador matam conexão calada (o padrão do nginx é 60 s), e uma
 * loja fechada à noite é exatamente isso: nada trafegando. Os dois pontos de um
 * comentário SSE não disparam evento nenhum no navegador.
 */
const PULSO_MS = 25_000

/** Quanto o navegador espera antes de tentar de novo, quando a ponte cai. */
const RETENTAR_MS = 3_000

export const dynamic = "force-dynamic"

export async function GET(request: Request) {

    const cabecalhos = await cabecalhosDaSessao()

    if (!cabecalhos) {
        return Response.json({ erro: "Sessão expirada" }, { status: 401 })
    }

    // O bilhete é pedido com a sessão, aqui no servidor. É de uso único e vale
    // um minuto (ver whatsapp.Bilhete, no backend): se vazar de um log de
    // proxy, já não abre nada.
    //
    // O cabeçalho da loja vai junto (está em cabecalhosDaSessao): é ele que
    // decide de QUAL loja é o canal, para quem tem mais de uma.
    let bilhete: string

    try {
        const resposta = await fetch(url(`/private${whatsapp.bilhete()}`), {
            method: "POST",
            headers: cabecalhos,
            cache: "no-store",
        })

        if (resposta.status === 401) {
            return Response.json({ erro: "Sessão expirada" }, { status: 401 })
        }

        if (!resposta.ok) {
            return Response.json({ erro: "O servidor não abriu o canal ao vivo" }, { status: 502 })
        }

        const dados = (await resposta.json()) as { bilhete?: unknown }

        if (typeof dados.bilhete !== "string" || dados.bilhete === "") {
            return Response.json({ erro: "O servidor não abriu o canal ao vivo" }, { status: 502 })
        }

        bilhete = dados.bilhete

    } catch {
        return Response.json({ erro: "O servidor não respondeu" }, { status: 502 })
    }

    const enderecoDoSocket =
        `${API_BASE.replace(/^http/, "ws")}/ws/whatsapp?bilhete=${encodeURIComponent(bilhete)}`

    const texto = new TextEncoder()

    const corpo = new ReadableStream<Uint8Array>({

        start(controlador) {

            let vivo = true
            const socket = new WebSocket(enderecoDoSocket)

            const escrever = (linha: string) => {
                if (!vivo) return
                try {
                    controlador.enqueue(texto.encode(linha))
                } catch {
                    // O navegador já foi embora e o fluxo fechou. Não é erro:
                    // encerrar aqui é o caminho normal de uma aba fechada.
                    encerrar()
                }
            }

            const pulso = setInterval(() => escrever(": pulso\n\n"), PULSO_MS)

            function encerrar() {

                if (!vivo) return

                vivo = false
                clearInterval(pulso)

                try {
                    socket.close()
                } catch {
                    // Já estava fechado.
                }

                try {
                    controlador.close()
                } catch {
                    // Já estava fechado.
                }
            }

            // O intervalo de retentativa vai no começo do fluxo: é ele que diz
            // ao EventSource para voltar em três segundos em vez dos cinco que
            // o navegador usa por padrão. A ponte cai de propósito a cada queda
            // do socket — quem reabre é o navegador, com um bilhete novo.
            escrever(`retry: ${RETENTAR_MS}\n\n`)

            socket.onopen = () => escrever("event: aberto\ndata: {}\n\n")

            socket.onmessage = (evento) => {

                const aviso = typeof evento.data === "string" ? evento.data : ""

                // Linha única, sempre: o aviso do backend é um JSON curto de
                // uma linha, e um "\n" no meio do corpo partiria o evento SSE
                // em dois. Cortar é mais seguro do que confiar.
                if (aviso === "" || aviso.includes("\n")) return

                escrever(`data: ${aviso}\n\n`)
            }

            socket.onclose = encerrar
            socket.onerror = encerrar

            // A aba fechou, a pessoa navegou, o Next desligou: os três chegam
            // aqui, e os três têm o mesmo desfecho — fechar o socket do lado do
            // backend. Sem isto, cada recarregamento de página deixaria uma
            // conexão pendurada no Go até o ping dela falhar.
            request.signal.addEventListener("abort", encerrar)
        },
    })

    return new Response(corpo, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-store, no-transform",
            Connection: "keep-alive",

            // Desliga o buffer do proxy. Com ele ligado, o aviso fica parado
            // esperando o bloco encher — e um canal ao vivo que entrega em lote
            // não é ao vivo.
            "X-Accel-Buffering": "no",
        },
    })
}
