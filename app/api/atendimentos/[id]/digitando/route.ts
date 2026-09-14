import { cookies } from "next/headers"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { atendimentos } from "@/app/api/rotas"

/**
 * "O atendente está digitando…" a caminho do cliente.
 *
 * Nunca devolve erro: o aviso é enfeite útil, e uma falha aqui não pode virar
 * mensagem vermelha por cima da conversa de quem está apenas escrevendo. O
 * pior desfecho é o cliente não ver as bolinhas.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) return new Response(null, { status: 204 })

        const { id } = await params

        if (!/^\d+$/.test(id)) return new Response(null, { status: 204 })

        await fetch(url(atendimentos.digitando(id)), {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(await cabecalhoDaLojaAberta()) },
            cache: "no-store",
        })

        return new Response(null, { status: 204 })

    } catch {
        return new Response(null, { status: 204 })
    }
}
