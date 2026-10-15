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
 * O desconto como o caixa o pede.
 *
 * Duas formas, porque são as duas que a conversa no balcão produz: "faz
 * cinquenta reais" e "dá dez por cento". Nenhuma é convertida na outra aqui —
 * as duas vão como foram ditas, e quem calcula, confere contra o teto da loja
 * e reparte entre as linhas é o servidor.
 *
 * O percentual vence o valor quando os dois vêm preenchidos.
 */
export interface DescontoPedido {
    valor?: number
    percentual?: number
    motivo?: string
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
    desconto: DescontoPedido = {},
): Promise<VendaDoBalcao> {
    return apiFetch<VendaDoBalcao>("/api/balcao/vender", {
        method: "POST",
        body: { itens, meio, recebido, desconto },
    })
}

/**
 * Acha produtos pelo NOME, para quando não há código para bipar.
 *
 * Devolve o MESMO tipo da leitura de código, e isso é o que importa nesta
 * função: a tela tem um caminho só para pôr item na sacola, venha ele do
 * leitor ou da busca. Dois formatos seriam dois caminhos, e o segundo
 * envelheceria.
 *
 * Abaixo de dois caracteres devolve lista vazia sem chamar o servidor: com uma
 * letra, o resultado é quase o catálogo inteiro cortado em vinte linhas
 * arbitrárias — o que parece um resultado e não é.
 */
export async function buscarNoBalcao(nome: string): Promise<ItemDoBalcao[]> {

    const termo = nome.trim()

    if (termo.length < 2) return []

    const resposta = await apiFetch<{ produtos: ItemDoBalcao[] }>(
        `/api/balcao/buscar?nome=${encodeURIComponent(termo)}`,
    )

    return resposta.produtos ?? []
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
): Promise<RespostaDasVendas> {

    const query = canceladas ? "?canceladas=1" : ""

    return apiFetch<RespostaDasVendas>(`/api/balcao/vendas${query}`)
}

/**
 * O que a listagem de vendas devolve.
 *
 * O teto do desconto vem de carona aqui, e não de uma rota própria: a tela do
 * caixa já faz esta chamada ao abrir, e quem decide o teto é o dono, na
 * configuração da loja (ver services/balcao.Listar, no backend). Zero quer
 * dizer desligado — a tela não mostra campo de desconto nenhum.
 */
export interface RespostaDasVendas {
    vendas: VendaResumida[]
    horas_para_cancelar: number
    desconto_maximo: number
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
