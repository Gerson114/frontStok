import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { conta } from "@/app/api/rotas"

// POST /api/assinatura/plano/previa — o que TrocarPlano cobraria agora, sem
// cobrar nada.
//
// Existe para a tela avisar antes: subir de plano fatura na hora (ver o
// comentário sobre prorrateio em services/assinatura/plano.go), e sem este
// aviso o lojista só descobre isso na fatura.

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const pedido = safeParse(await request.text()) as { plano?: unknown } | null
        const plano = pedido?.plano === "pro" ? "pro" : pedido?.plano === "inicial" ? "inicial" : "base"

        const response = await fetch(url(conta.planoPrevia()), {
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
