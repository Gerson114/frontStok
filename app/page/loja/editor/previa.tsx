"use client"

import type { Bloco } from "@/app/type/type"
import type { TemaLoja } from "@/middleware/loja"

/**
 * A prévia da home, dentro do editor.
 *
 * Desenha os mesmos blocos que a vitrine desenha, com as cores que o lojista
 * escolheu no tema — para ele ver o que está montando enquanto monta, em vez
 * de salvar, abrir a loja noutra aba e voltar.
 *
 * É uma REPRESENTAÇÃO, e a tela diz isso com todas as letras. Os produtos
 * aparecem como retângulos, e não como o catálogo de verdade: buscar o
 * catálogo aqui tornaria o editor lento a cada tecla, e o que se decide nesta
 * tela é arranjo — onde fica cada seção, em que ordem, com que texto —, não o
 * preço da terceira camiseta.
 *
 * Por que não um iframe com a loja de verdade: a vitrine responde
 * `frame-ancestors 'none'`, que é o que impede qualquer site de embutir a
 * loja de alguém numa moldura e enganar o comprador. Abrir essa porta para
 * mostrar uma prévia seria trocar uma proteção real por uma comodidade — e o
 * botão "Ver a loja", que abre em aba nova, resolve o caso de conferir o
 * resultado final sem abrir porta nenhuma.
 */

const CINZA = "rgba(0,0,0,0.06)"

export default function Previa({
    blocos,
    tema,
    escolhido,
    aoEscolher,
}: {
    blocos: Bloco[]
    tema: TemaLoja
    escolhido: string | null
    aoEscolher: (id: string) => void
}) {

    // As cores do lojista entram como variáveis, do mesmo jeito que a vitrine
    // as recebe — assim a prévia muda junto quando ele troca o tema.
    const estilo = {
        "--fundo": tema.fundo,
        "--ink": tema.texto,
        "--destaque": tema.destaque,
        "--palco": tema.palco,
    } as React.CSSProperties

    return (
        <div
            style={estilo}
            className="min-h-[30rem] overflow-hidden bg-[var(--fundo)] text-[var(--ink)]"
        >
            {/* O cabeçalho não é editável: ele é a marca, a busca e a sacola,
                e vem em toda página da loja. Está aqui só para a prévia
                parecer a loja. */}
            <div className="flex items-center justify-between gap-4 border-b px-5 py-3" style={{ borderColor: CINZA }}>
                <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">
                    Sua loja
                </span>

                <span className="h-6 w-40 rounded" style={{ background: CINZA }} />
            </div>

            {blocos.length === 0 ? (
                <p className="px-6 py-16 text-center text-sm opacity-60">
                    A página está vazia. Escolha um bloco à esquerda.
                </p>
            ) : (
                blocos.map((bloco) => (
                    <Selecionavel
                        key={bloco.id}
                        bloco={bloco}
                        escolhido={escolhido}
                        aoEscolher={aoEscolher}
                    />
                ))
            )}

            <div className="border-t px-5 py-6 text-center text-[0.7rem] opacity-50" style={{ borderColor: CINZA }}>
                Rodapé da loja
            </div>
        </div>
    )
}

/** Um bloco na prévia, clicável para abrir os ajustes dele. */
function Selecionavel({
    bloco,
    escolhido,
    aoEscolher,
}: {
    bloco: Bloco
    escolhido: string | null
    aoEscolher: (id: string) => void
}) {
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
                // Um clique dentro de uma seção escolhe o bloco de dentro, e
                // não a seção inteira: sem isto, o filho seria inalcançável.
                e.stopPropagation()
                aoEscolher(bloco.id)
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    aoEscolher(bloco.id)
                }
            }}
            className={`relative cursor-pointer outline-offset-[-2px] transition-shadow ${
                escolhido === bloco.id ? "outline outline-2 outline-[#005BD3]" : "hover:outline hover:outline-1 hover:outline-[#B5B5B5]"
            }`}
        >
            <Desenho bloco={bloco} escolhido={escolhido} aoEscolher={aoEscolher} />
        </div>
    )
}

