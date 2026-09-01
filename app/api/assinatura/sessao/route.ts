import { extrairMensagemErro } from "@/middleware/client"
import { url, cookieDeSessao } from "@/app/api/backend"
import { publico } from "@/app/api/rotas"


const COOKIE_CADASTRO = "cadastro"

// POST /api/assinatura/sessao — fecha o cadastro na volta do Stripe.
//
// Recebe o id da sessão que veio na URL de retorno e pede ao backend que
// confirme o pagamento com o próprio Stripe. Se estiver pago, a conta é
// criada lá e a resposta traz a sessão do lojista já aberta — ele entra sem
// digitar de novo a senha que acabou de escolher.
//
// Quem afirma que houve pagamento é o Stripe, nunca esta rota nem a página:
// aqui só repassamos o identificador que veio na URL.
export async function POST(request: Request) {
    try {
        const corpo = safeParse(await request.text().catch(() => ""))
        const sessao = (corpo as { session_id?: unknown } | null)?.session_id

        // Formato conferido antes de gastar uma ida ao backend com o que
        // obviamente não é um id de sessão do Stripe.
        if (typeof sessao !== "string" || !sessao.startsWith("cs_") || sessao.length > 200) {
            return Response.json({ erro: "Sessão de pagamento inválida" }, { status: 400 })
        }

        const response = await fetch(url(publico.assinaturaSessao()), {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ session_id: sessao }),
            cache: "no-store",
        })

        const texto = await response.text()
        const dados = safeParse(texto) as Record<string, unknown> | null

        if (!response.ok) {
            return Response.json(
                { erro: extrairMensagemErro(dados) },
                { status: response.status }
            )
        }

        // O token da sessão fica só no cookie httpOnly, como no login: a
        // página recebe o e-mail e o plano para montar a tela, nunca o token.
        const saida = Response.json(
            { email: dados?.email, plano: dados?.plano },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        )

        // Mesma reemissão do login: quem sabe se o navegador está em HTTPS é
        // este lado, não o backend. Ver cookieDeSessao.
        const cookie = cookieDeSessao(response.headers.getSetCookie())

        if (!cookie) {
            return Response.json(
                { erro: "O servidor não abriu a sessão. Entre pelo login." },
                { status: 502 }
            )
        }

        saida.headers.append("Set-Cookie", cookie)

        // O cadastro terminou: o cookie que o representava não serve mais
        // para nada e some junto.
        saida.headers.append(
            "Set-Cookie",
            `${COOKIE_CADASTRO}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
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
