import { sanitizeText } from "@/security/sanitize"

// Pública: sem cookie, sem Authorization — só repassa a busca do catálogo
// para o backend (rota pública /public/produtos), no mesmo padrão de proxy
// usado no resto do app, para o navegador nunca falar direto com o backend.
const API_BASE = process.env.API_URL ?? "http://localhost:8080"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const nome = sanitizeText(searchParams.get("nome") ?? "").slice(0, 100)

        const url = new URL("/public/produtos", API_BASE)
        if (nome) {
            url.searchParams.set("nome", nome)
        }

        const response = await fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ erro: "Não foi possível carregar os produtos" }, { status: response.status })
        }

        const dados = safeParse(texto)

        if (!dados) {
            return Response.json({ erro: "Resposta inválida do servidor" }, { status: 502 })
        }

        return Response.json(dados, {
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
