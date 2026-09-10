import { repassarPedido } from "@/app/api/pedidos/route"
import { pedidos } from "@/app/api/rotas"

// POST /api/pedidos/[codigo]/verificar-pagamento
//
// Pergunta ao provedor se aquele pedido foi pago. Nenhuma decisão aqui: quem
// consulta, confere o valor e confirma é o backend, com as mesmas travas do
// webhook.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return repassarPedido(pedidos.verificarPagamento(encodeURIComponent(id)).replace("/private", ""), {})
}
