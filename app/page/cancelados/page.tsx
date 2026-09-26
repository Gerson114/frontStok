import { permanentRedirect } from "next/navigation"

/**
 * Cancelados virou uma aba de Pedidos.
 *
 * A tela que existia aqui era a de Pedidos com o filtro invertido: a mesma
 * busca, o mesmo cartão, o mesmo seletor de situação, mudando só quais
 * pedidos entravam na lista. Duas telas iguais faziam o lojista adivinhar
 * em qual delas procurar um pedido.
 *
 * O endereço continua de pé por causa dos favoritos e dos links antigos —
 * inclusive o item de menu, enquanto o servidor ainda o mandar.
 */
export default function Cancelados() {
    // `permanentRedirect` (308), e não o 307 do `redirect`: a mudança é
    // definitiva, e o permanente é o que faz o navegador guardar o novo
    // endereço em vez de bater aqui toda vez que alguém abrir o favorito.
    permanentRedirect("/page/pedidos?status=cancelados")
}
