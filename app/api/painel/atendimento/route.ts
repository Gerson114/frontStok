import { repassarAoBackend } from "@/app/api/backend"
import { painel } from "@/app/api/rotas"

/**
 * GET /api/painel/atendimento?dias=30
 *
 * O fluxo das conversas da equipe. Só o dono recebe — quem decide isso é o
 * backend, que responde 403 para o resto da equipe; esta rota não tenta
 * adivinhar quem está do outro lado.
 */
export async function GET(request: Request) {
    const pedido = Number(new URL(request.url).searchParams.get("dias"))
    const dias = Number.isFinite(pedido) && pedido > 0 ? Math.floor(pedido) : 30

    return repassarAoBackend("GET", painel.atendimento(dias))
}
