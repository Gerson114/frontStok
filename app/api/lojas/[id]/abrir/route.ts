import { cookies } from "next/headers"
import { COOKIE_DA_LOJA, idValido, repassarAoBackend } from "@/app/api/backend"
import { lojas } from "@/app/api/rotas"

/**
 * POST /api/lojas/:id/abrir — passa a mostrar esta loja no painel.
 *
 * A ordem importa: PERGUNTA ao backend antes de gravar. Ele é a autoridade
 * sobre de quem é a loja, e gravar primeiro deixaria o painel apontando para
 * uma unidade que a API vai recusar — tela por tela, sem explicação.
 *
 * O cookie é gravado AQUI porque é este servidor que o navegador enxerga: o
 * backend nunca vê cookie nenhum, e recebe a escolha como cabeçalho a cada
 * requisição (ver cabecalhosDaSessao).
 */
export async function POST(_request: Request, contexto: { params: Promise<{ id: string }> }) {

    const { id } = await contexto.params

    if (!idValido(id)) {
        return Response.json({ erro: "Endereço inválido" }, { status: 400 })
    }

    const resposta = await repassarAoBackend("POST", lojas.trocar(id))

    if (!resposta.ok) return resposta

    const cookieStore = await cookies()

    // httpOnly como o da sessão: nenhum script da página precisa lê-lo, e o
    // que não é legível não vaza por injeção. Um ano porque é preferência de
    // tela, não credencial — quem troca de computador cai na loja principal,
    // que é o certo: a escolha é daquele navegador.
    cookieStore.set(COOKIE_DA_LOJA, id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
    })

    return resposta
}
