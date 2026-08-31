import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"

// Server-only (ao contrário de NEXT_PUBLIC_*): o navegador nunca fala direto
// com o backend Go.
const API_BASE = process.env.API_URL ?? "http://localhost:8080"

/**
 * Repassa uma chamada de WhatsApp ao backend, com o token do cookie.
 *
 * Está num arquivo só porque são sete rotas fazendo exatamente a mesma coisa
 * e a única diferença entre elas é o caminho. O erro do backend é repassado
 * como veio: a mensagem dele ("faz mais de 24 horas que este cliente não
 * escreve") é justamente o que a tela precisa mostrar.
 */
export async function repassar(
    metodo: "GET" | "POST" | "PUT" | "DELETE",
    caminho: string,
    corpo?: unknown
) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(`${API_BASE}/private${caminho}`, {
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
        const dados = texto ? safeParse(texto) : null

        if (!response.ok) {
            return Response.json(
                { erro: extrairMensagemErro(dados), ...(typeof dados === "object" && dados ? dados : {}) },
                { status: response.status }
            )
        }

        return Response.json(dados ?? {}, {
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

/** Aceita só dígitos como id — o caminho vai montado numa URL do backend. */
export function idValido(id: string): boolean {
    return /^\d{1,18}$/.test(id)
}

/**
 * Repassa um arquivo do backend (foto de perfil, imagem, áudio, documento).
 *
 * Separado de `repassar` porque aqui o corpo é binário: transformar em JSON
 * corromperia o arquivo. Os cabeçalhos de segurança que o backend pôs vêm
 * junto de propósito — é ele quem sabe se o tipo pode abrir na tela ou tem de
 * descer como anexo, e reescrevê-los aqui abriria a brecha que lá foi
 * fechada.
 */
export async function repassarArquivo(caminho: string) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return new Response("Não autenticado", { status: 401 })
        }

        const response = await fetch(`${API_BASE}/private${caminho}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        })

        if (!response.ok) {
            return new Response("Arquivo não encontrado", { status: response.status })
        }

        const cabecalhos = new Headers()

        for (const nome of [
            "Content-Type",
            "Content-Length",
            "Content-Disposition",
            "X-Content-Type-Options",
            "Content-Security-Policy",
        ]) {
            const valor = response.headers.get(nome)
            if (valor) cabecalhos.set(nome, valor)
        }

        // Conversa de cliente não fica em cache de intermediário nenhum.
        cabecalhos.set("Cache-Control", "private, no-store")

        return new Response(response.body, { status: 200, headers: cabecalhos })

    } catch {
        return new Response("Erro interno do servidor", { status: 500 })
    }
}
