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
 * A classe `com-menu` acompanha o menu lateral, cuja largura é uma variável
 * de CSS (ver --menu em globals.css) e continua na
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
            ? "bg-[#FEE9E8] text-[#8E1F0B]"
            : "bg-[#F1F1F1] text-[#616161]"

    return (
        <main className="com-menu flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[#F1F1F1] p-6">

            <div className="card w-full max-w-xl p-8 text-center md:p-10">

                <div
                    className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${cores}`}
                    aria-hidden
                >
                    {icone}
                </div>

                <h1 className="font-display mt-5 text-2xl text-[#303030]">
                    {titulo}
                </h1>

                <div className="mt-2 text-[#616161]">
                    {children}
                </div>

                {acoes && (
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        {acoes}
                    </div>
                )}

                {rodape && (
                    <div className="mt-6 border-t border-[#EBEBEB] pt-4">
                        {rodape}
                    </div>
                )}

            </div>

        </main>
    )
}
