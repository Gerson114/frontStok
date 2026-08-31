import { apiFetch } from "./client"
import type { Etiqueta, Pedido, StatusPedido } from "@/app/type/type"

interface RespostaPedidos {
    pedidos: Pedido[]
}

interface RespostaEtiquetas {
    etiquetas: Etiqueta[]
}

interface RespostaAtualizarStatus {
    mensagem: string
    pedido: Pedido
}

export async function listarPedidos(): Promise<Pedido[]> {
    const dados = await apiFetch<RespostaPedidos>("/api/pedidos")
    return Array.isArray(dados.pedidos) ? dados.pedidos : []
}

export async function atualizarStatusPedido(id: number, status: StatusPedido): Promise<Pedido> {
    const dados = await apiFetch<RespostaAtualizarStatus>(`/api/pedidos/${id}/status`, {
        method: "PUT",
        body: { status },
    })

    return dados.pedido
}

/**
 * A fila de etiquetas da loja: os pedidos confirmados, um por etiqueta.
 *
 * Quem decide o que entra — e faz as somas de peças e valor — é o backend.
 * Filtrar por status aqui seria repetir a regra em dois lugares, e o dia em
 * que ela mudasse a tela imprimiria etiqueta de pedido que não devia.
 */
export async function listarEtiquetas(): Promise<Etiqueta[]> {
    const dados = await apiFetch<RespostaEtiquetas>("/api/pedidos/etiquetas")
    return Array.isArray(dados.etiquetas) ? dados.etiquetas : []
}


// ---------------------------------------------------------------------------
// Pedido que veio de fora
// ---------------------------------------------------------------------------

/**
 * Uma linha da lista que chegou por WhatsApp, telefone ou papel: o produto e
 * quantas peças o cliente pediu.
 */
export interface ItemLancado {
    produto_id: number
    quantidade: number
}

/** O que o estoque cobre de cada linha da lista. */
export interface LinhaConferida {
    produto_id: number
    produto_nome: string
    produto_codigo: string
    pedido: number
    disponivel: number
    falta: number
}

export interface Conferencia {
    itens: LinhaConferida[]
    /** Falso quando alguma linha não tem peça suficiente. */
    atende_tudo: boolean
}

/**
 * Compara a lista com o estoque, sem reservar nada.
 *
 * É a conferência que se faz de olho na lista antes de lançar: quem decide o
 * que há é o servidor, pelo mesmo critério de saída do balcão e da vitrine.
 */
export async function conferirDisponibilidade(itens: ItemLancado[]): Promise<Conferencia> {

    const dados = await apiFetch<Partial<Conferencia>>("/api/pedidos/conferir", {
        method: "POST",
        body: { itens },
    })

    return {
        itens: Array.isArray(dados.itens) ? dados.itens : [],
        atende_tudo: dados.atende_tudo !== false,
    }
}

/** O que não coube no pedido lançado. */
export interface Falta {
    produto_id: number
    produto_nome: string
    produto_codigo: string
    pedido: number
    disponivel: number
}

export interface PedidoLancado {
    mensagem: string
    pedido: Pedido
    faltas: Falta[]
}

/**
 * Lança o pedido e reserva as peças.
 *
 * Sem `aceitarParcial`, o servidor recusa o lançamento inteiro quando falta
 * peça (409, com a lista do que falta) — é o que impede meio pedido de ir
 * para a separação sem ninguém saber. Com ele, lança o que dá para atender
 * agora e devolve a diferença para quem lançou resolver com o cliente.
 *
 * O pedido nasce confirmado: quem lançou foi a própria loja, com a lista na
 * frente, então ele já aparece na separação e na fila de etiquetas.
 */
export async function lancarPedido(
    cliente: { nome: string; contato: string },
    itens: ItemLancado[],
    aceitarParcial = false
): Promise<PedidoLancado> {

    const dados = await apiFetch<Partial<PedidoLancado>>("/api/pedidos", {
        method: "POST",
        body: {
            cliente_nome: cliente.nome,
            cliente_contato: cliente.contato,
            itens,
            aceitar_parcial: aceitarParcial,
        },
    })

    return {
        mensagem: dados.mensagem ?? "",
        pedido: dados.pedido as Pedido,
        faltas: Array.isArray(dados.faltas) ? dados.faltas : [],
    }
}
