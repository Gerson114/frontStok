// Cliente HTTP único usado por todas as chamadas às rotas internas do
// Next (app/api/*). Centraliza credenciais, cabeçalhos e tratamento de erro
// para que os componentes nunca precisem chamar `fetch` diretamente.

export class ApiError extends Error {
    status: number

    constructor(message: string, status: number) {
        super(message)
        this.name = "ApiError"
        this.status = status
    }
}

interface ApiFetchOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE"
    body?: unknown
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
    const response = await fetch(path, {
        method: options.method ?? "GET",
        credentials: "include",
        cache: "no-store",
        headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })

    const texto = await response.text()
    const dados = texto ? safeParse(texto) : null

    if (!response.ok) {
        throw new ApiError(extrairMensagemErro(dados), response.status)
    }

    return dados as T
}

function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}

export function extrairMensagemErro(dados: unknown): string {
    if (dados && typeof dados === "object" && "erro" in dados) {
        return String((dados as { erro: unknown }).erro)
    }

    return "Erro inesperado ao comunicar com o servidor."
}
