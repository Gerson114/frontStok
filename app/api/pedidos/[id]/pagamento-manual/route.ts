import { repassarPedido } from "@/app/api/pedidos/route"
import { pedidos } from "@/app/api/rotas"

// POST /api/pedidos/[codigo]/pagamento-manual
//
// A loja declarando que recebeu por fora do provedor. Diferente de
// verificar-pagamento, aqui não há consulta a ninguém: é a palavra de quem
// está logado, e o backend grava quem foi (ver ConfirmarPagamentoManual).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params
    const corpo = await request.json().catch(() => ({}))

    return repassarPedido(
        pedidos.pagamentoManual(encodeURIComponent(id)).replace("/private", ""),
        { meio: typeof corpo?.meio === "string" ? corpo.meio : "outro" },
    )
}
