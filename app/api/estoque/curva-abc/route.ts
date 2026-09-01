import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { estoque } from "@/app/api/rotas"

// POST /api/estoque/curva-abc — reapura o giro de cada produto.
//
// É POST, e não GET, porque a apuração escreve: reclassifica o catálogo
// inteiro. `dias` é a janela de vendas olhada para trás; zero ou ausente usa
// a janela padrão do servidor.
export async function POST(request: Request) {

    const corpo = await corpoDaRequisicao(request)
    const dias = Number(corpo.dias ?? 0)

    if (!Number.isInteger(dias) || dias < 0) {
        return Response.json({ erro: "Janela inválida" }, { status: 400 })
    }

    return repassarAoBackend("POST", estoque.curvaABC(), { dias })
}
