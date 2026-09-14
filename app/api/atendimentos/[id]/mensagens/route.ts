import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { atendimentos } from "@/app/api/rotas"

/**
 * O fio de um atendimento, e a resposta do atendente.
 *
 * GET aceita ?desde=<id> — a tela usa isso para buscar só o que chegou depois
 * do que ela já mostra, em vez de rebaixar a conversa inteira a cada aviso.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    return encaminhar(request, params, "GET")
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    return encaminhar(request, params, "POST")
}

async function encaminhar(
    request: Request,
    params: Promise<{ id: string }>,
    metodo: "GET" | "POST",
) {
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

        let corpo: string | undefined

        if (metodo === "POST") {

            const entrada = safeParse(await request.text().catch(() => "")) as Record<string, unknown> | null

            const texto = String(entrada?.texto ?? "").slice(0, 2000)

            if (!texto.trim()) {
                return Response.json({ erro: "Escreva alguma coisa antes de enviar" }, { status: 400 })
            }

            corpo = JSON.stringify({ texto })
        }

        const desde = new URL(request.url).searchParams.get("desde") ?? ""

        const resposta = await fetch(
            url(atendimentos.mensagens(id, metodo === "GET" ? desde.replace(/\D+/g, "") : "")),
            {
                method: metodo,
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(await cabecalhoDaLojaAberta()),
                    Accept: "application/json",
                    ...(corpo ? { "Content-Type": "application/json" } : {}),
                },
                body: corpo,
                cache: "no-store",
            },
        )

        const texto = await resposta.text()

        if (!resposta.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: resposta.status })
        }

        return Response.json(safeParse(texto) ?? {}, {
            status: resposta.status,
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
