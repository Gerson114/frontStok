import { corpoDaRequisicao, idValido, repassarAoBackend } from "@/app/api/backend"
import { balcao } from "@/app/api/rotas"

/**
 * Estorna uma venda de balcão: as peças voltam ao estoque e ela sai do
 * faturamento.
 *
 * Nada é decidido aqui, e dois casos mostram por quê:
 *
 *   - o PRAZO. O backend recusa o estorno de uma venda velha (passa a ser
 *     devolução, que tem quarentena) e devolve 409 com a frase que explica.
 *     Repetir o prazo nesta rota criaria dois números para divergir no dia em
 *     que um deles mudasse;
 *   - a VENDA JÁ CANCELADA, que também volta 409. A tela trata os dois
 *     diferente de um 400: o pedido estava bem formado, o estado é que não
 *     permite.
 *
 * O motivo é opcional — exigir justificativa com o cliente esperando produz
 * "erro" e "aaa" em metade das linhas —, então corpo ausente ou ilegível vira
 * objeto vazio em vez de recusa.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Venda inválida" }, { status: 400 })
    }

    return repassarAoBackend("POST", balcao.cancelarVenda(id), await corpoDaRequisicao(request))
}
