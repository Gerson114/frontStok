import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { estoque } from "@/app/api/rotas"


// // GET /api/unidades/:id/historico — tudo que já aconteceu com uma peça.
export async function GET(_request: Request, { params }: { params: Promise<{ unidadeId: string }> }) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const { unidadeId } = await params

        if (!/^\\d+$/.test(unidadeId)) {
            return Response.json({ erro: "peça inválida" }, { status: 400 })
        }

        const response = await fetch(url(estoque.historico(unidadeId)), {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
                Accept: "application/json",
            },
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: response.status })
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
