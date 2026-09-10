import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/**
 * Quem participa de um mural.
 *
 * POST chama gente — só quem é dono do quadro. DELETE tira (sem `cracha`, é a
 * própria pessoa saindo). Quem pode cada coisa é decidido no backend.
 */
export async function POST(request: Request, contexto: { params: Promise<{ id: string }> }) {
    const { id } = await contexto.params

    return repassarAoBackend("POST", equipe.membrosDoMural(id), await corpoDaRequisicao(request))
}

export async function DELETE(request: Request, contexto: { params: Promise<{ id: string }> }) {
    const { id } = await contexto.params
    const cracha = new URL(request.url).searchParams.get("cracha") ?? undefined

    return repassarAoBackend("DELETE", equipe.membrosDoMural(id, cracha))
}
