import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { funcionarios } from "@/app/api/rotas"

/**
 * PUT /api/funcionarios/:id/senha — o dono define uma senha nova.
 *
 * Rota própria, e não um campo dentro da edição: senha trocada por engano
 * junto com o nome é senha que ninguém sabe mais qual é. Aqui a única coisa
 * que se pode fazer é trocá-la, e é preciso pedir por isso.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const { id } = await params

        if (!/^\d+$/.test(id)) {
            return Response.json({ erro: "funcionário inválido" }, { status: 400 })
        }

        const corpo = safeParse(await request.text().catch(() => "")) as Record<string, unknown> | null

        if (!corpo || typeof corpo.password !== "string") {
            return Response.json({ erro: "Informe a nova senha" }, { status: 400 })
        }

        const response = await fetch(url(funcionarios.senha(id)), {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ password: corpo.password }),
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
