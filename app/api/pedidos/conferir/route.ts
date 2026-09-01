import { repassarPedido } from "@/app/api/pedidos/route"
import { pedidos } from "@/app/api/rotas"

// POST /api/pedidos/conferir — compara a lista que veio de fora com o que
// há em estoque, sem reservar nada.
export async function POST(request: Request) {
    const corpo = await request.json().catch(() => null)
    return repassarPedido(pedidos.conferir(), corpo ?? {})
}
