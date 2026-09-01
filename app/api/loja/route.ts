import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { conta } from "@/app/api/rotas"


// GET /api/loja — identidade da loja logada: nome, endereço público da
// vitrine e se ela está mesmo no ar.
export async function GET() {
    return encaminhar("GET")
}

// PUT /api/loja — grava nome e endereço. O endereço é único entre todas as
// lojas, então o backend pode responder 409; a mensagem dele é repassada
// como veio, porque é ela que a tela mostra.
export async function PUT(request: Request) {
    const corpo = safeParse(await request.text().catch(() => ""))

    if (!corpo || typeof corpo !== "object") {
        return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
    }

    const { nome_loja, slug } = corpo as { nome_loja?: unknown; slug?: unknown }

    if (typeof slug !== "string" || slug.trim() === "") {
        return Response.json({ erro: "Escolha um endereço para a sua loja" }, { status: 400 })
    }

    return encaminhar("PUT", {
        nome_loja: typeof nome_loja === "string" ? nome_loja.slice(0, 60) : "",
        slug: slug.slice(0, 40),
    })
}

async function encaminhar(metodo: "GET" | "PUT", corpo?: unknown) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(url(conta.loja()), {
            method: metodo,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
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
