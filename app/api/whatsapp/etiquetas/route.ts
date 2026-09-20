import { repassar } from "../proxy"
import { whatsapp } from "@/app/api/rotas"

// GET /api/whatsapp/etiquetas — o catálogo de etiquetas da loja.
export async function GET() {
    return repassar("GET", whatsapp.etiquetas())
}

// POST /api/whatsapp/etiquetas — cria uma etiqueta no catálogo.
export async function POST(request: Request) {

    const corpo = await request.json().catch(() => null)

    // Campo a campo, e não o corpo inteiro: é a camada que separa o que a
    // tela pode mandar do que o backend aceita. Quem acrescentar um campo à
    // etiqueta precisa acrescentá-lo aqui também — ele some em silêncio se
    // esquecer.
    return repassar("POST", whatsapp.etiquetas(), {
        nome: corpo?.nome,
        cor: corpo?.cor,
    })
}
