import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { estoque } from "@/app/api/rotas"


// GET /api/entradas — histórico de remessas recebidas.
export async function GET() {
    return repassar("GET", null)
}

// POST /api/entradas — dá entrada numa remessa.
//
// Cada item diz qual produto chegou, quantas peças, por quanto e onde foram
// guardadas. O backend cria as peças, soma o estoque e devolve os ids para
// imprimir as etiquetas do lote.
export async function POST(request: Request) {
    const corpo = safeParse(await request.text().catch(() => "")) as Record<string, unknown> | null
    const itens = corpo?.itens

    if (!Array.isArray(itens) || itens.length === 0) {
        return Response.json({ erro: "Informe ao menos um item na entrada" }, { status: 400 })
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

        const response = await fetch(url(estoque.entradas()), {
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
