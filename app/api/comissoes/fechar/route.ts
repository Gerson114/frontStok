import { repassarAoBackend } from "@/app/api/backend"
import { comissoes } from "@/app/api/rotas"

/** Congela o mês: o que for pago vira número morto no banco. */
export async function POST(request: Request) {

    const mes = new URL(request.url).searchParams.get("mes") ?? ""

    return repassarAoBackend("POST", comissoes.fechar(mes))
}
