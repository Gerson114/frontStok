import { corpoDaRequisicao, idValido, repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/**
 * Uma tarefa.
 *
 * PUT move (fecha, reabre, muda de mão, muda o prazo) — quem pediu, quem faz
 * e o dono. DELETE apaga — só quem pediu e o dono, porque a saída mais fácil
 * para uma tarefa desagradável não pode ser fazê-la sumir.
 */
export async function PUT(request: Request, contexto: { params: Promise<{ id: string }> }) {
    const { id } = await contexto.params

    if (!idValido(id)) {
        return Response.json({ erro: "Endereço inválido" }, { status: 400 })
    }

    return repassarAoBackend("PUT", equipe.tarefa(id), await corpoDaRequisicao(request))
}

export async function DELETE(_request: Request, contexto: { params: Promise<{ id: string }> }) {
    const { id } = await contexto.params

    if (!idValido(id)) {
        return Response.json({ erro: "Endereço inválido" }, { status: 400 })
    }

    return repassarAoBackend("DELETE", equipe.tarefa(id))
}
