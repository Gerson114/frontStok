"use client"

import { useEffect, useState } from "react"
import {
    TEMA_DE_FABRICA,
    consultarTema,
    contraste,
    enviarLogo,
    removerLogo,
    salvarTema,
    sobre,
    type TemaLoja,
} from "@/middleware/loja"
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiImage, FiRefreshCw, FiTrash2, FiUpload } from "react-icons/fi"

/**
 * As cores da vitrine, escolhidas pelo lojista.
 *
 * São quatro campos, e não uma paleta inteira, porque a vitrine deriva o
 * resto deles: o cinza do texto secundário, a cor das bordas e o fundo das
 * placas de foto são misturas do texto com o fundo escolhidos (ver :root em
 * vendas/frontp/app/globals.css). Quem troca o fundo para escuro recebe
 * borda clara sem pedir — é o que impede que dar a cor ao lojista produza
 * uma loja em que nada se enxerga.
 *
 * O contraste ruim é avisado, não impedido. A loja é dele; o que a tela
 * evita é ele descobrir pelo cliente que o preço sumiu no fundo.
 */

const CAMPOS: { chave: keyof Omit<TemaLoja, "logo_url">; rotulo: string; ajuda: string }[] = [
    { chave: "fundo", rotulo: "Fundo", ajuda: "A cor da página inteira." },
    { chave: "texto", rotulo: "Texto", ajuda: "Títulos, preços e descrições." },
    { chave: "destaque", rotulo: "Destaque", ajuda: "A faixa do topo e os botões." },
    { chave: "palco", rotulo: "Faixa", ajuda: "O fundo da área de banner." },
]

/** O contraste mínimo da WCAG para texto corrido. */
const CONTRASTE_TEXTO = 4.5

/** O mínimo para um elemento grande e sólido, como um botão, se destacar. */
const CONTRASTE_FORMA = 3

