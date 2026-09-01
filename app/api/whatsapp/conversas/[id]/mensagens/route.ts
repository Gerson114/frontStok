import { idValido, repassar, safeParse } from "../../../proxy"
import { whatsapp } from "@/app/api/rotas"

// GET /api/whatsapp/conversas/:id/mensagens — o fio da conversa.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Conversa inválida" }, { status: 400 })
    }

    return repassar("GET", whatsapp.mensagens(id))
}

// POST /api/whatsapp/conversas/:id/mensagens — responde ao cliente.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Conversa inválida" }, { status: 400 })
    }

    const corpo = safeParse(await request.text().catch(() => ""))
    const texto = (corpo as { texto?: unknown })?.texto

    if (typeof texto !== "string" || texto.trim() === "") {
        return Response.json({ erro: "Escreva alguma coisa antes de enviar" }, { status: 400 })
    }

    return repassar("POST", whatsapp.mensagens(id), { texto: texto.slice(0, 4096) })
}
