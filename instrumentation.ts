// Gancho de subida do Next: roda uma vez, antes de o servidor atender a
// primeira requisição (ver node_modules/next/dist/docs → instrumentation).
//
// Serve para uma coisa só: conferir a configuração antes de o painel existir
// para alguém. É o par do que o backend Go já faz no main (ver
// lib/security/ambiente) — e a falta desse par no front era como
// NEXT_PUBLIC_WS_URL=ws://localhost:8080, correto na máquina de quem
// desenvolve, podia ir junto para produção sem nada reclamar.

import { conferir, ehProducao } from "@/security/ambiente"

export function register() {

    const problemas = conferir()

    if (problemas.length === 0) return

    const marca = ehProducao() ? "ERRO DE SEGURANÇA" : "AVISO DE SEGURANÇA"

    for (const problema of problemas) {
        console.error(`${marca}: ${problema.variavel}: ${problema.mensagem} (correção: ${problema.correcao})`)
    }

    if (ehProducao()) {
        // Derruba a subida de propósito. Um painel fora do ar é um problema
        // visível, que alguém conserta em minutos; um painel no ar mandando
        // conversa de cliente em texto puro é um problema invisível, que
        // ninguém conserta porque ninguém vê.
        throw new Error(
            `servidor não subiu: ${problemas.length} problema(s) de segurança na configuração (NODE_ENV=production)`
        )
    }

    console.warn(
        "Rodando em desenvolvimento: os avisos acima não impedem a subida, mas em produção impediriam."
    )
}
