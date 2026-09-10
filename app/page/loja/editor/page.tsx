"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
    FiAlertCircle,
    FiArrowDown,
    FiArrowUp,
    FiCheckCircle,
    FiColumns,
    FiExternalLink,
    FiEye,
    FiGrid,
    FiImage,
    FiLayout,
    FiMove,
    FiPlus,
    FiRotateCcw,
    FiTrash2,
    FiType,
} from "react-icons/fi"
import type { IconType } from "react-icons"
import { Pagina } from "@/app/components/pagina/pagina"
import {
    consultarPaginaDaLoja,
    salvarPaginaDaLoja,
    urlDaVitrine,
    consultarLoja,
    consultarTema,
    TEMA_DE_FABRICA,
    type TemaLoja,
} from "@/middleware/loja"
import type { Bloco } from "@/app/type/type"
import Previa from "./previa"
import {
    achatar,
    cabeEmColuna,
    contar,
    editarNaArvore,
    inserirNaArvore,
    moverNaArvore,
    removerDaArvore,
    type Caminho,
} from "./arvore"

/**
 * O editor da home da vitrine.
 *
 * Arrasta-e-solta para ordenar, painel à direita para configurar. O que ele
 * NÃO faz, e é a decisão mais importante dele: não deixa escrever HTML, CSS
 * nem JavaScript.
 *
 * O motivo é o de sempre nas telas que produzem conteúdo público — mas aqui
 * ele é mais sério, porque a página editada é a que o COMPRADOR abre, com a
 * sessão, o carrinho e o endereço dele na tela. Marcação livre vinda do
 * painel seria script rodando no navegador de terceiros: uma conta de lojista
 * invadida viraria roubo de dados dos clientes dele, e nenhuma limpeza de
 * HTML é confiável o bastante para apostar isso.
 *
 * Então o editor monta uma LISTA DE BLOCOS de um catálogo fechado, cada um
 * com propriedades de tipo conhecido. Quem desenha continua sendo o código da
 * vitrine, revisado uma vez, para todas as lojas. Na prática o lojista faz o
 * que faria num construtor de páginas — escolhe as seções, a ordem, os
 * títulos, as cores dentro do tema dele — sem que exista um caminho para pôr
 * código na página de alguém.
 *
 * Reordenar tem DOIS caminhos de propósito: arrastar e as setas. Arrastar não
 * funciona com teclado nem em muitos toques de celular, e uma tela em que só
 * se reordena arrastando é uma tela que parte da equipe não consegue usar.
 */

interface TipoDeBloco {
    tipo: string
    nome: string
    descricao: string
    Icone: IconType
    /** Só pode existir uma vez na página. */
    unico?: boolean
}

const CATALOGO: TipoDeBloco[] = [
    {
        tipo: "secao",
        nome: "Seção com colunas",
        descricao: "Um container: põe blocos lado a lado.",
        Icone: FiColumns,
    },
    {
        tipo: "banner",
        nome: "Banners",
        descricao: "O carrossel que você cadastra em Banners.",
        Icone: FiImage,
        unico: true,
    },
    {
        tipo: "atalhos",
        nome: "Atalhos de categoria",
        descricao: "As categorias do seu catálogo, em círculos.",
        Icone: FiGrid,
        unico: true,
    },
    {
        tipo: "prateleira",
        nome: "Prateleira de produtos",
        descricao: "Uma fileira de produtos com título.",
        Icone: FiLayout,
    },
    {
        tipo: "grade",
        nome: "Grade de produtos",
        descricao: "A lista completa, com busca, filtro e paginação.",
        Icone: FiGrid,
        unico: true,
    },
    {
        tipo: "texto",
        nome: "Texto",
        descricao: "Um título e um parágrafo seus.",
        Icone: FiType,
    },
    {
        tipo: "faixa",
        nome: "Faixa de destaque",
        descricao: "Uma chamada com fundo colorido e botão.",
        Icone: FiLayout,
    },
    {
        tipo: "imagem",
        nome: "Imagem",
        descricao: "Uma imagem de largura inteira, com link.",
        Icone: FiImage,
    },
    {
        tipo: "espaco",
        nome: "Espaço",
        descricao: "Um respiro entre dois blocos.",
        Icone: FiMove,
    },
]

function doCatalogo(tipo: string): TipoDeBloco | undefined {
    return CATALOGO.find((item) => item.tipo === tipo)
}

