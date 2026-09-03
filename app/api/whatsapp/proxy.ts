import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { API_BASE } from "@/app/api/backend"


/**
 * Repassa uma chamada de WhatsApp ao backend, com o token do cookie.
 *
 * Está num arquivo só porque são sete rotas fazendo exatamente a mesma coisa
 * e a única diferença entre elas é o caminho. O erro do backend é repassado
 * como veio: a mensagem dele ("faz mais de 24 horas que este cliente não
 * escreve") é justamente o que a tela precisa mostrar.
 */
export async function repassar(
    metodo: "GET" | "POST" | "PUT" | "DELETE",
    caminho: string,
    corpo?: unknown
) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(`${API_BASE}/private${caminho}`, {
            method: metodo,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
            cache: "no-store",
        })

        const texto = await response.text()
        const dados = texto ? safeParse(texto) : null

        if (!response.ok) {
            return Response.json(
                { erro: extrairMensagemErro(dados), ...(typeof dados === "object" && dados ? dados : {}) },
                { status: response.status }
            )
        }

        return Response.json(dados ?? {}, {
            status: response.status,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

export function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}

/** Aceita só dígitos como id — o caminho vai montado numa URL do backend. */
export function idValido(id: string): boolean {
    return /^\d{1,18}$/.test(id)
}

/**
 * Repassa um arquivo do backend (foto de perfil, imagem, áudio, documento).
 *
 * Separado de `repassar` porque aqui o corpo é binário: transformar em JSON
 * corromperia o arquivo. Os cabeçalhos de segurança que o backend pôs vêm
 * junto de propósito — é ele quem sabe se o tipo pode abrir na tela ou tem de
 * descer como anexo, e reescrevê-los aqui abriria a brecha que lá foi
 * fechada.
 */
export async function repassarArquivo(
    caminho: string,
    request?: Request,
    /**
     * Por quantos segundos o NAVEGADOR do lojista pode reaproveitar este
     * arquivo sem pedir de novo. Zero (o padrão) é não guardar nada.
     *
     * Existe por causa da foto de perfil, que é o único arquivo daqui que a
     * tela pede repetidamente: a lista de conversas mostra uma por linha, e
     * sem cache cada volta à tela rebuscava todas elas — foi o que levou o
     * painel a tomar 429 do limite de requisições.
     *
     * Áudio, imagem e documento das conversas continuam sem cache: são
     * conteúdo de cliente, e não há motivo para ficarem em disco depois de
     * vistos.
     */
    segundosDeCache = 0
) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return new Response("Não autenticado", { status: 401 })
        }

        const cabecalhosDaIda: Record<string, string> = {
            Authorization: `Bearer ${token}`,
        }

        // Range vai adiante em vez de ser engolido aqui.
        //
        // É com ele que o navegador pede "do segundo 30 em diante" ao
        // arrastar a barra de um áudio, e é ele que alguns navegadores exigem
        // antes de começar a tocar. O backend responde a isso (ver
        // servirArquivo), mas a resposta nunca chegava: este proxy pedia o
        // arquivo inteiro e devolvia sempre 200, então a faixa só tocava do
        // começo e arrastar não ia a lugar nenhum.
        for (const nome of ["range", "if-range"]) {
            const valor = request?.headers.get(nome)
            if (valor) cabecalhosDaIda[nome] = valor
        }

        const response = await fetch(`${API_BASE}/private${caminho}`, {
            headers: cabecalhosDaIda,
            cache: "no-store",
        })

        if (!response.ok) {
            return new Response("Arquivo não encontrado", { status: response.status })
        }

        const cabecalhos = new Headers()

        for (const nome of [
            "Content-Type",
            "Content-Length",
            "Content-Disposition",
            "X-Content-Type-Options",
            "Content-Security-Policy",
            // Os dois da resposta parcial: sem eles o navegador recebe um
            // pedaço e acha que é o arquivo inteiro.
            "Content-Range",
            "Accept-Ranges",
        ]) {
            const valor = response.headers.get(nome)
            if (valor) cabecalhos.set(nome, valor)
        }

        // Estes três vão sempre, sobrescrevendo o que veio: são a diferença
        // entre um arquivo mandado por um cliente ser mostrado e ser
        // executado, e não podem depender de o backend ter lembrado deles.
        //
        // Sem nosniff (e mais ainda sem Content-Type), o navegador adivinha o
        // tipo pelo conteúdo — um "áudio" que na verdade é HTML abriria como
        // página na origem do painel, com a sessão do lojista junto. Sem
        // CORP, qualquer site pode embutir a foto e os áudios dos clientes da
        // loja numa página dele.
        cabecalhos.set("X-Content-Type-Options", "nosniff")
        cabecalhos.set("Cross-Origin-Resource-Policy", "same-origin")

        if (!cabecalhos.has("Content-Type")) {
            cabecalhos.set("Content-Type", "application/octet-stream")
        }

        // Conversa de cliente não fica em cache de intermediário nenhum. O
        // "private" é o que garante isso mesmo quando há tempo de cache: ele
        // permite guardar no navegador de quem pediu e proíbe em qualquer
        // ponto do caminho — proxy da loja, CDN, cache compartilhado.
        cabecalhos.set(
            "Cache-Control",
            segundosDeCache > 0 ? `private, max-age=${segundosDeCache}` : "private, no-store"
        )

        // O status vai como veio: 206 é a resposta certa a um Range, e
        // reescrevê-lo como 200 diria ao navegador que o pedaço é o todo.
        return new Response(response.body, { status: response.status, headers: cabecalhos })

    } catch {
        return new Response("Erro interno do servidor", { status: 500 })
    }
}
