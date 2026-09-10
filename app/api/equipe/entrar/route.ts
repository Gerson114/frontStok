import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/**
 * POST /api/equipe/entrar — destrava a conversa com o código da loja.
 *
 * O código é repassado como veio. Conferir aqui o formato antecipadamente
 * pareceria zelo e seria o contrário: uma resposta diferente para "formato
 * errado" e para "código errado" conta a quem está tentando quando ele acertou
 * o formato, e o limite de tentativas do backend deixaria de contar as
 * tentativas que esta rota recusasse sozinha.
 */
export async function POST(request: Request) {
    return repassarAoBackend("POST", equipe.entrar(), await corpoDaRequisicao(request))
}
