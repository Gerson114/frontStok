import { idValido, repassar } from "../../../proxy"
import { whatsapp } from "@/app/api/rotas"

/**
 * POST /api/whatsapp/conversas/:id/situacao — iniciar e encerrar o
 * atendimento. Quem pode mover é decidido no backend: só quem está com a
 * conversa, e o dono.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Conversa inválida" }, { status: 400 })
    }

    const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null

    const acao = String(corpo?.acao ?? "")

    if (acao !== "iniciar" && acao !== "encerrar") {
        return Response.json({ erro: "Ação inválida" }, { status: 400 })
    }

    return repassar("POST", whatsapp.situacao(id), { acao })
}
