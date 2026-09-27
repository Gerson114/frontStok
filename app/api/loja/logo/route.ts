import { repassarAoBackend, repassarArquivo } from "@/app/api/backend"
import { conta } from "@/app/api/rotas"

/**
 * POST /api/loja/logo — a logo da vitrine, enviada como arquivo.
 *
 * Passa por repassarArquivo, e não por repassarAoBackend, porque o corpo é
 * multipart: serializar como JSON transformaria a imagem num texto inválido
 * do outro lado.
 *
 * O tamanho não é conferido aqui. Quem tem o limite é o backend, que é quem
 * grava — repetir o número nos dois lados criaria dois limites para divergir
 * no dia em que um deles mudasse.
 */
export async function POST(request: Request) {
    return repassarArquivo(conta.logo(), request, "logo", "Escolha uma imagem.")
}

/** DELETE /api/loja/logo — tira a logo e devolve o nome escrito ao topo. */
export async function DELETE() {
    return repassarAoBackend("DELETE", conta.logo())
}
