import { repassar } from "../proxy"

// GET /api/whatsapp/conversas — a lista da esquerda, da conversa mais
// recente para a mais antiga.
export async function GET() {
    return repassar("GET", "/whatsapp/conversas")
}
