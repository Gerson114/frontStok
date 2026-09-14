import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { paginaDaLoja } from "@/app/api/rotas"

/**
 * O desenho da home da vitrine.
 *
 * Esta rota não confere o conteúdo dos blocos de propósito — quem manda é o
 * servidor (ver services/paginas), que tem o catálogo e as regras. Repetir a
 * validação aqui criaria duas listas de tipos permitidos para manter em
 * sincronia, e a segunda a divergir seria a que deixa passar.
 *
 * O que ela faz é o que só ela pode: pôr o token do cookie, limitar o tamanho
 * do que sobe e devolver a mensagem do backend como veio.
 */
export async function GET() {
    return encaminhar("GET")
}

export async function PUT(request: Request) {

    const corpo = safeParse(await request.text().catch(() => "")) as Record<string, unknown> | null

    if (!corpo || !Array.isArray(corpo.blocos)) {
        return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
    }

    // Teto antes de trafegar: quarenta blocos é o limite do servidor, e
    // mandar mil para ouvir "não" gastaria a viagem inteira.
    if (corpo.blocos.length > 40) {
        return Response.json({ erro: "A página tem blocos demais" }, { status: 400 })
    }

    return encaminhar("PUT", { blocos: corpo.blocos })
}

async function encaminhar(metodo: "GET" | "PUT", corpo?: unknown) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const resposta = await fetch(url(paginaDaLoja.home()), {
            method: metodo,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(await cabecalhoDaLojaAberta()),
                Accept: "application/json",
                ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
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
