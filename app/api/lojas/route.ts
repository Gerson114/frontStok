import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { lojas } from "@/app/api/rotas"

/**
 * As lojas do dono.
 *
 * GET lista com o limite do plano; POST abre mais uma. Só o dono passa, e quem
 * confere o limite é o backend — a tela esconde o botão para não prometer o
 * que não pode cumprir, mas a rota existe e responde a quem souber chamá-la.
 */
export async function GET() {
    return repassarAoBackend("GET", lojas.rede())
}

export async function POST(request: Request) {
    return repassarAoBackend("POST", lojas.rede(), await corpoDaRequisicao(request))
}
