import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { funcionarios } from "@/app/api/rotas"

/**
 * A equipe da loja.
 *
 * O corpo é repassado sem conferência de conteúdo de propósito: quem decide o
 * que é um nome aceitável, uma senha aceitável e uma permissão que existe é o
 * servidor — e é lá que a decisão precisa estar, porque esta rota não é a
 * única porta para aquela API. Aqui só se confere o que evita uma viagem
 * inútil: sessão e formato.
 */

// GET /api/funcionarios — a equipe e o catálogo de telas concedíveis.
export async function GET() {
    return repassar("GET", null)
}

// POST /api/funcionarios — abre uma conta de painel para alguém da equipe.
export async function POST(request: Request) {
    const corpo = safeParse(await request.text().catch(() => "")) as Record<string, unknown> | null

    if (!corpo) {
        return Response.json({ erro: "Dados inválidos" }, { status: 400 })
    }

    return repassar("POST", corpo)
}

async function repassar(metodo: "GET" | "POST", corpo: unknown) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(url(funcionarios.lista()), {
            method: metodo,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                ...(corpo ? { "Content-Type": "application/json" } : {}),
            },
            body: corpo ? JSON.stringify(corpo) : undefined,
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
