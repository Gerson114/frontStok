import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"

const API_BASE = process.env.API_URL ?? "http://localhost:8080"

// Os planos oferecidos. Repetidos aqui de propósito: esta rota roda no
// servidor e não deve encaminhar ao backend qualquer texto que o navegador
// mande no lugar do plano.
const PLANOS = ["gratis", "estoque", "site"]

// POST /api/assinatura/plano — troca o plano de quem JÁ assina.
//
// Diferente de /checkout, que abre um pagamento novo: aqui a assinatura já
// existe e só o preço dela muda. Abrir um checkout para quem já assina
// criaria uma segunda cobrança mensal na mesma loja.
//
// Quem acerta as contas da troca (a diferença proporcional do mês) é o
// Stripe, decidido no backend — o navegador só diz para qual plano quer ir.
//
// A troca só sai com `confirmar: true`. Sem isso o backend responde 428 com
// a prévia da cobrança dentro, e é essa prévia que a tela mostra ao lojista
// antes de perguntar de novo — ninguém tem o cartão cobrado sem ver o valor.
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const corpo = safeParse(await request.text().catch(() => "")) as
            { plano?: unknown; confirmar?: unknown } | null

        const plano = corpo?.plano
        const confirmar = corpo?.confirmar === true

        if (typeof plano !== "string" || !PLANOS.includes(plano)) {
            return Response.json(
                { erro: "Escolha um plano para continuar" },
                { status: 400 }
            )
        }

        const response = await fetch(`${API_BASE}/private/assinatura/plano`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ plano, confirmar }),
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            const dados = safeParse(texto)

            // O corpo do erro vai inteiro, e não só a mensagem: o 428 traz a
            // prévia da troca, que é o conteúdo da caixa de confirmação.
            return Response.json(
                {
                    ...(dados && typeof dados === "object" ? dados : {}),
                    erro: extrairMensagemErro(dados),
                },
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
