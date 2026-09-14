import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { atendimentos } from "@/app/api/rotas"

/**
 * POST /api/atendimentos/:id/situacao — iniciar e encerrar o atendimento.
 *
 * Quem pode mover é decidido no backend: só quem está com o fio, e o dono. Um
 * atendente encerrando o atendimento de outro fecharia a conversa na cara de
 * quem está no meio dela.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const { id } = await params

        if (!/^\d+$/.test(id)) {
            return Response.json({ erro: "atendimento inválido" }, { status: 400 })
        }

        const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null

        const acao = String(corpo?.acao ?? "")

        if (acao !== "iniciar" && acao !== "encerrar") {
            return Response.json({ erro: "ação inválida" }, { status: 400 })
        }

        const resposta = await fetch(url(atendimentos.situacao(id)), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ acao }),
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
