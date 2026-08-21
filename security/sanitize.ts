// Sanitização de entradas do usuário no front-end.
//
// Isto NÃO substitui a sanitização feita no backend (lib/security/sanitize
// no projeto Go) — ela continua sendo a última linha de defesa. Aqui o
// objetivo é limpar os dados antes de enviá-los, para reduzir ruído e dar
// feedback melhor ao usuário.

const TAG_RE = /<[^>]*>/g
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g
const SPACE_RE = /\s+/g

/**
 * Remove tags HTML, caracteres de controle e espaços redundantes de um
 * texto simples. Espelha `sanitize.String` do backend.
 */
export function sanitizeText(input: string): string {
    if (!input) return ""

    return input
        .replace(TAG_RE, "")
        .replace(CONTROL_RE, "")
        .trim()
        .replace(SPACE_RE, " ")
}

/** Normaliza um e-mail (remove espaços extras e caixa). */
export function sanitizeEmail(input: string): string {
    return input.trim().toLowerCase()
}

/** Remove espaços das pontas, sem mexer no conteúdo (para URLs, por ex.). */
export function sanitizeUrl(input: string): string {
    return input.trim()
}
