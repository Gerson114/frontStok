import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { pedidos } from "@/app/api/rotas"


// GET /api/pedidos/etiquetas — a fila de impressão da loja.
//
// Quem decide o que entra nela é o backend: são os pedidos confirmados, com
// os itens já resolvidos (código do produto, nome, valor) e as somas
// prontas. Aqui não se filtra nem se soma nada — a etiqueta impressa e a
// tela precisam dizer o mesmo número, e um só lugar faz a conta.
export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(url(pedidos.etiquetas()), {
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
