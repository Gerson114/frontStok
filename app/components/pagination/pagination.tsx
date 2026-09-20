import { FiChevronLeft, FiChevronRight } from "react-icons/fi"

interface PaginationProps {
    paginaAtual: number
    totalPaginas: number
    aoMudarPagina: (pagina: number) => void
}

function numerosVisiveis(paginaAtual: number, totalPaginas: number): (number | "...")[] {

    if (totalPaginas <= 7) {
        return Array.from({ length: totalPaginas }, (_, i) => i + 1)
    }

    const paginas = new Set<number>([1, totalPaginas, paginaAtual, paginaAtual - 1, paginaAtual + 1])

    const ordenadas = Array.from(paginas)
        .filter((pagina) => pagina >= 1 && pagina <= totalPaginas)
        .sort((a, b) => a - b)

    const resultado: (number | "...")[] = []

    for (let i = 0; i < ordenadas.length; i++) {
        if (i > 0 && ordenadas[i] - ordenadas[i - 1] > 1) {
            resultado.push("...")
        }
        resultado.push(ordenadas[i])
    }

    return resultado
}

export default function Pagination({ paginaAtual, totalPaginas, aoMudarPagina }: PaginationProps) {

    if (totalPaginas <= 1) return null

    return (

        <nav
            aria-label="Paginação"
            className="mt-8 flex items-center justify-center gap-1.5"
        >

            <button
                type="button"
                onClick={() => aoMudarPagina(paginaAtual - 1)}
                disabled={paginaAtual === 1}
                aria-label="Página anterior"
                className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--linha)] bg-[var(--superficie)] px-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--fundo)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--superficie)]"
            >
                <FiChevronLeft className="w-4" aria-hidden />
            </button>

            {numerosVisiveis(paginaAtual, totalPaginas).map((item, indice) =>
                item === "..." ? (

                    <span
                        key={`reticencias-${indice}`}
                        className="flex h-9 min-w-9 items-center justify-center text-sm text-[var(--ink-3)]"
                    >
                        …
                    </span>

                ) : (

                    <button
                        key={item}
                        type="button"
                        onClick={() => aoMudarPagina(item)}
                        aria-current={item === paginaAtual ? "page" : undefined}
                        className={`num flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-bold transition-colors ${
                            item === paginaAtual
                                ? "bg-[var(--azul)] text-white"
                                : "border border-[var(--linha)] bg-[var(--superficie)] text-[var(--ink)] hover:bg-[var(--fundo)]"
                        }`}
                    >
                        {item}
                    </button>

                )
            )}

            <button
                type="button"
                onClick={() => aoMudarPagina(paginaAtual + 1)}
                disabled={paginaAtual === totalPaginas}
                aria-label="Próxima página"
                className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--linha)] bg-[var(--superficie)] px-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--fundo)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--superficie)]"
            >
                <FiChevronRight className="w-4" aria-hidden />
            </button>

        </nav>

    )
}
