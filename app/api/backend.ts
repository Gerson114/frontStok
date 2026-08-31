// Repasse ao backend Go, usado pelas rotas internas do Next (app/api/*).
//
// Toda rota daqui faz a mesma coisa: pega o cookie de sessão, chama o
// backend com ele no Authorization e devolve a resposta como veio — inclusive
// o status, que é o que faz o 402 (assinatura vencida) e o 409 (tarefa já
// assumida por outra pessoa) chegarem à tela com o significado que têm.
//
// Nenhuma decisão mora aqui: o front não sabe quem pode assumir uma tarefa,
// o que está abaixo do mínimo na prateleira nem quais pedidos entram numa
// onda. Ele mostra o que o servidor respondeu.

import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"

const API_BASE = process.env.API_URL ?? "http://localhost:8080"

export type MetodoHttp = "GET" | "POST" | "PUT" | "DELETE"

export async function repassarAoBackend(
    metodo: MetodoHttp,
    caminho: string,
    corpo?: unknown
): Promise<Response> {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const temCorpo = corpo !== undefined && corpo !== null

        const response = await fetch(`${API_BASE}${caminho}`, {
            method: metodo,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                ...(temCorpo ? { "Content-Type": "application/json" } : {}),
            },
            body: temCorpo ? JSON.stringify(corpo) : undefined,
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
            status: response.status,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

export function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}

/**
 * Corpo opcional: várias rotas da fila aceitam requisição sem corpo nenhum
 * (assumir uma tarefa trabalhando sozinho não tem responsável a informar),
 * então corpo ausente ou ilegível vira objeto vazio em vez de erro.
 */
export async function corpoDaRequisicao(request: Request): Promise<Record<string, unknown>> {
    const texto = await request.text().catch(() => "")
    const dados = texto ? safeParse(texto) : null

    return dados && typeof dados === "object" ? (dados as Record<string, unknown>) : {}
}

/** Id vindo da URL é palpite de quem pediu até ser conferido. */
export function idValido(id: string): boolean {
    return /^[0-9]+$/.test(id)
}
