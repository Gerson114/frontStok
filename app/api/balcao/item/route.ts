import { repassarAoBackend } from "@/app/api/backend"
import { balcao } from "@/app/api/rotas"

/**
 * Resolve o código lido no balcão.
 *
 * O código é limitado aqui porque ele vem do leitor e vai para uma consulta:
 * o backend recusa o mesmo, mas barrar antes evita uma ida de rede para
 * devolver o erro que já se sabe.
 */
export async function GET(request: Request) {

    const codigo = new URL(request.url).searchParams.get("codigo")?.trim() ?? ""

    if (!codigo || codigo.length > 60) {
        return Response.json({ erro: "Informe o código lido" }, { status: 400 })
    }

    return repassarAoBackend("GET", balcao.item(codigo))
}
