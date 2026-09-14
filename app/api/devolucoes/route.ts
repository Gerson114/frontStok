import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { API_BASE, cabecalhoDaLojaAberta } from "@/app/api/backend"


// GET /api/devolucoes — a fila de quarentena da loja.
// POST /api/devolucoes — registra peças que voltaram.
//
// Quem escolhe as peças, tira do vendável e guarda o motivo é o backend
// (ver internal/handlers/logistica/devolucao.go).
export async function GET() {
    return repassar("GET", "", null)
}

export async function POST(request: Request) {
    const corpo = safeParse(await request.text().catch(() => ""))
    return repassar("POST", "", corpo)
}

export async function repassar(metodo: "GET" | "POST", caminho: string, corpo: unknown) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(`${API_BASE}/private/devolucoes${caminho}`, {
            method: metodo,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
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
