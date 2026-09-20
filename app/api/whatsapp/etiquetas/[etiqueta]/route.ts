import { idValido, repassar } from "../../proxy"
import { whatsapp } from "@/app/api/rotas"

// DELETE /api/whatsapp/etiquetas/:etiqueta — tira do catálogo e de todos os
// clientes que a tinham.
export async function DELETE(_: Request, { params }: { params: Promise<{ etiqueta: string }> }) {

    const { etiqueta } = await params

    if (!idValido(etiqueta)) {
        return Response.json({ erro: "Etiqueta inválida" }, { status: 400 })
    }

    return repassar("DELETE", whatsapp.etiqueta(etiqueta))
}
