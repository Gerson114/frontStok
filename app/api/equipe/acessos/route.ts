import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/**
 * Quem pediu para entrar na conversa da equipe.
 *
 * GET lista; POST decide (confirmar ou recusar). Só o dono passa — esta rota
 * não tenta adivinhar quem está do outro lado.
 */
export async function GET() {
    return repassarAoBackend("GET", equipe.acessos())
}

export async function POST(request: Request) {
    return repassarAoBackend("POST", equipe.acessos(), await corpoDaRequisicao(request))
}
