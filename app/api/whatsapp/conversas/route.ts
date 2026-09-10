import { repassar } from "../proxy"
import { whatsapp } from "@/app/api/rotas"

// GET /api/whatsapp/conversas — a lista da esquerda, da conversa mais
// recente para a mais antiga.
export async function GET(request: Request) {

    // Encerradas só quando a tela pede: elas saíram da mesa de trabalho, mas
    // continuam guardadas.
    const encerrados = new URL(request.url).searchParams.get("encerrados") === "1"

    return repassar("GET", whatsapp.conversas(encerrados))
}
