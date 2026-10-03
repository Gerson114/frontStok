// A venda no balcão: o cliente na frente, a peça saindo e o dinheiro entrando
// no mesmo instante.
//
// Nada aqui decide preço nem escolhe peça. O preço sai do cadastro no
// servidor, com a promoção aplicada, e qual peça sai é decisão do estoque
// (validade primeiro, depois prateleira). Se o preço viesse daqui, o valor da
// venda viria do navegador.

import { apiFetch } from "./client"
import type {
    ItemDoBalcao,
    MeioDePagamento,
    ResultadoDoCancelamento,
    VendaDoBalcao,
    VendaResumida,
} from "@/app/type/type"

/**
 * Uma linha da sacola, do jeito que ela viaja para o servidor.
 *
 * `etiqueta` é o código BIPADO, e só vai preenchido quando a linha nasceu de
 * uma etiqueta de balança. O preço NÃO viaja — nunca —, e é esta a razão de o
 * campo existir: o valor do queijo pesado só está dentro do código de barras
 * que a balança imprimiu, e o servidor relê esse valor de lá com a mesma
 * função que o leitor usou. Mandar o preço daqui seria deixar o navegador
 * escolher quanto o cliente paga.
 */
export interface LinhaParaVender {
    produto_id: number
    quantidade: number
    etiqueta?: string
}

/**
 * Resolve o código lido ou digitado.
 *
 * É a mesma rota para o leitor USB (que digita o código e dá Enter) e para o
 * dedo, então a tela funciona igual dos dois jeitos.
 */
export async function consultarItemDoBalcao(codigo: string): Promise<ItemDoBalcao> {
    return apiFetch<ItemDoBalcao>(`/api/balcao/item?codigo=${encodeURIComponent(codigo)}`)
}

/**
 * Conclui a venda inteira, ou nenhuma parte dela.
 *
 * A atomicidade é do servidor, e é o que separa esta chamada da anterior, que
 * vendia uma peça por vez: com três peças na sacola e a terceira faltando, o
 * cliente saía com duas cobradas e nenhuma forma de desfazer.
 *
 * Falta de estoque volta como 409 com o nome do produto e quanto falta — é o
 * que o vendedor precisa para resolver na frente do cliente.
 */
export async function venderNoBalcao(
    itens: LinhaParaVender[],
    meio: MeioDePagamento,
    recebido = 0,
): Promise<VendaDoBalcao> {
    return apiFetch<VendaDoBalcao>("/api/balcao/vender", {
        method: "POST",
        body: { itens, meio, recebido },
    })
}

/**
 * As vendas já feitas, da mais recente para a mais antiga.
 *
 * É a lista de onde se cancela. As canceladas ficam de fora por padrão — são
 * ruído para quem está no caixa agora — e aparecem com `canceladas`.
 *
 * `horas_para_cancelar` vem junto para a tela poder EXPLICAR por que o botão
 * desapareceu de uma venda antiga, em vez de simplesmente não o mostrar.
 */
export async function listarVendasDoBalcao(
    canceladas = false,
): Promise<{ vendas: VendaResumida[]; horas_para_cancelar: number }> {

    const query = canceladas ? "?canceladas=1" : ""

    return apiFetch<{ vendas: VendaResumida[]; horas_para_cancelar: number }>(
        `/api/balcao/vendas${query}`,
    )
}

/**
 * Estorna uma venda: as peças voltam ao estoque e ela sai do faturamento.
 *
 * O motivo é opcional de propósito — exigir justificativa com o cliente
 * esperando produz "erro" e "aaa" em metade das linhas, que é pior que o vazio
 * honesto. Quem quiser auditar tem a hora e o autor, que ficam na venda.
 *
 * Venda já cancelada e prazo vencido voltam como 409 com a frase que explica
 * cada caso. A tela repassa essa frase em vez de escrever a sua: o prazo é do
 * servidor, e repeti-lo aqui criaria dois números para divergir.
 */
export async function cancelarVendaDoBalcao(
    id: number,
    motivo = "",
): Promise<ResultadoDoCancelamento> {
    return apiFetch<ResultadoDoCancelamento>(`/api/balcao/vendas/${id}/cancelar`, {
        method: "POST",
        body: { motivo },
    })
}
