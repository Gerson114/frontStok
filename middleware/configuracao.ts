// As regras que cada loja ajusta para si.
//
// Como o resto do painel, passa pelas rotas internas do Next — o token vive
// no cookie httpOnly e o navegador nunca o enxerga.

import { apiFetch } from "./client"
import type { ConfiguracaoDaLoja, RespostaDaConfiguracao } from "@/app/type/type"

/**
 * O que está valendo agora, com os limites de cada campo.
 *
 * Os limites vêm do servidor e não são escritos aqui: quem recusa um prazo de
 * carrinho de um minuto é ele, e uma segunda cópia da regra no navegador é
 * uma cópia para divergir no dia em que a primeira mudar.
 */
export async function consultarConfiguracao(): Promise<RespostaDaConfiguracao> {
    return apiFetch<RespostaDaConfiguracao>("/api/configuracao")
}

/** Grava o que o lojista mudou. A recusa do servidor volta como mensagem pronta. */
export async function salvarConfiguracao(
    configuracao: ConfiguracaoDaLoja,
): Promise<{ mensagem?: string }> {
    return apiFetch<{ mensagem?: string }>("/api/configuracao", {
        method: "PUT",
        body: configuracao,
    })
}
