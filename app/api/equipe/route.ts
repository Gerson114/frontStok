import { repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/**
 * GET /api/equipe — o estado da conversa interna.
 *
 * Trancado, o backend devolve só "destravado: false" e mais nada: nem a lista
 * de colegas, nem prévia de mensagem. Quem decide isso é ele — esta rota não
 * filtra nada, e é de propósito que não filtre: regra de acesso escrita em
 * dois lugares é regra que um dia diverge, e o lado que cede é sempre o mais
 * fácil de mudar.
 */
export async function GET() {
    return repassarAoBackend("GET", equipe.estado())
}
