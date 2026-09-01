import { repassar } from "../proxy"
import { whatsapp } from "@/app/api/rotas"

// GET /api/whatsapp/conversas — a lista da esquerda, da conversa mais
// recente para a mais antiga.
export async function GET() {
    return repassar("GET", whatsapp.conversas())
}
