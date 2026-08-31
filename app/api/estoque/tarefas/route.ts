import { repassarAoBackend } from "@/app/api/backend"

// GET /api/estoque/tarefas — a fila de trabalho do estoque.
//
// Sem filtro, o backend devolve o que está por fazer (pendente e em
// andamento), que é o que a tela do celular precisa quase sempre;
// `?situacao=concluida` abre o histórico e `?tipo=` filtra o tipo de
// trabalho. Quem ordena a fila é o servidor — a tela não reordena nada.
const SITUACOES = ["pendente", "em_andamento", "concluida", "cancelada"]
const TIPOS = ["armazenagem", "ressuprimento", "separacao", "inventario"]

export async function GET(request: Request) {

    const { searchParams } = new URL(request.url)

    const situacao = searchParams.get("situacao") ?? ""
    const tipo = searchParams.get("tipo") ?? ""

    if (situacao && !SITUACOES.includes(situacao)) {
        return Response.json({ erro: "situação inválida" }, { status: 400 })
    }

    if (tipo && !TIPOS.includes(tipo)) {
        return Response.json({ erro: "tipo de tarefa inválido" }, { status: 400 })
    }

    const filtros = new URLSearchParams()

    if (situacao) filtros.set("situacao", situacao)
    if (tipo) filtros.set("tipo", tipo)

    const consulta = filtros.toString()

    return repassarAoBackend("GET", `/private/estoque/tarefas${consulta ? `?${consulta}` : ""}`)
}
