// As lojas do dono: abrir, renomear, fechar e trocar a que o painel mostra.
//
// Tudo passa pelas rotas internas do Next, como o resto do painel. Nada aqui
// decide acesso: quem confere que a loja é do dono, e que o plano comporta mais
// uma, é o backend — a tela esconde o botão para não prometer o que não pode
// cumprir, e a rota existe para quem souber chamá-la.

import { apiFetch } from "./client"
import type { LojaDaRede, RedeDeLojas } from "@/app/type/type"

/** As lojas do dono, com o limite do plano contratado. */
export async function consultarRede(): Promise<RedeDeLojas> {

    const dados = await apiFetch<RedeDeLojas>("/api/lojas")

    return {
        lojas: dados.lojas ?? [],
        limite: dados.limite ?? 1,
        pode_abrir: dados.pode_abrir ?? false,
    }
}

/** Abre mais uma loja. Recusada com 409 quando o plano não comporta. */
export async function abrirLoja(nome: string): Promise<LojaDaRede> {

    const dados = await apiFetch<{ loja: LojaDaRede }>("/api/lojas", {
        method: "POST",
        body: { nome },
    })

    return dados.loja
}

/**
 * Renomeia a loja, ou a liga e desliga.
 *
 * Fechar NÃO apaga: a vitrine sai do ar, a loja some do seletor e para de
 * ocupar vaga no plano — e o estoque, os pedidos e o histórico continuam onde
 * estão. A principal não fecha: é a que sobra se o plano cair para o base.
 */
export async function mexerNaLoja(
    id: number,
    mudanca: Partial<{ nome: string; ativa: boolean }>
): Promise<void> {
    await apiFetch(`/api/lojas/${id}`, { method: "PUT", body: mudanca })
}

/**
 * Passa a mostrar outra loja no painel.
 *
 * Depois disso a página precisa ser RECARREGADA de verdade, e não só
 * re-renderizada: metade das telas é montada no servidor, e o que está em
 * memória continua sendo o da loja anterior — o lojista veria o estoque de uma
 * unidade com o faturamento de outra.
 */
export async function trocarDeLoja(id: number): Promise<void> {
    await apiFetch(`/api/lojas/${id}/abrir`, { method: "POST" })
}
