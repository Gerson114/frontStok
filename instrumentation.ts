

import { conferir } from "@/security/ambiente"

export function register() {
    const problemas = conferir()

    if (problemas.length === 0) {
        return
    }

    for (const problema of problemas) {
        console.warn(
            `AVISO DE CONFIGURAÇÃO: ${problema.variavel}: ${problema.mensagem} (correção: ${problema.correcao})`
        )
    }

    // Intencionalmente não usamos throw new Error().
    // O servidor deve continuar iniciando mesmo quando
    // alguma variável de ambiente não estiver configurada.
}

