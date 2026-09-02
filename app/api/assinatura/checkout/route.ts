import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { conta } from "@/app/api/rotas"


// POST /api/assinatura/checkout — abre a sessão de pagamento e devolve a URL
// hospedada pelo provedor de cobrança para onde o lojista deve ser levado.
//
// Não tem corpo: a assinatura é uma só e o preço dela vive na configuração do
// backend, então o navegador não tem o que escolher nem como pedir outro
// valor.
//
// Nenhum dado de cartão passa por aqui, nem pelo backend: o lojista digita o
// cartão numa página do provedor. É isso que mantém este sistema fora do
// escopo pesado do PCI-DSS — número de cartão e CVV nunca tocam a nossa
// infraestrutura.
//
// Qual loja está sendo cobrada é decidido no backend a partir do token, não
// do corpo desta requisição, então não há nada aqui que o navegador possa
// forjar.

export async function POST() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(url(conta.checkout()), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: "{}",
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
