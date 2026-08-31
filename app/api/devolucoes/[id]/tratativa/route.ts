import { repassar } from "@/app/api/devolucoes/route"

// POST /api/devolucoes/:id/tratativa — encaminha a decisão ao backend, que é
// quem mexe no estoque de verdade.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!/^[0-9]+$/.test(id)) {
        return Response.json({ erro: "Devolução inválida" }, { status: 400 })
    }

    const corpo = await request.json().catch(() => ({}))

    return repassar("POST", `/${id}/tratativa`, corpo ?? {})
}