function Desenho({
    bloco,
    escolhido,
    aoEscolher,
}: {
    bloco: Bloco
    escolhido: string | null
    aoEscolher: (id: string) => void
}) {

    switch (bloco.tipo) {

        case "secao": {

            const colunas = bloco.colunas ?? [[]]

            const fundo =
                bloco.fundo === "destaque"
                    ? { background: "var(--destaque)", color: "var(--fundo)" }
                    : bloco.fundo === "claro"
                        ? { background: "var(--palco)" }
                        : undefined

            return (
                <div style={fundo} className="px-5 py-6">
                    {bloco.titulo ? (
                        <p className="mb-4 text-[0.95rem] font-bold">{bloco.titulo}</p>
                    ) : null}

                    <div
                        className="grid gap-4"
                        style={{ gridTemplateColumns: `repeat(${Math.max(1, colunas.length)}, minmax(0, 1fr))` }}
                    >
                        {colunas.map((coluna, indice) => (
                            <div
                                key={indice}
                                className="min-h-[4rem] space-y-3 rounded border border-dashed p-2"
                                style={{ borderColor: CINZA }}
                            >
                                {coluna.length === 0 ? (
                                    <p className="py-4 text-center text-[0.7rem] opacity-40">
                                        coluna vazia
                                    </p>
                                ) : (
                                    coluna.map((filho) => (
                                        <Selecionavel
                                            key={filho.id}
                                            bloco={filho}
                                            escolhido={escolhido}
                                            aoEscolher={aoEscolher}
                                        />
                                    ))
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )
        }

        case "banner":
            return (
                <div
                    className="flex h-32 items-center justify-center text-xs font-semibold uppercase tracking-[0.12em] opacity-50"
                    style={{ background: CINZA }}
                >
                    Carrossel de banners
                </div>
            )

        // A faixa de selos. Desenhada com os textos de verdade, e não com
        // barras cinzas: o lojista está justamente escrevendo essas palavras, e
        // uma prévia que as esconde não serve para conferir o que ele escreveu.
        case "cartoes": {

            const cartoes = bloco.cartoes ?? []

            if (cartoes.length === 0) {
                return (
                    <div
                        className="flex h-16 items-center justify-center text-xs font-semibold uppercase tracking-[0.12em] opacity-50"
                        style={{ background: CINZA }}
                    >
                        Faixa de cartões (vazia)
                    </div>
                )
            }

            return (
                <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
                    {cartoes.map((cartao, i) => (
                        <span key={i} className="flex items-start gap-2">
                            <span
                                className="h-7 w-7 shrink-0 rounded-full"
                                style={{ background: "var(--destaque)" }}
                            />
                            <span className="min-w-0">
                                <span className="block truncate text-[0.7rem] font-bold">
                                    {cartao.titulo || "sem título"}
                                </span>
                                {cartao.texto ? (
                                    <span className="mt-0.5 block text-[0.6rem] leading-snug opacity-70">
                                        {cartao.texto}
                                    </span>
                                ) : null}
                            </span>
                        </span>
                    ))}
                </div>
            )
        }

        case "atalhos":
            return (
                <div className="flex gap-4 overflow-hidden px-5 py-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className="flex flex-col items-center gap-1.5">
                            <span className="h-12 w-12 rounded-full" style={{ background: CINZA }} />
                            <span className="h-2 w-10 rounded" style={{ background: CINZA }} />
                        </span>
                    ))}
                </div>
            )

        case "prateleira":
            return (
                <div className="px-5 py-5">
                    <p className="mb-3 text-[0.95rem] font-bold">{bloco.titulo || "Destaques"}</p>

                    <div className="flex gap-3 overflow-hidden">
                        {Array.from({ length: Math.min(bloco.quantidade ?? 8, 5) }).map((_, i) => (
                            <span key={i} className="w-28 shrink-0">
                                <span className="block aspect-[4/5] rounded" style={{ background: CINZA }} />
                                <span className="mt-1.5 block h-2 w-3/4 rounded" style={{ background: CINZA }} />
                            </span>
                        ))}
                    </div>
                </div>
            )

        case "grade":
            return (
                <div className="px-5 py-5">
                    <p className="mb-3 text-[0.95rem] font-bold">Todos os produtos</p>

                    <div className="grid grid-cols-4 gap-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <span key={i}>
                                <span className="block aspect-[4/5] rounded" style={{ background: CINZA }} />
                                <span className="mt-1.5 block h-2 w-3/4 rounded" style={{ background: CINZA }} />
                            </span>
                        ))}
                    </div>
                </div>
            )

        case "texto":
            return (
                <div className={`px-5 py-6 ${bloco.alinhamento === "centro" ? "text-center" : ""}`}>
                    {bloco.titulo ? <p className="text-[1rem] font-bold">{bloco.titulo}</p> : null}

                    {bloco.texto ? (
                        <p className="mt-2 whitespace-pre-line text-[0.82rem] leading-relaxed opacity-75">
                            {bloco.texto}
                        </p>
                    ) : (
                        <p className="mt-2 text-[0.78rem] italic opacity-40">(sem texto)</p>
                    )}
                </div>
            )

        case "faixa": {

            const destaque = bloco.tom !== "claro"

            return (
                <div
                    className="px-5 py-8 text-center"
                    style={
                        destaque
                            ? { background: "var(--destaque)", color: "var(--fundo)" }
                            : { background: "var(--palco)" }
                    }
                >
                    <p className="text-[1rem] font-bold">{bloco.titulo || "(sem chamada)"}</p>

                    {bloco.texto ? (
                        <p className="mx-auto mt-1.5 max-w-md text-[0.8rem] opacity-90">{bloco.texto}</p>
                    ) : null}

                    {bloco.botao_texto ? (
                        <span
                            className="mt-3 inline-block px-5 py-2 text-[0.78rem] font-semibold"
                            style={
                                destaque
                                    ? { background: "var(--fundo)", color: "var(--destaque)" }
                                    : { background: "var(--destaque)", color: "var(--fundo)" }
                            }
                        >
                            {bloco.botao_texto}
                        </span>
                    ) : null}
                </div>
            )
        }

        case "imagem":
            return (
                <div className="px-5 py-4">
                    {bloco.imagem_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={bloco.imagem_url} alt="" className="max-h-56 w-full rounded object-cover" />
                    ) : (
                        <div
                            className="flex h-32 items-center justify-center rounded text-xs opacity-50"
                            style={{ background: CINZA }}
                        >
                            imagem sem endereço
                        </div>
                    )}
                </div>
            )

        case "espaco":
            return (
                <div
                    className={`${
                        bloco.altura === "grande" ? "h-16" : bloco.altura === "pequeno" ? "h-4" : "h-10"
                    } flex items-center justify-center text-[0.65rem] uppercase tracking-[0.1em] opacity-30`}
                >
                    espaço
                </div>
            )

        default:
            return null
    }
}
