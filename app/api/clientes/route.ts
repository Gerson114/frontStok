import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { clientes } from "@/app/api/rotas"

/** GET /api/clientes — quem compra na loja, com o que cada um já somou. */
export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const resposta = await fetch(url(clientes.lista()), {
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
