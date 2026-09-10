import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Rotas que exigem sessão (cookie httpOnly "token" definido pelo backend).
const ROTAS_PROTEGIDAS = [
    "/page/produtos",
    "/page/produto",
    "/page/estoque",
    "/page/avarias",
    "/page/pedidos",
    "/page/vendidos",
    "/page/cancelados",
    "/page/etiquetas",
    "/page/banners",
    "/page/promocoes",
    "/page/loja",
    // A caixa de entrada do WhatsApp da loja. Sem ela aqui, a tela abria para
    // quem não tem sessão: as conversas em si não vinham (o backend recusa
    // sem token), mas o painel do lojista se desenhava inteiro para um
    // estranho — e "não vazou nada porque a outra ponta barrou" é exatamente
    // a defesa que se perde quando a outra ponta muda.
    // As lojas do dono. Sem ela aqui, a tela abriria para quem não tem sessão
    // — vazia, porque a API recusa, mas desenhada: o painel do lojista se
    // montando inteiro para um estranho.
    "/page/lojas",
    "/page/conversas",
    // A conversa interna da equipe, pelo mesmo motivo da linha acima: sem
    // ela aqui, a tela do cadeado se desenharia para um estranho, e o campo
    // de código ficaria exposto a quem nem sessão tem — que é o oposto de
    // exigir dois fatores.
    "/page/equipe",
    "/page/venda",
    // Exige sessão como as demais, mas note que NÃO exige assinatura em dia:
    // é a tela onde o lojista bloqueado paga para voltar a ter acesso.
    "/page/assinatura",
]

// Telas que ficam DENTRO de uma área protegida mas precisam abrir sem
// sessão. A volta do Stripe é o caso: no cadastro novo, é justamente essa
// página que cria a conta e abre a sessão — exigir sessão nela mandaria para
// o login quem acabou de pagar, e o pagamento ficaria sem conta.
//
// Conferida ANTES de ROTAS_PROTEGIDAS, porque "/page/assinatura" é prefixo
// de "/page/assinatura/sucesso".
const ROTAS_ABERTAS = [
    "/page/assinatura/sucesso",
    "/page/assinatura/cancelado",
]

// ==============================
// RATE LIMIT
// ==============================
// Contador em memória por IP — o Proxy roda em runtime Node.js (Next.js 16),
// então isso persiste enquanto o processo do servidor viver. Em uma
// implantação com múltiplas instâncias atrás de um load balancer, cada
// instância tem seu próprio contador (não é compartilhado); para esse caso
// seria necessário um store externo (ex: Redis). Para uma única instância,
// como este projeto, isso já barra brute-force e scraping automatizado.
const JANELA_MS = 60_000
const LIMITE_CONTA = 5 // tentativas por minuto, por IP, nas rotas de conta
const LIMITE_API = 120 // demais chamadas de API por minuto, por IP
const LIMITE_IMAGEM = 400 // fotos por minuto, por IP (ver ROTA_IMAGEM)
const LIMITE_LEITURA = 600 // consultas de acompanhamento por minuto, por IP

/**
 * O que é ARQUIVO tem balde próprio, e não o de 120.
 *
 * Antes as fotos vinham direto do host de terceiro e não passavam por aqui;
 * desde que a CSP fechou `img-src`, cada tela do painel manda uma dezena delas
 * para cá. Somadas no mesmo balde das chamadas de API, uma listagem com dez
 * produtos gastava um décimo do minuto, e o limite passava a ser atingido
 * navegando normalmente — derrubando, junto com as fotos, as chamadas que
 * fazem a tela funcionar. Um limite que dispara com uso legítimo não protege
 * ninguém: ensina a ignorá-lo.
 *
 * Continua finito porque cada chamada faz o servidor buscar um endereço de
 * fora, e isso é banda nossa gasta a pedido de outra pessoa. Mas é folgado: a
 * resposta já vem com cache de cinco minutos, então só a primeira visita a
 * cada foto chega até aqui.
 *
 * As fotos de perfil e a mídia do WhatsApp entram aqui pelo MESMO motivo, e
 * ficaram de fora por esquecimento — foi o que fez o painel travar em "Muitas
 * requisições" ao navegar. A tela de Conversas mostra um avatar por linha:
 * numa loja com noventa conversas, abrir a tela uma vez gastava quase o
 * minuto inteiro do balde de API, e a segunda abertura derrubava junto as
 * chamadas que fazem a tela funcionar. São arquivos, não chamadas de API, e é
 * no balde de arquivos que eles pertencem.
 */
