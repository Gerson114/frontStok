import { apiFetch } from "./client"
import type { Produto, Unidade } from "@/app/type/type"
import type { NovoProduto, NovoProdutoVariantes, ProdutoEditavel, NovaTransferencia } from "@/security/validate"

interface RespostaConsulta {
    produtos: Produto[]
}

interface RespostaCadastro {
    mensagem: string
    produto: Produto
}

interface RespostaCadastroVariantes {
    mensagem: string
    produtos: Produto[]
}

interface RespostaUnidades {
    unidades: Unidade[]
}

interface RespostaVenda {
    mensagem: string
    unidade: Unidade
    produto: Produto
}

/**
 * Como uma peça se identifica nas telas do painel.
 *
 * O código é o do PRODUTO — o mesmo nas cinco camisetas P brancas, porque é
 * ele que vai na etiqueta de todas elas. O que distingue uma peça da outra
 * aqui dentro é a sequência, o número de ordem em que ela entrou no estoque;
 * ela não está impressa em lugar nenhum e serve só para o lojista saber de
 * qual peça a tela está falando quando transfere ou avaria uma.
 */
export function identificarPeca(codigoProduto: string | undefined, sequencia: number): string {
    return `${codigoProduto || "sem código"} · peça ${sequencia}`
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

/** Cadastra a mesma peça em vários tamanhos de uma vez (ver NovoProdutoVariantes). */
export async function cadastrarProdutoVariantes(produto: NovoProdutoVariantes): Promise<Produto[]> {
    const dados = await apiFetch<RespostaCadastroVariantes>("/api/produtos/variantes", {
        method: "POST",
        body: produto,
    })

    return dados.produtos
}

export async function editarProduto(id: number, produto: ProdutoEditavel): Promise<Produto> {
    const dados = await apiFetch<RespostaCadastro>(`/api/produtos/${id}`, {
        method: "PUT",
        body: produto,
    })

    return dados.produto
}

/**
 * Põe ou tira o produto da vitrine.
 *
 * Não cria nem apaga nada: a vitrine é uma escolha sobre o que o estoque já
 * tem. Ter dois lugares para criar produto criaria duas verdades sobre o que
 * a loja vende.
 */
export async function publicarProduto(id: number, publicado: boolean): Promise<void> {
    await apiFetch<{ mensagem: string }>(`/api/produtos/${id}/vitrine`, {
        method: "PUT",
        body: { publicado },
    })
}

/** Exclui permanentemente um produto e suas unidades. */
export async function excluirProduto(id: number): Promise<void> {
    await apiFetch<{ mensagem: string }>(`/api/produtos/${id}`, {
        method: "DELETE",
    })
}

export async function listarUnidades(produtoId: number): Promise<Unidade[]> {
    const dados = await apiFetch<RespostaUnidades>(`/api/produtos/${produtoId}/unidades`)
    return Array.isArray(dados.unidades) ? dados.unidades : []
}

/** Unidades de todos os produtos — usado no mapa de endereços do estoque. */
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

/**
 * Move uma peça para outro endereço do estoque.
 *
 * `destino` é o código da prateleira, o mesmo escrito na etiqueta dela. Quem
 * recusa endereço inexistente, bloqueado ou sem espaço é o servidor: a tela
 * mostra o erro que ele devolveu, em vez de tentar adivinhar antes.
 */
export async function transferirUnidade(unidadeId: number, destino: string): Promise<void> {
    const transferencia: NovaTransferencia = { destino }

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

/** Exclui permanentemente uma unidade específica do estoque. */
export async function excluirUnidade(unidadeId: number): Promise<void> {
    await apiFetch<{ mensagem: string }>(`/api/unidades/${unidadeId}`, {
        method: "DELETE",
    })
}
