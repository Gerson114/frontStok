// Quanto a loja cobra para entregar, e para onde. Passa pela rota interna
// /api/frete, como o resto do painel.

import { apiFetch } from "./client"
import type { ConfigFrete, RegraFrete } from "@/app/type/type"

interface RespostaFrete {
    config: ConfigFrete
    regras: RegraFrete[]
}

export async function consultarFrete(): Promise<RespostaFrete> {
    const dados = await apiFetch<RespostaFrete>("/api/frete")

    return {
        config: dados.config,
        regras: dados.regras ?? [],
    }
}

export async function salvarFrete(config: ConfigFrete, regras: RegraFrete[]): Promise<void> {
    await apiFetch("/api/frete", {
        method: "PUT",
        body: { ...config, regras },
    })
}

/** Os 27 estados, na mesma ordem em que o servidor os valida. */
export const UFS = [
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS",
    "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC",
    "SE", "SP", "TO",
] as const

/** A UF especial da linha que vale para todo estado sem linha própria. */
export const UF_CURINGA = "*"
