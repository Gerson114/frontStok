import { idValido, repassarAoBackend } from "@/app/api/backend"

// POST /api/estoque/ondas/:id/cancelar — desmancha a separação.
//
// As reservas dos pedidos continuam de pé: cancelar a separação não cancela
// a venda.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Onda inválida" }, { status: 400 })
    }

    return repassarAoBackend("POST", `/private/estoque/ondas/${id}/cancelar`, {})
}
