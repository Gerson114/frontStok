import { sanitizeEmail } from "@/security/sanitize"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { publico } from "@/app/api/rotas"

/**
 * Troca a senha com o código na mão.
 *
 * A senha NÃO é conferida aqui — nem formato, nem força. Quem decide isso é o
 * backend, com a mesma regra que vale no cadastro (ver validate.PasswordDeConta):
 * duas validações de senha em dois lugares é como uma delas fica mais frouxa
 * que a outra sem ninguém perceber.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null)

        if (!body || typeof body !== "object") {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const entrada = body as Record<string, unknown>
        const email = sanitizeEmail(String(entrada.email ?? ""))
        const codigo = String(entrada.codigo ?? "").trim()
        const senha = String(entrada.senha ?? "")

        if (!email || !codigo || !senha) {
            return Response.json({ erro: "Preencha o código e a senha nova" }, { status: 400 })
        }

        const response = await fetch(url(publico.senhaRedefinir()), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ email, codigo, senha }),
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
