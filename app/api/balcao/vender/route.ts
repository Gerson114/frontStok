import { corpoDaRequisicao, repassarAoBackend } from "@/app/api/backend"
import { balcao } from "@/app/api/rotas"

/**
 * Conclui a venda inteira, ou nenhuma parte dela.
 *
 * Quem valida a sacola, o meio de pagamento e o estoque é o backend — a tela
 * repassa a mensagem dele em vez de tentar adivinhar antes. Estoque que
 * acabou volta como 409, e é o único erro que a tela trata diferente: ele
 * manda conferir a prateleira, não corrigir o que foi digitado.
 */
export async function POST(request: Request) {
    return repassarAoBackend("POST", balcao.vender(), await corpoDaRequisicao(request))
}
