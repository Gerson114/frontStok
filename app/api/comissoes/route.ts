import { repassarAoBackend } from "@/app/api/backend"
import { comissoes } from "@/app/api/rotas"

/**
 * O fechamento de comissão de um mês.
 *
 * O mês vem na consulta; sem ele o backend responde o mês passado, que é o
 * que existe para fechar. Quem confere que é o dono, e que o plano é o Pro, é
 * o backend.
 */
export async function GET(request: Request) {

    const mes = new URL(request.url).searchParams.get("mes") ?? undefined

    return repassarAoBackend("GET", comissoes.doMes(mes))
}
