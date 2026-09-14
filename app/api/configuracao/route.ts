import { repassarAoBackend } from "@/app/api/backend"

/**
 * GET  /api/configuracao — o que está valendo nesta loja.
 * PUT  /api/configuracao — grava o que o lojista mudou.
 *
 * Sem validação aqui: quem conhece os limites de cada campo — e o que
 * acontece quando um prazo de carrinho vira um minuto — é o backend. O que
 * este arquivo faz é o de sempre: levar o cookie httpOnly até lá.
 */
export async function GET() {
    return repassarAoBackend("GET", "/private/configuracao")
}

export async function PUT(request: Request) {
    const corpo = await request.json().catch(() => null)

    if (!corpo || typeof corpo !== "object") {
        return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
    }

    return repassarAoBackend("PUT", "/private/configuracao", corpo)
}
