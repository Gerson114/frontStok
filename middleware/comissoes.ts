// A comissão do mês de quem vende por percentual.
//
// Nada aqui calcula nada: a conta é do backend, sobre as peças que saíram e
// não voltaram, e a tela só desenha o que vier. Fosse calculado aqui, o valor
// da tela e o valor gravado no fechamento poderiam divergir — e o que se paga
// é o gravado.

import { apiFetch } from "./client"
import type { FechamentoDeComissao } from "@/app/type/type"

/**
 * O fechamento de um mês.
 *
 * Sem mês, o backend responde o PASSADO: é o mês que se fecha, e a tela abre
 * em cima do trabalho que existe para fazer.
 */
export async function consultarComissoes(mes?: string): Promise<FechamentoDeComissao> {

    const busca = mes ? `?mes=${encodeURIComponent(mes)}` : ""

    return apiFetch<FechamentoDeComissao>(`/api/comissoes${busca}`)
}

/** Congela o mês. Recusado com 400 enquanto o mês não terminou. */
export async function fecharComissoes(mes: string): Promise<void> {
    await apiFetch(`/api/comissoes/fechar?mes=${encodeURIComponent(mes)}`, { method: "POST" })
}

/**
 * Devolve o mês ao estado de conta.
 *
 * Não estorna nem paga nada — o dinheiro já saiu por fora do sistema. Serve
 * para consertar percentual errado, nome trocado ou devolução que entrou
 * depois, e fechar de novo com o valor certo.
 */
export async function reabrirComissoes(mes: string): Promise<void> {
    await apiFetch(`/api/comissoes/reabrir?mes=${encodeURIComponent(mes)}`, { method: "POST" })
}
