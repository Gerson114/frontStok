"use client"

import { useEffect, useState } from "react"
import {
    FiAlertCircle,
    FiArrowDown,
    FiArrowUp,
    FiCheckCircle,
    FiPlus,
    FiRotateCcw,
    FiTrash2,
} from "react-icons/fi"
import { Pagina, Secao } from "@/app/components/pagina/pagina"
import {
    consultarMoldura,
    salvarMoldura,
    type Cabecalho,
    type CatalogoDaMoldura,
    type ColunaDoRodape,
    type FaixaDoTopo,
    type PecaDaMoldura,
    type Rodape,
} from "@/middleware/loja"

/**
 * O editor do cabeçalho e do rodapé — o topo e o pé que aparecem em TODA
 * página da loja, e não só na home (por isso não mora dentro do editor da
 * home: ver services/paginas/moldura.go).
 *
 * Mesma anatomia de segurança do editor da home: uma peça é sempre de um
 * catálogo fechado (o que o servidor manda em `catalogo`), nunca marcação —
 * o lojista escolhe QUAIS peças aparecem, em que ordem e em que faixa, e
 * quem desenha cada uma continua sendo o código da vitrine.
 *
 * O topo é uma linha horizontal com três áreas (esquerda, centro, direita) —
 * é por isso que não existe posicionamento livre por coordenada, que
 * produziria um topo que se desmancha no celular.
 */

const NOME_DA_FAIXA: Record<string, string> = {
    servico: "Faixa de serviço",
    marca: "Faixa da marca",
    navegacao: "Régua de categorias",
}

const AJUDA_DA_FAIXA: Record<string, string> = {
    servico: "A linha fina de cima: garantias, CNPJ, troca de filial.",
    marca: "A barra principal: a marca, a busca, a conta e a sacola.",
    navegacao: "A régua de categorias, logo abaixo da marca.",
}

const NOME_DA_PECA: Record<string, string> = {
    marca: "Marca da loja",
    busca: "Campo de busca",
    conta: "Menu da conta",
    pedidos: "Atalho para pedidos",
    sacola: "Sacola",
    departamentos: "Categorias",
    filiais: "Trocar de filial",
    cnpj: "CNPJ da loja",
    selo: "Selo de confiança",
    texto: "Texto livre",
    link: "Link",
    sobre: "Sobre a loja",
    contato: "Fale com a loja",
    pagamento: "Formas de pagamento",
    links: "Lista de links",
    copyright: "Direitos autorais",
    privacidade: "Aviso de privacidade",
}

const NOME_DO_FUNDO: Record<string, string> = {
    destaque: "Cor da marca",
    claro: "Claro",
    escuro: "Escuro",
}

const NOME_DA_APARICAO: Record<string, string> = {
    sempre: "Sempre",
    "so-desktop": "Só no computador",
    "so-celular": "Só no celular",
}

const NOME_DA_LARGURA: Record<string, string> = {
    normal: "Normal",
    larga: "Larga",
}

const ICONES = [
    { chave: "cadeado", nome: "Cadeado (segurança)" },
    { chave: "cartao", nome: "Cartão (pagamento)" },
    { chave: "caixa", nome: "Caixa (pedido)" },
    { chave: "fone", nome: "Fone (atendimento)" },
    { chave: "caminhao", nome: "Caminhão (entrega)" },
    { chave: "troca", nome: "Setas (troca)" },
    { chave: "relogio", nome: "Relógio (prazo)" },
    { chave: "estrela", nome: "Estrela (destaque)" },
    { chave: "presente", nome: "Presente (brinde)" },
    { chave: "mapa", nome: "Mapa (endereço)" },
    { chave: "escudo", nome: "Escudo (garantia)" },
    { chave: "etiqueta", nome: "Etiqueta (preço)" },
]

const AREAS: { chave: "esquerda" | "centro" | "direita"; nome: string }[] = [
    { chave: "esquerda", nome: "Esquerda" },
    { chave: "centro", nome: "Centro" },
    { chave: "direita", nome: "Direita" },
]

/* ==========================================================================
   Operações puras sobre listas — a mesma ideia do arvore.ts do editor da
   home, numa escala menor: aqui não há aninhamento livre, só listas dentro
   de listas num formato fixo (faixa → área; coluna → peças; barra).
   ========================================================================== */

