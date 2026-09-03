import { idValido, repassarArquivo } from "../../../proxy"
import { whatsapp } from "@/app/api/rotas"

// GET /api/whatsapp/conversas/:id/foto — a foto de perfil do cliente.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return new Response("Conversa inválida", { status: 400 })
    }

    // Cinco minutos de cache no navegador do lojista.
    //
    // Foto de perfil quase não muda, e a lista de conversas pede uma por
    // linha: sem isto, cada volta à tela rebusca a lista inteira de fotos, e
    // é essa rajada que fazia o painel tomar "Muitas requisições".
    //
    // Curto de propósito: o cliente que troca a foto aparece com a nova em
    // poucos minutos, sem ninguém precisar limpar nada.
    return repassarArquivo(whatsapp.foto(id), request, 300)
}
