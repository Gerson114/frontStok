import { corpoDaRequisicao, idValido, repassarAoBackend } from "@/app/api/backend"

// POST /api/estoque/tarefas/:id/concluir
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Tarefa inválida" }, { status: 400 })
    }

    return repassarAoBackend("POST", `/private/estoque/tarefas/${id}/concluir`, await corpoDaRequisicao(request))
}
