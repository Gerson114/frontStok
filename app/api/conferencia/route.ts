import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { estoque } from "@/app/api/rotas"


// POST /api/conferencia — fecha uma contagem de estoque.
//
// Manda o trecho conferido e os códigos encontrados; o backend responde o
// que faltou (com nome e onde deveria estar) e o que sobrou, e grava o
// resultado para servir de auditoria depois.
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const corpo = safeParse(await request.text().catch(() => "")) as Record<string, unknown> | null

        if (!corpo || !Array.isArray(corpo.codigos)) {
            return Response.json({ erro: "Bipe ao menos uma peça antes de fechar" }, { status: 400 })
        }

        const response = await fetch(url(estoque.conferencia()), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                // Código da prateleira conferida; vazio confere a loja
                // inteira, que é a contagem geral.
                endereco: String(corpo.endereco ?? "").trim(),
                codigos: corpo.codigos,
            }),
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: response.status })
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
