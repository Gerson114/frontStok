// Autenticação: login, cadastro e logout passam pelas rotas internas
// /api/login, /api/cadastro e /api/logout — o navegador nunca fala direto
// com o backend, só o servidor Next. Isso evita depender de CORS entre
// front e backend e garante que o cookie httpOnly "token" seja sempre
// definido na própria origem do front.

import { sanitizeEmail } from "@/security/sanitize"
import { ApiError, extrairMensagemErro } from "@/middleware/client"
import type { CadastroConcluido, InicioCadastro, Plano } from "@/app/type/type"

export async function login(email: string, password: string): Promise<void> {
    const response = await fetch("/api/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
            email: sanitizeEmail(email),
            password,
        }),
    })

    if (!response.ok) {
        const texto = await response.text().catch(() => "")
        const dados = texto ? safeParse(texto) : null
        throw new Error(extrairMensagemErro(dados))
    }
}

/**
 * Primeiro passo do cadastro: guarda os dados e devolve os planos.
 *
 * A conta ainda NÃO existe aqui — ela só nasce depois do pagamento (ver
 * `escolherPlano` e `concluirCadastro`). Quem decide isso é o backend, e é
 * ele quem diz, em `proximo_passo`, qual é a próxima tela: escolher o plano,
 * ou ir direto ao login quando o servidor roda sem cobrança configurada.
 */
export async function cadastro(email: string, password: string): Promise<InicioCadastro> {
    const response = await fetch("/api/cadastro", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
            email: sanitizeEmail(email),
            password,
        }),
    })

    const texto = await response.text().catch(() => "")
    const dados = texto ? safeParse(texto) : null

    if (!response.ok) {
        throw new ApiError(extrairMensagemErro(dados), response.status)
    }

    return dados as InicioCadastro
}

/**
 * Segundo passo: abre o pagamento do plano escolhido e devolve a URL do
 * Stripe. Quem chama leva o navegador até lá com `window.location.assign`.
 *
 * Só a chave do plano é enviada; o preço vive na configuração do backend,
 * para o navegador não ter como assinar um plano pagando o outro.
 */
export async function escolherPlano(plano: Plano): Promise<string> {
    const response = await fetch("/api/assinatura/checkout-publico", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ plano }),
    })

    const texto = await response.text().catch(() => "")
    const dados = texto ? safeParse(texto) : null

    if (!response.ok) {
        throw new ApiError(extrairMensagemErro(dados), response.status)
    }

    return (dados as { url: string }).url
}

/**
 * Terceiro passo: na volta do Stripe, troca o id da sessão pela conta criada
 * e pela sessão já aberta.
 *
 * Quem confirma o pagamento é o backend, perguntando ao próprio Stripe —
 * esta função só entrega o identificador que veio na URL de retorno.
 */
export async function concluirCadastro(sessionId: string): Promise<CadastroConcluido> {
    const response = await fetch("/api/assinatura/sessao", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ session_id: sessionId }),
    })

    const texto = await response.text().catch(() => "")
    const dados = texto ? safeParse(texto) : null

    if (!response.ok) {
        throw new ApiError(extrairMensagemErro(dados), response.status)
    }

    return dados as CadastroConcluido
}

function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}

export async function logout(): Promise<void> {
    await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
    })
}
