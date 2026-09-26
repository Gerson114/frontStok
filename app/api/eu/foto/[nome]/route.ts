import { cabecalhosDaSessao, url } from "@/app/api/backend"

/**
 * GET /api/eu/foto/<nome> — entrega a imagem de perfil.
 *
 * Só existe quando o bucket NÃO tem domínio público (R2_PUBLIC_URL em branco).
 * Com ele definido, o endereço que o servidor devolve aponta direto para a
 * Cloudflare e nada passa por aqui.
 *
 * É um repasse de BINÁRIO, e por isso não usa repassarAoBackend: aquele lê a
 * resposta como texto e a devolve como JSON, o que destruiria o JPEG. Aqui o
 * corpo atravessa como veio.
 *
 * O <img> da página não manda cabeçalho de autenticação — ele só busca uma
 * URL. Quem acrescenta a sessão é esta rota, que roda no servidor do painel e
 * tem acesso ao cookie. É a mesma razão de todas as outras rotas daqui
 * existirem.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ nome: string }> },
) {
    const cabecalhos = await cabecalhosDaSessao()

    if (!cabecalhos) {
        return new Response(null, { status: 401 })
    }

    const { nome } = await params

    // O nome é conferido do lado de lá antes de virar caminho no bucket (ver
    // funcionario.nomeDeFotoValido, que só aceita 32 dígitos hexadecimais e
    // ".jpg"). Aqui ele é apenas codificado, para um "/" ou ".." não escapar
    // da rota ao ser colado na URL.
    const resposta = await fetch(url(`/private/eu/foto/${encodeURIComponent(nome)}`), {
        headers: cabecalhos,
        cache: "no-store",
    })

    if (!resposta.ok) {
        return new Response(null, { status: resposta.status })
    }

    // O cache de um ano vem do servidor e é repassado como está: o conteúdo de
    // um nome nunca muda, porque trocar a foto sorteia um nome novo. Sem
    // repassá-lo, o navegador voltaria a pedir a mesma imagem em toda lista de
    // equipe desenhada.
    return new Response(resposta.body, {
        status: 200,
        headers: {
            "Content-Type": resposta.headers.get("content-type") ?? "image/jpeg",
            "Cache-Control": resposta.headers.get("cache-control") ?? "public, max-age=31536000, immutable",
        },
    })
}
