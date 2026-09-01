// Por onde as imagens de fora entram no painel.
//
// A CSP do painel declara `img-src 'self' data:` — nenhuma figura vem
// diretamente de um servidor de terceiro. Isso fecha dois furos de uma vez: o
// canal por onde um script injetado mandaria dados embutidos numa URL de
// imagem, e o rastro que cada tela do painel deixava no servidor de quem
// hospeda a foto (que via o IP do lojista e a hora em que ele abriu cada
// produto).
//
// Em troca, toda foto de fora passa por /api/imagem, que busca no servidor e
// serve da nossa origem. Ver a rota para as defesas de SSRF.

/**
 * O endereço por onde a tela deve pedir esta imagem.
 *
 * Caminho que já é nosso ("/api/whatsapp/midia/12") passa direto: é a mesma
 * origem, e proxiar o próprio servidor só gastaria um salto. Vazio continua
 * vazio, para quem chama decidir o que mostrar no lugar.
 */
export function urlDaImagem(bruto: string | null | undefined): string {

    const limpo = (bruto ?? "").trim()

    if (!limpo) return ""

    if (limpo.startsWith("/")) return limpo

    return `/api/imagem?u=${encodeURIComponent(limpo)}`
}
