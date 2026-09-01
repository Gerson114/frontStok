import { repassar } from "../../proxy"
import { whatsapp } from "@/app/api/rotas"

// POST /api/whatsapp/aparelho/parear — gera um QR novo. Devolve na hora;
// quem espera o lojista ler é a tela, perguntando pelo GET acima.
export async function POST() {
    return repassar("POST", whatsapp.parear())
}
