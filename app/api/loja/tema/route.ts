import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"

// Server-only (ao contrário de NEXT_PUBLIC_*): o navegador nunca fala direto
// com o backend Go.
const API_BASE = process.env.API_URL ?? "http://localhost:8080"

/** Uma cor do tema como o backend a aceita: hexadecimal longo, ou vazio. */
const COR_RE = /^#[0-9a-fA-F]{6}$/

// GET /api/loja/tema — as cores e o logo escolhidos por esta loja. Loja que
// nunca mexeu em "Aparência" recebe tudo vazio, que é o tema de fábrica.
export async function GET() {
    return encaminhar("GET")
}

// PUT /api/loja/tema — grava as quatro cores e o logo.
//
// O que se recusa aqui é só o que não é cor. Combinação feia e contraste
// ruim passam de propósito: quem escolhe a cara da loja é o lojista, e a
// tela já o avisa quando o texto fica difícil de ler.
export async function PUT(request: Request) {

    const corpo = safeParse(await request.text().catch(() => ""))

    if (!corpo || typeof corpo !== "object") {
        return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
    }

    const { fundo, texto, destaque, palco, logo_url } = corpo as Record<string, unknown>

    const cores: Record<string, string> = {}

    for (const [nome, valor] of Object.entries({ fundo, texto, destaque, palco })) {

        if (valor === undefined || valor === null || valor === "") {
            cores[nome] = ""
            continue
        }

        if (typeof valor !== "string" || !COR_RE.test(valor.trim())) {
            return Response.json(
                { erro: `A cor de ${nome} precisa estar na forma #RRGGBB` },
                { status: 400 }
            )
        }

        cores[nome] = valor.trim()
    }

    return encaminhar("PUT", {
        ...cores,
        logo_url: typeof logo_url === "string" ? logo_url.trim().slice(0, 500) : "",
    })
}

async function encaminhar(metodo: "GET" | "PUT", corpo?: unknown) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(`${API_BASE}/private/loja/tema`, {
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
