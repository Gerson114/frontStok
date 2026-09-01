import { repassarAoBackend } from "@/app/api/backend"
import { estoque } from "@/app/api/rotas"

// GET  /api/estoque/reposicao — o que está abaixo do mínimo na prateleira.
// POST /api/estoque/reposicao — põe essas reposições na fila.
//
// Os dois são separados no backend de propósito: ver o que falta é consulta e
// acontece a cada abertura de tela; criar trabalho para alguém é decisão, e
// decisão não se toma sozinha ao carregar uma página.
export async function GET() {
    return repassarAoBackend("GET", estoque.reposicao())
}

export async function POST() {
    return repassarAoBackend("POST", estoque.reposicao(), {})
}