function mover<T>(lista: T[], indice: number, passo: number): T[] {

    const destino = indice + passo

    if (destino < 0 || destino >= lista.length) return lista

    const copia = [...lista]
    const [item] = copia.splice(indice, 1)
    copia.splice(destino, 0, item)

    return copia
}

function remover<T>(lista: T[], indice: number): T[] {
    return lista.filter((_, i) => i !== indice)
}

function novoId(): string {
    return `pc-${Math.random().toString(36).slice(2, 8)}`
}

function novaPeca(tipo: string): PecaDaMoldura {

    switch (tipo) {
        case "texto":
        case "selo":
            return { id: novoId(), tipo, icone: "estrela", texto: "" }
        case "link":
            return { id: novoId(), tipo, icone: "etiqueta", texto: "", link: "" }
        case "marca":
        case "busca":
            return { id: novoId(), tipo, tamanho: "normal" }
        default:
            return { id: novoId(), tipo }
    }
}

export default function EditorDaMoldura() {

    const [cabecalho, setCabecalho] = useState<Cabecalho>({ faixas: [] })
    const [rodape, setRodape] = useState<Rodape>({ ligado: true, colunas: [], barra: [] })
    const [catalogo, setCatalogo] = useState<CatalogoDaMoldura | null>(null)
    const [padrao, setPadrao] = useState<{ cabecalho: Cabecalho; rodape: Rodape } | null>(null)

    const [carregando, setCarregando] = useState(true)
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro] = useState("")
    const [salvo, setSalvo] = useState(false)

    useEffect(() => {

        let vivo = true

        async function buscar() {
            try {
                const dados = await consultarMoldura()

                if (!vivo) return

                setCabecalho(dados.cabecalho)
                setRodape(dados.rodape)
                setCatalogo(dados.catalogo)
                setPadrao(dados.padrao)

            } catch (e) {
                if (vivo) setErro(e instanceof Error ? e.message : "Não foi possível carregar o cabeçalho e o rodapé.")
            } finally {
                if (vivo) setCarregando(false)
            }
        }

        void buscar()

        return () => {
            vivo = false
        }
    }, [])

    function mexeu() {
        setSalvo(false)
        setErro("")
    }

    /* ---------------------------------------------------------------- *
       O TOPO
     * ---------------------------------------------------------------- */

    function atualizarFaixa(faixaId: string, mudar: (faixa: FaixaDoTopo) => FaixaDoTopo) {
        setCabecalho((atual) => ({
            faixas: atual.faixas.map((faixa) => (faixa.id === faixaId ? mudar(faixa) : faixa)),
        }))
        mexeu()
    }

    function atualizarArea(
        faixaId: string,
        area: "esquerda" | "centro" | "direita",
        mudar: (lista: PecaDaMoldura[]) => PecaDaMoldura[],
    ) {
        atualizarFaixa(faixaId, (faixa) => ({ ...faixa, [area]: mudar(faixa[area]) }))
    }

    function adicionarPeca(faixaId: string, area: "esquerda" | "centro" | "direita", tipo: string) {
        if (!tipo) return
        atualizarArea(faixaId, area, (lista) => [...lista, novaPeca(tipo)])
    }

    /* ---------------------------------------------------------------- *
       O RODAPÉ
     * ---------------------------------------------------------------- */

    function atualizarColuna(colunaId: string, mudar: (coluna: ColunaDoRodape) => ColunaDoRodape) {
        setRodape((atual) => ({
            ...atual,
            colunas: atual.colunas.map((coluna) => (coluna.id === colunaId ? mudar(coluna) : coluna)),
        }))
        mexeu()
    }

    function adicionarColuna() {
        setRodape((atual) => ({
            ...atual,
            colunas: [...atual.colunas, { id: novoId(), titulo: "", largura: "normal", pecas: [] }],
        }))
        mexeu()
    }

    function atualizarBarra(mudar: (lista: PecaDaMoldura[]) => PecaDaMoldura[]) {
        setRodape((atual) => ({ ...atual, barra: mudar(atual.barra) }))
        mexeu()
    }

    async function salvar() {

        setSalvando(true)
        setErro("")

        try {
            const salvo = await salvarMoldura({ cabecalho, rodape })

            setCabecalho(salvo.cabecalho)
            setRodape(salvo.rodape)
            setSalvo(true)

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível salvar.")
        } finally {
            setSalvando(false)
        }
    }

    if (carregando) {
        return (
            <Pagina titulo="Cabeçalho e rodapé" volta={{ nome: "Minha loja", rota: "/page/loja" }}>
                <div className="card p-8 text-center text-sm text-[var(--ink-2)]">Carregando...</div>
            </Pagina>
        )
    }

    return (
        <Pagina
            titulo="Cabeçalho e rodapé"
            descricao="O topo e o pé da sua loja, montados peça a peça. Eles aparecem em toda página — não só na home."
            volta={{ nome: "Minha loja", rota: "/page/loja" }}
            acoes={
                <button type="button" onClick={salvar} disabled={salvando} className="btn btn-primario">
                    {salvando ? "Salvando..." : "Salvar e publicar"}
                </button>
            }
        >
            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {salvo && !erro && (
                <div className="flex items-start gap-2.5 rounded-lg bg-[var(--verde-fundo)] px-4 py-3 text-sm font-semibold text-[var(--verde)]">
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>Publicado. Recarregue a loja para ver.</span>
                </div>
            )}

            {catalogo && (
                <>
                    <Secao titulo="Topo" descricao="Uma faixa por linha. Cada uma tem o que fica à esquerda, no meio e à direita.">
                        <div className="space-y-4">
                            {cabecalho.faixas.map((faixa) => (
                                <FaixaCard
                                    key={faixa.id}
                                    faixa={faixa}
                                    catalogo={catalogo}
                                    aoMudar={(mudar) => atualizarFaixa(faixa.id, mudar)}
                                    aoAdicionarPeca={(area, tipo) => adicionarPeca(faixa.id, area, tipo)}
                                    aoMudarArea={(area, mudar) => atualizarArea(faixa.id, area, mudar)}
                                />
                            ))}
                        </div>
                    </Secao>

                    <Secao
                        titulo="Rodapé"
                        descricao="As colunas do meio da página, e a barra final com direitos autorais."
                        acoes={
                            <Chave
                                ligada={rodape.ligado}
                                rotulo="Mostrar rodapé"
                                aoMudar={(v) => {
                                    setRodape((atual) => ({ ...atual, ligado: v }))
                                    mexeu()
                                }}
                            />
                        }
                    >
                        <div className="space-y-4">
                            {rodape.colunas.map((coluna, indice) => (
                                <ColunaCard
                                    key={coluna.id}
                                    coluna={coluna}
                                    catalogo={catalogo}
                                    podeSubir={indice > 0}
                                    podeDescer={indice < rodape.colunas.length - 1}
                                    aoSubir={() => setRodape((a) => ({ ...a, colunas: mover(a.colunas, indice, -1) }))}
                                    aoDescer={() => setRodape((a) => ({ ...a, colunas: mover(a.colunas, indice, 1) }))}
                                    aoRemover={() => {
                                        setRodape((a) => ({ ...a, colunas: remover(a.colunas, indice) }))
                                        mexeu()
                                    }}
                                    aoMudar={(mudar) => atualizarColuna(coluna.id, mudar)}
                                />
                            ))}

                            <button
                                type="button"
                                onClick={adicionarColuna}
                                disabled={rodape.colunas.length >= 5}
                                className="btn btn-neutro disabled:opacity-40"
                            >
                                <FiPlus className="w-4" aria-hidden />
                                Mais uma coluna
                            </button>

                            <div className="border-t border-[var(--linha-suave)] pt-4">
                                <p className="rotulo mb-3 text-[var(--ink-3)]">Barra final</p>

                                <ListaDePecas
                                    pecas={rodape.barra}
                                    catalogo={catalogo}
                                    aoMudar={atualizarBarra}
                                />
                            </div>
                        </div>
                    </Secao>

                    <div className="flex items-center justify-between gap-4">
                        <p className="text-xs leading-relaxed text-[var(--ink-3)]">
                            O editor trabalha com peças prontas, e não com HTML: é o que garante
                            que nada colocado aqui possa rodar como código na página do seu
                            cliente.
                        </p>

                        {padrao && (
                            <button
                                type="button"
                                onClick={() => {
                                    setCabecalho(padrao.cabecalho)
                                    setRodape(padrao.rodape)
                                    mexeu()
                                }}
                                className="btn btn-neutro shrink-0"
                            >
                                <FiRotateCcw className="w-4" aria-hidden />
                                Voltar ao padrão
                            </button>
                        )}
                    </div>
                </>
            )}
        </Pagina>
    )
}

