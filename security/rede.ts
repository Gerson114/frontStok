// Reconhecer endereços que um servidor não deve ir buscar.
//
// Existe por causa do proxy de imagens (app/api/imagem): ele recebe uma URL
// escrita pelo lojista e vai buscá-la a partir do SERVIDOR, que enxerga coisas
// que o navegador dele nunca enxergaria — o banco na rede interna, o painel de
// administração do orquestrador, e sobretudo o serviço de metadados da nuvem
// em 169.254.169.254, que entrega credenciais da máquina a quem simplesmente
// pedir. É o que se chama de SSRF: usar o servidor como binóculo para dentro
// da própria infraestrutura.
//
// A lista é de negação e generosa de propósito. Faixa reservada nova que eu
// esqueça aqui vira buraco; faixa pública que eu bloqueie por engano vira, no
// máximo, uma imagem que não carrega.

/** Um octeto de IPv4 como número, ou -1 se não for um. */
function octeto(texto: string): number {
    if (!/^\d{1,3}$/.test(texto)) return -1

    const valor = Number(texto)

    return valor >= 0 && valor <= 255 ? valor : -1
}

/**
 * Se o IPv4 está numa faixa que não se busca: privada, loopback, link-local
 * (onde mora o metadados da nuvem), CGNAT, multicast ou reservada.
 */
function ipv4Privado(ip: string): boolean {

    const partes = ip.split(".")

    if (partes.length !== 4) return true

    const [a, b, c, d] = partes.map(octeto)

    if ([a, b, c, d].some((valor) => valor < 0)) return true

    if (a === 0) return true                                  // 0.0.0.0/8
    if (a === 10) return true                                 // privada
    if (a === 127) return true                                // loopback
    if (a === 100 && b >= 64 && b <= 127) return true         // CGNAT 100.64/10
    if (a === 169 && b === 254) return true                   // link-local (metadados)
    if (a === 172 && b >= 16 && b <= 31) return true          // privada
    if (a === 192 && b === 0 && c === 0) return true          // 192.0.0.0/24
    if (a === 192 && b === 0 && c === 2) return true          // TEST-NET-1
    if (a === 192 && b === 168) return true                   // privada
    if (a === 198 && (b === 18 || b === 19)) return true       // benchmark 198.18/15
    if (a === 198 && b === 51 && c === 100) return true       // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true        // TEST-NET-3
    if (a >= 224) return true                                 // multicast + reservada

    return false
}

/** O mesmo para IPv6, incluindo o IPv4 disfarçado dentro de um IPv6. */
function ipv6Privado(ip: string): boolean {

    const normal = ip.toLowerCase().split("%")[0]

    // "::ffff:192.168.0.1" e "::ffff:c0a8:1" são o IPv4 vestido de IPv6, e
    // valem exatamente o que o IPv4 dentro deles vale.
    const mapeado = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(normal)

    if (mapeado) return ipv4Privado(mapeado[1])

    if (normal === "::" || normal === "::1") return true      // indefinido, loopback

    const inicio = normal.split(":")[0]

    if (inicio === "") return true                            // "::algo": não roteável

    const grupo = parseInt(inicio, 16)

    if (Number.isNaN(grupo)) return true

    if ((grupo & 0xfe00) === 0xfc00) return true              // fc00::/7 local única
    if ((grupo & 0xffc0) === 0xfe80) return true              // fe80::/10 link-local
    if ((grupo & 0xff00) === 0xff00) return true              // ff00::/8 multicast

    return false
}

/**
 * Se este endereço fica dentro da nossa infraestrutura (ou é reservado).
 *
 * Falha fechado: o que não se reconhece como endereço público volta `true`.
 * Diante da dúvida, não buscar é a resposta barata; buscar é a cara.
 */
export function enderecoPrivado(ip: string): boolean {

    const limpo = ip.trim().replace(/^\[|\]$/g, "")

    if (!limpo) return true

    return limpo.includes(":") ? ipv6Privado(limpo) : ipv4Privado(limpo)
}
