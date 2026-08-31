import { apiFetch } from "./client"
import type { Produto } from "@/app/type/type"

interface RespostaCatalogo {
    produtos: Produto[]
}

/** Catálogo público de produtos (vitrine), sem exigir sessão. */
export async function listarCatalogo(nome?: string): Promise<Produto[]> {
    const query = nome ? `?nome=${encodeURIComponent(nome)}` : ""
    const dados = await apiFetch<RespostaCatalogo>(`/api/catalogo${query}`)
    return Array.isArray(dados.produtos) ? dados.produtos : []
}
