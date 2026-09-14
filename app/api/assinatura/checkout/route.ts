import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { conta } from "@/app/api/rotas"


// POST /api/assinatura/checkout — abre a sessão de pagamento e devolve a URL
// hospedada pelo provedor de cobrança para onde o lojista deve ser levado.
//
// Do corpo passa adiante apenas QUAL PLANO ("base" ou "pro"). O preço de cada
// um vive na configuração do backend, então o navegador escolhe entre dois
// nomes e nunca um valor — mandar price_... daqui seria deixar qualquer um
// assinar pelo que quisesse.
//
// Nenhum dado de cartão passa por aqui, nem pelo backend: o lojista digita o
// cartão numa página do provedor. É isso que mantém este sistema fora do
// escopo pesado do PCI-DSS — número de cartão e CVV nunca tocam a nossa
// infraestrutura.
//
// Qual loja está sendo cobrada é decidido no backend a partir do token, não
// do corpo desta requisição, então não há nada aqui que o navegador possa
// forjar.

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        // Só o nome do plano atravessa, e nada mais: um corpo repassado
        // inteiro deixaria o navegador acrescentar campos que o backend um dia
        // passe a ler.
        const pedido = safeParse(await request.text()) as { plano?: unknown } | null
        const plano = pedido?.plano === "pro" ? "pro" : "base"

        const response = await fetch(url(conta.checkout()), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
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
