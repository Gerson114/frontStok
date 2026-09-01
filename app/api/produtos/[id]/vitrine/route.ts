import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { produtos } from "@/app/api/rotas"


// PUT /api/produtos/:id/vitrine — põe ou tira o produto do site.
//
// Só o "sim ou não" atravessa: o produto em si não é editado aqui, e quem
// confere se ele é desta loja é o backend.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const { id } = await params

        if (!/^[0-9]+$/.test(id)) {
            return Response.json({ erro: "produto inválido" }, { status: 400 })
        }

        const corpo = await request.json().catch(() => null) as { publicado?: unknown } | null

        const response = await fetch(url(produtos.vitrine(id)), {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ publicado: corpo?.publicado === true }),
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
