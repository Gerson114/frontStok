import { sanitizeEmail } from "@/security/sanitize"
import { extrairMensagemErro } from "@/middleware/client"
import { url, cookieDeSessao, cookieDaLembranca } from "@/app/api/backend"
import { publico } from "@/app/api/rotas"


export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null)

        if (!body || typeof body !== "object") {
            return Response.json({ erro: "Corpo da requisição inválido" }, { status: 400 })
        }

        const entrada = body as Record<string, unknown>
        const email = sanitizeEmail(String(entrada.email ?? ""))
        const password = String(entrada.password ?? "")

        // "Continuar conectado" chega como booleano e segue como booleano:
        // quem decide o que ele vale — se abre lembrança, por quanto tempo,
        // com que segredo — é o backend (ver services/login/lembranca.go).
        const lembrar = entrada.lembrar === true

        // A validade de fato (formato, força, existência da conta) é
        // decidida pelo backend — aqui só evitamos mandar campos vazios.
        if (!email || !password) {
            return Response.json({ erro: "Email ou senha inválidos" }, { status: 400 })
        }

        const response = await fetch(url(publico.login()), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",

                // O navegador de quem está entrando, repassado.
                //
                // O backend só enxerga ESTE servidor, então sem repassar ele
                // gravava "node" como aparelho de toda lembrança — um campo
                // que existe justamente para o lojista reconhecer "este é o
                // computador da loja" na lista.
                "User-Agent": request.headers.get("user-agent") ?? "",
            },
            body: JSON.stringify({ email, Password: password, lembrar }),
            cache: "no-store",
        })

        const texto = await response.text()

        if (!response.ok) {
            return Response.json({ erro: extrairMensagemErro(safeParse(texto)) }, { status: response.status })
        }

        const saida = Response.json({ mensagem: "login realizado com sucesso" }, {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        })

        // Reemitido para esta origem em vez de repassado como veio: os
        // atributos do cookie (Secure, sobretudo) têm de descrever a conexão
        // do NAVEGADOR, e o backend só enxerga a nossa. Ver cookieDeSessao.
        const cookie = cookieDeSessao(response.headers.getSetCookie())

        if (!cookie) {
            return Response.json(
                { erro: "O servidor não abriu a sessão. Tente de novo." },
                { status: 502 }
            )
        }

        saida.headers.append("Set-Cookie", cookie)

        // O cookie da lembrança só existe quando a caixa foi marcada, então
        // ausência aqui é o caso normal, não falha.
        const lembranca = cookieDaLembranca(response.headers.getSetCookie())

        if (lembranca) saida.headers.append("Set-Cookie", lembranca)

        return saida

    } catch {
        return Response.json({ erro: "Erro interno do servidor" }, { status: 500 })
    }
}

function safeParse(texto: string): unknown {
    try {
        return JSON.parse(texto)
    } catch {
        return null
    }
}
