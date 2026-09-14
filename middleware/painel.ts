// Os gráficos do painel: a série de vendas e o fluxo do atendimento.
//
// Como o resto do painel, passam pelas rotas internas do Next — o token vive
// no cookie httpOnly e o navegador nunca o enxerga.

import { apiFetch } from "./client"
import type {
    FluxoDeAtendimento,
    GranularidadeDeVendas,
    PainelDaEquipe,
    PainelDaMercadoria,
    PainelDasEntregas,
    SerieDeVendas,
} from "@/app/type/type"

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

/* ==========================================================================
   Os três painéis por assunto

   Um pedido por tela, e a tela inteira numa resposta só: são consultas curtas
   sobre a mesma loja, e três idas ao servidor para desenhar uma página fariam
   ela aparecer em pedaços, cada número entrando na frente do outro.

   Todos os campos ganham um padrão aqui. Resposta que vem sem uma lista não
   pode derrubar a página com "cannot read property of undefined" — o painel
   mostra o que chegou, e o que não chegou aparece vazio.
   ========================================================================== */

/** O que chegou e o que saiu da loja, na régua pedida. */
export async function consultarPainelDaMercadoria(
    periodo: GranularidadeDeVendas,
): Promise<PainelDaMercadoria> {

    const dados = await apiFetch<PainelDaMercadoria>(
        `/api/painel/produtos?periodo=${encodeURIComponent(periodo)}`,
    )

    return {
        granularidade: dados.granularidade ?? periodo,
        serie: dados.serie ?? [],
        resumo: dados.resumo ?? {
            pecas_entraram: 0, pecas_sairam: 0, custo_entrada: 0, receita_saida: 0,
            em_estoque: 0, reservadas: 0, avariadas: 0, devolvidas: 0, custo_parado: 0,
        },
        mais_sairam: dados.mais_sairam ?? [],
        mais_entraram: dados.mais_entraram ?? [],
        fornecedores: dados.fornecedores ?? [],
        paradas: dados.paradas ?? [],
    }
}

/** O que cada pessoa da equipe fez na régua pedida. */
export async function consultarPainelDaEquipe(
    periodo: GranularidadeDeVendas,
): Promise<PainelDaEquipe> {

    const dados = await apiFetch<PainelDaEquipe>(
        `/api/painel/equipe?periodo=${encodeURIComponent(periodo)}`,
    )

    return {
        granularidade: dados.granularidade ?? periodo,
        resumo: dados.resumo ?? {
            pessoas: 0, ativos: 0, gerentes: 0, pecas_vendidas: 0, faturamento: 0, sem_dono: 0,
        },
        pessoas: dados.pessoas ?? [],
    }
}

/** Quantos vieram buscar e quantos foram despachados, na régua pedida. */
export async function consultarPainelDasEntregas(
    periodo: GranularidadeDeVendas,
): Promise<PainelDasEntregas> {

    const dados = await apiFetch<PainelDasEntregas>(
        `/api/painel/entregas?periodo=${encodeURIComponent(periodo)}`,
    )

    return {
        granularidade: dados.granularidade ?? periodo,
        serie: dados.serie ?? [],
        resumo: dados.resumo ?? {
            retiradas: 0, entregas: 0, frete_cobrado: 0, no_prazo: 0, atrasados: 0,
            horas_ate_despachar: 0, a_embalar: 0, a_caminho: 0, a_retirar: 0,
        },
        transportadoras: dados.transportadoras ?? [],
        destinos: dados.destinos ?? [],
    }
}
