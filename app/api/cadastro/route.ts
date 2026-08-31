import { sanitizeEmail } from "@/security/sanitize"
import { extrairMensagemErro } from "@/middleware/client"

// Mesma lógica de /api/login: nunca fala direto com o backend a partir do
// navegador, só o servidor Next repassa a requisição.
const API_BASE = process.env.API_URL ?? "http://localhost:8080"

// Nome do cookie que guarda o token do cadastro em andamento — aquele que
// liga o formulário já preenchido ao pagamento que vem depois.
const COOKIE_CADASTRO = "cadastro"

// Mesma validade do cadastro pendente no backend (24h). Passado o prazo, o
// visitante refaz o formulário.
const VALIDADE_CADASTRO_S = 60 * 60 * 24

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null)

        if (!body || typeof body !== "object") {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const entrada = body as Record<string, unknown>
        const email = sanitizeEmail(String(entrada.email ?? ""))
        const password = String(entrada.password ?? "")

        // A validade de fato (formato do e-mail, força da senha, e-mail já
        // cadastrado) é decidida pelo backend — aqui só evitamos mandar
        // campos vazios.
        if (!email || !password) {
            return Response.json({ erro: "Email ou senha inválidos" }, { status: 400 })
        }

        const response = await fetch(`${API_BASE}/public/cadastro`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({ email, password }),
            cache: "no-store",
        })

        const texto = await response.text()
        const dados = safeParse(texto) as Record<string, unknown> | null

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(dados) }, { status: response.status })
        }

        // Com a cobrança desligada (desenvolvimento, sem Stripe) o backend já
        // criou a conta e manda seguir para o login — não há plano a escolher
        // nem pagamento a fazer.
        if (dados?.proximo_passo === "login") {
            return Response.json(
                { proximo_passo: "login", email, cobranca_ativa: false },
                { status: 201, headers: { "Cache-Control": "no-store" } }
            )
        }

        const saida = Response.json(
            {
                proximo_passo: "escolher_plano",
                email,
                cobranca_ativa: true,
                teste_dias: dados?.teste_dias,
                planos: dados?.planos ?? [],
            },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        )

        // O token do cadastro fica em cookie httpOnly, e não na resposta: ele
        // é o que autoriza abrir um pagamento em nome deste formulário, então
        // não tem por que ficar ao alcance de qualquer script da página.
        saida.headers.append(
            "Set-Cookie",
            [
                `${COOKIE_CADASTRO}=${encodeURIComponent(String(dados?.cadastro_token ?? ""))}`,
                "Path=/",
                "HttpOnly",
                "SameSite=Lax",
                `Max-Age=${VALIDADE_CADASTRO_S}`,
                process.env.NODE_ENV === "production" ? "Secure" : "",
            ]
                .filter(Boolean)
                .join("; ")
        )

        return saida

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
