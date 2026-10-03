import { idValido, repassarAoBackend } from "@/app/api/backend"
import { balcao } from "@/app/api/rotas"

/**
 * Uma venda com as linhas dela.
 *
 * Existe para o operador conferir que é a venda certa ANTES de cancelar: dois
 * clientes seguidos pagando R$ 52,40 é coisa que acontece, e o total sozinho
 * não distingue um do outro.
 *
 * `params` é uma Promise neste Next (16) — o id só existe depois do await.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Venda inválida" }, { status: 400 })
    }

    return repassarAoBackend("GET", balcao.umaVenda(id))
}