const ROTA_IMAGEM = "/api/imagem"

/** Fotos de perfil e mídia das conversas: `/api/whatsapp/.../foto` e `/midia/:id`. */
const ROTAS_DE_ARQUIVO_WHATSAPP = /^\/api\/whatsapp\/(conversas\/\d+\/foto|midia\/\d+)$/

/** Se o caminho serve um arquivo, e não uma chamada de API. */
function ehArquivo(pathname: string): boolean {
    return pathname === ROTA_IMAGEM || ROTAS_DE_ARQUIVO_WHATSAPP.test(pathname)
}

/**
 * Teto do corpo de uma requisição, o mesmo 1 MiB do backend Go (ver
 * lib/midlleware/bodylimit).
 *
 * Sem isto, cada rota chamava `request.json()` num corpo de tamanho livre — e
 * quem chama escolhe esse tamanho. Um POST de 40 MB era lido inteiro para a
 * memória do servidor ANTES de qualquer validação de conteúdo: a rota até
 * respondia "dados inválidos", mas só depois de já ter pago o preço. O
 * cabeçalho é conferido aqui, antes de a rota existir, e um só lugar cobre
 * todas elas.
 *
 * Nada legítimo do painel chega perto: os corpos são JSON de formulário, e a
 * foto de produto é uma URL, não um upload.
 */
const LIMITE_CORPO_BYTES = 1 << 20

/**
 * Limite das telas, separado do das rotas de API.
 *
 * As páginas não tinham limite nenhum — dava para varrer o painel inteiro sem
 * esbarrar em nada. É folgado porque navegar de verdade gasta pouco (uma
 * pessoa abre dezenas de telas por minuto, não centenas) e porque a loja
 * inteira sai por um IP só.
 */
const LIMITE_PAGINA = 300

/**
 * As rotas que ficam no balde apertado, e não no de 120 por minuto.
 *
 * Login é o caso óbvio (força bruta de senha). As outras duas entram pelo
 * mesmo motivo pelo qual o login entrou: são as portas abertas a quem ainda
 * não tem conta, e 120 por minuto por IP dá para criar cadastro em massa e
 * para abrir sessão de pagamento no Stripe em série — o que custa dinheiro e
 * suja a conta da loja mesmo sem ninguém pagar nada.
 */
/**
 * As leituras de acompanhamento, que têm balde próprio e folgado.
 *
 * O painel ficou ao vivo: a barra superior conta o que chegou, a conversa se
 * atualiza sozinha, o "está digitando" avisa enquanto alguém escreve. Isso é
 * muita chamada — e A LOJA INTEIRA SAI POR UM IP SÓ, então cinco pessoas
 * trabalhando somavam no mesmo balde de 120 e batiam no limite bem no meio de
 * um atendimento, que é o pior momento possível.
 *
 * Separá-las não afrouxa nada do que o limite protege. Estas rotas só LEEM,
 * exigem sessão, respondem números pequenos e não criam nem cobram nada; o
 * balde apertado continua valendo para tudo o que escreve, e o de 5 por minuto
 * para as portas abertas a quem não tem conta.
 *
 * É a mesma ideia do balde das imagens logo acima, e pelo mesmo motivo:
 * tráfego legítimo de natureza diferente não pode dividir a régua com o
 * tráfego que a régua existe para conter.
 */
const ROTAS_DE_LEITURA = [
    "/api/notificacoes",
    "/api/equipe",
    "/api/atendimentos",
    "/api/whatsapp/conversas",
]

const ROTAS_DE_CONTA = [
    "/api/login",
    "/api/cadastro",
    "/api/assinatura/checkout-publico",
]

const contadores = new Map<string, { total: number; expiraEm: number }>()

// Evita que o Map cresça indefinidamente em processos de longa duração.
setInterval(() => {
    const agora = Date.now()
    for (const [chave, registro] of contadores) {
        if (registro.expiraEm <= agora) contadores.delete(chave)
    }
}, JANELA_MS).unref()

