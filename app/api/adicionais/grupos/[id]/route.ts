import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { adicionais } from "@/app/api/rotas"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return repassarAoBackend("PUT", adicionais.umGrupo(id), await corpoDaRequisicao(request))
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return repassarAoBackend("DELETE", adicionais.umGrupo(id))
}
