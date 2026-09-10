import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { publico } from "@/app/api/rotas"

// POST /api/cadastro/confirmar — o passo do meio do cadastro: os seis
// dígitos que chegaram por e-mail.
//
// Como as irmãs deste diretório, ela não decide nada: quem confere o código,
// conta as tentativas e diz se venceu é o backend. O que acontece aqui é o
// que sempre acontece — o cookie httpOnly do cadastro vira `cadastro_token`
// no corpo, para o identificador nunca passar pelo JavaScript da página.
const COOKIE_CADASTRO = "cadastro"

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const cadastro = cookieStore.get(COOKIE_CADASTRO)?.value

        if (!cadastro) {
            return Response.json(
                { erro: "Seu cadastro expirou. Preencha os dados novamente." },
                { status: 401 }
            )
        }

        const corpo = await request.json().catch(() => null)
        const codigo = String((corpo as Record<string, unknown> | null)?.codigo ?? "").trim()

        if (!codigo) {
            return Response.json({ erro: "Digite o código que enviamos por e-mail" }, { status: 400 })
        }

        const response = await fetch(url(publico.cadastroConfirmar()), {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ cadastro_token: cadastro, codigo }),
            cache: "no-store",
        })

        const texto = await response.text()
        const dados = safeParse(texto)

        if (!response.ok) {
            // As tentativas restantes acompanham o erro: é o que deixa a tela
            // avisar "faltam 2" em vez de só repetir "código incorreto".
            const detalhe = dados as Record<string, unknown> | null

            return Response.json(
                { erro: extrairMensagemErro(dados), tentativas_restam: detalhe?.tentativas_restam },
                { status: response.status }
            )
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