/**
 * Quantos proxies confiáveis existem entre o navegador e este processo.
 *
 * O padrão é ZERO, e não um: sem declaração, X-Forwarded-For é ignorado por
 * completo e vale o IP da conexão. É o mesmo padrão que o backend Go adota
 * (ver SetTrustedProxies em main.go), e pelo mesmo motivo — supor um proxy
 * que não existe faz o limite ler um cabeçalho que quem chama escreve, e um
 * IP novo por tentativa é um limite que não limita nada.
 *
 * Errar para este lado atrapalha quem esqueceu de configurar (a loja inteira
 * atrás de um NAT conta como um IP só); errar para o outro lado desliga o
 * limite sem ninguém perceber.
 */
function proxiesConfiaveis(): number {
    const declarado = Number(process.env.TRUSTED_PROXY_COUNT)

    return Number.isInteger(declarado) && declarado >= 0 ? declarado : 0
}

const PROXIES_CONFIAVEIS = proxiesConfiaveis()

/**
 * O IP de quem chamou, para contar no limite por minuto.
 *
 * X-Forwarded-For é uma LISTA que cada salto acrescenta no fim, e a primeira
 * posição é a única que quem chama escreve à vontade — mandar
 * "X-Forwarded-For: 1.2.3.4" num cabeçalho inventado dava a cada tentativa de
 * login um IP novo, e o limite de cinco por minuto virava enfeite. Por isso
 * conta-se de trás para frente: o último item foi escrito pelo nosso próprio
 * proxy e é o que ele viu de verdade.
 */
function obterIp(request: NextRequest): string {

    // Com Cloudflare na frente, o CF-Connecting-IP é o caminho mais firme: ela
    // o REESCREVE em toda requisição, então ele não carrega nada que o
    // visitante tenha escrito — ao contrário do X-Forwarded-For, cuja primeira
    // posição vem de quem chama.
    //
    // Ele só vale se a origem for inalcançável por fora da Cloudflare; senão
    // qualquer um bate direto no servidor com o cabeçalho que quiser. Por isso
    // depende de TRUSTED_PROXY_COUNT estar declarado, e por isso o firewall da
    // VPS tem de aceitar só as faixas dela (ver deploy/PRODUCAO.md).
    if (PROXIES_CONFIAVEIS > 0) {
        const daCloudflare = request.headers.get("cf-connecting-ip")?.trim()

        if (daCloudflare) return daCloudflare.slice(0, 45)
    }

    // Zero proxies: nada de X-Forwarded-For. Sem ninguém confiável na frente
    // para reescrevê-lo, o cabeçalho é só texto que quem chama inventou.
    const encaminhado = PROXIES_CONFIAVEIS > 0 ? request.headers.get("x-forwarded-for") : null

    if (encaminhado) {
        const saltos = encaminhado.split(",").map((parte) => parte.trim()).filter(Boolean)

        // Curto demais para o número de saltos declarados: alguém mandou a
        // lista pela metade, ou TRUSTED_PROXY_COUNT está maior do que a
        // realidade. Nos dois casos, a posição que sobraria seria a primeira —
        // justamente a que quem chama escreve à vontade. Cair fora daqui é o
        // que impede o cabeçalho curto de virar um IP novo a cada tentativa.
        if (saltos.length >= PROXIES_CONFIAVEIS) {
            return saltos[saltos.length - PROXIES_CONFIAVEIS]
        }
    }

    return request.headers.get("x-real-ip") ?? "desconhecido"
}

/** Retorna false quando o limite da janela atual já foi atingido. */
function podeConsumir(chave: string, limite: number): boolean {
    const agora = Date.now()
    const registro = contadores.get(chave)

    if (!registro || registro.expiraEm <= agora) {
        contadores.set(chave, { total: 1, expiraEm: agora + JANELA_MS })
        return true
    }

    if (registro.total >= limite) {
        return false
    }

    registro.total += 1
    return true
}

