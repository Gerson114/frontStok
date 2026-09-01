import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { conta } from "@/app/api/rotas"


// POST /api/assinatura/portal — devolve a URL do portal de cobrança do
// Stripe, onde o lojista troca o cartão, baixa as faturas e cancela a
// assinatura por conta própria.
//
// Tudo isso acontece do lado do Stripe justamente para que dados de cartão e
// histórico de cobrança não precisem existir aqui.
export async function POST() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(url(conta.portal()), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json(
                { erro: extrairMensagemErro(safeParse(texto)) },
                { status: response.status }
            )
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
