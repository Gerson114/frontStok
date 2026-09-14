import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { API_BASE, cabecalhoDaLojaAberta } from "@/app/api/backend"


// GET /api/enderecos — os lugares do estoque, com ocupação de cada um.
// POST /api/enderecos — cadastra uma prateleira nova.
export async function GET() {
    return repassarEndereco("GET", "", null)
}

export async function POST(request: Request) {
    const corpo = await request.json().catch(() => null)
    return repassarEndereco("POST", "", corpo ?? {})
}

export async function repassarEndereco(metodo: "GET" | "POST", caminho: string, corpo: unknown) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(`${API_BASE}/private/enderecos${caminho}`, {
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
