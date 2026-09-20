import { idValido, repassar } from "../../../proxy"
import { whatsapp } from "@/app/api/rotas"

// GET /api/whatsapp/conversas/:id/notas — os recados da equipe sobre este
// cliente. Nunca saem para o WhatsApp.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Conversa inválida" }, { status: 400 })
    }

    return repassar("GET", whatsapp.notas(id))
}

// POST /api/whatsapp/conversas/:id/notas — grava um recado.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Conversa inválida" }, { status: 400 })
    }

    const corpo = await request.json().catch(() => null)

    return repassar("POST", whatsapp.notas(id), { texto: corpo?.texto })
}
