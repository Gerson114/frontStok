import { corpoDaRequisicao, idValido, repassarAoBackend } from "@/app/api/backend"
import { adicionais } from "@/app/api/rotas"

/** Define quais perguntas este produto faz. Manda a lista inteira e substitui. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Endereço inválido" }, { status: 400 })
    }

    return repassarAoBackend("PUT", adicionais.doProduto(id), await corpoDaRequisicao(request))
}
