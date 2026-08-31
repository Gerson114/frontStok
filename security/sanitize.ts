// Sanitização de entradas do usuário no front-end.
//
// Isto NÃO substitui a sanitização feita no backend (lib/security/sanitize
// no projeto Go) — ela continua sendo a última linha de defesa. Aqui o
// objetivo é limpar os dados antes de enviá-los, para reduzir ruído e dar
// feedback melhor ao usuário.

const TAG_RE = /<[^>]*>/g
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g
const SPACE_RE = /\s+/g
const HORIZONTAL_SPACE_RE = /[ \t]+/g
const BLANK_LINES_RE = /\n{3,}/g

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

/**
 * Como `sanitizeText`, mas preserva quebras de linha — para campos de
 * texto livre com parágrafos (ex: descrição). Espelha `sanitize.Descricao`
 * do backend.
 */
export function sanitizeDescricao(input: string): string {
    if (!input) return ""

    return input
        .replace(TAG_RE, "")
        .replace(CONTROL_RE, "")
        .replace(/\r\n/g, "\n")
        .replace(HORIZONTAL_SPACE_RE, " ")
        .replace(BLANK_LINES_RE, "\n\n")
        .split("\n")
        .map((linha) => linha.trim())
        .join("\n")
        .trim()
}

/** Normaliza um e-mail (remove espaços extras e caixa). */
export function sanitizeEmail(input: string): string {
    return input.trim().toLowerCase()
}

/** Remove espaços das pontas, sem mexer no conteúdo (para URLs, por ex.). */
export function sanitizeUrl(input: string): string {
    return input.trim()
}

/**
 * Limpa a ficha técnica de um produto: nome e valor de cada par passam pelo
 * mesmo saneamento do resto do texto, e pares em branco somem.
 *
 * O formulário mostra linhas vazias para o lojista preencher; mandá-las ao
 * backend só para receber um erro de volta seria implicância com quem
 * simplesmente não usou a última linha.
 */
export function sanitizeAtributos(valor: unknown): Record<string, string> {

    if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
        return {}
    }

    const limpos: Record<string, string> = {}

    for (const [nome, conteudo] of Object.entries(valor as Record<string, unknown>)) {

        const chave = sanitizeText(String(nome ?? ""))
        const texto = sanitizeText(String(conteudo ?? ""))

        if (chave && texto) {
            limpos[chave] = texto
        }
    }

    return limpos
}
