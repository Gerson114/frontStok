// Os gráficos do painel: a série de vendas e o fluxo do atendimento.
//
// Como o resto do painel, passam pelas rotas internas do Next — o token vive
// no cookie httpOnly e o navegador nunca o enxerga.

import { apiFetch } from "./client"
import type { FluxoDeAtendimento, GranularidadeDeVendas, SerieDeVendas } from "@/app/type/type"

/**
 * As vendas na régua pedida.
 *
 * Os pontos vêm sempre completos do servidor, inclusive as janelas em que não
 * se vendeu nada: é ele que sabe em que fuso a venda foi gravada, e um dia
 * parado tem de aparecer zerado em vez de sumir do eixo.
 */
export async function consultarVendas(
    granularidade: GranularidadeDeVendas
): Promise<SerieDeVendas> {

    const dados = await apiFetch<SerieDeVendas>(
        `/api/painel/vendas?granularidade=${encodeURIComponent(granularidade)}`
    )

    return {
        granularidade: dados.granularidade ?? granularidade,
        pontos: dados.pontos ?? [],
        pecas: dados.pecas ?? 0,
        faturamento: dados.faturamento ?? 0,
        margem: dados.margem ?? 0,
    }
}

/** O que a equipe fez com as conversas nos últimos `dias`. Só o dono recebe. */
export async function consultarFluxoDeAtendimento(dias: number): Promise<FluxoDeAtendimento> {

    const dados = await apiFetch<FluxoDeAtendimento>(`/api/painel/atendimento?dias=${dias}`)

    return {
        dias: dados.dias ?? dias,
        desde: dados.desde,
        pessoas: dados.pessoas ?? [],
        passagens: dados.passagens ?? [],
        fila: dados.fila ?? { livres: 0, atribuidos: 0, em_atendimento: 0, encerrados: 0 },
        linha_do_dia: dados.linha_do_dia ?? [],
    }
}
