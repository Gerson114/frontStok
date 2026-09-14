import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { atendimentos } from "@/app/api/rotas"

/**
 * GET /api/atendimentos — quem escreveu para a loja pelo site.
 *
 * A lista vem ordenada do servidor (quem falou por último em cima), que é a
 * ordem de quem está esperando resposta.
 */
export async function GET(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        // Encerradas só quando a tela pede: elas saíram da mesa de trabalho.
        const encerrados = new URL(request.url).searchParams.get("encerrados") === "1"

        const resposta = await fetch(url(atendimentos.lista(encerrados)), {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(await cabecalhoDaLojaAberta()) },
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
