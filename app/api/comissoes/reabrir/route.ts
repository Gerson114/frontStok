import { repassarAoBackend } from "@/app/api/backend"
import { comissoes } from "@/app/api/rotas"

/** Devolve o mês ao estado de conta, para o dono fechar de novo com o valor certo. */
export async function POST(request: Request) {

    const mes = new URL(request.url).searchParams.get("mes") ?? ""

    return repassarAoBackend("POST", comissoes.reabrir(mes))
}
