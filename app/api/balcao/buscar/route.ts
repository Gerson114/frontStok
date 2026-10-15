import { repassarAoBackend } from "@/app/api/backend"
import { balcao } from "@/app/api/rotas"

/**
 * Acha produtos pelo NOME, para quando não há código para bipar.
 *
 * O piso de dois caracteres existe nos dois lados de propósito: o servidor
 * devolve lista vazia abaixo dele, e barrar aqui também evita uma ida de rede
 * por tecla digitada — a tela chama esta rota a cada letra.
 *
 * Quem decide o que é um resultado continua sendo o backend: o preço vem dele
 * com a promoção já aplicada, no mesmo formato da leitura de código.
 */
export async function GET(request: Request) {

    const nome = new URL(request.url).searchParams.get("nome")?.trim() ?? ""

    if (nome.length < 2) {
        return Response.json({ produtos: [] })
    }

    if (nome.length > 60) {
        return Response.json({ erro: "Busca muito longa" }, { status: 400 })
    }

    return repassarAoBackend("GET", balcao.buscar(nome))
}
