import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { paginaDaLoja } from "@/app/api/rotas"

/**
 * O topo e o rodapé da vitrine, montados peça a peça.
 *
 * Mesma anatomia da rota da home (ver app/api/loja/pagina/route.ts): não
 * confere o CONTEÚDO de cabeçalho e rodapé — quem tem o catálogo e as regras
 * é o servidor (ver services/paginas/moldura.go). O que esta rota garante é
 * o que só ela pode: o token do cookie e o corpo com o formato mínimo certo.
 */
export async function GET() {
    return encaminhar("GET")
}

export async function PUT(request: Request) {

    const corpo = safeParse(await request.text().catch(() => "")) as Record<string, unknown> | null

    // Cabeçalho E rodapé são opcionais aqui — o servidor trata a ausência de
    // cada um como "não mexi nisto", e não como "apague isto" (ver
    // entradaMoldura no Go). Mas pelo menos UM dos dois precisa vir, senão a
    // gravação é um corpo vazio indo até o backend só para ele dizer "nada a
    // salvar".
    if (!corpo || (corpo.cabecalho === undefined && corpo.rodape === undefined)) {
        return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
    }

    return encaminhar("PUT", {
        cabecalho: corpo.cabecalho,
        rodape: corpo.rodape,
    })
}

async function encaminhar(metodo: "GET" | "PUT", corpo?: unknown) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const resposta = await fetch(url(paginaDaLoja.moldura()), {
            method: metodo,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
                Accept: "application/json",
                ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
            cache: "no-store",
        })

        const texto = await resposta.text()

        if (!resposta.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: resposta.status })
        }

        return Response.json(safeParse(texto) ?? {}, {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}
