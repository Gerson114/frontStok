import { repassarAoBackend } from "@/app/api/backend"
import { pagamento } from "@/app/api/rotas"

// A conta da loja no provedor de pagamento.
//
// O access token passa por aqui só de ida. Ele não é registrado em log
// nenhum, não é guardado deste lado e não volta na resposta — o backend o
// grava cifrado com a chave da loja e devolve apenas os últimos caracteres,
// para a tela dizer qual está salvo.

export async function GET() {
    return repassarAoBackend("GET", pagamento.conta())
}

/**
 * POST /api/pagamento — testa a cobrança com as credenciais já salvas.
 *
 * Não recebe corpo nenhum de propósito: quem tem as credenciais é o backend,
 * e este caminho existe para o lojista descobrir aqui — e não no checkout de
 * um cliente — que a conta dele ainda não cobra.
 */
export async function POST() {
    return repassarAoBackend("POST", pagamento.testar())
}

export async function PUT(request: Request) {

    const corpo = await request.json().catch(() => null)

    if (!corpo || typeof corpo !== "object") {
        return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
    }

    const { access_token, segredo_webhook } = corpo as Record<string, unknown>

    const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "")

    const { provedor } = corpo as Record<string, unknown>

    return repassarAoBackend("PUT", pagamento.conta(), {
        // Qual gateway esta loja usa. Quem valida é o backend, contra a lista
        // do que ele sabe operar — aqui só repassamos a escolha.
        provedor: texto(provedor),
        access_token: texto(access_token),
        segredo_webhook: texto(segredo_webhook),
    })
}

export async function DELETE() {
    return repassarAoBackend("DELETE", pagamento.conta())
}
