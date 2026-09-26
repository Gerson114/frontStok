"use client"

import { useEffect } from "react"

/**
 * Segura a rolagem da página enquanto uma coluna do celular está aberta.
 *
 * A coluna é presa à tela; a página atrás dela não é. Sem isto, o dedo que
 * percorre a lista de telas continua o movimento no fim dela e passa a rolar
 * o conteúdo de trás — a pessoa fecha o menu e encontra a tela num lugar em
 * que não estava. É o "scroll chaining", e todo aplicativo com gaveta o
 * desliga.
 *
 * A trava é uma classe no `<html>`, e não `style.overflow` escrito aqui, por
 * causa da largura: a coluna só existe abaixo de 768px (ela é `md:hidden`),
 * e o CSS é quem sabe disso sem precisar medir a janela em JavaScript. No
 * desktop a classe entra e não faz nada.
 */
const CLASSE = "coluna-aberta"

export function useTravarRolagem(aberta: boolean): void {

    useEffect(() => {

        if (!aberta) return

        document.documentElement.classList.add(CLASSE)

        return () => {
            document.documentElement.classList.remove(CLASSE)
        }

    }, [aberta])
}