// ==============================
// CSP: PARA ONDE A ABA PODE FALAR
// ==============================
/**
 * As origens de WebSocket que a página pode abrir.
 *
 * As conversas ao vivo saem de NEXT_PUBLIC_WS_URL, que é OUTRO servidor — o
 * backend Go, não a origem do painel. Com `connect-src 'self'` sozinho o
 * navegador cortava esse fio calado, e a tela só se atualizava na varredura
 * de meio em meio minuto; abrir a mão com `connect-src *` consertaria isso
 * devolvendo a um script injetado o direito de mandar as conversas para
 * qualquer lugar. Então declara-se o endereço, e só ele.
 *
 * Vai também a versão wss:// do que estiver configurado como ws://, porque é
 * para ela que o cliente sobe sozinho quando o painel é servido por HTTPS
 * (ver `enderecoDoFluxo` em middleware/whatsapp.ts).
 */
function origensDoSocket(): string[] {
    const bruto = process.env.NEXT_PUBLIC_WS_URL

    if (!bruto) return []

    try {
        const url = new URL(bruto.trim())

        if (url.protocol !== "ws:" && url.protocol !== "wss:") return []

        // Em produção só a forma segura entra na política, mesmo que a
        // variável ainda diga ws://. Declarar a origem em texto puro seria a
        // CSP autorizando o navegador a abrir justamente a conexão que o
        // cliente evita (ver enderecoDoFluxo em middleware/whatsapp.ts) — e
        // uma permissão que ninguém pretende usar é uma permissão que só
        // serve a quem não deveria.
        if (url.protocol === "wss:") return [url.origin]

        return process.env.NODE_ENV === "production"
            ? [`wss://${url.host}`]
            : [url.origin, `wss://${url.host}`]

    } catch {
        return []
    }
}

const ORIGENS_SOCKET = origensDoSocket().join(" ")

// ==============================
// CSRF
// ==============================
// As rotas /api/* usam cookie de sessão automático (credentials: "include"),
// então requisições que alteram estado (POST/PUT/DELETE/PATCH) precisam
// confirmar que partiram do próprio front — senão um site de terceiros
// poderia disparar uma ação autenticada só pelo navegador da vítima ter a
// sessão aberta.
const METODOS_SENSIVEIS = ["POST", "PUT", "DELETE", "PATCH"]

function origemConfiavel(request: NextRequest): boolean {
    const origin = request.headers.get("origin")

    if (origin) {
        try {
            return new URL(origin).host === request.nextUrl.host
        } catch {
            return false
        }
    }

    const referer = request.headers.get("referer")

    if (referer) {
        try {
            return new URL(referer).host === request.nextUrl.host
        } catch {
            return false
        }
    }

    // Sem Origin nem Referer, recusa.
    //
    // Antes aqui se devolvia true, com o argumento de que sem esses
    // cabeçalhos não é um navegador e portanto não há cookie ambiente para
    // abusar. O argumento é bom e ainda assim a porta fica aberta: todo
    // navegador manda Origin em POST/PUT/DELETE/PATCH, então nenhuma
    // chamada legítima do painel cai neste caso, e o que sobra é só o que
    // conseguiu chegar aqui com o cookie do lojista sem se identificar.
    // Defesa que depende de o atacante não conseguir omitir um cabeçalho é
    // defesa que ele desliga.
    //
    // Se um dia algo servidor-a-servidor precisar destas rotas, o caminho é
    // uma credencial própria, não uma exceção baseada em cabeçalho ausente.
    return false
}

/**
 * Se esta chamada é uma leitura de acompanhamento (ver ROTAS_DE_LEITURA).
 *
 * O MÉTODO entra na conta, e não só o caminho: `/api/equipe` também recebe
 * POST — escrever mensagem, entrar na conversa —, e essas são escritas de
 * verdade, que continuam no balde apertado. Só o GET é acompanhamento.
 *
 * O "está digitando" é a exceção deliberada: é POST porque avisa, mas não
 * grava nada, não devolve corpo e é a chamada mais frequente do painel. Deixá-
 * la no balde comum faria uma pessoa escrevendo consumir sozinha um sexto do
 * limite da loja.
 */
