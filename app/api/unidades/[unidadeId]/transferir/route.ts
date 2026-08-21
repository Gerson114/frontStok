import { cookies } from "next/headers"
import { validarTransferencia, type NovaTransferencia } from "@/security/validate"
import { extrairMensagemErro } from "@/middleware/client"

const API_BASE = process.env.API_URL ?? "http://localhost:8080"

export async function POST(
    request: Request,
    { params }: { params: Promise<{ unidadeId: string }> }
) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const { unidadeId } = await params

        if (!/^\d+$/.test(unidadeId)) {
            return Response.json({ erro: "unidade inválida" }, { status: 400 })
        }

        const body = await request.json().catch(() => null)

        if (!body || typeof body !== "object") {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const entrada = body as Record<string, unknown>

        const transferencia: NovaTransferencia = {
            rua_destino: Number(entrada.rua_destino),
            bloco_destino: String(entrada.bloco_destino ?? "").toUpperCase(),
        }

        const erros = validarTransferencia(transferencia)

        if (erros.length > 0) {
            return Response.json({ erro: erros[0], erros }, { status: 400 })
        }

        const response = await fetch(`${API_BASE}/private/unidades/${unidadeId}/transferir`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(transferencia),
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: response.status })
        }

        return Response.json(safeParse(texto) ?? { mensagem: "unidade transferida com sucesso" }, {
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
