import { repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/**
 * POST /api/equipe/sair — a pessoa sai da conversa da empresa.
 *
 * Quem decide quem pode sair é o backend: o dono não sai, porque é a única
 * conta capaz de readmitir quem saiu.
 */
export async function POST() {
    return repassarAoBackend("POST", equipe.sair())
}
