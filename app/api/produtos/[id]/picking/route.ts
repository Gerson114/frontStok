import { corpoDaRequisicao, idValido, repassarAoBackend } from "@/app/api/backend"

// PUT /api/produtos/:id/picking — onde o produto mora na prateleira de venda
// e quanto ele tem de ter ali.
//
// É o par de informações sem o qual não existe ressuprimento: sem dizer onde
// o produto deve ficar e qual é o mínimo, "abaixo do mínimo" não quer dizer
// nada, e a loja descobre a prateleira vazia pela boca do cliente — com o
// estoque cheio no fundo.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {

    const { id } = await params

    if (!idValido(id)) {
        return Response.json({ erro: "Produto inválido" }, { status: 400 })
    }

    const corpo = await corpoDaRequisicao(request)

    const endereco = String(corpo.endereco ?? "").trim()
    const minimo = Number(corpo.minimo ?? 0)

    // Máximo zero é caso normal: o servidor cai na capacidade do endereço.
    const maximo = Number(corpo.maximo ?? 0)

    if (!endereco) {
        return Response.json({ erro: "Informe a prateleira de venda do produto" }, { status: 400 })
    }

    if (!Number.isInteger(minimo) || minimo <= 0) {
        return Response.json({ erro: "O mínimo tem de ser maior que zero" }, { status: 400 })
    }

    if (!Number.isInteger(maximo) || maximo < 0) {
        return Response.json({ erro: "Máximo inválido" }, { status: 400 })
    }

    return repassarAoBackend("PUT", `/private/produto/${id}/picking`, { endereco, minimo, maximo })
}