function ehLeituraDeAcompanhamento(request: NextRequest, pathname: string): boolean {

    if (pathname === "/api/equipe/digitando") return request.method === "POST"

    if (request.method !== "GET") return false

    return ROTAS_DE_LEITURA.some(
        (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
    )
}

/** Se o corpo declarado passa do teto — ver LIMITE_CORPO_BYTES. */
function corpoGrandeDemais(request: NextRequest): boolean {

    const declarado = Number(request.headers.get("content-length"))

    return Number.isFinite(declarado) && declarado > LIMITE_CORPO_BYTES
}

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (pathname.startsWith("/api/")) {
        if (METODOS_SENSIVEIS.includes(request.method) && !origemConfiavel(request)) {
            return Response.json({ erro: "Origem não permitida" }, { status: 403 })
        }

        if (corpoGrandeDemais(request)) {
            return Response.json(
                { erro: "Requisição grande demais" },
                { status: 413, headers: { "Cache-Control": "no-store" } }
            )
        }

        const ip = obterIp(request)

        const balde = ROTAS_DE_CONTA.includes(pathname)
            ? { nome: "conta", limite: LIMITE_CONTA }
            : ehLeituraDeAcompanhamento(request, pathname)
                ? { nome: "leitura", limite: LIMITE_LEITURA }
            : ehArquivo(pathname)
                ? { nome: "imagem", limite: LIMITE_IMAGEM }
                : { nome: "api", limite: LIMITE_API }

        const chave = `${ip}:${balde.nome}`
        const limite = balde.limite

        if (!podeConsumir(chave, limite)) {
            return Response.json(
                { erro: "Muitas requisições. Tente novamente em instantes." },
                { status: 429, headers: { "Retry-After": "60" } }
            )
        }

        return NextResponse.next()
    }

    // Daqui para baixo são as telas. Elas também contam — sem isso, o painel
    // inteiro podia ser varrido tela a tela sem esbarrar em nada, e a
    // proteção de rota (o redirecionamento para /login) só diz que a página
    // não abre, não que ela não pode ser pedida mil vezes.
    if (!podeConsumir(`${obterIp(request)}:pagina`, LIMITE_PAGINA)) {
        return new Response("Muitas requisições. Tente novamente em instantes.", {
            status: 429,
            headers: { "Retry-After": "60", "Content-Type": "text/plain; charset=utf-8" },
        })
    }

    const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
    const isDev = process.env.NODE_ENV === "development"

    // img-src fechado em 'self': nenhuma figura vem direto de servidor de
    // terceiro. Antes era `https:`, que liberava qualquer host do mundo — e
    // uma URL de imagem é um canal de saída, o jeito mais simples de um script
    // injetado mandar o que roubou para fora sem esbarrar em nada. As fotos de
    // fora entram pelo proxy (app/api/imagem), que busca no servidor e serve
    // daqui; `data:` fica porque o QR do WhatsApp chega assim.
    const cspHeader = `
        default-src 'self';
        script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        img-src 'self' data:;
        font-src 'self' https://fonts.gstatic.com;
        connect-src 'self'${ORIGENS_SOCKET ? ` ${ORIGENS_SOCKET}` : ""};
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        frame-ancestors 'none';
        ${isDev ? "" : "upgrade-insecure-requests;"}
    `
    const contentSecurityPolicyHeaderValue = cspHeader.replace(/\s{2,}/g, " ").trim()

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-nonce", nonce)
    requestHeaders.set("Content-Security-Policy", contentSecurityPolicyHeaderValue)

    const precisaAutenticar =
        !ROTAS_ABERTAS.some((rota) => request.nextUrl.pathname.startsWith(rota)) &&
        ROTAS_PROTEGIDAS.some((rota) => request.nextUrl.pathname.startsWith(rota))

    if (precisaAutenticar && !request.cookies.get("token")) {
        return NextResponse.redirect(new URL("/login", request.url))
    }

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    })

    response.headers.set("Content-Security-Policy", contentSecurityPolicyHeaderValue)
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    // X-Frame-Options e frame-ancestors barram o painel DENTRO de outra
    // página; estes dois cuidam do caminho inverso, o de outra página abrir o
    // painel com window.open e ficar com uma referência viva para ele. Com o
    // isolamento, a janela de quem abriu e a do painel deixam de se enxergar.
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin")
    response.headers.set("Cross-Origin-Resource-Policy", "same-origin")

    if (!isDev) {
        response.headers.set(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload"
        )
    }

    return response
}

export const config = {
    matcher: [
        {
            source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
            missing: [
                { type: "header", key: "next-router-prefetch" },
                { type: "header", key: "purpose", value: "prefetch" },
            ],
        },
        "/api/:path*",
    ],
}
