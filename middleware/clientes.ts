// Quem compra na loja, do ponto de vista do painel: a lista com o que cada um
// somou e o histórico completo de uma pessoa. Tudo passa pelas rotas internas
// /api/clientes, como o resto do painel.

import { apiFetch } from "./client"

/** Uma linha da lista de clientes. */
export interface ClienteResumo {
    id: number
    nome: string
    contato: string

    /** Falso é o cliente que o próprio lojista cadastrou ao lançar um pedido. */
    tem_conta: boolean

    cliente_desde: string

    /** Só o que virou venda: cancelado e não pago ficam de fora das somas. */
    pedidos: number
    total_gasto: number
    ultimo_pedido: string | null

    /** Mensagens do chat do site esperando resposta. */
    nao_lidas: number
}

export interface ItemDoHistorico {
    produto_id: number
    produto_nome: string
    quantidade: number
    preco: number
}

export interface PedidoDoHistorico {
    id: number
    codigo: string
    status: string
    pagamento_status: string
    created_at: string
    total: number
    pecas: number
    entrega_tipo: string
    cidade: string
    uf: string
    telefone: string
    itens: ItemDoHistorico[]
}

export interface EnderecoUsado {
    logradouro: string
    numero: string
    complemento: string
    bairro: string
    cidade: string
    uf: string
    cep: string
}

export interface AvaliacaoDoCliente {
    produto_id: number
    produto_nome: string
    nota: number
    comentario: string
    criada_em: string
}

export interface Historico {
    cliente: {
        id: number
        nome: string
        contato: string
        tem_conta: boolean
        cliente_desde: string
    }
    resumo: {
        pedidos: number
        total_gasto: number
        ticket_medio: number
        primeiro_pedido: string | null
        ultimo_pedido: string | null
    }
    pedidos: PedidoDoHistorico[]
    enderecos: EnderecoUsado[]
    avaliacoes: AvaliacaoDoCliente[]
    conversa: { id?: number; ultima_mensagem_em?: string; nao_lidas?: number }
}

export async function listarClientes(): Promise<ClienteResumo[]> {
    const dados = await apiFetch<{ clientes?: ClienteResumo[] }>("/api/clientes")
    return Array.isArray(dados.clientes) ? dados.clientes : []
}

export async function historicoDoCliente(id: number): Promise<Historico> {
    return apiFetch<Historico>(`/api/clientes/${id}`)
}

/**
 * Anonimiza o cliente: os dados pessoais somem, os pedidos ficam sem dono.
 *
 * Existe para atender ao pedido de eliminação previsto na LGPD (art. 18, VI)
 * sem que a loja perca o histórico de vendas que a lei fiscal manda guardar.
 */
export async function anonimizarCliente(id: number): Promise<void> {
    await apiFetch(`/api/clientes/${id}/anonimizar`, { method: "POST" })
}
