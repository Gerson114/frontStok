// Gancho de subida do Next: roda uma vez, antes de o servidor atender a
// primeira requisição.
//
// Serve para uma coisa só: conferir a configuração e RECLAMAR alto quando ela
// está insegura. É o par do que o backend Go faz no main (ver
// lib/security/ambiente) e do que a vitrine faz no gancho dela.
//
// NÃO derruba a subida, e isto é decisão tomada com o painel no chão: a versão
// que encerrava o processo em produção (process.exit(1)) foi ao ar sem
// TRUSTED_PROXY_COUNT declarado no Dokploy e o container morreu no boot — o
// domínio do painel respondeu 502 até a reversão. A vitrine pode se permitir
// falhar fechado porque o compose dela declara as variáveis; o painel é
// publicado por outro caminho, cujo ambiente este repositório não controla.
//
// O que produção deve ter definido, e o log grita quando não tem: API_URL,
// NEXT_PUBLIC_WS_URL e TRUSTED_PROXY_COUNT. Sem o último, o limite por IP não
// distingue visitante de proxy e conta a loja inteira como um cliente só (ver
// obterIp em proxy.ts) — é degradação, não brecha: o pior caso é 429 cedo
// demais, e não limite nenhum.

import { conferir, ehProducao } from "@/security/ambiente"

export function register() {

    const problemas = conferir()

    if (problemas.length === 0) return

    const marca = ehProducao() ? "ERRO DE CONFIGURAÇÃO EM PRODUÇÃO" : "AVISO DE CONFIGURAÇÃO"

    for (const problema of problemas) {
        console.error(`${marca}: ${problema.variavel}: ${problema.mensagem} (correção: ${problema.correcao})`)
    }

    if (ehProducao()) {
        console.error(
            `${problemas.length} problema(s) de configuração em produção: o painel SOBE assim mesmo, ` +
            "mas corrija as variáveis acima no ambiente do deploy."
        )
    }
}
