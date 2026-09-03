// Leitura direta do backend, para as telas que o Next renderiza no servidor.
//
// É o mesmo dado que `middleware/*` busca, pelo caminho curto. Pelo caminho
// longo — o que toda tela do painel usa hoje — o navegador abre a página,
// monta um esqueleto, pede a `app/api/*`, que pede ao Go, e só então a lista
// aparece: três pernas e uma tela piscando antes do primeiro número. Aqui a
// página já está rodando no servidor, ao lado do backend, então ela pergunta
// uma vez e o lojista recebe o HTML com a grade dentro.
//
// Só leitura, e de propósito. Gravar continua passando por `app/api/*`,
// porque quem grava é um clique no navegador — e é lá que o cookie de sessão
// vira `Authorization` sem nunca aparecer para a página.

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { API_BASE } from "@/app/api/backend"
import { conta, estoque, produtos as rotasProdutos } from "@/app/api/rotas"
import type { Assinatura, ItemMenu, Produto, Unidade } from "@/app/type/type"

/**
 * O erro que as telas de servidor deixam subir até o `error.tsx` do trecho.
 *
 * Não carrega detalhe do servidor na mensagem: em produção o Next nem
 * entregaria esse texto ao navegador, e quem precisa da causa exata a acha
 * no log pelo `digest`.
 */
export class ErroDoBackend extends Error {
    constructor(readonly status: number) {
        super("Não foi possível falar com o servidor.")
        this.name = "ErroDoBackend"
    }
}

/** 402: a loja está logada, mas a assinatura não está em dia. */
const STATUS_PAGAMENTO_NECESSARIO = 402

async function buscarNoBackend<T>(caminho: string): Promise<T> {

    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    // Chegar aqui sem cookie é caso de borda: o proxy já manda para o login
    // quem não tem sessão (ver proxy.ts). Fica como rede de segurança para o
    // dia em que uma rota nova escapar da lista de lá.
    if (!token) redirect("/login")

    let resposta: Response

    try {
        resposta = await fetch(`${API_BASE}${caminho}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            cache: "no-store",
        })
    } catch {
        // Backend fora do ar, DNS, timeout: para a tela é tudo a mesma
        // coisa — não há dado para mostrar.
        throw new ErroDoBackend(503)
    }

    // Os dois desvios abaixo ficam FORA do try de propósito: `redirect()`
    // funciona lançando, e um catch em volta engoliria o desvio e mostraria
    // uma tela de erro no lugar da tela de pagamento.
    if (resposta.status === 401) redirect("/login")

    if (resposta.status === STATUS_PAGAMENTO_NECESSARIO) redirect("/page/assinatura")

    if (!resposta.ok) throw new ErroDoBackend(resposta.status)

    const texto = await resposta.text()

    try {
        return (texto ? JSON.parse(texto) : {}) as T
    } catch {
        throw new ErroDoBackend(502)
    }
}

/** Todos os produtos da loja. */
export async function listarProdutos(): Promise<Produto[]> {
    const dados = await buscarNoBackend<{ produtos?: Produto[] }>(rotasProdutos.consultar())
    return Array.isArray(dados.produtos) ? dados.produtos : []
}

/** Todas as peças em estoque, de todos os produtos. */
export async function listarTodasUnidades(): Promise<Unidade[]> {
    const dados = await buscarNoBackend<{ unidades?: Unidade[] }>(estoque.unidades())
    return Array.isArray(dados.unidades) ? dados.unidades : []
}

/**
 * As telas que o plano da loja libera.
 *
 * Quem decide é o backend, olhando a assinatura — a tela só pergunta. É o
 * mesmo `menu` que o menu lateral consome; aqui ele serve para saber se a
 * loja tem site, e portanto se faz sentido oferecer "pôr na vitrine".
 */
export async function consultarMenu(): Promise<ItemMenu[]> {
    const assinatura = await buscarNoBackend<Assinatura>(conta.assinatura())
    return assinatura.menu ?? []
}
