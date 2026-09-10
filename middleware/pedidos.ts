import { apiFetch } from "./client"
import type { Etiqueta, Pedido, StatusPedido } from "@/app/type/type"

interface RespostaPedidos {
    pedidos: Pedido[]
}

interface RespostaEtiquetas {
    etiquetas: Etiqueta[]
}

export async function listarPedidos(): Promise<Pedido[]> {
    const dados = await apiFetch<RespostaPedidos>("/api/pedidos")
    return Array.isArray(dados.pedidos) ? dados.pedidos : []
}

/**
 * Os pedidos presos esperando o pagamento cair.
 *
 * Vêm de uma consulta separada porque a lista normal os exclui de propósito:
 * pedido não pago não é venda, e misturá-lo com o trabalho do dia faria
 * separar mercadoria de quem nunca pagou.
 */
export async function listarPedidosAguardando(): Promise<Pedido[]> {
    const dados = await apiFetch<RespostaPedidos>("/api/pedidos?pagamento=aguardando")
    return Array.isArray(dados.pedidos) ? dados.pedidos : []
}

interface RespostaVerificacao {
    pagamento_status: string
    mensagem: string
}

/** Pergunta ao provedor se aquele pedido foi pago, em vez de esperar o aviso. */
export async function verificarPagamento(codigo: string): Promise<RespostaVerificacao> {
    return apiFetch<RespostaVerificacao>(`/api/pedidos/${codigo}/verificar-pagamento`, {
        method: "POST",
    })
}

/** Os meios que a loja pode declarar ao confirmar um recebimento por fora. */
export type MeioManual = "pix" | "dinheiro" | "maquininha" | "transferencia" | "outro"

/**
 * Confirma à mão que o dinheiro entrou.
 *
 * Não pergunta nada ao provedor: é a loja AFIRMANDO que recebeu, para o caso
 * de Pix direto, dinheiro na entrega ou aviso do provedor que se perdeu. O
 * backend grava quem afirmou e por qual meio, e um pedido já pago pelo
 * provedor não é sobrescrito.
 */
export async function confirmarPagamentoManual(
    codigo: string,
    meio: MeioManual,
): Promise<RespostaVerificacao> {
    return apiFetch<RespostaVerificacao>(`/api/pedidos/${codigo}/pagamento-manual`, {
        method: "POST",
        body: JSON.stringify({ meio }),
    })
}

/**
 * Muda a situação do pedido, e só ela.
 *
 * Confirmar é dizer "aceitei, estou preparando" — não é assumir o dia em que
 * a mercadoria sai. Quem grava esse dia é marcarDiaDeEnvio, quando a loja
 * souber.
 */
export async function atualizarStatusPedido(
    id: number,
    status: StatusPedido,
): Promise<Pedido> {
    const resposta = await apiFetch<{ pedido: Pedido }>(`/api/pedidos/${id}/status`, {
        method: "PUT",
        body: { status },
    })

    return resposta.pedido
}

/**
 * Marca o dia em que o pedido sai da loja ("AAAA-MM-DD") — é o que o põe no
 * calendário da agenda de entregas.
 *
 * Vazio desmarca: o pedido sai do calendário e volta para a fila de preparo,
 * que é como se desfaz um dia escolhido cedo demais sem ter de inventar outro.
 */
export async function marcarDiaDeEnvio(id: number, dia: string): Promise<Pedido> {
    const resposta = await apiFetch<{ pedido: Pedido }>(`/api/pedidos/${id}/envio`, {
        method: "PUT",
        body: { envio_previsto_em: dia },
    })

    return resposta.pedido
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

/**
 * Grava quem levou o pedido e com que código.
 *
 * Não mexe no status: despachar e mudar a situação são a mesma coisa aos
 * olhos do lojista, mas o status debita estoque na entrega — e as duas
 * gravações juntas fariam uma acontecer sem ninguém ter pedido.
 */
export async function salvarRastreio(
    id: number,
    dados: { transportadora: string; codigo_rastreio: string },
): Promise<void> {
    await apiFetch(`/api/pedidos/${id}/rastreio`, {
        method: "PUT",
        body: dados,
    })
}

/** A agenda de entregas de um mês, mais o que não tem dia e o que perdeu o seu. */
export interface Agenda {
    mes: string
    entregas: Pedido[]

    /**
     * Os que passaram do dia marcado sem serem despachados.
     *
     * Vêm à parte e vêm SEMPRE, mesmo fora do mês que se está olhando: sumir
     * com o pedido atrasado quando o lojista vira a página do calendário é
     * perder de vista justamente o que precisava dele.
     */
    atrasados: Pedido[]

    /**
     * Os que a loja está preparando: confirmados, sem dia de saída marcado.
     *
     * Não estão no calendário de propósito — ninguém disse ainda em que dia
     * eles saem, e chutar um dia encheria a agenda de trabalho que não existe.
     * É desta fila que o lojista joga cada pedido para o seu dia.
     */
    em_preparo: Pedido[]
}

export async function consultarAgenda(mes: string): Promise<Agenda> {
    const dados = await apiFetch<Agenda>(`/api/entregas?mes=${encodeURIComponent(mes)}`)

    return {
        mes: dados.mes,
        entregas: dados.entregas ?? [],
        atrasados: dados.atrasados ?? [],
        em_preparo: dados.em_preparo ?? [],
    }
}
