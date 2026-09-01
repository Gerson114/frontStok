import { idValido, repassarArquivo } from "../../../proxy"
import { whatsapp } from "@/app/api/rotas"

// GET /api/whatsapp/conversas/:id/foto — a foto de perfil do cliente.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return new Response("Conversa inválida", { status: 400 })
    }

    return repassarArquivo(whatsapp.foto(id), request)
}
