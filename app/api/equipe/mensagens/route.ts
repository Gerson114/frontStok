import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/** GET /api/equipe/mensagens?sala=…&desde=… — o que foi dito numa sala. */
export async function GET(request: Request) {
    const parametros = new URL(request.url).searchParams
    const desde = Number(parametros.get("desde"))

    return repassarAoBackend(
        "GET",
        equipe.mensagens(parametros.get("sala") ?? "geral", Number.isFinite(desde) ? desde : 0)
    )
}

/** POST /api/equipe/mensagens — escreve na sala. */
export async function POST(request: Request) {
    return repassarAoBackend("POST", equipe.escrever(), await corpoDaRequisicao(request))
}
