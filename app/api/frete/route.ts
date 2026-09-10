import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { conta } from "@/app/api/rotas"

// GET /api/frete — a configuração de entrega e a tabela por estado.
export async function GET() {
    return repassar("GET", null)
}

// PUT /api/frete — grava a configuração e SUBSTITUI a tabela inteira.
//
// Substitui, e não mescla: a tela manda a tabela como ela deve ficar, e
// mesclar deixaria de fora a única operação que o lojista não teria como
// fazer — apagar uma linha.
export async function PUT(request: Request) {
    const corpo = safeParse(await request.text().catch(() => "")) as Record<string, unknown> | null

    if (!corpo) {
        return Response.json({ erro: "Dados inválidos" }, { status: 400 })
    }

    return repassar("PUT", corpo)
}

async function repassar(metodo: "GET" | "PUT", corpo: unknown) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(url(conta.frete()), {
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
