import { idValido, repassar } from "../../../proxy"
import { whatsapp } from "@/app/api/rotas"

// POST /api/whatsapp/conversas/:id/lida — zera a bolinha de não lidas.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Conversa inválida" }, { status: 400 })
    }

    return repassar("POST", whatsapp.lida(id))
}
