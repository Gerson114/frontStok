import { repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/**
 * GET /api/equipe/presenca — quem da loja está com o painel aberto agora.
 *
 * Devolve `{ online: ["d3", "f12"] }`: só os crachás, que é o que cada linha
 * da equipe já traz. Quem cruza com os nomes é a tela.
 *
 * É chamada de novo a cada aviso de presença que chega pelo canal ao vivo, e
 * por isso é a mais leve das rotas da equipe — não toca no banco do lado de
 * lá: a resposta sai do socket que cada painel aberto mantém.
 */
export async function GET() {
    return repassarAoBackend("GET", equipe.presenca())
}
