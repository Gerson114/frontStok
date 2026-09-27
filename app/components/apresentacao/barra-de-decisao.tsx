"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { FiArrowRight } from "react-icons/fi"

/**
 * A barra de decisão: preço e botão, colados na base da tela.
 *
 * Existe porque a página é longa. O visitante que desceu até as perguntas
 * está a cinco rolagens do botão de assinar, e a decisão dele não pode
 * depender de ele lembrar onde aquele botão ficou.
 *
 * O valor e a chamada vêm por propriedade, do servidor — a barra não sabe
 * preço nenhum, e assim ela nunca diz um número diferente do resto da página.
 *
 * Nasce escondida e aparece quando o herói sai da tela. É a única coisa desta
 * página que depende de JavaScript para existir, e pode depender: ela é um
 * ATALHO para o que a página já diz. A chamada de assinar aparece quatro
 * vezes no documento — no herói, nos dois planos e no convite final —, então
 * quem estiver sem JavaScript não perde nada, só não ganha o atalho. Nenhum
 * conteúdo mora aqui.
 *
 * O alvo observado é o próprio herói, passado por id: dentro dele a chamada
 * já está na tela em tamanho grande, e duas chamadas ao mesmo tempo é a
 * página gritando.
 */
export default function BarraDeDecisao({
    chamada,
    detalhe,
    alvo,
}: {
    chamada: string
    detalhe: string
    alvo: string
}) {
    const [mostrar, setMostrar] = useState(false)
    const observando = useRef(false)

    useEffect(() => {
        const heroi = document.getElementById(alvo)

        if (!heroi || observando.current) return

        observando.current = true

        // Esconde enquanto QUALQUER parte do herói estiver visível.
        const observador = new IntersectionObserver(
            ([entrada]) => setMostrar(!entrada.isIntersecting),
            { threshold: 0 },
        )

        observador.observe(heroi)

        return () => observador.disconnect()
    }, [alvo])

    return (
        <div
            className={`lp-barra ${mostrar ? "lp-barra-visivel" : ""}`}
            // A barra é um atalho para o que a página já diz. Para quem navega
            // por leitor de tela ela seria a terceira vez que a mesma chamada
            // aparece, e é por isso que ela fica fora da ordem de leitura.
            aria-hidden
        >
            <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">

                <p className="hidden min-w-0 flex-1 truncate text-sm text-[#616161] sm:block">
                    {detalhe}
                </p>

                <div className="flex flex-1 items-center gap-2 sm:flex-none">
                    <Link
                        href="/login"
                        tabIndex={-1}
                        className="btn btn-neutro hidden px-4 py-2.5 text-sm sm:inline-flex"
                    >
                        Entrar
                    </Link>

                    <Link
                        href="/cadastro"
                        tabIndex={-1}
                        className="btn btn-primario w-full px-5 py-2.5 text-sm sm:w-auto"
                    >
                        {chamada}
                        <FiArrowRight className="lp-seta w-4" aria-hidden />
                    </Link>
                </div>

            </div>
        </div>
    )
}
