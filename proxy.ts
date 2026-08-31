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
const LIMITE_LOGIN = 5 // tentativas de login por minuto, por IP
const LIMITE_API = 120 // demais chamadas de API por minuto, por IP

const contadores = new Map<string, { total: number; expiraEm: number }>()

// Evita que o Map cresça indefinidamente em processos de longa duração.
setInterval(() => {
    const agora = Date.now()
    for (const [chave, registro] of contadores) {
        if (registro.expiraEm <= agora) contadores.delete(chave)
    }
}, JANELA_MS).unref()

function obterIp(request: NextRequest): string {
    const encaminhado = request.headers.get("x-forwarded-for")
    if (encaminhado) return encaminhado.split(",")[0].trim()

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

    // Sem Origin nem Referer: não é uma requisição de navegador (ex:
    // servidor a servidor), então não carrega o cookie de sessão do usuário
    // de qualquer forma — não é um vetor de CSRF.
    return true
}

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (pathname.startsWith("/api/")) {
        if (METODOS_SENSIVEIS.includes(request.method) && !origemConfiavel(request)) {
            return Response.json({ erro: "Origem não permitida" }, { status: 403 })
        }

        const ip = obterIp(request)
        const ehLogin = pathname === "/api/login"
        const chave = `${ip}:${ehLogin ? "login" : "api"}`
        const limite = ehLogin ? LIMITE_LOGIN : LIMITE_API

        if (!podeConsumir(chave, limite)) {
            return Response.json(
                { erro: "Muitas requisições. Tente novamente em instantes." },
                { status: 429, headers: { "Retry-After": "60" } }
            )
        }

        return NextResponse.next()
    }

    const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
    const isDev = process.env.NODE_ENV === "development"

    const cspHeader = `
        default-src 'self';
        script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        img-src 'self' https: data:;
        font-src 'self' https://fonts.gstatic.com;
        connect-src 'self';
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
