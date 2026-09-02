import { extrairMensagemErro } from "@/middleware/client"
import { url } from "@/app/api/backend"
import { publico } from "@/app/api/rotas"


// GET /api/oferta — o que está à venda, para a tela de cadastro.
//
// Aberta a qualquer visitante, como a tabela de preços de qualquer site. Não
// exige sessão porque quem a lê ainda não tem conta — é justamente a tela
// que decide se ele vai ter uma.
//
// O preço vem do backend, que por sua vez o lê do provedor de cobrança.
// Nenhum valor é escrito aqui: preço repetido no front é preço que um dia
// diverge do que a fatura cobra.
export async function GET() {
    try {
        const response = await fetch(url(publico.oferta()), {
            method: "GET",
            headers: { Accept: "application/json" },
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
