import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/**
 * POST /api/equipe/digitando — "fulano está digitando" naquela sala.
 *
 * Sai sem corpo de resposta e é chamada a cada dois segundos enquanto a pessoa
 * escreve. Quem confere se ela pode avisar naquela sala é o backend: sem isso,
 * o sinal viraria um jeito de bater na porta de uma conversa alheia.
 */
export async function POST(request: Request) {
    return repassarAoBackend("POST", equipe.digitando(), await corpoDaRequisicao(request))
}
