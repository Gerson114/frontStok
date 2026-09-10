import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/** POST /api/equipe/grupos — abre um grupo com quem foi escolhido. */
export async function POST(request: Request) {
    return repassarAoBackend("POST", equipe.grupos(), await corpoDaRequisicao(request))
}
