import { repassarAoBackend, repassarArquivo } from "@/app/api/backend"
import { eu } from "@/app/api/rotas"

/**
 * POST /api/eu/foto — a foto de perfil de quem está logado.
 *
 * Passa por repassarArquivo, e não por repassarAoBackend, porque o corpo é
 * multipart: serializar como JSON transformaria a imagem num texto inválido do
 * outro lado.
 *
 * O tamanho não é conferido aqui. Quem tem o limite é o backend, que é quem
 * grava (ver arquivo.TamanhoMaximoDaFoto) — repetir o número nos dois lados
 * criaria dois limites para divergir no dia em que um deles mudasse.
 */
export async function POST(request: Request) {
    return repassarArquivo(eu.foto(), request, "foto", "Escolha uma imagem.")
}

/** DELETE /api/eu/foto — tira a foto e volta para a inicial do nome. */
export async function DELETE() {
    return repassarAoBackend("DELETE", eu.foto())
}
