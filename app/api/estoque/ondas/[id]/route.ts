import { idValido, repassarAoBackend } from "@/app/api/backend"

// GET /api/estoque/ondas/:id — a onda com as paradas e os pedidos dela.
//
// A situação vem recalculada das tarefas a cada abertura: é o que mantém a
// lista honesta sem exigir que alguém feche a onda à mão.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Onda inválida" }, { status: 400 })
    }

    return repassarAoBackend("GET", `/private/estoque/ondas/${id}`)
}
