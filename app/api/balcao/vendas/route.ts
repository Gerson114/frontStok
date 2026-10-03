import { repassarAoBackend } from "@/app/api/backend"
import { balcao } from "@/app/api/rotas"

/**
 * As vendas já feitas no balcão, da mais recente para a mais antiga.
 *
 * É o caminho até o cancelamento: quem bipou duas vezes acha a venda que
 * acabou de fazer pela hora e pelo total.
 *
 * `canceladas=1` traz também as estornadas. Elas ficam de fora por padrão —
 * são ruído para quem está no caixa agora —, e aparecem para quem está
 * auditando. Quem decide o que a lista mostra é o backend; aqui só se repassa
 * a intenção.
 */
export async function GET(request: Request) {

    const canceladas = new URL(request.url).searchParams.get("canceladas") === "1"

    return repassarAoBackend("GET", balcao.vendas(canceladas))
}
