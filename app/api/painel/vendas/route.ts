import { repassarAoBackend } from "@/app/api/backend"
import { painel } from "@/app/api/rotas"

/**
 * GET /api/painel/vendas?granularidade=dia|mes|ano
 *
 * A série do gráfico de vendas. A régua é o único parâmetro, e ela é
 * conferida aqui só o bastante para não repassar texto arbitrário na URL —
 * quem decide a janela, o teto e o que fazer com um valor desconhecido é o
 * backend.
 */
export async function GET(request: Request) {
    const pedida = new URL(request.url).searchParams.get("granularidade") ?? "dia"
    const granularidade = REGUAS.includes(pedida) ? pedida : "dia"

    return repassarAoBackend("GET", painel.vendas(granularidade))
}

const REGUAS = ["dia", "mes", "ano"]
