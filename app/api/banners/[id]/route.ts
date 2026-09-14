import { cookies } from "next/headers"
import { sanitizeText, sanitizeUrl, sanitizeDescricao } from "@/security/sanitize"
import { validarBanner, type NovoBanner } from "@/security/validate"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { produtos } from "@/app/api/rotas"


export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const { id } = await params

        if (!/^\d+$/.test(id)) {
            return Response.json({ erro: "banner inválido" }, { status: 400 })
        }

        const body = await request.json().catch(() => null)

        if (!body || typeof body !== "object") {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const entrada = body as Record<string, unknown>

        const banner: NovoBanner = {
            titulo: sanitizeText(String(entrada.titulo ?? "")),
            descricao: sanitizeDescricao(String(entrada.descricao ?? "")),
            imagem_url: sanitizeUrl(String(entrada.imagem_url ?? "")),
            valor: Number(entrada.valor ?? 0),
            valor_antigo: Number(entrada.valor_antigo ?? 0),
            link: sanitizeUrl(String(entrada.link ?? "")),
            ativo: Boolean(entrada.ativo),
            ordem: Number.isFinite(Number(entrada.ordem)) ? Number(entrada.ordem) : 0,
        }

        const erros = validarBanner(banner)

        if (erros.length > 0) {
            return Response.json({ erro: erros[0], erros }, { status: 400 })
        }

        const response = await fetch(url(produtos.banner(id)), {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(banner),
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: response.status })
        }

        const dados = safeParse(texto)

        if (!dados) {
            return Response.json({ erro: "Resposta inválida do servidor" }, { status: 502 })
        }

        return Response.json(dados, {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const { id } = await params

        if (!/^\d+$/.test(id)) {
            return Response.json({ erro: "banner inválido" }, { status: 400 })
        }

        const response = await fetch(url(produtos.banner(id)), {
            method: "DELETE",
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

        return Response.json(safeParse(texto) ?? { mensagem: "banner excluído com sucesso" }, {
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
