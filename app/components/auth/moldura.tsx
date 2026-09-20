import type { ReactNode } from "react"
import type { IconType } from "react-icons"
import Topo from "../header/topo"

// Larguras das barras do código de barras decorativo — as mesmas da landing
// (app/page.tsx) e da etiqueta impressa em /page/produto/etiqueta. Índice par
// é barra, ímpar é espaço.
const BARRAS = [
    3, 2, 1, 2, 4, 1, 2, 3, 1, 1, 2, 2, 3, 1, 1, 4, 2, 1, 3, 2, 1, 1, 4, 2,
    2, 3, 1, 2, 1, 1, 3, 2, 4, 1, 2, 2, 1, 3, 2, 1, 1, 2, 3, 4, 1, 2, 2, 1,
]

export interface ItemMoldura {
    texto: string
    Icone: IconType
}

interface Props {
    /** Texto da etiqueta azul acima da chamada. */
    etiqueta: string
    /** Manchete da coluna da esquerda — o argumento da tela. */
    chamada: string
    /** Três frases curtas sobre o que o painel entrega. */
    itens: ItemMoldura[]
    /** Linha fina no pé da coluna da esquerda (planos, cobrança). */
    nota: string
    children: ReactNode
}

/**
 * Moldura das telas de conta (login e cadastro).
 *
 * Mesma anatomia do hero da landing: o topo público no alto e, dentro da
 * caixa de `max-w-6xl`, o argumento à esquerda e um card branco à direita —
 * lá é a etiqueta da peça, aqui é o formulário. As duas telas respeitam a
 * mesma largura e o mesmo respiro da página inicial.
 */
export default function MolduraAuth({ etiqueta, chamada, itens, nota, children }: Props) {
    return (
        <div className="flex min-h-screen flex-col bg-white">

            <Topo />

            <section className="flex flex-1 items-center border-b border-[var(--linha-suave)] bg-[var(--fundo)]">
                <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">

                    {/* ======================================================
                        ARGUMENTO — some no celular, onde o formulário é o
                        que importa e a landing fica a um toque no topo.
                        ====================================================== */}
                    <div className="hidden lg:block">

                        <span className="tag tag-info">{etiqueta}</span>

                        <p className="font-display mt-4 text-3xl leading-tight text-[var(--ink)]">
                            {chamada}
                        </p>

                        <ul className="mt-8 space-y-4">
                            {itens.map(({ texto, Icone }) => (
                                <li key={texto} className="flex items-start gap-3">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--azul-suave)]">
                                        <Icone className="w-[1.05rem] text-[var(--azul-escuro)]" aria-hidden />
                                    </span>
                                    <span className="pt-1.5 text-[0.95rem] leading-relaxed text-[var(--ink-2)]">
                                        {texto}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <p className="mt-8 max-w-md text-sm leading-relaxed text-[var(--ink-3)]">
                            {nota}
                        </p>

                        {/* Código de barras: o mesmo desenho da etiqueta que o
                            lojista imprime, aqui como assinatura visual. */}
                        <div className="mt-8 flex h-9 items-stretch opacity-20" aria-hidden>
                            {BARRAS.map((largura, i) => (
                                <span
                                    key={i}
                                    style={{ width: `${largura * 3}px` }}
                                    className={i % 2 === 0 ? "bg-[var(--ink)]" : "bg-transparent"}
                                />
                            ))}
                        </div>

                    </div>

                    {/* ======================================================
                        FORMULÁRIO
                        ====================================================== */}
                    <div className="card mx-auto w-full max-w-md p-7 sm:p-8 lg:max-w-none">
                        {children}
                    </div>

                </div>
            </section>

        </div>
    )
}
