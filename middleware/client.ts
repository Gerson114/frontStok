// Cliente HTTP único usado por todas as chamadas às rotas internas do
// Next (app/api/*). Centraliza credenciais, cabeçalhos e tratamento de erro
// para que os componentes nunca precisem chamar `fetch` diretamente.

export class ApiError extends Error {
    status: number

    /**
     * O corpo da resposta que falhou, inteiro. Alguns erros não são só uma
     * mensagem: a troca de plano recusada por falta de confirmação (428)
     * devolve junto a prévia da cobrança, que é justamente o que a tela
     * precisa mostrar antes de perguntar de novo.
     */
    dados: unknown

    constructor(message: string, status: number, dados?: unknown) {
        super(message)
        this.name = "ApiError"
        this.status = status
        this.dados = dados
    }
}

interface ApiFetchOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE"
    body?: unknown
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {

    // FormData passa como está, sem JSON.stringify e SEM Content-Type.
    //
    // Serializar um FormData como JSON produziria a string "[object FormData]"
    // — um corpo válido que não contém arquivo nenhum, e um erro que só
    // aparece do outro lado como "campo ausente". E o cabeçalho precisa
    // carregar a fronteira que separa as partes, que só o fetch sabe montar:
    // declarar "multipart/form-data" à mão é o erro clássico aqui.
    const ehFormulario = options.body instanceof FormData

    const response = await fetch(path, {
        method: options.method ?? "GET",
        credentials: "include",
        cache: "no-store",
        headers: options.body !== undefined && !ehFormulario
            ? { "Content-Type": "application/json" }
            : undefined,
        body: options.body === undefined
            ? undefined
            : ehFormulario
                ? (options.body as FormData)
                : JSON.stringify(options.body),
    })

    const texto = await response.text()
    const dados = texto ? safeParse(texto) : null

    if (!response.ok) {
        if (response.status === STATUS_PAGAMENTO_NECESSARIO) {
            redirecionarParaAssinatura()
        }

        throw new ApiError(extrairMensagemErro(dados), response.status, dados)
    }

    return dados as T
}

// 402 Payment Required: o backend responde assim quando a loja está logada,
// mas sem assinatura em dia. É diferente de 401 (não está logado) e de
// 403/404 (não é seu), e por isso pede uma tela própria.
const STATUS_PAGAMENTO_NECESSARIO = 402

const ROTA_ASSINATURA = "/page/assinatura"

// Leva o lojista à tela de pagamento em vez de deixar cada página inventar
// uma mensagem para um erro que só tem uma saída: pagar. Fica centralizado
// aqui porque qualquer chamada do painel pode ser a primeira a esbarrar no
// bloqueio.
function redirecionarParaAssinatura(): void {
    if (typeof window === "undefined") return

    // Não redireciona se já estamos na própria tela de assinatura: ela
    // consulta /api/assinatura de propósito, e um laço de recarga deixaria a
    // página inutilizável justamente para quem precisa pagar.
    if (window.location.pathname.startsWith(ROTA_ASSINATURA)) return

    // Navegação "dura" de propósito, e não useRouter().push: este módulo é um
    // wrapper de fetch, não um componente, então não há router disponível
    // aqui. Recarregar a página inteira também é o que se quer — o acesso da
    // loja acabou de mudar, e qualquer estado em memória do painel bloqueado
    // deixou de valer.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = ROTA_ASSINATURA
}

// Exportada porque o envio de arquivo (ver produtos.ts) não passa por
// apiFetch: ele monta o próprio multipart e precisa ler a resposta do mesmo
// jeito que todo o resto do painel lê.
export function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}

export function extrairMensagemErro(dados: unknown): string {
    if (dados && typeof dados === "object" && "erro" in dados) {
        return String((dados as { erro: unknown }).erro)
    }

    return "Erro inesperado ao comunicar com o servidor."
}
