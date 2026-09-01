// Confere, na subida do servidor, se a configuração do painel é segura para o
// ambiente em que ele está rodando.
//
// É o espelho de lib/security/ambiente no backend Go, e existe pelo mesmo
// motivo: um erro de configuração perigoso deve aparecer no boot, para quem
// faz o deploy, e não meses depois num vazamento. Em desenvolvimento vira
// aviso, para não atrapalhar; em produção derruba a subida, porque ali não
// existe "depois eu arrumo".
//
// A variável que motivou este arquivo foi NEXT_PUBLIC_WS_URL: em ws:// o
// bilhete de acesso e as conversas dos clientes atravessam a rede em texto
// puro. Isso está certo em localhost e é um vazamento em produção — e nada,
// até aqui, impedia o valor de desenvolvimento de ir junto no deploy.

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
    return [...conferirSocket(), ...conferirVitrine(), ...conferirBackend()]
}

function conferirSocket(): Problema[] {

    const bruto = (process.env.NEXT_PUBLIC_WS_URL ?? "").trim()

    if (!bruto) {
        return [{
            variavel: "NEXT_PUBLIC_WS_URL",
            mensagem: "não definida: as conversas do WhatsApp não chegam ao vivo, e a tela só se atualiza a cada 30 segundos",
            correcao: "aponte para o mesmo servidor de API_URL, como wss://",
        }]
    }

    let url: URL

    try {
        url = new URL(bruto)
    } catch {
        return [{
            variavel: "NEXT_PUBLIC_WS_URL",
            mensagem: `${JSON.stringify(bruto)} não é um endereço válido`,
            correcao: "use a forma wss://servidor:porta, sem barra no final",
        }]
    }

    if (url.protocol !== "ws:" && url.protocol !== "wss:") {
        return [{
            variavel: "NEXT_PUBLIC_WS_URL",
            mensagem: `esquema ${JSON.stringify(url.protocol)} não é de WebSocket`,
            correcao: "use ws:// em desenvolvimento e wss:// em produção",
        }]
    }

    if (!ehProducao()) return []

    const problemas: Problema[] = []

    if (url.protocol === "ws:") {
        problemas.push({
            variavel: "NEXT_PUBLIC_WS_URL",
            mensagem: "ws:// em produção: o bilhete de acesso viaja na URL do socket e as conversas dos clientes voltam por ele, tudo em texto puro para quem estiver no caminho",
            correcao: "troque para wss://",
        })
    }

    if (enderecoDeDesenvolvimento(url)) {
        problemas.push({
            variavel: "NEXT_PUBLIC_WS_URL",
            mensagem: `${JSON.stringify(url.host)} é endereço de desenvolvimento: o painel de produção não consegue abrir o fio ao vivo`,
            correcao: "use o domínio real do servidor de API",
        })
    }

    return problemas
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
