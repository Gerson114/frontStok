// Sair do painel para um endereço que veio de uma resposta.
//
// O checkout e o portal de cobrança moram no Stripe, então em três lugares o
// painel troca de endereço para uma URL que ele não escreveu: recebeu do
// backend. Mandar essa URL direta para `window.location` é um sink — um
// `javascript:...` no lugar do link do Stripe roda script na origem do
// painel, com a sessão do lojista aberta, e nem precisa de XSS na nossa
// página para chegar lá: basta o backend responder errado, por bug ou por
// estar comprometido.
//
// Não é desconfiar do backend por esporte. É a mesma regra que o resto do
// sistema já segue nos dois sentidos — o backend não confia no que o
// navegador manda, e o navegador confere o que o backend responde antes de
// transformar em ação.

/**
 * Leva o navegador a um endereço externo, se for mesmo um endereço externo.
 *
 * Só https:// passa. Isso descarta de uma vez `javascript:` e `data:` (que
 * executam na nossa origem) e também http:// puro, porque é para lá que o
 * lojista seria mandado digitar um cartão.
 *
 * Lança em vez de navegar quando o endereço não serve: quem chama já trata o
 * erro mostrando o aviso na tela, e é bem melhor o lojista ler "não foi
 * possível abrir o pagamento" do que o navegador ir para onde ninguém pediu.
 */
export function irParaPaginaExterna(bruto: string): void {

    if (!ehEnderecoExterno(bruto)) {
        throw new Error("O servidor devolveu um endereço de pagamento inválido")
    }

    window.location.assign(bruto)
}

/** Se o endereço é uma URL absoluta https — ver irParaPaginaExterna. */
export function ehEnderecoExterno(bruto: string): boolean {

    if (typeof bruto !== "string" || bruto.trim() === "") return false

    try {
        return new URL(bruto.trim()).protocol === "https:"
    } catch {
        return false
    }
}
