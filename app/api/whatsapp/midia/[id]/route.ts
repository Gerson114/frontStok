import { idValido, repassarArquivo } from "../../proxy"
import { whatsapp } from "@/app/api/rotas"

// GET /api/whatsapp/midia/:id — o arquivo de uma mensagem. Quem decide se
// esta loja pode vê-lo é o backend, pelo id da mensagem.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return new Response("Arquivo inválido", { status: 400 })
    }

    return repassarArquivo(whatsapp.midia(id), request)
}
