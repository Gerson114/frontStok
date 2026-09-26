import { apiFetch } from "./client"

/**
 * O lado do quadrado que sai daqui, em pixels.
 *
 * O mesmo número que o servidor usa (arquivo.LadoDaFoto). Os dois existem de
 * propósito: aqui para o arquivo ser pequeno ao atravessar a rede, lá para o
 * que chega ser sempre o que se espera, venha de onde vier. Se um dia
 * divergirem, quem manda é o servidor — ele reprocessa o que recebe.
 */
const LADO = 256

/**
 * Reduz a foto ANTES de enviar, no próprio navegador.
 *
 * É o que faz o envio funcionar em qualquer rede e por qualquer caminho. A
 * foto que sai de uma câmera de celular tem de 3 a 12 MB, e entre a aba e o
 * bucket ela atravessa o servidor do painel, o proxy e a API — cada um com um
 * teto próprio, nem todos sob nosso controle, e o primeiro que a recusar
 * devolve um "arquivo grande demais" que não diz qual deles foi. Reduzindo
 * aqui, o que trafega tem algumas dezenas de kilobytes e nenhum desses tetos
 * chega perto de ser tocado.
 *
 * Não é uma medida de SEGURANÇA, e não substitui nada do que o servidor faz:
 * quem envia controla o navegador e pode mandar o que quiser por fora desta
 * função. O servidor continua decodificando a imagem para provar que é uma, e
 * continua reescrevendo-a a partir dos pixels — é lá que o EXIF morre.
 *
 * `imageOrientation: "from-image"` não é detalhe: uma foto tirada com o
 * celular deitado traz a rotação no EXIF em vez de nos pixels, e sem isto o
 * rosto chegaria de lado. Como o EXIF é descartado depois, a rotação precisa
 * ser aplicada agora — ou some junto com ele.
 *
 * Qualquer falha devolve o arquivo original. É o desfecho seguro: um navegador
 * antigo, uma imagem que o canvas não aceita ou uma foto enorme demais para a
 * memória da aba voltam ao caminho de antes, em que o servidor faz todo o
 * trabalho — mais lento, e funcionando.
 */
async function reduzir(imagem: File): Promise<Blob> {

    try {
        const original = await createImageBitmap(imagem, { imageOrientation: "from-image" })

        // Recorte central antes de reduzir, igual ao servidor: espremer um
        // retrato num quadrado deforma o rosto, que é o que a pessoa quer
        // mostrar. Cortando o lado mais longo, o que sobra é o meio da foto.
        const lado = Math.min(original.width, original.height)

        if (lado <= 0) return imagem

        const tela = document.createElement("canvas")
        tela.width = LADO
        tela.height = LADO

        const pincel = tela.getContext("2d")

        if (!pincel) return imagem

        pincel.drawImage(
            original,
            (original.width - lado) / 2,
            (original.height - lado) / 2,
            lado,
            lado,
            0,
            0,
            LADO,
            LADO,
        )

        original.close()

        const reduzida = await new Promise<Blob | null>((resolver) =>
            tela.toBlob(resolver, "image/jpeg", 0.85),
        )

        return reduzida ?? imagem

    } catch {
        return imagem
    }
}

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
 * de começar a enviar.
 */
export async function trocarMinhaFoto(imagem: File): Promise<string> {

    const envio = new FormData()

    // Sempre ".jpg": o que sai de reduzir() é JPEG, e mandar o nome original
    // faria um ".png" chegar do outro lado rotulando um JPEG. O servidor não
    // confia no nome — ele decodifica —, mas um nome que mente é um rastro
    // falso no dia em que alguém for ler um log.
    envio.append("foto", await reduzir(imagem), "foto.jpg")

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
