import { repassarAoBackend } from "@/app/api/backend"
import { painel } from "@/app/api/rotas"

/**
 * GET /api/notificacoes — o que chegou e ninguém viu.
 *
 * Pedida a cada aviso do canal ao vivo, em toda aba aberta: é por isso que é
 * uma rota à parte da tela de início, e não um pedaço dela.
 */
export async function GET() {
    return repassarAoBackend("GET", painel.notificacoes())
}
