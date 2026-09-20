import { idValido, repassar } from "../../../../proxy"
import { whatsapp } from "@/app/api/rotas"

// DELETE /api/whatsapp/conversas/:id/notas/:nota — apaga um recado. Quem
// apaga é quem escreveu, ou o dono; quem decide isso é o backend.
export async function DELETE(
    _: Request,
    { params }: { params: Promise<{ id: string; nota: string }> },
) {

    const { id, nota } = await params

    if (!idValido(id) || !idValido(nota)) {
        return Response.json({ erro: "Endereço inválido" }, { status: 400 })
    }

    return repassar("DELETE", whatsapp.nota(id, nota))
}
