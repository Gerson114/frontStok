/**
 * O nome do produto, e só ele.
 *
 * Existe porque o nome já esteve espalhado: o título de cada aba, o cabeçalho
 * do painel, o rodapé da página de vendas e a etiqueta impressa diziam cada
 * um a sua cópia da mesma palavra. Trocar o nome virava uma caçada de vinte e
 * três lugares, com a garantia de esquecer dois.
 *
 * Aqui é uma linha. O servidor tem o gêmeo deste arquivo (lib/marca), pelo
 * mesmo motivo e com o mesmo valor — e é de lá que saem o remetente do e-mail
 * e a descrição da assinatura no provedor de cobrança.
 */
export const MARCA = "Chonnostech"

/** O plano de cima, escrito como aparece na página de vendas. */
export const MARCA_PRO = `${MARCA} Pro`

/**
 * O título de uma aba do painel.
 *
 * Sempre "tela | produto", nessa ordem: na aba estreita do navegador o começo
 * é o que sobra, e o que a pessoa procura ao voltar para a janela é a tela em
 * que estava, não o nome do sistema.
 */
export function tituloDaAba(tela: string): string {
    return `${tela} | ${MARCA}`
}