/* ==========================================================================
   O cartão de UMA faixa do topo
   ========================================================================== */

function FaixaCard({
    faixa,
    catalogo,
    aoMudar,
    aoAdicionarPeca,
    aoMudarArea,
}: {
    faixa: FaixaDoTopo
    catalogo: CatalogoDaMoldura
    aoMudar: (mudar: (faixa: FaixaDoTopo) => FaixaDoTopo) => void
    aoAdicionarPeca: (area: "esquerda" | "centro" | "direita", tipo: string) => void
    aoMudarArea: (area: "esquerda" | "centro" | "direita", mudar: (lista: PecaDaMoldura[]) => PecaDaMoldura[]) => void
}) {

    const permitidas = catalogo.pecas_da_faixa[faixa.tipo] ?? {}
    const tiposDaFaixa = Object.keys(permitidas).filter((tipo) => permitidas[tipo])

    return (
        <section className={`card overflow-hidden ${faixa.ligada ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--linha)] bg-[var(--superficie-2)] px-4 py-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--ink)]">{NOME_DA_FAIXA[faixa.tipo] ?? faixa.tipo}</p>
                    <p className="mt-0.5 text-xs text-[var(--ink-3)]">{AJUDA_DA_FAIXA[faixa.tipo]}</p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-[var(--ink-2)]">
                        Fundo
                        <select
                            className="field w-auto cursor-pointer py-1 text-xs"
                            value={faixa.fundo ?? "destaque"}
                            onChange={(e) => aoMudar((f) => ({ ...f, fundo: e.target.value }))}
                        >
                            {catalogo.fundos.map((fundo) => (
                                <option key={fundo} value={fundo}>{NOME_DO_FUNDO[fundo] ?? fundo}</option>
                            ))}
                        </select>
                    </label>

                    <Chave
                        ligada={faixa.ligada}
                        rotulo={`Mostrar ${NOME_DA_FAIXA[faixa.tipo] ?? faixa.tipo}`}
                        aoMudar={(v) => aoMudar((f) => ({ ...f, ligada: v }))}
                    />
                </div>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-3">
                {AREAS.map(({ chave, nome }) => (
                    <div key={chave}>
                        <p className="rotulo mb-2 text-[var(--ink-3)]">{nome}</p>

                        <ListaDePecas
                            pecas={faixa[chave]}
                            catalogo={catalogo}
                            aoMudar={(mudar) => aoMudarArea(chave, mudar)}
                        />

                        <SeletorDePeca
                            tipos={tiposDaFaixa}
                            aoEscolher={(tipo) => aoAdicionarPeca(chave, tipo)}
                        />
                    </div>
                ))}
            </div>
        </section>
    )
}

/* ==========================================================================
   Uma coluna do rodapé
   ========================================================================== */

function ColunaCard({
    coluna,
    catalogo,
    podeSubir,
    podeDescer,
    aoSubir,
    aoDescer,
    aoRemover,
    aoMudar,
}: {
    coluna: ColunaDoRodape
    catalogo: CatalogoDaMoldura
    podeSubir: boolean
    podeDescer: boolean
    aoSubir: () => void
    aoDescer: () => void
    aoRemover: () => void
    aoMudar: (mudar: (coluna: ColunaDoRodape) => ColunaDoRodape) => void
}) {
    return (
        <div className="rounded-lg border border-[var(--linha)] p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                    className="field flex-1"
                    placeholder="Título da coluna"
                    maxLength={40}
                    value={coluna.titulo ?? ""}
                    onChange={(e) => aoMudar((c) => ({ ...c, titulo: e.target.value }))}
                />

                <select
                    className="field w-auto cursor-pointer text-xs"
                    value={coluna.largura ?? "normal"}
                    onChange={(e) => aoMudar((c) => ({ ...c, largura: e.target.value }))}
                >
                    {catalogo.larguras_da_coluna.map((largura) => (
                        <option key={largura} value={largura}>{NOME_DA_LARGURA[largura] ?? largura}</option>
                    ))}
                </select>

                <span className="flex shrink-0 items-center">
                    <button type="button" aria-label="Subir coluna" disabled={!podeSubir} onClick={aoSubir} className="p-1 text-[var(--ink-2)] hover:text-[var(--ink)] disabled:opacity-30">
                        <FiArrowUp className="w-3.5" aria-hidden />
                    </button>
                    <button type="button" aria-label="Descer coluna" disabled={!podeDescer} onClick={aoDescer} className="p-1 text-[var(--ink-2)] hover:text-[var(--ink)] disabled:opacity-30">
                        <FiArrowDown className="w-3.5" aria-hidden />
                    </button>
                    <button type="button" aria-label="Tirar coluna" onClick={aoRemover} className="p-1 text-[var(--ink-3)] hover:text-[var(--vermelho)]">
                        <FiTrash2 className="w-3.5" aria-hidden />
                    </button>
                </span>
            </div>

            <ListaDePecas
                pecas={coluna.pecas}
                catalogo={catalogo}
                aoMudar={(mudar) => aoMudar((c) => ({ ...c, pecas: mudar(c.pecas) }))}
            />

            <SeletorDePeca
                tipos={catalogo.pecas_do_rodape}
                aoEscolher={(tipo) => aoMudar((c) => ({ ...c, pecas: [...c.pecas, novaPeca(tipo)] }))}
            />
        </div>
    )
}

/* ==========================================================================
   A lista de peças de UM lugar (uma área do topo, uma coluna, a barra) — a
   mesma lista serve os três porque a peça é a mesma ideia em qualquer um
   deles. O que pode ENTRAR ali (`tiposPermitidos`) é assunto de quem chama —
   vai para o `SeletorDePeca` ao lado, não para esta lista, que só desenha o
   que já está dentro.
   ========================================================================== */

function ListaDePecas({
    pecas,
    catalogo,
    aoMudar,
}: {
    pecas: PecaDaMoldura[]
    catalogo: CatalogoDaMoldura
    aoMudar: (mudar: (lista: PecaDaMoldura[]) => PecaDaMoldura[]) => void
}) {

    if (pecas.length === 0) {
        return <p className="mb-2 text-xs text-[var(--ink-3)]">Vazio.</p>
    }

    return (
        <ul className="mb-2 space-y-2">
            {pecas.map((peca, indice) => (
                <li key={peca.id} className="rounded-md border border-[var(--linha-suave)] bg-[var(--superficie-2)] p-2">
                    <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--ink)]">
                            {NOME_DA_PECA[peca.tipo] ?? peca.tipo}
                        </span>

                        <span className="flex shrink-0 items-center">
                            <button
                                type="button"
                                aria-label="Subir"
                                disabled={indice === 0}
                                onClick={() => aoMudar((lista) => mover(lista, indice, -1))}
                                className="p-1 text-[var(--ink-2)] hover:text-[var(--ink)] disabled:opacity-30"
                            >
                                <FiArrowUp className="w-3.5" aria-hidden />
                            </button>
                            <button
                                type="button"
                                aria-label="Descer"
                                disabled={indice === pecas.length - 1}
                                onClick={() => aoMudar((lista) => mover(lista, indice, 1))}
                                className="p-1 text-[var(--ink-2)] hover:text-[var(--ink)] disabled:opacity-30"
                            >
                                <FiArrowDown className="w-3.5" aria-hidden />
                            </button>
                            <button
                                type="button"
                                aria-label={`Tirar ${NOME_DA_PECA[peca.tipo] ?? peca.tipo}`}
                                onClick={() => aoMudar((lista) => remover(lista, indice))}
                                className="p-1 text-[var(--ink-3)] hover:text-[var(--vermelho)]"
                            >
                                <FiTrash2 className="w-3.5" aria-hidden />
                            </button>
                        </span>
                    </div>

                    <CampoDaPeca
                        peca={peca}
                        catalogo={catalogo}
                        aoMudar={(mudanca) => aoMudar((lista) => lista.map((p, i) => (i === indice ? { ...p, ...mudanca } : p)))}
                    />
                </li>
            ))}
        </ul>
    )
}

/** Os campos de UMA peça — variam conforme o tipo (ver limparPeca no Go). */
function CampoDaPeca({
    peca,
    catalogo,
    aoMudar,
}: {
    peca: PecaDaMoldura
    catalogo: CatalogoDaMoldura
    aoMudar: (mudanca: Partial<PecaDaMoldura>) => void
}) {

    const temTexto = peca.tipo === "texto" || peca.tipo === "selo" || peca.tipo === "link"
    const temLink = peca.tipo === "link"
    const temIcone = peca.tipo === "texto" || peca.tipo === "selo" || peca.tipo === "link"
    const temTamanho = peca.tipo === "marca" || peca.tipo === "busca"

    if (!temTexto && !temTamanho) {
        // Peça de sistema (sacola, conta, departamentos...): nada para
        // escrever, só onde ela aparece — ver o seletor de tela abaixo.
        return (
            <div className="mt-2">
                <SeletorDeAparicao peca={peca} catalogo={catalogo} aoMudar={aoMudar} />
            </div>
        )
    }

    return (
        <div className="mt-2 space-y-2">
            {temIcone && (
                <select
                    className="field text-xs"
                    value={peca.icone ?? "estrela"}
                    onChange={(e) => aoMudar({ icone: e.target.value })}
                >
                    {ICONES.map((icone) => (
                        <option key={icone.chave} value={icone.chave}>{icone.nome}</option>
                    ))}
                </select>
            )}

            {temTexto && (
                <input
                    className="field text-xs"
                    placeholder="Texto"
                    maxLength={80}
                    value={peca.texto ?? ""}
                    onChange={(e) => aoMudar({ texto: e.target.value })}
                />
            )}

            {temLink && (
                <input
                    className="field text-xs"
                    placeholder="/pagina-ou-https://..."
                    maxLength={300}
                    value={peca.link ?? ""}
                    onChange={(e) => aoMudar({ link: e.target.value })}
                />
            )}

            {temTamanho && (
                <select
                    className="field text-xs"
                    value={peca.tamanho ?? "normal"}
                    onChange={(e) => aoMudar({ tamanho: e.target.value })}
                >
                    {catalogo.tamanhos.map((tamanho) => (
                        <option key={tamanho} value={tamanho}>{tamanho === "grande" ? "Grande" : "Normal"}</option>
                    ))}
                </select>
            )}

            <SeletorDeAparicao peca={peca} catalogo={catalogo} aoMudar={aoMudar} />
        </div>
    )
}

function SeletorDeAparicao({
    peca,
    catalogo,
    aoMudar,
}: {
    peca: PecaDaMoldura
    catalogo: CatalogoDaMoldura
    aoMudar: (mudanca: Partial<PecaDaMoldura>) => void
}) {
    return (
        <select
            className="field text-xs"
            value={peca.aparicao ?? "sempre"}
            onChange={(e) => aoMudar({ aparicao: e.target.value })}
        >
            {catalogo.aparicoes.map((aparicao) => (
                <option key={aparicao} value={aparicao}>{NOME_DA_APARICAO[aparicao] ?? aparicao}</option>
            ))}
        </select>
    )
}

/** "+ peça aqui", filtrado pelo que cabe naquele lugar. */
function SeletorDePeca({ tipos, aoEscolher }: { tipos: string[]; aoEscolher: (tipo: string) => void }) {
    return (
        <select
            className="field cursor-pointer py-1 text-xs"
            value=""
            onChange={(e) => {
                if (e.target.value) aoEscolher(e.target.value)
                e.target.value = ""
            }}
        >
            <option value="">+ peça aqui</option>
            {tipos.map((tipo) => (
                <option key={tipo} value={tipo}>{NOME_DA_PECA[tipo] ?? tipo}</option>
            ))}
        </select>
    )
}

/** O liga-desliga — mesmo desenho de app/page/config/page.tsx. */
function Chave({ ligada, aoMudar, rotulo }: { ligada: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={ligada}
            aria-label={rotulo}
            onClick={() => aoMudar(!ligada)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                ligada ? "bg-[var(--azul)]" : "bg-[var(--ink-4)]"
            }`}
        >
            <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--superficie)] shadow-sm transition-[left] ${
                    ligada ? "left-[1.375rem]" : "left-0.5"
                }`}
            />
        </button>
    )
}
