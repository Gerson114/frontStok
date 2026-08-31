import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"

const API_BASE = process.env.API_URL ?? "http://localhost:8080"

export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(`${API_BASE}/private/pedidos`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: response.status })
        }

        return Response.json(safeParse(texto) ?? { pedidos: [] }, {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

// POST /api/pedidos — lança um pedido que veio de fora (WhatsApp, telefone,
// lista de papel). Quem confere o estoque, reserva as peças e recusa o que
// não cabe é o backend; aqui só se repassa.
export async function POST(request: Request) {
    const corpo = await request.json().catch(() => null)
    return repassarPedido("/pedidos", corpo ?? {})
}

export async function repassarPedido(caminho: string, corpo: unknown) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(`${API_BASE}/private${caminho}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(corpo),
            cache: "no-store",
        })

        const texto = await response.text()
        const dados = safeParse(texto)

        if (!response.ok) {
            // O 409 de estoque insuficiente carrega a lista do que faltou —
            // é justamente o que a tela precisa mostrar antes de perguntar
            // se manda o parcial. Por isso o corpo vai inteiro, e não só a
            // mensagem.
            return Response.json(
                { erro: extrairMensagemErro(dados), ...(dados as object ?? {}) },
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

function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}
