// A bolinha da barra superior: o que chegou e ninguém viu.
//
// Uma chamada só, com três números, porque ela é feita a cada aviso do canal
// ao vivo em toda aba aberta. Somar isso a partir das listas de pedidos e
// conversas custaria três respostas grandes para desenhar três números.

import { apiFetch } from "./client"
import type { Notificacoes } from "@/app/type/type"

const VAZIO: Notificacoes = { pedidos: 0, whatsapp: 0, site: 0, equipe: 0, total: 0 }

/**
 * Falha em silêncio, devolvendo zeros.
 *
 * O ícone sem bolinha é aceitável; uma barra superior que não desenha porque
 * a contagem não veio, não é. Quem não tem a tela recebe zero naquele número
 * — quem decide isso é o servidor.
 */
export async function consultarNotificacoes(): Promise<Notificacoes> {
    try {
        const dados = await apiFetch<Notificacoes>("/api/notificacoes")

        return {
            pedidos: dados.pedidos ?? 0,
            whatsapp: dados.whatsapp ?? 0,
            site: dados.site ?? 0,
            equipe: dados.equipe ?? 0,
            total: dados.total ?? 0,
        }
    } catch {
        return VAZIO
    }
}
