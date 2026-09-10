import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { pedidos } from "@/app/api/rotas"

/**
 * PUT /api/pedidos/:id/rastreio — quem levou o pedido e com que código.
 *
 * Rota própria, e não um campo dentro da mudança de status: o status tem
 * consequência de estoque (a entrega debita as peças), e gravar as duas
 * coisas juntas faria uma delas acontecer sem ninguém ter pedido.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const { id } = await params

        if (!/^\d+$/.test(id)) {
            return Response.json({ erro: "pedido inválido" }, { status: 400 })
        }

        const corpo = safeParse(await request.text().catch(() => "")) as Record<string, unknown> | null

        if (!corpo || typeof corpo.codigo_rastreio !== "string" || !corpo.codigo_rastreio.trim()) {
            return Response.json({ erro: "Informe o código de rastreio" }, { status: 400 })
        }

        const response = await fetch(url(pedidos.rastreio(id)), {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                transportadora: String(corpo.transportadora ?? "").slice(0, 80),
                codigo_rastreio: corpo.codigo_rastreio.slice(0, 64),
            }),
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: response.status })
        }

        return Response.json(safeParse(texto) ?? {}, {
            status: response.status,
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
