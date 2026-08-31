import { repassar } from "../../proxy"

// POST /api/whatsapp/aparelho/parear — gera um QR novo. Devolve na hora;
// quem espera o lojista ler é a tela, perguntando pelo GET acima.
export async function POST() {
    return repassar("POST", "/whatsapp/aparelho/parear")
}
