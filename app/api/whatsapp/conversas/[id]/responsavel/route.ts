import { idValido, repassar } from "../../../proxy"
import { whatsapp } from "@/app/api/rotas"

/**
 * POST /api/whatsapp/conversas/:id/responsavel — de quem é este cliente.
 *
 * Assumir, largar e transferir passam pela mesma rota: o que muda é o corpo, e
 * quem pode cada coisa é decidido no backend — a diferença não é de tela, é de
 * quem está logado. O erro dele ("este cliente já está sendo atendido por
 * Helena") é o que a tela mostra.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Conversa inválida" }, { status: 400 })
    }

    const corpo = await request.json().catch(() => ({}))

    return repassar("POST", whatsapp.responsavel(id), corpo ?? {})
}
