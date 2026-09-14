import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { conta } from "@/app/api/rotas"


// GET /api/assinatura/oferta — o que está à venda, visto por quem já está
// logado.
//
// É a mesma descrição de /api/oferta, com uma diferença: aqui o backend diz
// se esta loja já tem assinatura em dia, o que permite à tela mostrar
// "contratar" ou "sua assinatura".
//
// Os preços vêm do Stripe, pelo backend. Nenhum valor é escrito no front.
export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(url(conta.oferta()), {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
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
