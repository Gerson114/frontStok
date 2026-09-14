import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { clientes } from "@/app/api/rotas"

/**
 * POST /api/clientes/:id/anonimizar — elimina os dados do titular (LGPD, art. 18, VI).
 *
 * Não apaga a linha: apaga a PESSOA de dentro dela. Nome, e-mail, telefone e
 * conversas somem; os pedidos continuam, sem dono. A loja é obrigada a guardar
 * o histórico das vendas (art. 16, I), e destruir a venda junto com o cadastro
 * trocaria um problema legal por outro.
 *
 * Quem tem "pedidos" no painel não chega aqui — a permissão exigida é
 * "clientes". Eliminar dados de uma pessoa não é operação de quem embala
 * encomenda.
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
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

        const resposta = await fetch(url(clientes.anonimizar(id)), {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(await cabecalhoDaLojaAberta()) },
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
