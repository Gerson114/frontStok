import { repassar, safeParse } from "../proxy"

// GET /api/whatsapp/canal — como está a conexão desta loja. O token nunca
// volta do backend, nem mascarado.
export async function GET() {
    return repassar("GET", "/whatsapp/canal")
}

// PUT /api/whatsapp/canal — conecta ou reconecta o WhatsApp da loja.
export async function PUT(request: Request) {

    const corpo = safeParse(await request.text().catch(() => ""))

    if (!corpo || typeof corpo !== "object") {
        return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
    }

    const { phone_number_id, waba_id, numero_exibicao, token, ativo } = corpo as Record<string, unknown>

    const texto = (valor: unknown, limite: number) =>
        typeof valor === "string" ? valor.trim().slice(0, limite) : ""

    return repassar("PUT", "/whatsapp/canal", {
        phone_number_id: texto(phone_number_id, 64),
        waba_id: texto(waba_id, 64),
        numero_exibicao: texto(numero_exibicao, 32),
        // O token vai inteiro e não é registrado em log nenhum daqui:
        // é a credencial que fala pelo WhatsApp da loja.
        token: typeof token === "string" ? token.trim() : "",
        ativo: typeof ativo === "boolean" ? ativo : true,
    })
}

// DELETE /api/whatsapp/canal — desconecta. As conversas ficam.
export async function DELETE() {
    return repassar("DELETE", "/whatsapp/canal")
}
