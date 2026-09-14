import { repassar } from "@/app/api/devolucoes/route"

// POST /api/devolucoes/pedidas/:id — a loja aceitando ou recusando a
// devolução que o cliente pediu.
//
// Aceitar manda o backend estornar o dinheiro pela conta da própria loja no
// provedor de pagamento. Nada disso é decidido aqui: esta rota só carrega a
// decisão e o texto da resposta.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!/^[0-9]+$/.test(id)) {
        return Response.json({ erro: "Devolução inválida" }, { status: 400 })
    }

    const corpo = await request.json().catch(() => null)

    if (!corpo || typeof corpo !== "object" || typeof (corpo as { aceitar?: unknown }).aceitar !== "boolean") {
        return Response.json({ erro: "Diga se a devolução foi aceita ou recusada" }, { status: 400 })
    }

    const { aceitar, resposta } = corpo as { aceitar: boolean; resposta?: unknown }

    return repassar("POST", `/pedidas/${id}`, {
        aceitar,
        resposta: String(resposta ?? "").slice(0, 1000),
    })
}