export default function Aparencia() {

    const [tema, setTema] = useState<TemaLoja>(TEMA_DE_FABRICA)
    const [carregando, setCarregando] = useState(true)
    const [salvando, setSalvando] = useState(false)
    const [enviando, setEnviando] = useState(false)
    const [erro, setErro] = useState("")
    const [salvo, setSalvo] = useState(false)

    useEffect(() => {
        let cancelado = false

        async function buscar() {
            try {
                const dados = await consultarTema()

                if (cancelado) return

                // Campo vazio no servidor quer dizer "de fábrica". A tela
                // mostra a cor de fábrica de verdade, e não um campo em
                // branco: ninguém escolhe cor a partir do nada.
                setTema({
                    fundo: dados.fundo || TEMA_DE_FABRICA.fundo,
                    texto: dados.texto || TEMA_DE_FABRICA.texto,
                    destaque: dados.destaque || TEMA_DE_FABRICA.destaque,
                    palco: dados.palco || TEMA_DE_FABRICA.palco,
                    logo_url: dados.logo_url,
                })

            } catch (e) {
                if (!cancelado) setErro(e instanceof Error ? e.message : "Erro ao consultar a aparência")
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        buscar()

        return () => {
            cancelado = true
        }
    }, [])

    /**
     * Manda a imagem e aponta a loja para ela.
     *
     * O endereço volta pronto do servidor e entra no estado como qualquer
     * outro campo — daí em diante a logo enviada e a colada são a mesma
     * coisa para o resto da tela, inclusive para a prévia.
     *
     * Não salva o tema junto: o envio já gravou a logo do lado de lá, e
     * disparar o PUT aqui gravaria por cima cores que o lojista talvez
     * estivesse no meio de escolher.
     */
    async function mandarLogo(imagem: File) {

        setEnviando(true)
        setErro("")

        try {
            const endereco = await enviarLogo(imagem)
            setTema((atual) => ({ ...atual, logo_url: endereco }))
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível enviar a imagem.")
        } finally {
            setEnviando(false)
        }
    }

    /** Tira a logo e devolve o nome escrito ao topo da vitrine. */
    async function tirarLogo() {

        setEnviando(true)
        setErro("")

        try {
            await removerLogo()
            setTema((atual) => ({ ...atual, logo_url: "" }))
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível tirar a logo.")
        } finally {
            setEnviando(false)
        }
    }

    function mudar(chave: keyof TemaLoja, valor: string) {
        setTema((atual) => ({ ...atual, [chave]: valor }))
        setSalvo(false)
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        setErro("")
        setSalvo(false)

        try {
            setSalvando(true)
            await salvarTema(tema)
            setSalvo(true)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível salvar as cores")
        } finally {
            setSalvando(false)
        }
    }

    // Os avisos são calculados a cada tecla, e não ao salvar: o lojista tem
    // de ver o problema enquanto ainda está escolhendo a cor.
    const avisos: string[] = []

    if (contraste(tema.texto, tema.fundo) < CONTRASTE_TEXTO) {
        avisos.push("O texto quase some no fundo escolhido — descrições e preços vão ficar difíceis de ler.")
    }

    if (contraste(tema.destaque, tema.fundo) < CONTRASTE_FORMA) {
        avisos.push("Os botões quase somem no fundo: quem entrar na loja pode não achar o “comprar”.")
    }

    if (contraste(tema.texto, tema.palco) < CONTRASTE_TEXTO) {
        avisos.push("O texto do banner quase some na faixa escolhida.")
    }

    if (carregando) {
        return (
            <section className="card mt-6 p-6 text-sm text-[var(--ink-2)]">
                Carregando a aparência da loja...
            </section>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="card mt-6 p-6 sm:p-7">

            <h2 className="font-display text-lg text-[var(--ink)]">
                Aparência
            </h2>

            <p className="mt-1 text-sm text-[var(--ink-2)]">
                As cores da sua vitrine. O resto da loja acompanha sozinho — as
                bordas e os cinzas nascem do fundo e do texto que você escolher.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {CAMPOS.map(({ chave, rotulo, ajuda }) => (
                    <div key={chave}>
                        <label htmlFor={`cor-${chave}`} className="rotulo">
                            {rotulo}
                        </label>

                        <div className="flex items-stretch gap-2">
                            <input
                                id={`cor-${chave}`}
                                type="color"
                                value={tema[chave]}
                                onChange={(e) => mudar(chave, e.target.value)}
                                className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-[var(--linha)] bg-[var(--superficie)] p-1"
                            />

                            {/* O campo de texto ao lado do seletor existe para
                                quem já tem a cor da marca anotada: quase todo
                                lojista com identidade visual sabe o código
                                dela, e caçá-la no disco de cores é pior. */}
                            <input
                                type="text"
                                value={tema[chave]}
                                maxLength={7}
                                spellCheck={false}
                                onChange={(e) => mudar(chave, e.target.value.trim().toLowerCase())}
                                className="field font-mono uppercase"
                            />
                        </div>

                        <p className="mt-1.5 text-xs text-[var(--ink-3)]">{ajuda}</p>
                    </div>
                ))}
            </div>

            {/* A LOGO

                Duas portas para o mesmo campo, e não uma escolha a fazer: quem
                tem a imagem no computador escolhe o arquivo; quem já a tem
                publicada cola o endereço. A segunda porta fica embaixo, em
                letra menor, porque é a minoria dos casos — e existia sozinha
                até agora, que é o que deixava sem logo justamente o lojista
                que não tem onde hospedar imagem. */}
            <div className="mt-6 border-t border-[var(--linha)] pt-5">

                <p className="font-display text-sm text-[var(--ink)]">Logo da loja</p>

                <p className="mt-0.5 text-xs text-[var(--ink-3)]">
                    Substitui o nome escrito no topo da vitrine. Sem logo, o nome continua.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-4">

                    {/* A prévia sobre o fundo escolhido, e não sobre o branco
                        do painel: logo de fundo transparente ou claro some na
                        vitrine escura, e é aqui que isso tem de aparecer. */}
                    <span
                        className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--linha)]"
                        style={{ background: tema.palco || TEMA_DE_FABRICA.palco }}
                    >
                        {tema.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- vem da nossa rota ou do bucket, não de um CDN de imagem
                            <img src={tema.logo_url} alt="Logo da loja" className="max-h-full max-w-full object-contain" />
                        ) : (
                            <FiImage className="w-6 text-[var(--ink-3)]" aria-hidden />
                        )}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">

                        <label className="btn btn-neutro cursor-pointer px-3 py-1.5 text-sm">
                            <FiUpload className="w-4" aria-hidden />
                            {enviando ? "Enviando..." : tema.logo_url ? "Trocar imagem" : "Escolher imagem"}

                            <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                disabled={enviando}
                                onChange={(evento) => {
                                    const escolhida = evento.target.files?.[0]

                                    // O valor do campo é limpo para a mesma
                                    // imagem poder ser escolhida de novo depois
                                    // de um erro — sem isso o onChange não
                                    // dispara na segunda vez.
                                    evento.target.value = ""

                                    if (escolhida) void mandarLogo(escolhida)
                                }}
                            />
                        </label>

                        {tema.logo_url && (
                            <button
                                type="button"
                                onClick={() => void tirarLogo()}
                                disabled={enviando}
                                className="rounded-lg px-3 py-1.5 text-sm font-bold text-[var(--vermelho)] transition-colors hover:bg-[var(--vermelho-fundo)] disabled:opacity-50"
                            >
                                <FiTrash2 className="w-4" aria-hidden />
                                Tirar
                            </button>
                        )}

                    </div>
                </div>

                <details className="mt-4">
                    <summary className="cursor-pointer text-xs text-[var(--ink-2)]">
                        Já tenho a imagem publicada na internet
                    </summary>

                    <label htmlFor="logo" className="rotulo mt-2 block">
                        Endereço da imagem
                    </label>

                    <input
                        id="logo"
                        type="url"
                        maxLength={500}
                        placeholder="https://..."
                        className="field"
                        value={tema.logo_url}
                        onChange={(e) => mudar("logo_url", e.target.value)}
                    />

                    <p className="mt-1.5 text-xs text-[var(--ink-3)]">
                        Vale um endereço que já esteja no ar. Enviar um arquivo acima
                        substitui o que estiver escrito aqui.
                    </p>
                </details>
            </div>

            <Previa tema={tema} />

            {avisos.length > 0 && (
                <div className="mt-5 rounded-lg bg-[var(--amarelo-fundo)] px-4 py-3 text-sm text-[var(--amarelo)]">
                    <p className="flex items-center gap-2 font-semibold">
                        <FiAlertTriangle className="w-4 shrink-0" aria-hidden />
                        Dá para salvar assim, mas repare:
                    </p>

                    <ul className="mt-1.5 list-disc space-y-1 pl-8">
                        {avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}
                    </ul>
                </div>
            )}

            {erro && (
                <div
                    role="alert"
                    className="mt-5 flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]"
                >
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {salvo && !erro && (
                <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-[var(--verde-fundo)] px-4 py-3 text-sm font-semibold text-[var(--verde)]">
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>Cores salvas. Recarregue a vitrine para vê-las no ar.</span>
                </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
                <button type="submit" disabled={salvando} className="btn btn-primario">
                    {salvando ? "Salvando..." : "Salvar cores"}
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setTema({ ...TEMA_DE_FABRICA, logo_url: tema.logo_url })
                        setSalvo(false)
                    }}
                    className="btn btn-neutro"
                >
                    <FiRefreshCw className="w-4" aria-hidden />
                    Voltar ao padrão
                </button>
            </div>

        </form>
    )
}

/**
 * A vitrine em miniatura, pintada com as cores escolhidas.
 *
 * Repete as mesmas misturas que a loja de verdade faz no CSS — daí o
 * `color-mix` aparecer aqui com as porcentagens do globals.css da vitrine.
 * Um preview que não usasse a mesma conta mentiria, que é pior do que não
 * ter preview nenhum.
 */
function Previa({ tema }: { tema: TemaLoja }) {

    const mistura = (parte: number) => `color-mix(in srgb, ${tema.texto} ${parte}%, ${tema.fundo})`

    return (
        <div className="mt-6">
            <p className="rotulo">Como vai ficar</p>

            <div
                className="mt-2 overflow-hidden rounded-lg border border-[var(--linha)]"
                style={{ background: tema.fundo, color: tema.texto }}
            >
                <div
                    className="flex items-center gap-2.5 px-4 py-3"
                    style={{ background: tema.destaque, color: sobre(tema.destaque) }}
                >
                    <span
                        className="flex h-6 w-6 items-center justify-center text-xs font-bold"
                        style={{ background: sobre(tema.destaque), color: tema.destaque }}
                    >
                        M
                    </span>

                    <span className="text-xs font-semibold">
                        Sua loja
                    </span>
                </div>

                <div className="px-4 py-5" style={{ background: tema.palco }}>
                    <p className="text-lg font-light leading-tight">Coleção nova</p>
                    <p className="mt-0.5 text-xs" style={{ color: mistura(67) }}>
                        Confira as unidades que acabaram de chegar
                    </p>
                </div>

                <div className="flex items-center gap-4 px-4 py-4">
                    <div className="h-14 w-14 shrink-0" style={{ background: mistura(4) }} />

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">Camisa listrada</p>
                        <p className="text-xs" style={{ color: mistura(67) }}>Tam. M · Algodão</p>
                        <p className="mt-1 text-sm font-bold">R$ 189,90</p>
                    </div>

                    <span
                        className="shrink-0 px-4 py-2 text-xs font-semibold"
                        style={{ background: tema.destaque, color: sobre(tema.destaque) }}
                    >
                        comprar
                    </span>
                </div>

                <div className="border-t px-4 py-2 text-[0.7rem]" style={{ borderColor: mistura(14), color: mistura(44) }}>
                    Rodapé da loja
                </div>
            </div>
        </div>
    )
}
