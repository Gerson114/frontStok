import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { funcionarios } from "@/app/api/rotas"

// PUT /api/funcionarios/:id — nome, permissões e situação.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const corpo = safeParse(await request.text().catch(() => "")) as Record<string, unknown> | null

    if (!corpo) {
        return Response.json({ erro: "Dados inválidos" }, { status: 400 })
    }

    return repassar(params, "PUT", corpo)
}

// DELETE /api/funcionarios/:id — apaga a conta.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    return repassar(params, "DELETE", null)
}

async function repassar(
    params: Promise<{ id: string }>,
    metodo: "PUT" | "DELETE",
    corpo: unknown,
) {
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

        const response = await fetch(url(funcionarios.um(id)), {
            method: metodo,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
                Accept: "application/json",
                ...(corpo ? { "Content-Type": "application/json" } : {}),
            },
            body: corpo ? JSON.stringify(corpo) : undefined,
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
