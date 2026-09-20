// A venda no balcão: o cliente na frente, a peça saindo e o dinheiro entrando
// no mesmo instante.
//
// Nada aqui decide preço nem escolhe peça. O preço sai do cadastro no
// servidor, com a promoção aplicada, e qual peça sai é decisão do estoque
// (validade primeiro, depois prateleira). Se o preço viesse daqui, o valor da
// venda viria do navegador.

import { apiFetch } from "./client"
import type { ItemDoBalcao, MeioDePagamento, VendaDoBalcao } from "@/app/type/type"

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
    itens: { produto_id: number; quantidade: number }[],
    meio: MeioDePagamento,
): Promise<VendaDoBalcao> {
    return apiFetch<VendaDoBalcao>("/api/balcao/vender", {
        method: "POST",
        body: { itens, meio },
    })
}
