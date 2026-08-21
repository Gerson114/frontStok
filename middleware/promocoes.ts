import { apiFetch } from "./client"
import type { NovaPromocao } from "@/security/validate"

interface RespostaPromocao {
    mensagem: string
    promocao: {
        id: number
        produto_id: number
        preco_promocional: number
    }
}

export async function criarPromocao(promocao: NovaPromocao): Promise<void> {
    await apiFetch<RespostaPromocao>("/api/promocoes", {
        method: "POST",
        body: promocao,
    })
}

export async function removerPromocao(produtoId: number): Promise<void> {
    await apiFetch<{ mensagem: string }>(`/api/promocoes/${produtoId}`, {
        method: "DELETE",
    })
}
