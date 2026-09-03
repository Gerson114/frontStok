import type { ReactNode } from "react"

/**
 * A moldura das telas de recado — erro, 404, e o que mais precisar parar o
 * lojista no meio do caminho para dizer uma coisa só.
 *
 * Existe porque as quatro telas de erro do painel são o mesmo desenho com
 * outro texto dentro: cartão centrado, um círculo com ícone, título, uma
 * linha de explicação e as saídas. Escrever esse desenho quatro vezes seria
 * criar quatro lugares onde o painel pode deixar de se parecer consigo
 * mesmo.
 *
 * O `md:ml-64` acompanha o menu lateral, que é largura fixa e continua na
 * tela: recado não é motivo para o lojista perder a navegação.
 */
export default function Aviso({
    icone,
    tom = "erro",
    titulo,
    children,
    acoes,
    rodape,
}: {
    icone: ReactNode
    /** Vermelho para o que quebrou; neutro para o que só não existe. */
    tom?: "erro" | "neutro"
    titulo: string
    children: ReactNode
    acoes?: ReactNode
    rodape?: ReactNode
}) {
    const cores =
        tom === "erro"
            ? "bg-[#FDECEA] text-[#D4351C]"
            : "bg-[#F0F3F4] text-[#5A6469]"

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#F0F3F4] p-6 md:ml-64">

            <div className="card w-full max-w-xl p-8 text-center md:p-10">

                <div
                    className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${cores}`}
                    aria-hidden
                >
                    {icone}
                </div>

                <h1 className="font-display mt-5 text-2xl text-[#1E2428]">
                    {titulo}
                </h1>

                <div className="mt-2 text-[#5A6469]">
                    {children}
                </div>

                {acoes && (
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        {acoes}
                    </div>
                )}

                {rodape && (
                    <div className="mt-6 border-t border-[#E4E9EB] pt-4">
                        {rodape}
                    </div>
                )}

            </div>

        </main>
    )
}
