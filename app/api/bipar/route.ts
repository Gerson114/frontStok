import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { estoque } from "@/app/api/rotas"


// // GET /api/bipar?codigo=... — resolve o código lido pelo leitor de código de
// barras: tanto a etiqueta da peça quanto a do produto. Quem decide qual é
// qual, e o que responder, é o backend.
export async function GET(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const codigo = new URL(request.url).searchParams.get("codigo")?.trim() ?? ""

        if (!codigo || codigo.length > 60) {
            return Response.json({ erro: "Informe o código lido" }, { status: 400 })
        }

        const response = await fetch(url(estoque.bipar(codigo)), {
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
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: response.status })
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
