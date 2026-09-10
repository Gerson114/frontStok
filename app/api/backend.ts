// Repasse ao backend Go, usado pelas rotas internas do Next (app/api/*).
//
// Toda rota daqui faz a mesma coisa: pega o cookie de sessão, chama o
// backend com ele no Authorization e devolve a resposta como veio — inclusive
// o status, que é o que faz o 402 (assinatura vencida) e o 409 (tarefa já
// assumida por outra pessoa) chegarem à tela com o significado que têm.
//
// Nenhuma decisão mora aqui: o front não sabe quem pode assumir uma tarefa,
// o que está abaixo do mínimo na prateleira nem quais pedidos entram numa
// onda. Ele mostra o que o servidor respondeu.

import { cookies } from "next/headers"
import { extrairMensagemErro } from "@/middleware/client"

/**
 * O endereço do backend Go, lido do ambiente — o dono único deste valor.
 *
 * Ele já vinha do .env, mas a linha que o lia estava copiada em 44 arquivos
 * de rota. Repetição desse tamanho não é só feiúra: é 44 lugares onde um
 * padrão diferente pode ser escrito sem ninguém notar, e 44 arquivos para
 * abrir no dia em que a leitura precisar de uma validação a mais.
 *
 * Server-only de propósito (não é NEXT_PUBLIC): este endereço é interno, e o
 * navegador nunca fala com o backend por conta própria — tudo passa por
 * app/api/*, que encaminha daqui.
 *
 * A barra final é cortada para "http://api/" e "http://api" darem no mesmo:
 * os caminhos abaixo já começam com barra, e duas seguidas viram uma rota
 * que o backend não conhece.
 */
export const API_BASE = (process.env.API_URL ?? "http://localhost:8080").trim().replace(/\/+$/, "")

/**
 * O cookie em que este servidor guarda a loja que o lojista está vendo, e o
 * cabeçalho em que ele a repassa ao backend.
 *
 * São dois nomes para a mesma escolha porque são dois mundos: o navegador só
 * fala com ESTE servidor, e o backend só recebe o que este servidor manda —
 * ele nunca vê cookie nenhum. A tradução acontece em `cabecalhosDaSessao`, num
 * lugar só, para nenhuma rota esquecer de repassar a loja e mostrar
 * silenciosamente os dados da loja errada.
 *
 * O valor NÃO é confiado: o backend confere a cada requisição que aquela loja é
 * mesmo do dono logado (ver auth.lojaAberta). Aqui ele é preferência de tela.
 */
export const COOKIE_DA_LOJA = "loja"
export const CABECALHO_DA_LOJA = "X-Loja"

/**
 * Os cabeçalhos que toda chamada ao backend leva: quem é o lojista, e em qual
 * loja ele está.
 *
 * Sem sessão devolve null — quem chama responde 401 sem tentar a chamada.
 */
export async function cabecalhosDaSessao(): Promise<Record<string, string> | null> {

    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) return null

    const cabecalhos: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
    }

    const loja = cookieStore.get(COOKIE_DA_LOJA)?.value

    if (loja) cabecalhos[CABECALHO_DA_LOJA] = loja

    return cabecalhos
}

/**
 * O endereço completo de um caminho do catálogo (ver app/api/rotas.ts).
 *
 * É o único ponto em que o endereço do servidor encontra o caminho. Quem
 * chama fala só em caminho, que é o que não muda entre desenvolvimento e
 * produção.
 */
export function url(caminho: string): string {
    return `${API_BASE}${caminho}`
}

export type MetodoHttp = "GET" | "POST" | "PUT" | "DELETE"

export async function repassarAoBackend(
    metodo: MetodoHttp,
    caminho: string,
    corpo?: unknown
): Promise<Response> {
    try {
        const cabecalhos = await cabecalhosDaSessao()

        if (!cabecalhos) {
            return Response.json({ erro: "Não autenticado" }, { status: 401 })
        }

        const temCorpo = corpo !== undefined && corpo !== null

        const response = await fetch(`${API_BASE}${caminho}`, {
            method: metodo,
            headers: {
                ...cabecalhos,
                ...(temCorpo ? { "Content-Type": "application/json" } : {}),
            },
            body: temCorpo ? JSON.stringify(corpo) : undefined,
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json(
                { erro: extrairMensagemErro(safeParse(texto)) },
                { status: response.status }
            )
        }

        return Response.json(safeParse(texto) ?? {}, {
            status: response.status,
            headers: { "Cache-Control": "no-store" },
        })

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

export function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}

/**
 * Corpo opcional: várias rotas da fila aceitam requisição sem corpo nenhum
 * (assumir uma tarefa trabalhando sozinho não tem responsável a informar),
 * então corpo ausente ou ilegível vira objeto vazio em vez de erro.
 */
export async function corpoDaRequisicao(request: Request): Promise<Record<string, unknown>> {
    const texto = await request.text().catch(() => "")
    const dados = texto ? safeParse(texto) : null

    return dados && typeof dados === "object" ? (dados as Record<string, unknown>) : {}
}


/** Validade da sessão, a mesma do JWT que o backend assina (jwt.ValidadeDaSessao). */
export const VALIDADE_SESSAO_S = 60 * 60 * 24

/**
 * Reemite o cookie de sessão devolvido pelo backend, com os atributos certos
 * para ESTA origem.
 *
 * Antes o Set-Cookie do backend era repassado ao navegador letra por letra, e
 * isso escondia um furo: quem decide o `Secure` lá é o backend, olhando se a
 * requisição CHEGOU por HTTPS. Só que quem chega ao backend não é o navegador
 * — é este servidor do Next, por http://localhost:8080, servidor a servidor.
 * O backend via uma conexão em texto puro, concluía "não é HTTPS" e mandava o
 * cookie SEM Secure. Em produção, o painel roda em HTTPS e o cookie de sessão
 * do lojista ia para o navegador sem a marca que o impede de sair por uma
 * conexão sem criptografia.
 *
 * Quem sabe o esquema que o navegador está usando é este lado, não o backend.
 * Então é aqui que os atributos são decididos — como já se fazia com o cookie
 * do cadastro (ver app/api/cadastro/route.ts).
 *
 * O valor vai como veio, sem decodificar: é o mesmo texto que o navegador
 * devolve e que `cookies().get("token")` lê de volta.
 */
export function cookieDeSessao(recebidos: string[]): string | null {

    const bruto = recebidos.find((cookie) => cookie.startsWith("token="))

    if (!bruto) return null

    const valor = bruto.slice("token=".length).split(";")[0]

    if (!valor) return null

    return [
        `token=${valor}`,
        "Path=/",
        // Fora do alcance de qualquer script da página: é o que faz um XSS
        // não virar sessão roubada.
        "HttpOnly",
        // Não acompanha requisição disparada por outro site — a trava de CSRF
        // do lado do navegador, além da que o proxy já faz por Origin.
        "SameSite=Lax",
        `Max-Age=${VALIDADE_SESSAO_S}`,
        process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
        .filter(Boolean)
        .join("; ")
}

/** Id vindo da URL é palpite de quem pediu até ser conferido. */
export function idValido(id: string): boolean {
    return /^[0-9]+$/.test(id)
}
