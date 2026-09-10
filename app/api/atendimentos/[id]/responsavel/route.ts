import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { atendimentos } from "@/app/api/rotas"

/**
 * POST /api/atendimentos/:id/responsavel — de quem é este cliente.
 *
 * Assumir, largar e transferir na mesma rota. Quem pode cada uma delas é
 * decidido no backend (ver services/atendimento): um atendente pega quem está
 * livre e larga quem é dele; tirar cliente da mão de outro é do dono.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const { id } = await params

        if (!/^\d+$/.test(id)) {
            return Response.json({ erro: "atendimento inválido" }, { status: 400 })
        }

        const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null

        const funcionario = Number(corpo?.funcionario_id)

        const resposta = await fetch(url(atendimentos.responsavel(id)), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                funcionario_id: Number.isInteger(funcionario) && funcionario > 0 ? funcionario : null,
                liberar: corpo?.liberar === true,
            }),
            cache: "no-store",
        })

        const texto = await resposta.text()

        if (!resposta.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: resposta.status })
        }

        return Response.json(safeParse(texto) ?? {}, {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}
