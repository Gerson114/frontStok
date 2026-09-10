import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/** POST /api/equipe/lida — zera a bolinha de não lidas de uma sala. */
export async function POST(request: Request) {
    return repassarAoBackend("POST", equipe.lida(), await corpoDaRequisicao(request))
}
