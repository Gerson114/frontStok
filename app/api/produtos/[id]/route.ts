import { cookies } from "next/headers"
import { sanitizeText, sanitizeUrl, sanitizeDescricao, sanitizeAtributos } from "@/security/sanitize"
import { validarProdutoEditavel, type ProdutoEditavel } from "@/security/validate"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { produtos } from "@/app/api/rotas"


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
            return Response.json({ erro: "produto inválido" }, { status: 400 })
        }

        const response = await fetch(url(produtos.porId(id)), {
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

        return Response.json(safeParse(texto) ?? { mensagem: "produto excluído com sucesso" }, {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

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
            return Response.json({ erro: "produto inválido" }, { status: 400 })
        }

        const body = await request.json().catch(() => null)

        if (!body || typeof body !== "object") {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const entrada = body as Record<string, unknown>

        const produto: ProdutoEditavel = {
            nome: sanitizeText(String(entrada.nome ?? "")),
            descricao: sanitizeDescricao(String(entrada.descricao ?? "")),
            categoria: sanitizeText(String(entrada.categoria ?? "")),
            variacao: sanitizeText(String(entrada.variacao ?? "")),
            variacao_rotulo: sanitizeText(String(entrada.variacao_rotulo ?? "")),
            atributos: sanitizeAtributos(entrada.atributos),
            imagem_url: sanitizeUrl(String(entrada.imagem_url ?? "")),
            preco: Number(entrada.preco),
            estoque: Number(entrada.estoque),

            // Se este item é contado unidade a unidade, e o "tem hoje?" de
            // quem não é. Escritos à mão porque este corpo é montado campo a
            // campo — o que não está listado não chega ao servidor.
            sem_contagem: entrada.sem_contagem === true,
            disponivel: entrada.disponivel !== false,
            loja_id: Number(entrada.loja_id),
        }

        const erros = validarProdutoEditavel(produto)

        if (erros.length > 0) {
            return Response.json({ erro: erros[0], erros }, { status: 400 })
        }

        const response = await fetch(url(produtos.porId(id)), {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(produto),
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

function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}
