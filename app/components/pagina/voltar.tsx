"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"

/**
 * Voltar de verdade: para a tela ANTERIOR, e não para uma tela fixa.
 *
 * A queixa que fez isto existir: entrar na conversa da equipe vindo de
 * Pedidos e, ao tocar na seta de voltar, cair em Início — uma tela que a
 * pessoa não estava vendo. A seta dizia "voltar" e fazia "ir para outro
 * lugar". Quem chegou por Pedidos espera Pedidos.
 *
 * O cuidado que a coisa exige é o outro caso: quem abriu o endereço direto
 * (link colado, favorito, aba nova) não tem para onde voltar — `history.back()`
 * ali tira a pessoa do sistema, ou não faz nada, dependendo do navegador. Por
 * isso existe o destino de reserva, que é o pai daquela tela.
 *
 * Como se sabe se há para onde voltar DENTRO do sistema:
 *
 *   1. Houve navegação nesta aba depois que a página carregou — é o contador
 *      abaixo, alimentado pelo próprio roteador (ver `registrarPassada`).
 *   2. Ou a pessoa chegou aqui por um link nosso: o `referrer` é da mesma
 *      origem. Cobre a chegada por recarga de página inteira, em que o
 *      contador nasce zerado.
 *
 * Nenhum dos dois consulta `history.length`: ele conta o histórico da ABA
 * inteira, inclusive o que veio de outros sites, e por isso responde "sim"
 * para quem acabou de chegar de fora.
 */

/* O contador vive no módulo, e não em sessionStorage, de propósito: a
   pergunta é sobre ESTA carga da página ("já naveguei desde que cheguei?").
   Guardado na sessão, ele sobreviveria à recarga e responderia "sim" para
   quem apertou F5 numa tela que abriu direto. */
let passadas = 0

/** Chamado a cada troca de rota. Ver `ContadorDeRotas`, abaixo. */
export function registrarPassada(): void {
    passadas += 1
}

/** Há uma tela nossa atrás desta? */
export function temParaOndeVoltar(): boolean {

    if (typeof window === "undefined") return false

    if (passadas > 0) return true

    const veioDe = document.referrer

    if (!veioDe) return false

    try {
        return new URL(veioDe).origin === window.location.origin
    } catch {
        return false
    }
}

/**
 * O gesto de voltar, pronto para um onClick.
 *
 * A pergunta "há para onde voltar?" é feita no clique, e não na renderização:
 * no servidor não existem `document.referrer` nem contador, e decidir cedo
 * faria o botão nascer com um comportamento e trocar depois da hidratação.
 * No clique já é browser, e a resposta é a verdadeira.
 *
 * Sem histórico nosso, `replace` em vez de `push`: a tela de reserva toma o
 * lugar desta no histórico, para o voltar do navegador não trazer de volta
 * justamente a tela de onde a pessoa acabou de sair.
 */
export function useVoltar(destinoDeReserva: string) {

    const router = useRouter()

    return useCallback(() => {

        if (temParaOndeVoltar()) {
            router.back()
            return
        }

        router.replace(destinoDeReserva)

    }, [router, destinoDeReserva])
}
