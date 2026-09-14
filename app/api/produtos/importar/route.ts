import { repassarArquivo } from "@/app/api/backend"
import { produtos } from "@/app/api/rotas"

/** Grava o que a conferência mostrou. */
export async function POST(request: Request) {
    return repassarArquivo(produtos.importarPlanilha(), request)
}
