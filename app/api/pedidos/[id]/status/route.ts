import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { pedidos } from "@/app/api/rotas"


const STATUS_VALIDOS = ["pendente", "confirmado", "enviado", "entregue", "cancelado"]

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const body = await request.json().catch(() => null)

        if (!body || typeof body !== "object") {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const status = String((body as Record<string, unknown>).status ?? "")

        if (!STATUS_VALIDOS.includes(status)) {
            return Response.json({ erro: "status inválido" }, { status: 400 })
        }

        /* O código que o comprador diz no balcão, nas lojas que exigem um.

           Passa como veio, sem conferência aqui: quem compara é o backend,
           contra o código gravado no pedido. Conferir nesta camada exigiria
           que este servidor conhecesse o código — e o dia em que ele o
           conhecesse seria o dia em que o código deixaria de ser segredo entre
           quem comprou e o banco.

           Só dígitos, no máximo seis: é o formato que o backend aceita, e
           cortar aqui evita mandar adiante uma linha de texto colada por
           engano no campo. */
        const codigoRetirada = String((body as Record<string, unknown>).codigo_retirada ?? "")
            .replace(/\D/g, "")
            .slice(0, 6)

        // Só o status vai (e o código, quando há um). O dia da saída tem rota
        // própria (ver /api/pedidos/:id/envio): confirmar é dizer "estou
        // preparando", e misturar as duas gravações faria a loja assumir um dia
        // sem querer.
        const response = await fetch(url(pedidos.status(id)), {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                status,
                ...(codigoRetirada ? { codigo_retirada: codigoRetirada } : {}),
            }),
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: response.status })
        }

        return Response.json(safeParse(texto) ?? { mensagem: "status atualizado" }, {
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
