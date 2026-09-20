// O que o cliente escolhe junto do produto: borda, ponto da carne, tamanho.
//
// Nada aqui calcula preço nem decide o que é válido. Quem confere que a opção
// existe, é desta loja, está ativa e cabe no mínimo e no máximo do grupo é o
// servidor, na hora de fechar o pedido — o catálogo daqui serve para MONTAR a
// tela, não para validar.

import { apiFetch } from "./client"
import type { CatalogoDeAdicionais, GrupoDeAdicional, OpcaoDeAdicional } from "@/app/type/type"

/** Os grupos, as opções e a que produtos cada grupo está ligado. */
export async function consultarAdicionais(): Promise<CatalogoDeAdicionais> {

    const dados = await apiFetch<CatalogoDeAdicionais>("/api/adicionais")

    return {
        grupos: dados.grupos ?? [],
        ligacoes: dados.ligacoes ?? [],
        limites: dados.limites ?? { grupos_por_loja: 60, opcoes_por_grupo: 40, grupos_por_produto: 10, observacao_do_item: 200 },
    }
}

/** Cria um grupo. É a pergunta que o cliente vai ler: "Borda", "Ponto da carne". */
export async function criarGrupo(
    grupo: { nome: string; minimo: number; maximo: number; ordem?: number },
): Promise<GrupoDeAdicional> {

    const dados = await apiFetch<{ grupo: GrupoDeAdicional }>("/api/adicionais/grupos", {
        method: "POST",
        body: grupo,
    })

    return dados.grupo
}

export async function salvarGrupo(
    id: number,
    grupo: { nome: string; minimo: number; maximo: number; ordem?: number },
): Promise<void> {
    await apiFetch(`/api/adicionais/grupos/${id}`, { method: "PUT", body: grupo })
}

/**
 * Apaga o grupo, as opções dele e as ligações com os produtos.
 *
 * Os pedidos antigos não perdem nada: o que foi escolhido está congelado
 * dentro de cada item, e não é uma ligação para este catálogo.
 */
export async function excluirGrupo(id: number): Promise<void> {
    await apiFetch(`/api/adicionais/grupos/${id}`, { method: "DELETE" })
}

export async function criarOpcao(
    opcao: { grupo_id: number; nome: string; preco: number; ativa?: boolean; ordem?: number },
): Promise<OpcaoDeAdicional> {

    const dados = await apiFetch<{ opcao: OpcaoDeAdicional }>("/api/adicionais/opcoes", {
        method: "POST",
        body: opcao,
    })

    return dados.opcao
}

export async function salvarOpcao(
    id: number,
    opcao: { nome: string; preco: number; ativa: boolean; ordem?: number },
): Promise<void> {
    await apiFetch(`/api/adicionais/opcoes/${id}`, { method: "PUT", body: opcao })
}

export async function excluirOpcao(id: number): Promise<void> {
    await apiFetch(`/api/adicionais/opcoes/${id}`, { method: "DELETE" })
}

/**
 * Define quais perguntas um produto faz.
 *
 * Manda a lista INTEIRA e substitui, em vez de ligar e desligar um de cada
 * vez: é como a tela funciona, e mandar o estado final evita o caso em que
 * duas abas abertas somam suas escolhas.
 */
export async function ligarGruposAoProduto(produtoID: number, grupos: number[]): Promise<void> {
    await apiFetch(`/api/produtos/${produtoID}/adicionais`, { method: "PUT", body: { grupos } })
}
