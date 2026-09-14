import { repassarAoBackend } from "@/app/api/backend"
import { painel } from "@/app/api/rotas"

/**
 * GET /api/painel/produtos?periodo=dia|mes|ano
 *
 * Um dos três painéis por assunto. A régua é o único parâmetro, e ela é
 * conferida aqui só o bastante para não repassar texto arbitrário na URL —
 * quem decide a janela e o que fazer com um valor desconhecido é o backend.
 */
export async function GET(request: Request) {

    const pedido = new URL(request.url).searchParams.get("periodo") ?? "dia"
    const periodo = REGUAS.includes(pedido) ? pedido : "dia"

    return repassarAoBackend("GET", painel.produtos(periodo))
}

const REGUAS = ["dia", "mes", "ano"]
