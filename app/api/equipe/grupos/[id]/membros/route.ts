import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/**
 * Quem está num grupo.
 *
 * POST põe gente; DELETE tira (sem `cracha`, é a própria pessoa saindo).
 * Quem pode cada coisa é decidido no backend — o criador do grupo e o dono da
 * loja mexem na lista, e qualquer membro sai sozinho.
 */
export async function POST(request: Request, contexto: { params: Promise<{ id: string }> }) {
    const { id } = await contexto.params

    return repassarAoBackend("POST", equipe.membrosDoGrupo(id), await corpoDaRequisicao(request))
}

export async function DELETE(request: Request, contexto: { params: Promise<{ id: string }> }) {
    const { id } = await contexto.params
    const cracha = new URL(request.url).searchParams.get("cracha") ?? undefined

    return repassarAoBackend("DELETE", equipe.sairDoGrupo(id, cracha))
}
