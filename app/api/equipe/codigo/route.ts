import { repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/**
 * O código único da loja — a credencial que destrava a conversa da equipe.
 *
 * GET mostra o código atual (criando-o na primeira vez); POST sorteia outro e
 * derruba todo mundo que estava dentro. Quem passa é o dono ou quem ele
 * autorizou, e a decisão é do backend.
 *
 * Sem cache nos dois: `repassarAoBackend` responde com `Cache-Control:
 * no-store`, que é o que impede a credencial de ficar guardada no disco do
 * navegador de um computador de balcão.
 */
export async function GET() {
    return repassarAoBackend("GET", equipe.codigo())
}

export async function POST() {
    return repassarAoBackend("POST", equipe.codigo())
}
