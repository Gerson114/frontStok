import { repassarEndereco } from "@/app/api/enderecos/route"

// POST /api/enderecos/:id/bloqueio — tranca ou destranca um endereço.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!/^[0-9]+$/.test(id)) {
        return Response.json({ erro: "Endereço inválido" }, { status: 400 })
    }

    const corpo = await request.json().catch(() => ({}))

    return repassarEndereco("POST", `/${id}/bloqueio`, corpo ?? {})
}
