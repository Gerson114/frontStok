import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { pedidos } from "@/app/api/rotas"

/**
 * PUT /api/pedidos/:id/envio — o dia em que o pedido sai da loja.
 *
 * Rota própria, e não um campo dentro da mudança de status: confirmar é só
 * "aceitei, estou preparando", e o dia da saída a loja marca depois, quando
 * souber. É esta chamada que tira o pedido da fila de preparo e o põe num dia
 * do calendário.
 *
 * Data vazia é legítima e desmarca — o pedido volta para o preparo.
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

        if (!corpo || typeof corpo !== "object") {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        // O formato é conferido aqui só para não gastar uma viagem com um
        // texto qualquer; quem decide se o dia cabe no prazo prometido ao
        // cliente é o servidor, que é quem conhece o pedido.
        const dia = String(corpo.envio_previsto_em ?? "")

        if (dia && !/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
            return Response.json({ erro: "data de envio inválida" }, { status: 400 })
        }

        const response = await fetch(url(pedidos.envio(id)), {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ envio_previsto_em: dia }),
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
