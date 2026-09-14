import { repassarArquivo } from "@/app/api/backend"
import { produtos } from "@/app/api/rotas"

/** Lê a planilha e devolve o que vai acontecer. Não grava nada. */
export async function POST(request: Request) {
    return repassarArquivo(produtos.conferirPlanilha(), request)
}
