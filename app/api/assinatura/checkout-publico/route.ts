import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { publico } from "@/app/api/rotas"


// POST /api/assinatura/checkout-publico — abre o pagamento de quem ainda NÃO
// tem conta.
//
// É a irmã de /api/assinatura/checkout: aquela cobra um lojista já logado,
// esta cobra um cadastro em andamento. A diferença é de onde sai a
// identidade — lá do cookie de sessão, aqui do cookie do cadastro, gravado
// pelo primeiro passo do formulário. Nos dois casos, quem paga é decidido no
// servidor e não no corpo da requisição.
//
// Nenhum dado de cartão passa por aqui: o cartão é digitado numa página do
// provedor de cobrança.
const COOKIE_CADASTRO = "cadastro"

export async function POST() {
    try {
        const cookieStore = await cookies()
        const cadastro = cookieStore.get(COOKIE_CADASTRO)?.value

        if (!cadastro) {
            return Response.json(
                { erro: "Seu cadastro expirou. Preencha os dados novamente." },
                { status: 401 }
            )
        }

        const response = await fetch(url(publico.assinaturaCheckout()), {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ cadastro_token: cadastro }),
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json(
                { erro: extrairMensagemErro(safeParse(texto)) },
                { status: response.status }
            )
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
