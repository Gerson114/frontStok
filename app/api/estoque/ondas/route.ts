import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { estoque } from "@/app/api/rotas"

// GET  /api/estoque/ondas — as ondas da loja, da mais recente para a mais antiga.
// POST /api/estoque/ondas — abre uma onda com os pedidos informados.
//
// Onda é feita de pedidos, e pedido é coisa da vitrine: estas rotas exigem o
// plano com site. Quem não tem recebe 402 do backend e o cliente HTTP leva
// para a tela de assinatura.
const SITUACOES = ["aberta", "em_separacao", "concluida", "cancelada"]

export async function GET(request: Request) {

    const situacao = new URL(request.url).searchParams.get("situacao") ?? ""

    if (situacao && !SITUACOES.includes(situacao)) {
        return Response.json({ erro: "situação inválida" }, { status: 400 })
    }

    const consulta = situacao ? `?situacao=${encodeURIComponent(situacao)}` : ""

    return repassarAoBackend("GET", estoque.ondas(consulta))
}

export async function POST(request: Request) {

    const corpo = await corpoDaRequisicao(request)
    const pedidos = corpo.pedidos

    // Quem confere se os pedidos são desta loja é o backend; aqui só se
    // recusa o que nem chega a ser uma lista de ids.
    if (!Array.isArray(pedidos) || pedidos.length === 0) {
        return Response.json({ erro: "Informe os pedidos que entram na onda" }, { status: 400 })
    }

    const ids = pedidos.map(Number)

    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
        return Response.json({ erro: "Pedido inválido na lista" }, { status: 400 })
    }

    return repassarAoBackend("POST", estoque.ondas(), { pedidos: ids })
}
