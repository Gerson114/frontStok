import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"

// Server-only (ao contrário de NEXT_PUBLIC_*): o navegador nunca fala direto
// com o backend Go.
const API_BASE = process.env.API_URL ?? "http://localhost:8080"

// GET /api/assinatura — estado da assinatura da loja logada.
//
// Diferente das outras rotas do painel, esta continua respondendo quando a
// assinatura está vencida: é justamente ela que diz ao painel o que mostrar
// na tela de pagamento. Quem decide isso é o backend, que deixa as rotas de
// assinatura fora do bloqueio.
export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(`${API_BASE}/private/assinatura`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json(
                { erro: extrairMensagemErro(safeParse(texto)) },
                { status: response.status }
            )
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
