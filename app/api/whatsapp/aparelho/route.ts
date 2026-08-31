import { repassar } from "../proxy"

// GET /api/whatsapp/aparelho — em que pé está o pareamento e o QR de agora.
export async function GET() {
    return repassar("GET", "/whatsapp/aparelho")
}

// DELETE /api/whatsapp/aparelho — tira o sistema da lista de aparelhos
// conectados do lojista. As conversas ficam.
export async function DELETE() {
    return repassar("DELETE", "/whatsapp/aparelho")
}
