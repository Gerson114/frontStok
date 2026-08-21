import { apiFetch } from "./client"
import type { Produto, Unidade } from "@/app/type/type"
import type { NovoProduto, ProdutoEditavel, NovaTransferencia } from "@/security/validate"

interface RespostaConsulta {
    produtos: Produto[]
}

interface RespostaCadastro {
    mensagem: string
    produto: Produto
}

interface RespostaUnidades {
    unidades: Unidade[]
}

interface RespostaVenda {
    mensagem: string
    unidade: Unidade
    produto: Produto
}

export async function listarProdutos(): Promise<Produto[]> {
    const dados = await apiFetch<RespostaConsulta>("/api/consulta")
    return Array.isArray(dados.produtos) ? dados.produtos : []
}

/**
 * Não existe endpoint de busca por ID no backend — a loja é pequena o
 * bastante para buscar a lista inteira e filtrar aqui.
 */
export async function buscarProdutoPorId(id: number): Promise<Produto | null> {
    const produtos = await listarProdutos()
    return produtos.find((produto) => produto.id === id) ?? null
}

export async function cadastrarProduto(produto: NovoProduto): Promise<Produto> {
    const dados = await apiFetch<RespostaCadastro>("/api/produtos", {
        method: "POST",
        body: produto,
    })

    return dados.produto
}

export async function editarProduto(id: number, produto: ProdutoEditavel): Promise<Produto> {
    const dados = await apiFetch<RespostaCadastro>(`/api/produtos/${id}`, {
        method: "PUT",
        body: produto,
    })

    return dados.produto
}

export async function listarUnidades(produtoId: number): Promise<Unidade[]> {
    const dados = await apiFetch<RespostaUnidades>(`/api/produtos/${produtoId}/unidades`)
    return Array.isArray(dados.unidades) ? dados.unidades : []
}

/** Unidades de todos os produtos — usado no mapa de estoque (rua/bloco). */
export async function listarTodasUnidades(): Promise<Unidade[]> {
    const dados = await apiFetch<RespostaUnidades>("/api/unidades")
    return Array.isArray(dados.unidades) ? dados.unidades : []
}

/** Marca a próxima unidade disponível do produto como vendida e desconta 1 do estoque. */
export async function venderUnidade(produtoId: number): Promise<RespostaVenda> {
    return apiFetch<RespostaVenda>(`/api/produtos/${produtoId}/vender`, {
        method: "POST",
    })
}

/** Move uma unidade específica para outro local (rua/bloco). */
export async function transferirUnidade(unidadeId: number, transferencia: NovaTransferencia): Promise<void> {
    await apiFetch<{ mensagem: string }>(`/api/unidades/${unidadeId}/transferir`, {
        method: "POST",
        body: transferencia,
    })
}

/** Marca uma unidade específica como avariada e desconta 1 do estoque vendável. */
export async function avariarUnidade(unidadeId: number): Promise<void> {
    await apiFetch<{ mensagem: string }>(`/api/unidades/${unidadeId}/avariar`, {
        method: "POST",
    })
}

/** Desfaz a marcação de avaria de uma unidade e devolve 1 ao estoque vendável. */
export async function restaurarUnidade(unidadeId: number): Promise<void> {
    await apiFetch<{ mensagem: string }>(`/api/unidades/${unidadeId}/restaurar`, {
        method: "POST",
    })
}
