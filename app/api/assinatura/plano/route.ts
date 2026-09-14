import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { conta } from "@/app/api/rotas"

// POST /api/assinatura/plano — troca o plano de quem JÁ assina.
//
// É outra porta que o checkout de propósito. O checkout cria uma assinatura
// nova, e quem já tem uma sairia dele com duas cobranças mensais na mesma
// loja; aqui a assinatura que existe muda de item. Quem tenta trocar sem ter
// assinatura recebe 409 com `usar_checkout`, e é a tela que decide o que
// dizer.
//
// Do corpo só atravessa o nome do plano ("base" ou "pro"). O preço de cada um
// vive na configuração do backend — o navegador nunca manda valor nem
// price_..., senão bastaria editá-lo aqui para assinar o Pro pagando o base.
//
// Qual loja está sendo cobrada sai do token no backend, não daqui.

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const pedido = safeParse(await request.text()) as { plano?: unknown } | null
        const plano = pedido?.plano === "pro" ? "pro" : "base"

        const response = await fetch(url(conta.plano()), {
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
        const corpo = safeParse(texto)

        if (!response.ok) {
            return Response.json(
                { erro: extrairMensagemErro(corpo) },
                { status: response.status }
            )
        }

        return Response.json(corpo ?? {}, {
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
