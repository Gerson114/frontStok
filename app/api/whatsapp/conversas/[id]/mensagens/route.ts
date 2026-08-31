import { idValido, repassar, safeParse } from "../../../proxy"

// GET /api/whatsapp/conversas/:id/mensagens — o fio da conversa.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Conversa inválida" }, { status: 400 })
    }

    return repassar("GET", `/whatsapp/conversas/${id}/mensagens`)
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

    return repassar("POST", `/whatsapp/conversas/${id}/mensagens`, { texto: texto.slice(0, 4096) })
}
