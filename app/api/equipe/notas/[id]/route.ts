import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/**
 * Um recado do mural.
 *
 * PUT move, recolore, reescreve e traz para a frente; DELETE arranca. Quem
 * pode cada coisa é decidido no backend: arrastar é de qualquer um da
 * conversa — é um quadro de recados —, escrever e apagar são de quem pendurou.
 */
export async function PUT(request: Request, contexto: { params: Promise<{ id: string }> }) {
    const { id } = await contexto.params

    return repassarAoBackend("PUT", equipe.nota(id), await corpoDaRequisicao(request))
}

export async function DELETE(_request: Request, contexto: { params: Promise<{ id: string }> }) {
    const { id } = await contexto.params

    return repassarAoBackend("DELETE", equipe.nota(id))
}
