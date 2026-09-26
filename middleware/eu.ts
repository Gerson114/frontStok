import { apiFetch } from "./client"

/**
 * Troca a foto de perfil de quem está logado.
 *
 * Devolve o endereço da foto nova, pronto para entrar num <img> — quem monta
 * esse endereço é o servidor, porque só ele sabe se a foto vem da Cloudflare
 * ou dele mesmo. Esta função não precisa saber a diferença, e é isso que faz
 * ligar ou desligar o domínio público ser uma variável de ambiente em vez de
 * uma reconstrução do painel.
 *
 * O arquivo vai como multipart, e não como base64 dentro de JSON: base64 cresce
 * o corpo em um terço e obrigaria a aba a ler a imagem inteira na memória antes
 * de começar a enviar, o que numa foto de celular trava a tela por segundos.
 *
 * O tamanho não é conferido aqui. Quem tem o limite é o backend, que é quem
 * grava — repetir o número dos dois lados criaria dois limites para divergir.
 */
export async function trocarMinhaFoto(imagem: File): Promise<string> {

    const envio = new FormData()
    envio.append("foto", imagem, imagem.name)

    const dados = await apiFetch<{ foto?: string }>("/api/eu/foto", {
        method: "POST",
        body: envio,
    })

    return dados.foto ?? ""
}

/** Tira a foto de perfil e volta para a inicial do nome. */
export async function removerMinhaFoto(): Promise<void> {
    await apiFetch("/api/eu/foto", { method: "DELETE" })
}
