import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { pedidos } from "@/app/api/rotas"

/**
 * GET /api/entregas?mes=AAAA-MM — os pedidos a caminho, pela data de chegada.
 *
 * O mês vai como parâmetro porque o calendário é mensal; mês torto ou ausente
 * o servidor resolve para o corrente, em vez de virar erro — é um calendário,
 * e o desfecho útil de uma data ilegível é mostrar hoje.
 */
export async function GET(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const mes = new URL(request.url).searchParams.get("mes") ?? ""

        const response = await fetch(url(pedidos.entregas(mes)), {
            method: "GET",
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: response.status })
        }

        return Response.json(safeParse(texto) ?? {}, {
            status: response.status,
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
