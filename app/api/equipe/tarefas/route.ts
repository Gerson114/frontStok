import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/**
 * As tarefas da equipe.
 *
 * GET lista as da loja; POST abre uma. Quem pode ver e mexer é decidido pelo
 * backend, pela mesma regra da conversa: a conta ativa nesta loja e a entrada
 * confirmada pelo dono.
 */
export async function GET() {
    return repassarAoBackend("GET", equipe.tarefas())
}

export async function POST(request: Request) {
    return repassarAoBackend("POST", equipe.tarefas(), await corpoDaRequisicao(request))
}
