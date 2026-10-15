// Confere, na subida do servidor, se a configuração do painel é segura para o
// ambiente em que ele está rodando.
//
// É o espelho de lib/security/ambiente no backend Go, e existe pelo mesmo
// motivo: um erro de configuração perigoso deve aparecer no boot, para quem
// faz o deploy, e não meses depois num vazamento. Em desenvolvimento vira
// aviso, para não atrapalhar; em produção derruba a subida, porque ali não
// existe "depois eu arrumo".
//
// A variável que motivou este arquivo foi NEXT_PUBLIC_WS_URL, o endereço do
// socket que o navegador abria direto no backend. Ela não existe mais — o canal
// ao vivo virou uma rota desta mesma origem (ver app/api/aovivo/route.ts) —,
// mas a lição que ela deixou vale para as que ficaram: configuração errada deve
// aparecer no boot, para quem faz o deploy, e não meses depois.

export interface Problema {
    variavel: string
    mensagem: string
    correcao: string
}

/** Se este processo está servindo produção. */
export function ehProducao(): boolean {
    return process.env.NODE_ENV === "production"
}

/** Tudo o que está inseguro na configuração atual. Lista vazia é tudo certo. */
export function conferir(): Problema[] {
    return [...conferirVitrine(), ...conferirBackend(), ...conferirProxy()]
}

/**
 * Quantos proxies existem entre o navegador e este processo.
 *
 * O limite por IP do proxy.ts depende disto para saber de onde veio a
 * requisição. Sem a variável, nenhum cabeçalho de encaminhamento é aceito — e
 * atrás do Caddy, que é como o painel roda em produção, isso põe todo mundo
 * num balde só: o nono login do dia recebe "muitas tentativas" sem ninguém
 * ter errado senha nenhuma.
 *
 * Zero não serve em produção justamente por isso, e o valor não pode ser
 * chutado para cima: declarar mais saltos do que existem faz a leitura do
 * X-Forwarded-For cair na posição que quem chama escreve, e aí o limite volta
 * a não limitar nada.
 *
 * Um é só o Caddy. Dois é Cloudflare + Caddy — e aí o firewall da VPS tem de
 * aceitar apenas as faixas da Cloudflare, senão qualquer um bate direto na
 * origem com o cabeçalho que quiser (ver deploy/PRODUCAO.md no backend).
 *
 * É o espelho de conferirProxy na vitrine (vendas/frontp/security/ambiente.ts).
 */
function conferirProxy(): Problema[] {

    if (!ehProducao()) return []

    const bruto = (process.env.TRUSTED_PROXY_COUNT ?? "").trim()

    if (!bruto) {
        return [{
            variavel: "TRUSTED_PROXY_COUNT",
            mensagem: "não definida: o limite por IP cai num balde único e a loja inteira leva \"muitas tentativas\" no primeiro pico",
            correcao: "declare quantos proxies existem na frente do painel — 1 com Caddy, 2 com Cloudflare + Caddy",
        }]
    }

    const saltos = Number(bruto)

    if (!Number.isInteger(saltos) || saltos < 1 || saltos > 4) {
        return [{
            variavel: "TRUSTED_PROXY_COUNT",
            mensagem: `${JSON.stringify(bruto)} não é um número de saltos utilizável`,
            correcao: "use um inteiro de 1 a 4 — 1 com Caddy, 2 com Cloudflare + Caddy",
        }]
    }

    return []
}

function conferirVitrine(): Problema[] {

    const bruto = (process.env.NEXT_PUBLIC_VITRINE_URL ?? "").trim()

    if (!bruto || !ehProducao()) return []

    let url: URL

    try {
        url = new URL(bruto)
    } catch {
        return [{
            variavel: "NEXT_PUBLIC_VITRINE_URL",
            mensagem: `${JSON.stringify(bruto)} não é um endereço válido`,
            correcao: "use a forma https://dominio, sem barra no final",
        }]
    }

    const problemas: Problema[] = []

    if (url.protocol !== "https:") {
        problemas.push({
            variavel: "NEXT_PUBLIC_VITRINE_URL",
            mensagem: "vitrine em http: é o endereço que o lojista divulga aos clientes dele, e em texto puro qualquer um no caminho lê e altera o que a loja mostra",
            correcao: "use https://",
        })
    }

    if (enderecoDeDesenvolvimento(url)) {
        problemas.push({
            variavel: "NEXT_PUBLIC_VITRINE_URL",
            mensagem: `${JSON.stringify(url.host)} é endereço de desenvolvimento: o link da loja sai quebrado para todo lojista`,
            correcao: "use o domínio real da vitrine",
        })
    }

    return problemas
}

function conferirBackend(): Problema[] {

    // Só a ausência. http entre o Next e o Go é normal e não é problema: os
    // dois costumam conversar pela rede interna da máquina, e exigir TLS aí
    // seria cobrar cerimônia de uma conexão que nunca sai do servidor.
    if ((process.env.API_URL ?? "").trim()) return []

    return [{
        variavel: "API_URL",
        mensagem: "não definida: o painel cai no padrão http://localhost:8080, que em produção não é o backend",
        correcao: "aponte para o endereço interno do servidor Go",
    }]
}

/** Endereços que denunciam configuração de desenvolvimento esquecida no deploy. */
function enderecoDeDesenvolvimento(url: URL): boolean {

    const host = url.hostname.toLowerCase()

    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") {
        return true
    }

    return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
}
