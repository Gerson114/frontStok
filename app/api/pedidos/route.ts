import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url, API_BASE } from "@/app/api/backend"
import { pedidos } from "@/app/api/rotas"


export async function GET(request: Request) {
    try {
        // ?pagamento=aguardando abre a lista dos pedidos presos. Quem decide o
        // que cada valor significa é o backend; aqui só se repassa o pedido da
        // tela, e qualquer outro valor cai na lista normal.
        const aguardando = new URL(request.url).searchParams.get("pagamento") === "aguardando"

        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(url(aguardando ? pedidos.listaAguardando() : pedidos.lista()), {
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
    return repassarPedido(pedidos.criar(), corpo ?? {})
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
