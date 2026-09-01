import { corpoDaRequisicao, idValido, repassarAoBackend } from "@/app/api/backend"
import { estoque } from "@/app/api/rotas"

// POST /api/estoque/tarefas/:id/cancelar
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Tarefa inválida" }, { status: 400 })
    }

    return repassarAoBackend("POST", estoque.cancelarTarefa(id), await corpoDaRequisicao(request))
}
