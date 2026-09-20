import { idValido, repassar } from "../../../proxy"
import { whatsapp } from "@/app/api/rotas"

// PUT /api/whatsapp/conversas/:id/etiquetas — troca as etiquetas do cliente
// pelas que vieram. A lista inteira de uma vez, nunca "adicione esta".
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Conversa inválida" }, { status: 400 })
    }

    const corpo = await request.json().catch(() => null)

    const etiquetas = Array.isArray(corpo?.etiquetas)
        ? corpo.etiquetas.filter((umId: unknown) => Number.isInteger(umId))
        : []

    return repassar("PUT", whatsapp.etiquetasDaConversa(id), { etiquetas })
}
