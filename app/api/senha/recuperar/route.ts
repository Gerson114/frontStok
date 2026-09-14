import { sanitizeEmail } from "@/security/sanitize"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { publico } from "@/app/api/rotas"

/**
 * Pede o código de seis dígitos para trocar a senha.
 *
 * Repassa e nada mais: quem decide se existe conta com aquele e-mail — e quem
 * cuida para que a resposta seja a MESMA existindo ou não — é o backend (ver
 * services/login/recuperacao.go). Qualquer diferença de resposta aqui
 * transformaria este formulário numa lista de quem tem conta no sistema.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null)

        if (!body || typeof body !== "object") {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const email = sanitizeEmail(String((body as Record<string, unknown>).email ?? ""))

        if (!email) {
            return Response.json({ erro: "Informe o seu e-mail" }, { status: 400 })
        }

        const response = await fetch(url(publico.senhaRecuperar()), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ email }),
            cache: "no-store",
        })

        const texto = await response.text()
        const dados = safeParse(texto)

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(dados) }, { status: response.status })
        }

        return Response.json(dados ?? { mensagem: "" }, {
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
