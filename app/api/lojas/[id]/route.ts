import { corpoDaRequisicao, idValido, repassarAoBackend } from "@/app/api/backend"
import { lojas } from "@/app/api/rotas"

/** PUT /api/lojas/:id — renomeia a loja, ou a liga e desliga. */
export async function PUT(request: Request, contexto: { params: Promise<{ id: string }> }) {
    const { id } = await contexto.params

    if (!idValido(id)) {
        return Response.json({ erro: "Endereço inválido" }, { status: 400 })
    }

    return repassarAoBackend("PUT", lojas.uma(id), await corpoDaRequisicao(request))
}
