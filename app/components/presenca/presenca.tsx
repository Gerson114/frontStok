"use client"

import { useCallback, useEffect, useState } from "react"

import { consultarPresenca } from "@/middleware/equipe"
import { useAoVivo } from "@/middleware/aoVivo"

/**
 * Quem da loja está com o painel aberto agora.
 *
 * Devolve o conjunto de crachás online ("d3", "f12") — o mesmo campo que cada
 * `Membro` da equipe já traz. Quem desenha pergunta `online.has(membro.cracha)`
 * uma vez por linha.
 *
 * A lista chega por aviso, e não por relógio: o servidor publica um aviso de
 * presença quando alguém abre ou fecha o painel (ver whatsapp/presenca.go), e é
 * só aí que esta consulta acontece de novo. Uma tela com a equipe parada não
 * pergunta nada, e uma tela aberta numa loja movimentada pergunta na hora em
 * que o verde precisa mudar.
 *
 * A consulta em si é a mais leve do sistema: do lado de lá ela não toca no
 * banco — a resposta sai do socket que cada painel aberto mantém.
 */
export function usePresenca(): Set<string> {

    const [online, setOnline] = useState<Set<string>>(new Set())

    const buscar = useCallback(async () => {
        try {
            setOnline(await consultarPresenca())
        } catch {
            // A bolinha é enfeite informativo: uma falha aqui não pode
            // atrapalhar a tela que a hospeda. Fica com a lista anterior até o
            // próximo aviso, que é melhor do que apagar todo mundo por causa
            // de uma requisição que não voltou.
        }
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- o estado só muda dentro do then, não no corpo do efeito
        buscar()
    }, [buscar])

    useAoVivo(["presenca"], buscar)

    return online
}

/**
 * A bolinha verde.
 *
 * Fica presa ao canto de um avatar, e por isso quem a usa precisa ter
 * `relative` no elemento que a contém — o mesmo contrato de qualquer selo
 * sobreposto.
 *
 * Sai da árvore quando a pessoa está offline, em vez de virar uma bolinha
 * cinza: uma lista de trinta bolinhas cinza com duas verdes é mais difícil de
 * ler do que duas bolinhas verdes e mais nada. O cinza também sugeriria
 * "offline agora", quando a verdade é "não está com o painel aberto" — e essas
 * duas coisas não são iguais para quem trabalha no balcão com o celular na mão.
 */
export function Bolinha({
    online,
    titulo = "No painel agora",
}: {
    online: boolean
    titulo?: string
}) {

    if (!online) return null

    return (
        <span
            title={titulo}
            aria-label={titulo}
            role="img"
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--fundo)] bg-[var(--verde-forte)]"
        />
    )
}
