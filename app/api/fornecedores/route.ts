import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"

const API_BASE = process.env.API_URL ?? "http://localhost:8080"

// GET /api/fornecedores — de quem a loja compra.
export async function GET() {
    return repassar("GET", null)
}

// POST /api/fornecedores — cadastra um fornecedor.
//
// Só o nome é exigido; o resto é o que o lojista quiser anotar. Quem valida
// de fato é o backend — aqui apenas evitamos mandar um corpo vazio.
export async function POST(request: Request) {
    const corpo = safeParse(await request.text().catch(() => "")) as Record<string, unknown> | null

    if (!corpo || typeof corpo.nome !== "string" || !corpo.nome.trim()) {
        return Response.json({ erro: "Informe o nome do fornecedor" }, { status: 400 })
    }

    return repassar("POST", {
        nome: corpo.nome,
        documento: corpo.documento ?? "",
        contato: corpo.contato ?? "",
        observacao: corpo.observacao ?? "",
    })
}

async function repassar(metodo: "GET" | "POST", corpo: unknown) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(`${API_BASE}/private/fornecedores`, {
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
