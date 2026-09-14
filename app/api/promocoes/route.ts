import { cookies } from "next/headers"
import { validarPromocao, type NovaPromocao } from "@/security/validate"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { produtos } from "@/app/api/rotas"


export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const body = await request.json().catch(() => null)

        if (!body || typeof body !== "object") {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const entrada = body as Record<string, unknown>

        const promocao: NovaPromocao = {
            produto_id: Number(entrada.produto_id),
            preco_promocional: Number(entrada.preco_promocional),
        }

        const erros = validarPromocao(promocao)

        if (erros.length > 0) {
            return Response.json({ erro: erros[0], erros }, { status: 400 })
        }

        const response = await fetch(url(produtos.promocao()), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(promocao),
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: response.status })
        }

        const dados = safeParse(texto)

        if (!dados) {
            return Response.json({ erro: "Resposta inválida do servidor" }, { status: 502 })
        }

        return Response.json(dados, {
            status: 201,
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
