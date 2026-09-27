// Gancho de subida do Next: roda uma vez, antes de o servidor atender a
// primeira requisição.
//
// Serve para uma coisa só: conferir a configuração antes de o painel existir
// para alguém. É o par do que o backend Go faz no main (ver
// lib/security/ambiente) e do que a vitrine faz no gancho dela.
//
// Em produção derruba a subida, e isso é deliberado — antes daqui os
// problemas viravam só um console.warn que ninguém lê num log de container.
// O caso que decidiu a mudança é o TRUSTED_PROXY_COUNT: sem ele o limite por
// IP não distingue visitante de proxy, e o painel fica de pé devolvendo
// "muitas tentativas" a lojista que não errou nada. Um painel fora do ar é um
// problema visível, que alguém conserta em minutos; um painel no ar com o
// limite medindo a coisa errada é um problema invisível.
//
// O que produção precisa ter definido: API_URL, NEXT_PUBLIC_WS_URL e
// TRUSTED_PROXY_COUNT (ver deploy/docker-compose.prod.yml, que já os define).

import { conferir, ehProducao } from "@/security/ambiente"

export function register() {

    const problemas = conferir()

    if (problemas.length === 0) return

    const marca = ehProducao() ? "ERRO DE SEGURANÇA" : "AVISO DE SEGURANÇA"

    for (const problema of problemas) {
        console.error(`${marca}: ${problema.variavel}: ${problema.mensagem} (correção: ${problema.correcao})`)
    }

    if (ehProducao()) {

        // Encerrar o processo, e não só lançar: o Next CAPTURA o que este
        // gancho lança, escreve "An error occurred while loading instrumentation
        // hook" e continua escutando a porta, respondendo 500 a tudo. Um
        // container assim passa por healthcheck de TCP e fica de pé
        // indefinidamente servindo erro.
        const mensagem =
            `servidor não subiu: ${problemas.length} problema(s) de configuração (NODE_ENV=production)`

        console.error(mensagem)

        // Este arquivo é empacotado para os DOIS runtimes, porque existe um
        // proxy (ver proxy.ts) e ele roda no Edge, onde não há `process.exit`.
        // A leitura por Reflect.get evita que o empacotador encontre a API do
        // Node na análise estática do bundle do Edge.
        if (process.env.NEXT_RUNTIME === "nodejs") {

            const encerrar = Reflect.get(process, "exit") as ((codigo: number) => never) | undefined

            encerrar?.(1)
        }

        throw new Error(mensagem)
    }

    console.warn(
        "Rodando em desenvolvimento: os avisos acima não impedem a subida, mas em produção impediriam."
    )
}
