import { repassar } from "@/app/api/devolucoes/route"

// GET /api/devolucoes/pedidas — a fila das devoluções que os CLIENTES
// pediram, antes de a peça voltar.
//
// Irmã de /api/devolucoes, que lista as peças já em quarentena. São dois
// momentos do mesmo assunto e vivem na mesma tela do painel: aqui se decide
// se o dinheiro volta, lá o que fazer com a peça quando ela chegar.
export async function GET(request: Request) {

    const situacao = new URL(request.url).searchParams.get("situacao") ?? ""

    // Só o que o backend conhece viaja. Filtrar aqui evita mandar lixo à rede
    // para receber um 400 de volta — quem decide continua sendo ele.
    const permitidas = ["pedida", "aceita", "recusada", "todas"]

    const consulta = permitidas.includes(situacao) ? `?situacao=${situacao}` : ""

    return repassar("GET", `/pedidas${consulta}`, null)
}
