import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { estoque } from "@/app/api/rotas"

// GET  /api/estoque/inventario — endereços que passaram da hora de contar.
// POST /api/estoque/inventario — põe as contagens atrasadas na fila.
//
// `limite` é quantos endereços entram desta vez; zero ou ausente usa o
// padrão do servidor, uma fila que dá para começar e terminar no mesmo dia.
export async function GET() {
    return repassarAoBackend("GET", estoque.inventario())
}

export async function POST(request: Request) {

    const corpo = await corpoDaRequisicao(request)
    const limite = Number(corpo.limite ?? 0)

    if (!Number.isInteger(limite) || limite < 0) {
        return Response.json({ erro: "Limite inválido" }, { status: 400 })
    }

    return repassarAoBackend("POST", estoque.inventario(), { limite })
}
