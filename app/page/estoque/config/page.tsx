import { permanentRedirect } from "next/navigation"

/**
 * A configuração do estoque virou parte de "Endereços".
 *
 * Esta tela criava a estrutura em lote e imprimia as placas, enquanto
 * "Endereços" cadastrava um a um e listava o mesmo cadastro: duas portas para
 * o mesmo assunto, e o lojista precisava adivinhar em qual delas estava a
 * metade do trabalho que procurava. Agora tudo mora em /page/estoque/enderecos.
 *
 * A rota fica de pé só para redirecionar: link salvo, aba antiga aberta e o
 * item do menu que o servidor ainda mande caem no lugar certo em vez de num
 * 404. Quando "Configuração" sair do menu montado pelo backend
 * (internal/services/assinatura/recursos.go), esta pasta pode ser apagada.
 */
export default function ConfiguracaoDoEstoque() {
    // `permanentRedirect` (308), e não o 307 do `redirect`: a mudança é
    // definitiva, e o permanente é o que faz o navegador guardar o novo
    // endereço em vez de bater aqui toda vez que alguém abrir o favorito.
    permanentRedirect("/page/estoque/enderecos")
}
