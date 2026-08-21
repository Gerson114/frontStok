import { cookies } from "next/headers"
import { sanitizeText, sanitizeUrl } from "@/security/sanitize"
import { validarProduto, type NovoProduto } from "@/security/validate"
import { extrairMensagemErro } from "@/middleware/client"

const API_BASE = process.env.API_URL ?? "http://localhost:8080"

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const body = await request.json().catch(() => null)

        if (!body || typeof body !== "object") {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const entrada = body as Record<string, unknown>

        const produto: NovoProduto = {
            nome: sanitizeText(String(entrada.nome ?? "")),
            categoria: sanitizeText(String(entrada.categoria ?? "")),
            tamanho: sanitizeText(String(entrada.tamanho ?? "")),
            tecido: sanitizeText(String(entrada.tecido ?? "")),
            cor: sanitizeText(String(entrada.cor ?? "")),
            imagem_url: sanitizeUrl(String(entrada.imagem_url ?? "")),
            preco: Number(entrada.preco),
            estoque: Number(entrada.estoque),
            loja_id: Number(entrada.loja_id),
            rua: Number(entrada.rua),
            bloco: sanitizeText(String(entrada.bloco ?? "")).toUpperCase(),
        }

        const erros = validarProduto(produto)

        if (erros.length > 0) {
            return Response.json({ erro: erros[0], erros }, { status: 400 })
        }

        const response = await fetch(`${API_BASE}/private/cadastrarProduto`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(produto),
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: response.status })
        }

        const dados = safeParse(texto)

        if (!dados) {
            return Response.json({ erro: "Resposta inválida do servidor" }, { status: 502 })
        }

        return Response.json(dados, {
            status: 201,
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
