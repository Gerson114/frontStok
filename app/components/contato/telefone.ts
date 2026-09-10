/**
 * O telefone do jeito que gente lê.
 *
 * O número é guardado só com dígitos (é assim que ele é comparado e buscado);
 * a máscara é assunto de quem exibe. Só formata o que reconhece — celular e
 * fixo com DDD, com ou sem o 55 na frente. Qualquer outro tamanho volta como
 * veio: inventar máscara para um número estrangeiro é escondê-lo atrás de um
 * formato errado.
 */
export function telefoneLegivel(numero?: string): string {

    const digitos = (numero ?? "").replace(/\D+/g, "")

    const nacional = digitos.length > 11 && digitos.startsWith("55")
        ? digitos.slice(2)
        : digitos

    if (nacional.length === 11) {
        return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`
    }

    if (nacional.length === 10) {
        return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`
    }

    return numero ?? ""
}