/** Um bloco novo, já com o padrão de cada tipo preenchido. */
function novoBloco(tipo: string): Bloco {

    // Id só precisa ser único dentro da página — e legível, para quem for
    // olhar o JSON gravado entender o que é.
    const id = `${tipo}-${Math.random().toString(36).slice(2, 8)}`

    switch (tipo) {
        case "secao":
            // Nasce com duas colunas vazias: uma coluna só seria uma seção
            // que não faz nada de diferente do resto da página.
            return { id, tipo, colunas: [[], []], fundo: "nenhum", largura: "normal" }
        case "prateleira":
            return { id, tipo, titulo: "Destaques", fonte: "ofertas", quantidade: 8 }
        case "texto":
            return { id, tipo, titulo: "Sobre a loja", texto: "", alinhamento: "esquerda" }
        case "faixa":
            return { id, tipo, titulo: "Frete combinado na hora", texto: "", tom: "destaque" }
        case "imagem":
            return { id, tipo, imagem_url: "", alt: "" }
        case "espaco":
            return { id, tipo, altura: "medio" }
        default:
            return { id, tipo }
    }
}

export default function EditorDaHome() {

    const [blocos, setBlocos] = useState<Bloco[]>([])
    const [escolhido, setEscolhido] = useState<string | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro] = useState("")
    const [salvo, setSalvo] = useState(false)
    const [slug, setSlug] = useState("")

    // As cores da loja, para a prévia mostrar a página com a cara que ela
    // terá — e não com a do painel.
    const [tema, setTema] = useState<TemaLoja>(TEMA_DE_FABRICA)

    // O bloco que está sendo arrastado agora, e sobre qual ele está passando.
    const [arrastando, setArrastando] = useState<string | null>(null)
    const [alvo, setAlvo] = useState<string | null>(null)

    useEffect(() => {

        let vivo = true

        async function buscar() {
            try {
                const [pagina, loja, aparencia] = await Promise.all([
                    consultarPaginaDaLoja(),
                    consultarLoja(),
                    // O tema é só para a prévia: se falhar, ela desenha com as
                    // cores de fábrica em vez de a tela inteira não abrir.
                    consultarTema().catch(() => TEMA_DE_FABRICA),
                ])

                if (!vivo) return

                setBlocos(pagina)
                setSlug(loja.slug)
                setTema(aparencia)

            } catch (e) {
                if (vivo) setErro(e instanceof Error ? e.message : "Não foi possível carregar a página.")
            } finally {
                if (vivo) setCarregando(false)
            }
        }

        void buscar()

        return () => {
            vivo = false
        }
    }, [])

    const mexeu = useCallback(() => {
        setSalvo(false)
        setErro("")
    }, [])

    /**
     * Põe um bloco novo na página — ou dentro de uma coluna, quando o destino
     * diz de qual seção e coluna se trata.
     */
    function adicionar(tipo: string, destino?: Caminho) {

        const item = doCatalogo(tipo)

        if (item?.unico && achatar(blocos).some((bloco) => bloco.tipo === tipo)) {
            setErro(`${item.nome} só pode aparecer uma vez na página.`)
            return
        }

        // O teto é do servidor; conferir aqui evita montar a página inteira
        // para ouvir "não" no salvar.
        if (contar(blocos) >= 40) {
            setErro("A página chegou ao limite de 40 blocos.")
            return
        }

        const bloco = novoBloco(tipo)

        const lugar: Caminho = destino ?? { secao: null, coluna: 0, indice: blocos.length }

        setBlocos((atuais) => inserirNaArvore(atuais, lugar, bloco))
        setEscolhido(bloco.id)
        mexeu()
    }

    function remover(id: string) {
        setBlocos((atuais) => removerDaArvore(atuais, id)[0])
        if (escolhido === id) setEscolhido(null)
        mexeu()
    }

    /** Move um bloco para outro lugar da árvore. É o que arrastar e as setas fazem. */
    function mover(id: string, destino: Caminho) {
        setBlocos((atuais) => moverNaArvore(atuais, id, destino))
        mexeu()
    }

    /** Sobe ou desce um bloco DENTRO do container em que ele já está. */
    function empurrar(id: string, secao: string | null, coluna: number, indice: number, passo: number) {

        const lista = secao === null
            ? blocos
            : blocos.find((bloco) => bloco.id === secao)?.colunas?.[coluna] ?? []

        const destinoIndice = indice + passo

        if (destinoIndice < 0 || destinoIndice >= lista.length) return

        mover(id, { secao, coluna, indice: destinoIndice })
    }

    function editar(id: string, campo: keyof Bloco, valor: string | number) {
        setBlocos((atuais) => editarNaArvore(atuais, id, (bloco) => ({ ...bloco, [campo]: valor })))
        mexeu()
    }

    /** Muda quantas colunas uma seção tem, preservando o que já está dentro. */
    function mudarColunas(id: string, quantas: number) {

        setBlocos((atuais) =>
            editarNaArvore(atuais, id, (bloco) => {

                const atual = bloco.colunas ?? [[]]

                if (quantas > atual.length) {
                    return { ...bloco, colunas: [...atual, ...Array.from({ length: quantas - atual.length }, () => [])] }
                }

                // Tirando colunas, o que estava nas que saíram vai para a
                // última que ficou — em vez de sumir sem aviso.
                const ficam = atual.slice(0, quantas)
                const sobra = atual.slice(quantas).flat()

                if (sobra.length > 0) {
                    ficam[ficam.length - 1] = [...ficam[ficam.length - 1], ...sobra]
                }

                return { ...bloco, colunas: ficam }
            }),
        )

        mexeu()
    }

    async function salvar() {

        setSalvando(true)
        setErro("")

        try {
            // O que volta é o que FICOU gravado, já passado pela validação do
            // servidor. A tela adota essa versão em vez da que mandou: assim
            // o lojista vê o texto cortado no limite e o link recusado, em
            // vez de continuar vendo na tela algo que o banco não tem.
            setBlocos(await salvarPaginaDaLoja(blocos))
            setSalvo(true)

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível salvar.")
        } finally {
            setSalvando(false)
        }
    }

    const selecionado = achatar(blocos).find((bloco) => bloco.id === escolhido) ?? null

    if (carregando) {
        return (
            <Pagina titulo="Editor da home" volta={{ nome: "Minha loja", rota: "/page/loja" }}>
                <div className="card p-8 text-center text-sm text-[#616161]">Carregando a página...</div>
            </Pagina>
        )
    }

    return (
        <Pagina
            titulo="Editor da home"
            descricao="Monte a página inicial da sua vitrine: arraste para ordenar, clique para configurar. O que você monta aqui é o que o cliente vê ao abrir a loja."
            volta={{ nome: "Minha loja", rota: "/page/loja" }}
            acoes={
                <div className="flex items-center gap-2">
                    {slug && (
                        <a
                            href={urlDaVitrine(slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-neutro"
                        >
                            <FiEye className="w-4" aria-hidden />
                            Ver a loja
                            <FiExternalLink className="w-3.5" aria-hidden />
                        </a>
                    )}

                    <button
                        type="button"
                        onClick={salvar}
                        disabled={salvando}
                        className="btn btn-primario"
                    >
                        {salvando ? "Salvando..." : "Salvar e publicar"}
                    </button>
                </div>
            }
        >

            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {salvo && !erro && (
                <div className="flex items-start gap-2.5 rounded-lg bg-[#CDFEE1] px-4 py-3 text-sm font-semibold text-[#0C5132]">
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>Página publicada. Recarregue a loja para ver.</span>
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)_19rem] lg:items-start">

                {/* ==========================
                    O QUE DÁ PARA PÔR, E A ESTRUTURA DA PÁGINA
                ========================== */}
                <div className="space-y-4">

                    <section className="card overflow-hidden">
                        <h2 className="border-b border-[#E1E1E1] bg-[#F7F7F7] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#616161]">
                            Blocos
                        </h2>

                        <ul className="divide-y divide-[#EBEBEB]">
                            {CATALOGO.map((item) => {

                                const jaTem = item.unico && achatar(blocos).some((bloco) => bloco.tipo === item.tipo)

                                return (
                                    <li key={item.tipo}>
                                        <button
                                            type="button"
                                            onClick={() => adicionar(item.tipo)}
                                            disabled={jaTem}
                                            className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-[#F7F7F7] disabled:opacity-40 disabled:hover:bg-transparent"
                                        >
                                            <item.Icone className="mt-0.5 w-4 shrink-0 text-[#616161]" aria-hidden />

                                            <span className="min-w-0">
                                                <span className="flex items-center gap-1.5 text-sm font-medium text-[#303030]">
                                                    {item.nome}
                                                    {!jaTem && <FiPlus className="w-3 text-[#8A8A8A]" aria-hidden />}
                                                </span>

                                                <span className="mt-0.5 block text-xs leading-relaxed text-[#8A8A8A]">
                                                    {jaTem ? "Já está na página." : item.descricao}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>

                    <section className="card overflow-hidden">
                        <h2 className="border-b border-[#E1E1E1] bg-[#F7F7F7] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#616161]">
                            Estrutura
                        </h2>

                        {blocos.length === 0 ? (
                            <p className="px-4 py-8 text-center text-xs text-[#8A8A8A]">
                                Escolha um bloco acima para começar.
                            </p>
                        ) : (
                            <ul className="divide-y divide-[#EBEBEB]">
                                {blocos.map((bloco, indice) => (
                                    <li key={bloco.id}>

                                        <Linha
                                            bloco={bloco}
                                            escolhido={escolhido}
                                            arrastando={arrastando}
                                            alvo={alvo}
                                            aoEscolher={setEscolhido}
                                            aoRemover={remover}
                                            aoSubir={() => empurrar(bloco.id, null, 0, indice, -1)}
                                            aoDescer={() => empurrar(bloco.id, null, 0, indice, 1)}
                                            podeSubir={indice > 0}
                                            podeDescer={indice < blocos.length - 1}
                                            aoIniciarArrasto={() => setArrastando(bloco.id)}
                                            aoTerminarArrasto={() => {
                                                setArrastando(null)
                                                setAlvo(null)
                                            }}
                                            aoPassarPorCima={() => setAlvo(bloco.id)}
                                            aoSoltar={() => {
                                                if (arrastando && arrastando !== bloco.id) {
                                                    mover(arrastando, { secao: null, coluna: 0, indice })
                                                }
                                                setArrastando(null)
                                                setAlvo(null)
                                            }}
                                        />

                                        {/* AS COLUNAS DA SEÇÃO

                                            Cada uma é uma área de soltar: é
                                            para dentro delas que se arrasta um
                                            bloco para ele ficar lado a lado
                                            com outro. */}
                                        {bloco.colunas ? (
                                            <div className="space-y-2 border-t border-[#EBEBEB] bg-[#FAFAFA] px-3 py-2.5">
                                                {bloco.colunas.map((coluna, indiceColuna) => (
                                                    <div
                                                        key={indiceColuna}
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={(e) => {
                                                            e.preventDefault()

                                                            if (arrastando) {
                                                                mover(arrastando, {
                                                                    secao: bloco.id,
                                                                    coluna: indiceColuna,
                                                                    indice: coluna.length,
                                                                })
                                                            }

                                                            setArrastando(null)
                                                            setAlvo(null)
                                                        }}
                                                        className="rounded border border-dashed border-[#D1D1D1] p-2"
                                                    >
                                                        <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                                                            Coluna {indiceColuna + 1}
                                                        </p>

                                                        <ul className="space-y-1">
                                                            {coluna.map((filho, indiceFilho) => (
                                                                <li key={filho.id}>
                                                                    <Linha
                                                                        bloco={filho}
                                                                        miuda
                                                                        escolhido={escolhido}
                                                                        arrastando={arrastando}
                                                                        alvo={alvo}
                                                                        aoEscolher={setEscolhido}
                                                                        aoRemover={remover}
                                                                        aoSubir={() => empurrar(filho.id, bloco.id, indiceColuna, indiceFilho, -1)}
                                                                        aoDescer={() => empurrar(filho.id, bloco.id, indiceColuna, indiceFilho, 1)}
                                                                        podeSubir={indiceFilho > 0}
                                                                        podeDescer={indiceFilho < coluna.length - 1}
                                                                        aoIniciarArrasto={() => setArrastando(filho.id)}
                                                                        aoTerminarArrasto={() => {
                                                                            setArrastando(null)
                                                                            setAlvo(null)
                                                                        }}
                                                                        aoPassarPorCima={() => setAlvo(filho.id)}
                                                                        aoSoltar={() => {
                                                                            if (arrastando && arrastando !== filho.id) {
                                                                                mover(arrastando, {
                                                                                    secao: bloco.id,
                                                                                    coluna: indiceColuna,
                                                                                    indice: indiceFilho,
                                                                                })
                                                                            }
                                                                            setArrastando(null)
                                                                            setAlvo(null)
                                                                        }}
                                                                    />
                                                                </li>
                                                            ))}
                                                        </ul>

                                                        {/* Somar um bloco direto na coluna, para
                                                            quem prefere escolher a pôr e arrastar. */}
                                                        <label className="mt-1.5 block">
                                                            <span className="sr-only">
                                                                Adicionar bloco na coluna {indiceColuna + 1}
                                                            </span>

                                                            <select
                                                                value=""
                                                                onChange={(e) => {
                                                                    if (!e.target.value) return

                                                                    adicionar(e.target.value, {
                                                                        secao: bloco.id,
                                                                        coluna: indiceColuna,
                                                                        indice: coluna.length,
                                                                    })
                                                                }}
                                                                className="field cursor-pointer py-1 text-xs"
                                                            >
                                                                <option value="">+ bloco aqui</option>
                                                                {CATALOGO.filter((item) => cabeEmColuna(item.tipo)).map((item) => (
                                                                    <option key={item.tipo} value={item.tipo}>
                                                                        {item.nome}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}

                                    </li>
                                ))}
                            </ul>
                        )}

                        <p className="border-t border-[#EBEBEB] px-4 py-2.5 text-[0.7rem] leading-relaxed text-[#8A8A8A]">
                            Arraste para ordenar, ou use as setas — elas funcionam no
                            teclado e no celular, onde arrastar não funciona.
                        </p>
                    </section>

                </div>

                {/* ==========================
                    A PRÉVIA

                    O que o cliente vai ver, montando junto com você. Clicar
                    num bloco aqui abre os ajustes dele à direita.
                ========================== */}
                <section className="card overflow-hidden">
                    <h2 className="flex items-center justify-between gap-3 border-b border-[#E1E1E1] bg-[#F7F7F7] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#616161]">
                        Prévia
                        <span className="font-normal normal-case tracking-normal text-[#8A8A8A]">
                            os produtos aparecem como retângulos
                        </span>
                    </h2>

                    <Previa
                        blocos={blocos}
                        tema={tema}
                        escolhido={escolhido}
                        aoEscolher={setEscolhido}
                    />
                </section>

                {/* ==========================
                    O QUE O BLOCO TEM
                ========================== */}
                <section className="card overflow-hidden lg:sticky lg:top-4">
                    <h2 className="border-b border-[#E1E1E1] bg-[#F7F7F7] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#616161]">
                        {selecionado ? doCatalogo(selecionado.tipo)?.nome ?? "Bloco" : "Ajustes"}
                    </h2>

                    <div className="p-4">
                        {selecionado ? (
                            <Ajustes
                                bloco={selecionado}
                                aoEditar={editar}
                                aoMudarColunas={mudarColunas}
                            />
                        ) : (
                            <p className="py-6 text-center text-sm text-[#8A8A8A]">
                                Clique num bloco da prévia ou da estrutura para ajustar o
                                que ele mostra.
                            </p>
                        )}
                    </div>
                </section>

            </div>

            <div className="flex items-center justify-between gap-4">
                <p className="text-xs leading-relaxed text-[#8A8A8A]">
                    O editor trabalha com blocos prontos, e não com HTML: é o que
                    garante que nada colocado aqui possa rodar como código na página do
                    seu cliente. Cores e fontes saem do tema da loja, em{" "}
                    <Link href="/page/loja" className="text-[#005BD3] hover:underline">
                        Minha loja
                    </Link>
                    .
                </p>

                <button
                    type="button"
                    onClick={() => {
                        setBlocos(PADRAO.map((bloco) => ({ ...bloco })))
                        setEscolhido(null)
                        mexeu()
                    }}
                    className="btn btn-neutro shrink-0"
                >
                    <FiRotateCcw className="w-4" aria-hidden />
                    Voltar ao padrão
                </button>
            </div>

        </Pagina>
    )
}

/**
 * Uma linha da estrutura: o bloco, o que dá para fazer com ele, e as alças.
 *
 * A mesma para a página e para dentro das colunas — `miuda` só a aperta. Ter
 * duas versões da linha seria manter duas listas de botões em sincronia, e a
 * segunda a esquecer é a que fica sem o "remover".
 */
function Linha({
    bloco,
    miuda = false,
    escolhido,
    arrastando,
    alvo,
    aoEscolher,
    aoRemover,
    aoSubir,
    aoDescer,
    podeSubir,
    podeDescer,
    aoIniciarArrasto,
    aoTerminarArrasto,
    aoPassarPorCima,
    aoSoltar,
}: {
    bloco: Bloco
    miuda?: boolean
    escolhido: string | null
    arrastando: string | null
    alvo: string | null
    aoEscolher: (id: string) => void
    aoRemover: (id: string) => void
    aoSubir: () => void
    aoDescer: () => void
    podeSubir: boolean
    podeDescer: boolean
    aoIniciarArrasto: () => void
    aoTerminarArrasto: () => void
    aoPassarPorCima: () => void
    aoSoltar: () => void
}) {

    const item = doCatalogo(bloco.tipo)

    return (
        <div
            draggable
            onDragStart={aoIniciarArrasto}
            onDragEnd={aoTerminarArrasto}
            onDragOver={(e) => {
                // Sem isto o navegador recusa o solte.
                e.preventDefault()
                aoPassarPorCima()
            }}
            onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                aoSoltar()
            }}
            className={`flex items-center gap-2 transition-colors ${miuda ? "px-2 py-1.5" : "px-4 py-2.5"} ${
                bloco.id === escolhido ? "bg-[#EAF4FF]" : ""
            } ${alvo === bloco.id && arrastando !== bloco.id ? "border-t-2 border-t-[#005BD3]" : ""} ${
                arrastando === bloco.id ? "opacity-40" : ""
            }`}
        >
            <FiMove className="w-3.5 shrink-0 cursor-grab text-[#B5B5B5]" aria-hidden />

            <button
                type="button"
                onClick={() => aoEscolher(bloco.id)}
                className="min-w-0 flex-1 text-left"
            >
                <span className={`block font-medium text-[#303030] ${miuda ? "text-xs" : "text-sm"}`}>
                    {item?.nome ?? bloco.tipo}
                </span>

                <span className="mt-0.5 block truncate text-[0.7rem] text-[#8A8A8A]">
                    {resumoDoBloco(bloco)}
                </span>
            </button>

            <span className="flex shrink-0 items-center">
                <button
                    type="button"
                    onClick={aoSubir}
                    disabled={!podeSubir}
                    aria-label={`Subir ${item?.nome ?? bloco.tipo}`}
                    className="p-1 text-[#616161] transition-colors hover:text-[#303030] disabled:opacity-30"
                >
                    <FiArrowUp className="w-3.5" aria-hidden />
                </button>

                <button
                    type="button"
                    onClick={aoDescer}
                    disabled={!podeDescer}
                    aria-label={`Descer ${item?.nome ?? bloco.tipo}`}
                    className="p-1 text-[#616161] transition-colors hover:text-[#303030] disabled:opacity-30"
                >
                    <FiArrowDown className="w-3.5" aria-hidden />
                </button>

                <button
                    type="button"
                    onClick={() => aoRemover(bloco.id)}
                    aria-label={`Tirar ${item?.nome ?? bloco.tipo} da página`}
                    className="p-1 text-[#8A8A8A] transition-colors hover:text-[#8E1F0B]"
                >
                    <FiTrash2 className="w-3.5" aria-hidden />
                </button>
            </span>
        </div>
    )
}

/** O layout de fábrica: a home que a vitrine sempre teve. */
const PADRAO: Bloco[] = [
    { id: "banner", tipo: "banner" },
    { id: "atalhos", tipo: "atalhos" },
    { id: "ofertas", tipo: "prateleira", titulo: "Ofertas do dia", fonte: "ofertas", quantidade: 8 },
    { id: "grade", tipo: "grade" },
]

/** Uma linha dizendo o que este bloco mostra hoje. */
function resumoDoBloco(bloco: Bloco): string {

    switch (bloco.tipo) {
        case "secao": {
            const colunas = bloco.colunas?.length ?? 0
            const dentro = (bloco.colunas ?? []).reduce((soma, coluna) => soma + coluna.length, 0)
            return `${colunas} coluna(s) · ${dentro} bloco(s) dentro`
        }
        case "prateleira":
            return `${bloco.titulo || "sem título"} · ${
                bloco.fonte === "categoria" ? `categoria ${bloco.categoria || "?"}` : bloco.fonte === "recentes" ? "mais recentes" : "em oferta"
            } · ${bloco.quantidade ?? 8} produtos`
        case "texto":
        case "faixa":
            return bloco.titulo || bloco.texto || "sem texto"
        case "imagem":
            return bloco.imagem_url ? bloco.alt || bloco.imagem_url : "sem imagem"
        case "espaco":
            return bloco.altura === "grande" ? "grande" : bloco.altura === "pequeno" ? "pequeno" : "médio"
        default:
            return doCatalogo(bloco.tipo)?.descricao ?? ""
    }
}

/* ==========================================================================
   Os ajustes de cada tipo

   Campos de tipo conhecido, e opções fechadas onde há escolha de aparência.
   Não existe campo livre de cor, tamanho ou CSS: cor livre por bloco produz,
   mais cedo do que tarde, texto preto em fundo preto na loja de alguém — e
   CSS livre é a mesma porta que o HTML livre, por outro nome.
   ========================================================================== */

function Ajustes({
    bloco,
    aoEditar,
    aoMudarColunas,
}: {
    bloco: Bloco
    aoEditar: (id: string, campo: keyof Bloco, valor: string | number) => void
    aoMudarColunas: (id: string, quantas: number) => void
}) {

    const mudar = (campo: keyof Bloco) => (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => aoEditar(bloco.id, campo, e.target.value)

    switch (bloco.tipo) {

        case "secao":
            return (
                <div className="space-y-4">
                    <Campo rotulo="Título da seção" ajuda="Opcional, aparece acima das colunas.">
                        <input className="field" maxLength={80} value={bloco.titulo ?? ""} onChange={mudar("titulo")} />
                    </Campo>

                    <Campo rotulo="Colunas" ajuda="No celular elas viram uma embaixo da outra.">
                        <select
                            className="field cursor-pointer"
                            value={bloco.colunas?.length ?? 2}
                            onChange={(e) => aoMudarColunas(bloco.id, Number(e.target.value))}
                        >
                            <option value={1}>1 coluna</option>
                            <option value={2}>2 colunas</option>
                            <option value={3}>3 colunas</option>
                            <option value={4}>4 colunas</option>
                        </select>
                    </Campo>

                    <Campo rotulo="Fundo" ajuda="A cor vem do tema da sua loja.">
                        <select className="field cursor-pointer" value={bloco.fundo ?? "nenhum"} onChange={mudar("fundo")}>
                            <option value="nenhum">Sem fundo</option>
                            <option value="claro">Fundo claro</option>
                            <option value="destaque">Cor de destaque</option>
                        </select>
                    </Campo>

                    <Campo rotulo="Largura">
                        <select className="field cursor-pointer" value={bloco.largura ?? "normal"} onChange={mudar("largura")}>
                            <option value="normal">Alinhada ao resto da loja</option>
                            <option value="total">De ponta a ponta da tela</option>
                        </select>
                    </Campo>

                    <p className="text-xs leading-relaxed text-[#8A8A8A]">
                        Arraste blocos da estrutura para dentro das colunas, ou use o
                        &quot;+ bloco aqui&quot; de cada uma. Banner, atalhos e a grade de
                        produtos não entram em coluna: são de página inteira.
                    </p>
                </div>
            )

        case "prateleira":
            return (
                <div className="space-y-4">
                    <Campo rotulo="Título" ajuda="Aparece acima dos produtos.">
                        <input className="field" maxLength={80} value={bloco.titulo ?? ""} onChange={mudar("titulo")} />
                    </Campo>

                    <Campo rotulo="Quais produtos">
                        <select className="field cursor-pointer" value={bloco.fonte ?? "ofertas"} onChange={mudar("fonte")}>
                            <option value="ofertas">Os que estão em promoção</option>
                            <option value="recentes">Os cadastrados mais recentemente</option>
                            <option value="categoria">De uma categoria</option>
                        </select>
                    </Campo>

                    {bloco.fonte === "categoria" && (
                        <Campo rotulo="Categoria" ajuda="Escreva igual ao cadastro do produto.">
                            <input className="field" maxLength={40} value={bloco.categoria ?? ""} onChange={mudar("categoria")} />
                        </Campo>
                    )}

                    <Campo rotulo="Quantos produtos" ajuda="De 4 a 12.">
                        <input
                            className="field"
                            type="number"
                            min={4}
                            max={12}
                            value={bloco.quantidade ?? 8}
                            onChange={(e) => aoEditar(bloco.id, "quantidade", Number(e.target.value))}
                        />
                    </Campo>
                </div>
            )

        case "texto":
            return (
                <div className="space-y-4">
                    <Campo rotulo="Título">
                        <input className="field" maxLength={80} value={bloco.titulo ?? ""} onChange={mudar("titulo")} />
                    </Campo>

                    <Campo rotulo="Texto" ajuda="Até 400 caracteres.">
                        <textarea className="field min-h-28" maxLength={400} value={bloco.texto ?? ""} onChange={mudar("texto")} />
                    </Campo>

                    <Campo rotulo="Alinhamento">
                        <select className="field cursor-pointer" value={bloco.alinhamento ?? "esquerda"} onChange={mudar("alinhamento")}>
                            <option value="esquerda">À esquerda</option>
                            <option value="centro">Centralizado</option>
                        </select>
                    </Campo>
                </div>
            )

        case "faixa":
            return (
                <div className="space-y-4">
                    <Campo rotulo="Chamada">
                        <input className="field" maxLength={80} value={bloco.titulo ?? ""} onChange={mudar("titulo")} />
                    </Campo>

                    <Campo rotulo="Texto de apoio">
                        <textarea className="field min-h-20" maxLength={400} value={bloco.texto ?? ""} onChange={mudar("texto")} />
                    </Campo>

                    <Campo rotulo="Fundo" ajuda="A cor vem do tema da sua loja.">
                        <select className="field cursor-pointer" value={bloco.tom ?? "destaque"} onChange={mudar("tom")}>
                            <option value="destaque">Cor de destaque</option>
                            <option value="claro">Fundo claro</option>
                        </select>
                    </Campo>

                    <Campo rotulo="Texto do botão">
                        <input className="field" maxLength={40} value={bloco.botao_texto ?? ""} onChange={mudar("botao_texto")} />
                    </Campo>

                    <Campo rotulo="Link do botão" ajuda="Um caminho da sua loja (/acompanhar) ou um endereço https.">
                        <input className="field" maxLength={300} value={bloco.link ?? ""} onChange={mudar("link")} />
                    </Campo>
                </div>
            )

        case "imagem":
            return (
                <div className="space-y-4">
                    <Campo rotulo="Endereço da imagem" ajuda="https://... A mesma regra dos banners.">
                        <input className="field" maxLength={300} value={bloco.imagem_url ?? ""} onChange={mudar("imagem_url")} />
                    </Campo>

                    {bloco.imagem_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={bloco.imagem_url}
                            alt=""
                            className="max-h-40 w-full rounded-lg border border-[#EBEBEB] object-cover"
                        />
                    ) : null}

                    <Campo rotulo="Descrição da imagem" ajuda="Lida por quem não enxerga a tela.">
                        <input className="field" maxLength={80} value={bloco.alt ?? ""} onChange={mudar("alt")} />
                    </Campo>

                    <Campo rotulo="Link ao clicar" ajuda="Opcional.">
                        <input className="field" maxLength={300} value={bloco.link ?? ""} onChange={mudar("link")} />
                    </Campo>
                </div>
            )

        case "espaco":
            return (
                <Campo rotulo="Tamanho do respiro">
                    <select className="field cursor-pointer" value={bloco.altura ?? "medio"} onChange={mudar("altura")}>
                        <option value="pequeno">Pequeno</option>
                        <option value="medio">Médio</option>
                        <option value="grande">Grande</option>
                    </select>
                </Campo>
            )

        default:
            return (
                <p className="py-4 text-sm leading-relaxed text-[#616161]">
                    Este bloco não tem ajustes: ele mostra o que já está cadastrado na
                    loja. Use as setas ou arraste para escolher onde ele aparece.
                </p>
            )
    }
}

function Campo({ rotulo, ajuda, children }: { rotulo: string; ajuda?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="rotulo">{rotulo}</span>
            <span className="mt-1 block">{children}</span>
            {ajuda ? <span className="mt-1 block text-xs text-[#8A8A8A]">{ajuda}</span> : null}
        </label>
    )
}
