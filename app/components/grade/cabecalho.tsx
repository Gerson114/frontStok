"use client"

import type { ReactNode } from "react"
import { FiChevronDown, FiChevronUp } from "react-icons/fi"

/**
 * O cabeçalho de uma coluna que ordena uma grade.
 *
 * Vive aqui, e não em cada tela, porque as grades do painel são a mesma
 * coisa vista de ângulos diferentes — a de Produtos e a de Estoque ordenam
 * igual, e duas cópias do mesmo botão viram duas setas que um dia apontam
 * para lados diferentes.
 *
 * A seta aparece só na coluna que está ordenando: seta em toda coluna é
 * ruído, e no meio do ruído ninguém acha a que está valendo.
 */
export default function Cabecalho({
    ativa,
    desc,
    aoClicar,
    direita = false,
    children,
}: {
    ativa: boolean
    desc: boolean
    aoClicar: () => void
    /** Colunas de número são alinhadas à direita, e o título as acompanha. */
    direita?: boolean
    children: ReactNode
}) {
    return (
        <button
            type="button"
            onClick={aoClicar}
            className={`flex w-full items-center gap-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] transition-colors ${
                direita ? "justify-end" : ""
            } ${ativa ? "text-[#00369B]" : "text-[#616161] hover:text-[#303030]"}`}
        >
            {children}

            {ativa && (
                desc
                    ? <FiChevronDown className="w-3.5" aria-hidden />
                    : <FiChevronUp className="w-3.5" aria-hidden />
            )}
        </button>
    )
}
