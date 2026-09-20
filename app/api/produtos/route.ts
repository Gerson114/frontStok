import { cookies } from "next/headers"
import { sanitizeText, sanitizeUrl, sanitizeDescricao, sanitizeAtributos } from "@/security/sanitize"
import { validarProduto, type NovoProduto } from "@/security/validate"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { produtos } from "@/app/api/rotas"


export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const body = await request.json().catch(() => null)

        if (!body || typeof body !== "object") {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const entrada = body as Record<string, unknown>

        const produto: NovoProduto = {
            nome: sanitizeText(String(entrada.nome ?? "")),
            descricao: sanitizeDescricao(String(entrada.descricao ?? "")),
            categoria: sanitizeText(String(entrada.categoria ?? "")),
            variacao: sanitizeText(String(entrada.variacao ?? "")),
            variacao_rotulo: sanitizeText(String(entrada.variacao_rotulo ?? "")),
            atributos: sanitizeAtributos(entrada.atributos),
            imagem_url: sanitizeUrl(String(entrada.imagem_url ?? "")),
            preco: Number(entrada.preco),
            custo: Number(entrada.custo) || 0,
            estoque: Number(entrada.estoque),
            loja_id: Number(entrada.loja_id),
            // Em branco é o caso normal: o servidor escolhe onde guardar.
            endereco: sanitizeText(String(entrada.endereco ?? "")),

            // Item que não é contado unidade a unidade (ver o handler de
            // variantes, onde a mesma linha existe pelo mesmo motivo: este
            // corpo é montado campo a campo, e o que não é listado some).
            sem_contagem: entrada.sem_contagem === true,
        }

        const erros = validarProduto(produto)

        if (erros.length > 0) {
            return Response.json({ erro: erros[0], erros }, { status: 400 })
        }

        const response = await fetch(url(produtos.cadastrar()), {
            method: "POST",
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
            status: 201,
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
