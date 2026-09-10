import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { equipe } from "@/app/api/rotas"

/** O mural da loja: GET abre o quadro, POST pendura um recado. */
export async function GET(request: Request) {
    const pedido = Number(new URL(request.url).searchParams.get("mural"))

    return repassarAoBackend("GET", equipe.notas(Number.isFinite(pedido) && pedido > 0 ? pedido : undefined))
}

export async function POST(request: Request) {
    return repassarAoBackend("POST", equipe.notas(), await corpoDaRequisicao(request))
}
