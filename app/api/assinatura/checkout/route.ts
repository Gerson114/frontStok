import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"

const API_BASE = process.env.API_URL ?? "http://localhost:8080"

// POST /api/assinatura/checkout — abre a sessão de pagamento do plano
// escolhido e devolve a URL hospedada pelo Stripe para onde o lojista deve
// ser levado.
//
// Do corpo só aproveita o nome do plano; o preço de cada plano vive na
// configuração do backend, então o navegador não tem como pedir um preço.
//
// Nenhum dado de cartão passa por aqui, nem pelo backend: o lojista digita o
// cartão na página do próprio Stripe. É isso que mantém este sistema fora do
// escopo pesado do PCI-DSS — número de cartão e CVV nunca tocam a nossa
// infraestrutura.
//
// Qual loja está sendo cobrada é decidido no backend a partir do token, não
// do corpo desta requisição, então não há nada aqui que o navegador possa
// forjar.
// Os planos oferecidos. Repetidos aqui de propósito: esta rota roda no
// servidor e não deve encaminhar ao backend qualquer texto que o navegador
// mande no lugar do plano.
const PLANOS = ["gratis", "estoque", "site"]

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const corpo = safeParse(await request.text().catch(() => ""))
        const plano = (corpo as { plano?: unknown } | null)?.plano

        if (typeof plano !== "string" || !PLANOS.includes(plano)) {
            return Response.json(
                { erro: "Escolha um plano para continuar" },
                { status: 400 }
            )
        }

        const response = await fetch(`${API_BASE}/private/assinatura/checkout`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ plano }),
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
