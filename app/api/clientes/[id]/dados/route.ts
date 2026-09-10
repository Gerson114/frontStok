import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { clientes } from "@/app/api/rotas"

/**
 * GET /api/clientes/:id/dados — a cópia dos dados do titular (LGPD, art. 18, II).
 *
 * Quando um cliente exige por escrito "me manda tudo o que vocês têm sobre
 * mim", a loja tem 15 dias para responder. Sem isto, a resposta seria alguém
 * copiando telas à mão — devagar, incompleta e com risco de mandar o dado de
 * outra pessoa junto.
 *
 * Vai como anexo: o lojista precisa de um arquivo para encaminhar, não de uma
 * tela para ler.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const { id } = await params

        if (!/^\d+$/.test(id)) {
            return Response.json({ erro: "cliente inválido" }, { status: 400 })
        }

        const resposta = await fetch(url(clientes.dados(id)), {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            cache: "no-store",
        })

        const texto = await resposta.text()

        if (!resposta.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: resposta.status })
        }

        return new Response(texto, {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="cliente-${id}-dados.json"`,
                "Cache-Control": "no-store",
            },
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
