import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { publico } from "@/app/api/rotas"

// POST /api/cadastro/reenviar — pede outro código de confirmação para o
// cadastro em andamento.
//
// Sem corpo nenhum: quem é o cadastro sai do cookie httpOnly, e não de um
// campo que a página pudesse escolher. O intervalo entre um envio e outro, o
// teto de envios e o que acontece quando o e-mail não sai são decididos no
// backend — aqui só se repassa a resposta, inclusive o 429 de "espere um
// minuto", que a tela mostra como está.
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

        const response = await fetch(url(publico.cadastroReenviar()), {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ cadastro_token: cadastro }),
            cache: "no-store",
        })

        const texto = await response.text()
        const dados = safeParse(texto)

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(dados) }, { status: response.status })
        }

        return Response.json(dados ?? {}, {
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
