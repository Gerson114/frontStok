import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { adicionais } from "@/app/api/rotas"

export async function POST(request: Request) {
    return repassarAoBackend("POST", adicionais.grupos(), await corpoDaRequisicao(request))
}
