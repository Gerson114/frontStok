// Autenticação: login, cadastro e logout passam pelas rotas internas
// /api/login, /api/cadastro e /api/logout — o navegador nunca fala direto
// com o backend, só o servidor Next. Isso evita depender de CORS entre
// front e backend e garante que o cookie httpOnly "token" seja sempre
// definido na própria origem do front.

import { sanitizeEmail } from "@/security/sanitize"
import { ApiError, extrairMensagemErro } from "@/middleware/client"
import type { CadastroConcluido, InicioCadastro } from "@/app/type/type"

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
 * Pede o código de seis dígitos para trocar a senha do painel.
 *
 * Devolve a frase do servidor, que é a MESMA exista ou não conta com aquele
 * e-mail — de propósito: uma resposta diferente para e-mail existente
 * transformaria esta tela numa lista de quem tem conta no sistema. Quem
 * digitou o próprio endereço errado descobre pela caixa de entrada vazia, e
 * não por uma mensagem de erro que serve a qualquer um.
 */
export async function pedirCodigoDeSenha(email: string): Promise<string> {

    const response = await fetch("/api/senha/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sanitizeEmail(email) }),
    })

    const texto = await response.text().catch(() => "")
    const dados = texto ? safeParse(texto) : null

    if (!response.ok) {
        throw new Error(extrairMensagemErro(dados))
    }

    return (dados as { mensagem?: string } | null)?.mensagem ?? "Código enviado."
}

/** Troca a senha com o código na mão. Encerra as sessões abertas da conta. */
export async function redefinirSenha(email: string, codigo: string, senha: string): Promise<string> {

    const response = await fetch("/api/senha/redefinir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sanitizeEmail(email), codigo: codigo.trim(), senha }),
    })

    const texto = await response.text().catch(() => "")
    const dados = texto ? safeParse(texto) : null

    if (!response.ok) {
        throw new Error(extrairMensagemErro(dados))
    }

    return (dados as { mensagem?: string } | null)?.mensagem ?? "Senha trocada."
}

/**
 * Primeiro passo do cadastro: guarda os dados e devolve o que está à venda.
 *
 * A conta ainda NÃO existe aqui — ela só nasce depois do pagamento (ver
 * `irPagar` e `concluirCadastro`). Quem decide isso é o backend, e é ele quem
 * diz, em `proximo_passo`, qual é a próxima tela: pagar, ou ir direto ao
 * login quando o servidor roda sem cobrança configurada.
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
 * O passo do meio: confirma o e-mail com os seis dígitos que chegaram na
 * caixa de entrada.
 *
 * O código não é conferido aqui — quem sabe se ele está certo, se venceu e
 * quantas tentativas restam é o servidor. Esta função só entrega o que foi
 * digitado e devolve a resposta, inclusive as tentativas restantes, que a
 * tela mostra.
 */
export async function confirmarCadastro(codigo: string): Promise<InicioCadastro> {
    const response = await fetch("/api/cadastro/confirmar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ codigo: codigo.trim() }),
    })

    const texto = await response.text().catch(() => "")
    const dados = texto ? safeParse(texto) : null

    if (!response.ok) {
        throw new ApiError(extrairMensagemErro(dados), response.status)
    }

    return dados as InicioCadastro
}

/** Pede outro código de confirmação para o mesmo cadastro. */
export async function reenviarCodigo(): Promise<string> {
    const response = await fetch("/api/cadastro/reenviar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
    })

    const texto = await response.text().catch(() => "")
    const dados = texto ? safeParse(texto) : null

    if (!response.ok) {
        throw new ApiError(extrairMensagemErro(dados), response.status)
    }

    return String((dados as { mensagem?: string } | null)?.mensagem ?? "Código novo enviado")
}

/**
 * Segundo passo: abre o pagamento e devolve a URL do provedor de cobrança.
 * Quem chama leva o navegador até lá com `window.location.assign`.
 *
 * Nada é enviado: o preço vive na configuração do backend, para o navegador
 * não ter como assinar por um valor que não é o nosso.
 */
export async function irPagar(): Promise<string> {
    const response = await fetch("/api/assinatura/checkout-publico", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
    })

    const texto = await response.text().catch(() => "")
    const dados = texto ? safeParse(texto) : null

    if (!response.ok) {
        throw new ApiError(extrairMensagemErro(dados), response.status)
    }

    return (dados as { url: string }).url
}

/**
 * Terceiro passo: na volta do pagamento, troca o id da sessão pela conta
 * criada e pela sessão já aberta.
 *
 * Quem confirma o pagamento é o backend, perguntando ao provedor de cobrança
 * — esta função só entrega o identificador que veio na URL de retorno.
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

/**
 * Encerra a sessão — no servidor, e não só neste navegador.
 *
 * Lança quando a revogação falha. Antes o resultado era ignorado, e engolir
 * essa falha é o pior jeito de errar aqui: a tela mandaria o lojista para o
 * login parecendo ter saído, enquanto o token dele seguia valendo em qualquer
 * cópia que existisse. Quem clica em "sair" costuma estar fazendo isso porque
 * desconfia que alguém pegou a sessão.
 */
export async function logout(): Promise<void> {
    const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
    })

    if (!response.ok) {
        const texto = await response.text().catch(() => "")
        throw new Error(extrairMensagemErro(texto ? safeParse(texto) : null))
    }
}
