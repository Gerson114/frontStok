"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import {
    LADOS,
    TIPOS_ENDERECO,
    bloquearEndereco,
    criarEndereco,
    listarEnderecos,
    montarEstrutura,
    quantidadeDaEstrutura,
    type EnderecoEstoque,
    type LadoDaPrateleira,
    type TipoEndereco,
} from "@/middleware/estoque"
import { ApiError } from "@/middleware/client"
import Pagination from "@/app/components/pagination/pagination"
import Cabecalho from "@/app/components/grade/cabecalho"
import Barcode from "@/app/components/barcode/barcode"
import {
    FiAlertCircle,
    FiCheckCircle,
    FiGrid,
    FiLock,
    FiMapPin,
    FiPlus,
    FiPrinter,
    FiSearch,
    FiSlash,
    FiUnlock,
    FiX,
} from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"

/**
 * Os endereços do estoque como grade de operação, no padrão de um WMS (a
 * referência é o Senior WMS, a mesma de Produtos e Estoque): uma linha por
 * lugar, colunas fixas, densidade alta e a ação ao alcance do olho.
 *
 * O assunto já esteve partido em duas telas — "Endereços" cadastrava um a um
 * e "Configuração" criava em lote e imprimia as placas —, e as duas listavam
 * o mesmo cadastro. Aqui ele tem um lugar só, e a grade é o centro dela: o
 * cadastro é um painel que abre por cima, e a placa é ação em lote sobre as
 * linhas marcadas, que é como um WMS trata impressão de etiqueta.
 *
 * O que a grade assume:
 *
 *   - as colunas na ordem em que a pergunta é feita — que endereço é, onde
 *     fica, para que serve, quanto já tem dentro, se aceita movimentação;
 *   - o código em fonte de largura fixa e a ocupação à direita, para a coluna
 *     ser lida de cima a baixo sem o olho procurar o número;
 *   - ordenação por código como padrão, que é a ordem em que se anda pelo
 *     corredor;
 *   - o recorte como faixa de filtros com a contagem de cada um: "cheios" e
 *     "bloqueados" são as duas perguntas que se faz antes de guardar carga;
 *   - contagem no rodapé colado na tabela, e não solto na página.
 */

/** Quantas linhas por página. A grade é para varrer, não para rolar sem fim. */
const POR_PAGINA = 25

type Coluna = "codigo" | "local" | "tipo" | "ocupacao" | "situacao"

type Recorte = "todos" | "vazios" | "cheios" | "bloqueados"

const COR_DO_TIPO: Record<TipoEndereco, string> = {
    picking: "tag-success",
    pulmao: "tag-info",
    recebimento: "tag-info",
    expedicao: "tag-info",
    quarentena: "tag-neutral",
    avaria: "tag-neutral",
}

/** Quantas placas por folha. Prateleira alta pede placa grande. */
const TAMANHOS = [
    { chave: 1, nome: "Grande (1 por folha)", classe: "print:grid-cols-1", altura: "print:h-[24cm]", codigo: "text-7xl", barras: "max-w-md" },
    { chave: 2, nome: "Média (2 por folha)", classe: "print:grid-cols-1", altura: "print:h-[13cm]", codigo: "text-6xl", barras: "max-w-sm" },
    { chave: 4, nome: "Pequena (4 por folha)", classe: "print:grid-cols-2", altura: "print:h-[13cm]", codigo: "text-4xl", barras: "max-w-[14rem]" },
] as const

type Tamanho = (typeof TAMANHOS)[number]

/** Endereço com capacidade declarada e já no limite dela. */
function estaCheio(endereco: EnderecoEstoque): boolean {
    return endereco.capacidade > 0 && endereco.ocupacao >= endereco.capacidade
}

function corDaOcupacao(percentual: number): string {
    if (percentual >= 100) return "bg-[#8E1F0B]"
    if (percentual >= 80) return "bg-[#C7920A]"
    return "bg-[#0C5132]"
}

export default function EnderecosPage() {

    const [enderecos, setEnderecos] = useState<EnderecoEstoque[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    // O recorte, a busca e a ordem: os três jeitos de estreitar a grade.
    const [recorte, setRecorte] = useState<Recorte>("todos")
    const [busca, setBusca] = useState("")
    const [filtroTipo, setFiltroTipo] = useState<TipoEndereco | "">("")
    const [ordem, setOrdem] = useState<{ coluna: Coluna; desc: boolean }>({ coluna: "codigo", desc: false })
    const [paginaAtual, setPaginaAtual] = useState(1)

    // O cadastro abre por cima da grade, um painel de cada vez.
    const [painel, setPainel] = useState<"nenhum" | "lote" | "um">("nenhum")

    // A placa é ação em lote sobre o que está marcado.
    const [selecionados, setSelecionados] = useState<number[]>([])
    const [tamanho, setTamanho] = useState<Tamanho>(TAMANHOS[1])

    // O bloqueio pede um motivo, escrito na própria linha: a janelinha do
    // navegador tirava a pessoa da grade para perguntar isso.
    const [bloqueando, setBloqueando] = useState<number | null>(null)
    const [motivo, setMotivo] = useState("")
    const [salvandoBloqueio, setSalvandoBloqueio] = useState(false)

    const carregar = useCallback(async () => {
        try {
            setEnderecos(await listarEnderecos())
            setErro("")
        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os endereços.")
        } finally {
            setCarregando(false)
        }
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()
    }, [carregar])

    // ==========================
    // RESUMO
    // ==========================

    const totalRuas = new Set(enderecos.map((endereco) => endereco.rua)).size
    const totalPecas = enderecos.reduce((soma, endereco) => soma + endereco.ocupacao, 0)
    const totalCheios = enderecos.filter(estaCheio).length
    const totalBloqueados = enderecos.filter((endereco) => endereco.bloqueado).length

    /** Os recortes da barra de filtro, já com a contagem de cada um. */
    const filtros: { chave: Recorte; nome: string; total: number }[] = [
        { chave: "todos", nome: "Todos", total: enderecos.length },
        { chave: "vazios", nome: "Vazios", total: enderecos.filter((e) => e.ocupacao === 0).length },
        { chave: "cheios", nome: "Cheios", total: totalCheios },
        { chave: "bloqueados", nome: "Bloqueados", total: totalBloqueados },
    ]

    // ==========================
    // FILTRO E ORDEM
    // ==========================

    const filtrados = useMemo(() => {

        const termo = busca.trim().toLowerCase()

        return enderecos.filter((endereco) => {

            if (filtroTipo && endereco.tipo !== filtroTipo) return false

            if (recorte === "vazios" && endereco.ocupacao !== 0) return false
            if (recorte === "cheios" && !estaCheio(endereco)) return false
            if (recorte === "bloqueados" && !endereco.bloqueado) return false

            if (!termo) return true

            return [endereco.codigo, endereco.nome, endereco.zona, endereco.descricao]
                .filter(Boolean)
                .some((campo) => String(campo).toLowerCase().includes(termo))
        })

    }, [enderecos, busca, filtroTipo, recorte])

    const ordenados = useMemo(() => {

        const lista = [...filtrados]
        const sinal = ordem.desc ? -1 : 1

        lista.sort((a, b) => {
            switch (ordem.coluna) {
                case "local":
                    return sinal * `${a.zona ?? ""} ${a.nome}`.localeCompare(`${b.zona ?? ""} ${b.nome}`)
                case "tipo":
                    return sinal * a.tipo_nome.localeCompare(b.tipo_nome)
                case "ocupacao":
                    return sinal * (a.ocupacao - b.ocupacao)
                case "situacao":
                    return sinal * (Number(a.bloqueado) - Number(b.bloqueado) || Number(estaCheio(a)) - Number(estaCheio(b)))
                default:
                    return sinal * a.codigo.localeCompare(b.codigo, undefined, { numeric: true })
            }
        })

        return lista

    }, [filtrados, ordem])

    const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA))
    const paginaCorrigida = Math.min(paginaAtual, totalPaginas)
    const primeiraDaPagina = (paginaCorrigida - 1) * POR_PAGINA
    const daPagina = ordenados.slice(primeiraDaPagina, primeiraDaPagina + POR_PAGINA)

    function ordenarPor(coluna: Coluna) {
        setOrdem((atual) => ({ coluna, desc: atual.coluna === coluna ? !atual.desc : false }))
    }

    function aoMudarBusca(texto: string) {
        setBusca(texto)
        setPaginaAtual(1)
    }

    function aoMudarRecorte(escolhido: Recorte) {
        setRecorte(escolhido)
        setPaginaAtual(1)
    }

    function aoMudarTipo(escolhido: TipoEndereco | "") {
        setFiltroTipo(escolhido)
        setPaginaAtual(1)
    }

    // ==========================
    // SELEÇÃO PARA A PLACA
    // ==========================

    const idsDaPagina = daPagina.map((endereco) => endereco.id)
    const paginaToda = idsDaPagina.length > 0 && idsDaPagina.every((id) => selecionados.includes(id))

    function alternarLinha(id: number) {
        setSelecionados((atual) =>
            atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]
        )
    }

    function alternarPagina() {
        setSelecionados((atual) =>
            paginaToda
                ? atual.filter((id) => !idsDaPagina.includes(id))
                : Array.from(new Set([...atual, ...idsDaPagina]))
        )
    }

    const paraImprimir = enderecos.filter((endereco) => selecionados.includes(endereco.id))

    // ==========================
    // BLOQUEIO
    // ==========================

    async function liberar(endereco: EnderecoEstoque) {
        setErro("")

        try {
            await bloquearEndereco(endereco.id, false, "")
            setAviso(`${endereco.codigo} liberado.`)
            await carregar()
        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível liberar o endereço.")
        }
    }

    async function confirmarBloqueio(endereco: EnderecoEstoque) {
        setErro("")

        try {
            setSalvandoBloqueio(true)
            await bloquearEndereco(endereco.id, true, motivo.trim())
            setAviso(`${endereco.codigo} bloqueado.`)
            setBloqueando(null)
            setMotivo("")
            await carregar()
        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível bloquear o endereço.")
        } finally {
            setSalvandoBloqueio(false)
        }
    }

    return (
        <>
        <Pagina
            titulo="Endereços"
            descricao="Para que serve cada lugar, quanto cabe nele e se aceita movimentação agora. É por este cadastro que o sistema decide sozinho onde guardar o que entra — e é a placa impressa daqui que diz isso a quem está no corredor."
            paraImpressao
            acoes={
                <>
                    <button
                        type="button"
                        onClick={() => setPainel((atual) => (atual === "um" ? "nenhum" : "um"))}
                        aria-pressed={painel === "um"}
                        className="btn btn-neutro"
                    >
                        <FiPlus className="w-4" aria-hidden />
                        <span>Novo endereço</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setPainel((atual) => (atual === "lote" ? "nenhum" : "lote"))}
                        aria-pressed={painel === "lote"}
                        className="btn btn-primario"
                    >
                        <FiGrid className="w-4" aria-hidden />
                        <span>Montar estrutura</span>
                    </button>
                </>
            }
        >

            {erro && (
                <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aviso && (
                <div role="status" className="mb-4 flex items-start gap-2.5 rounded-lg bg-[#CDFEE1] px-4 py-3 text-sm font-semibold text-[#0C5132]">
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{aviso}</span>
                </div>
            )}

            {/* ==========================
                RESUMO
                Faixa fina, e não quatro cartões grandes: o número
                interessa de relance, no caminho para a grade.
            ========================== */}

            <div className="card grid grid-cols-2 divide-[#EBEBEB] md:grid-cols-4 md:divide-x">

                <Indicador
                    icone={<FiMapPin className="w-4" aria-hidden />}
                    cor="bg-[#EAF4FF] text-[#005BD3]"
                    rotulo="Endereços"
                    valor={enderecos.length}
                    borda
                />

                <Indicador
                    icone={<FiGrid className="w-4" aria-hidden />}
                    cor="bg-[#EAF4FF] text-[#005BD3]"
                    rotulo="Ruas"
                    valor={totalRuas}
                    borda
                />

                <Indicador
                    icone={<FiCheckCircle className="w-4" aria-hidden />}
                    cor={totalCheios > 0 ? "bg-[#FFF1E3] text-[#5E4200]" : "bg-[#F1F1F1] text-[#616161]"}
                    rotulo="Cheios"
                    valor={totalCheios}
                    destaque={totalCheios > 0 ? "text-[#5E4200]" : ""}
                />

                <Indicador
                    icone={<FiLock className="w-4" aria-hidden />}
                    cor={totalBloqueados > 0 ? "bg-[#FEE9E8] text-[#8E1F0B]" : "bg-[#F1F1F1] text-[#616161]"}
                    rotulo="Bloqueados"
                    valor={totalBloqueados}
                    destaque={totalBloqueados > 0 ? "text-[#8E1F0B]" : ""}
                />

            </div>

            <p className="mt-2 text-xs text-[#616161]">
                <span className="num font-bold text-[#303030]">{totalPecas}</span> peça(s)
                guardada(s) nestes endereços.
            </p>

            {/* ==========================
                CADASTRO
                Painel por cima da grade: cadastrar é o que se faz
                de vez em quando, e a grade é o que se olha sempre.
            ========================== */}

            {painel === "lote" && (
                <FormularioEstrutura
                    aoFechar={() => setPainel("nenhum")}
                    aoMudar={carregar}
                    avisar={setAviso}
                    falhar={setErro}
                />
            )}

            {painel === "um" && (
                <FormularioAvulso
                    aoFechar={() => setPainel("nenhum")}
                    aoMudar={carregar}
                    avisar={setAviso}
                    falhar={setErro}
                />
            )}

            {/* ==========================
                BARRA DA GRADE
            ========================== */}

            <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">

                    {filtros.map(({ chave, nome, total }) => {

                        const ativo = chave === recorte

                        return (
                            <button
                                key={chave}
                                type="button"
                                aria-pressed={ativo}
                                onClick={() => aoMudarRecorte(chave)}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors ${
                                    ativo
                                        ? "border-[#005BD3] bg-[#EAF4FF] text-[#00369B]"
                                        : "border-[#E1E1E1] bg-white text-[#616161] hover:border-[#8A8A8A] hover:text-[#303030]"
                                }`}
                            >
                                {nome}

                                <span className={`num text-xs font-extrabold ${ativo ? "text-[#005BD3]" : "text-[#8A8A8A]"}`}>
                                    {total}
                                </span>
                            </button>
                        )
                    })}

                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">

                    <select
                        value={filtroTipo}
                        onChange={(e) => aoMudarTipo(e.target.value as TipoEndereco | "")}
                        aria-label="Filtrar por tipo de endereço"
                        className="field cursor-pointer sm:w-52"
                    >
                        <option value="">Todos os tipos</option>
                        {TIPOS_ENDERECO.map((item) => (
                            <option key={item.chave} value={item.chave}>{item.nome}</option>
                        ))}
                    </select>

                    <div className="relative w-full lg:w-80">

                        <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8A8A8A]" aria-hidden />

                        <input
                            type="text"
                            value={busca}
                            onChange={(e) => aoMudarBusca(e.target.value)}
                            placeholder="Buscar por código, zona ou descrição"
                            className="field"
                            style={{ paddingLeft: "2.25rem", paddingRight: busca ? "2.25rem" : undefined }}
                        />

                        {busca && (
                            <button
                                type="button"
                                onClick={() => aoMudarBusca("")}
                                aria-label="Limpar busca"
                                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#616161] transition-colors hover:bg-[#F1F1F1]"
                            >
                                <FiX className="w-4" aria-hidden />
                            </button>
                        )}

                    </div>

                </div>

            </div>

            {/* ==========================
                AÇÃO EM LOTE
                Só aparece quando há linha marcada: barra de ação
                vazia é barra que ocupa espaço sem responder nada.
            ========================== */}

            {selecionados.length > 0 && (

                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#005BD3] bg-[#EAF4FF] px-4 py-2.5">

                    <p className="text-sm font-bold text-[#00369B]">
                        <span className="num">{selecionados.length}</span> endereço(s) marcado(s)
                    </p>

                    <span className="hidden h-5 w-px bg-[#CDE3FF] sm:block" />

                    <select
                        value={tamanho.chave}
                        onChange={(e) => {
                            const escolhido = TAMANHOS.find((item) => item.chave === Number(e.target.value))
                            if (escolhido) setTamanho(escolhido)
                        }}
                        aria-label="Tamanho da placa"
                        className="field w-auto cursor-pointer py-1.5 text-sm"
                    >
                        {TAMANHOS.map((item) => (
                            <option key={item.chave} value={item.chave}>{item.nome}</option>
                        ))}
                    </select>

                    <button type="button" onClick={() => window.print()} className="btn btn-primario text-sm">
                        <FiPrinter className="w-4" aria-hidden />
                        <span>Imprimir placas</span>
                    </button>

                    <button type="button" onClick={() => setSelecionados([])} className="btn btn-neutro text-sm">
                        Limpar marcação
                    </button>

                </div>

            )}

            {/* ==========================
                A GRADE
            ========================== */}

            {carregando ? (

                <p className="mt-6 text-[#616161]">Carregando endereços...</p>

            ) : ordenados.length === 0 ? (

                <div className="mt-6 rounded-lg border border-dashed border-[#E1E1E1] bg-white p-16 text-center">

                    <FiMapPin className="mx-auto w-10 text-[#8A8A8A]" aria-hidden />

                    <h3 className="font-display mt-5 text-xl text-[#303030]">
                        {enderecos.length === 0 ? "Seu estoque ainda não tem endereços" : "Nenhum endereço encontrado"}
                    </h3>

                    <p className="mx-auto mt-2 max-w-md text-sm text-[#616161]">
                        {enderecos.length === 0
                            ? "Diga quantas ruas, blocos e andares ele tem e o sistema cria as prateleiras todas de uma vez. Depois é só imprimir as placas e colar."
                            : "Nenhum endereço corresponde ao filtro ou à busca."}
                    </p>

                    {enderecos.length === 0 ? (

                        <button type="button" onClick={() => setPainel("lote")} className="btn btn-primario mt-6">
                            <FiGrid className="w-4" aria-hidden />
                            <span>Montar estrutura</span>
                        </button>

                    ) : (

                        <button
                            type="button"
                            onClick={() => { aoMudarBusca(""); aoMudarRecorte("todos"); aoMudarTipo("") }}
                            className="btn btn-neutro mt-6"
                        >
                            Limpar filtros
                        </button>

                    )}

                </div>

            ) : (

                <div className="card mt-6 overflow-hidden">

                    {/* Em tela estreita a grade rola no eixo X em
                        vez de virar cartão: coluna que muda de
                        lugar conforme a largura é coluna que
                        ninguém aprende onde fica. */}
                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[56rem] border-collapse text-sm">

                            <thead>
                                <tr className="border-b border-[#E1E1E1] bg-[#F7F7F7] text-left">

                                    <th scope="col" className="w-10 px-4 py-2.5">
                                        <input
                                            type="checkbox"
                                            checked={paginaToda}
                                            onChange={alternarPagina}
                                            aria-label="Marcar os endereços desta página"
                                            className="h-4 w-4 cursor-pointer accent-[#005BD3]"
                                        />
                                    </th>

                                    <th scope="col" className="px-4 py-2.5">
                                        <Cabecalho ativa={ordem.coluna === "codigo"} desc={ordem.desc} aoClicar={() => ordenarPor("codigo")}>
                                            Endereço
                                        </Cabecalho>
                                    </th>

                                    <th scope="col" className="px-4 py-2.5">
                                        <Cabecalho ativa={ordem.coluna === "local"} desc={ordem.desc} aoClicar={() => ordenarPor("local")}>
                                            Onde fica
                                        </Cabecalho>
                                    </th>

                                    <th scope="col" className="px-4 py-2.5">
                                        <Cabecalho ativa={ordem.coluna === "tipo"} desc={ordem.desc} aoClicar={() => ordenarPor("tipo")}>
                                            Serve para
                                        </Cabecalho>
                                    </th>

                                    <th scope="col" className="px-4 py-2.5">
                                        <Cabecalho ativa={ordem.coluna === "ocupacao"} desc={ordem.desc} aoClicar={() => ordenarPor("ocupacao")} direita>
                                            Ocupação
                                        </Cabecalho>
                                    </th>

                                    <th scope="col" className="px-4 py-2.5">
                                        <Cabecalho ativa={ordem.coluna === "situacao"} desc={ordem.desc} aoClicar={() => ordenarPor("situacao")}>
                                            Situação
                                        </Cabecalho>
                                    </th>

                                    <th scope="col" className="px-4 py-2.5 text-right text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#616161]">
                                        Ações
                                    </th>

                                </tr>
                            </thead>

                            <tbody>

                                {daPagina.map((endereco) => {

                                    const marcado = selecionados.includes(endereco.id)
                                    const cheio = estaCheio(endereco)

                                    return (

                                        <Fragment key={endereco.id}>

                                            <tr className={`border-b border-[#EBEBEB] transition-colors hover:bg-[#F7F7F7] ${marcado ? "bg-[#EAF4FF]" : ""}`}>

                                                {/* MARCAÇÃO */}
                                                <td className="px-4 py-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={marcado}
                                                        onChange={() => alternarLinha(endereco.id)}
                                                        aria-label={`Marcar ${endereco.codigo}`}
                                                        className="h-4 w-4 cursor-pointer accent-[#005BD3]"
                                                    />
                                                </td>

                                                {/* ENDEREÇO */}
                                                <td className="px-4 py-2.5">
                                                    <span className="num font-bold text-[#303030]">{endereco.codigo}</span>
                                                    {endereco.descricao && (
                                                        <span className="block max-w-[16rem] truncate text-xs text-[#8A8A8A]">
                                                            {endereco.descricao}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* ONDE FICA */}
                                                <td className="px-4 py-2.5">
                                                    <span className="block text-[#303030]">{endereco.nome}</span>
                                                    <span className="block text-xs text-[#8A8A8A]">
                                                        {endereco.zona || "Sem zona"}
                                                    </span>
                                                </td>

                                                {/* SERVE PARA */}
                                                <td className="px-4 py-2.5">
                                                    <span className={`tag ${COR_DO_TIPO[endereco.tipo] ?? "tag-neutral"}`}>
                                                        {endereco.tipo_nome}
                                                    </span>
                                                </td>

                                                {/* OCUPAÇÃO */}
                                                <td className="px-4 py-2.5 text-right">

                                                    <span className="num font-bold text-[#303030]">
                                                        {endereco.ocupacao}
                                                        <span className="font-normal text-[#8A8A8A]">
                                                            {endereco.capacidade > 0 ? ` / ${endereco.capacidade}` : " / —"}
                                                        </span>
                                                    </span>

                                                    {typeof endereco.ocupacao_percentual === "number" && (
                                                        <span className="ml-auto mt-1 block h-1.5 w-24 overflow-hidden rounded-full bg-[#EBEBEB]">
                                                            <span
                                                                className={`block h-full ${corDaOcupacao(endereco.ocupacao_percentual)}`}
                                                                style={{ width: `${Math.min(endereco.ocupacao_percentual, 100)}%` }}
                                                            />
                                                        </span>
                                                    )}

                                                </td>

                                                {/* SITUAÇÃO */}
                                                <td className="px-4 py-2.5">

                                                    {endereco.bloqueado ? (
                                                        <span className="tag tag-danger">
                                                            <FiLock className="w-3" aria-hidden />
                                                            Bloqueado
                                                        </span>
                                                    ) : cheio ? (
                                                        <span className="tag tag-warning">Cheio</span>
                                                    ) : (
                                                        <span className="tag tag-success">Liberado</span>
                                                    )}

                                                    {endereco.bloqueado && endereco.motivo_bloqueio && (
                                                        <span className="mt-1 block max-w-[14rem] truncate text-xs text-[#8E1F0B]">
                                                            {endereco.motivo_bloqueio}
                                                        </span>
                                                    )}

                                                </td>

                                                {/* AÇÕES */}
                                                <td className="px-4 py-2.5">

                                                    <div className="flex items-center justify-end gap-1">

                                                        {endereco.bloqueado ? (

                                                            <button
                                                                type="button"
                                                                onClick={() => liberar(endereco)}
                                                                title="Liberar endereço"
                                                                aria-label={`Liberar ${endereco.codigo}`}
                                                                className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E1E1E1] text-[#0C5132] transition-colors hover:border-[#0C5132] hover:bg-[#CDFEE1]"
                                                            >
                                                                <FiUnlock className="w-4" aria-hidden />
                                                            </button>

                                                        ) : (

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setBloqueando(bloqueando === endereco.id ? null : endereco.id)
                                                                    setMotivo("")
                                                                }}
                                                                title="Bloquear endereço"
                                                                aria-label={`Bloquear ${endereco.codigo}`}
                                                                className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E1E1E1] text-[#616161] transition-colors hover:border-[#8E1F0B] hover:bg-[#FEE9E8] hover:text-[#8E1F0B]"
                                                            >
                                                                <FiSlash className="w-4" aria-hidden />
                                                            </button>

                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => alternarLinha(endereco.id)}
                                                            title="Marcar para imprimir a placa"
                                                            aria-label={`Marcar a placa de ${endereco.codigo}`}
                                                            className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                                                                marcado
                                                                    ? "border-[#005BD3] bg-[#EAF4FF] text-[#00369B]"
                                                                    : "border-[#E1E1E1] text-[#616161] hover:border-[#005BD3] hover:bg-[#EAF4FF] hover:text-[#00369B]"
                                                            }`}
                                                        >
                                                            <FiPrinter className="w-4" aria-hidden />
                                                        </button>

                                                    </div>

                                                </td>

                                            </tr>

                                            {bloqueando === endereco.id && !endereco.bloqueado && (

                                                <tr className="border-b border-[#EBEBEB] bg-[#F7F7F7]">

                                                    <td colSpan={7} className="px-4 py-3">

                                                        <div className="flex flex-wrap items-end gap-2">

                                                            <div className="min-w-[16rem] flex-1 space-y-1.5">
                                                                <label className="rotulo" htmlFor={`motivo-${endereco.id}`}>
                                                                    Por que <span className="num">{endereco.codigo}</span> está sendo bloqueado?
                                                                </label>
                                                                <input
                                                                    id={`motivo-${endereco.id}`}
                                                                    type="text"
                                                                    value={motivo}
                                                                    onChange={(e) => setMotivo(e.target.value)}
                                                                    placeholder="Ex: contagem em andamento"
                                                                    className="field"
                                                                    autoFocus
                                                                />
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => confirmarBloqueio(endereco)}
                                                                disabled={salvandoBloqueio}
                                                                className="btn btn-primario text-sm"
                                                            >
                                                                {salvandoBloqueio ? "Bloqueando..." : "Bloquear"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => setBloqueando(null)}
                                                                className="btn btn-neutro text-sm"
                                                            >
                                                                Cancelar
                                                            </button>

                                                        </div>

                                                    </td>

                                                </tr>

                                            )}

                                        </Fragment>
                                    )
                                })}

                            </tbody>

                        </table>

                    </div>

                    {/* RODAPÉ DA GRADE — a contagem fica colada
                        nela e não solta no meio da página. */}
                    <div className="flex flex-col gap-3 border-t border-[#E1E1E1] bg-[#F7F7F7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

                        <p className="text-xs text-[#616161]">
                            Mostrando{" "}
                            <span className="num font-bold text-[#303030]">
                                {primeiraDaPagina + 1}–{primeiraDaPagina + daPagina.length}
                            </span>{" "}
                            de <span className="num font-bold text-[#303030]">{ordenados.length}</span>
                            {ordenados.length !== enderecos.length && (
                                <> · <span className="num">{enderecos.length}</span> no total</>
                            )}
                        </p>

                        <Pagination
                            paginaAtual={paginaCorrigida}
                            totalPaginas={totalPaginas}
                            aoMudarPagina={setPaginaAtual}
                        />

                    </div>

                </div>

            )}

        </Pagina>

            {/* ==========================
                O QUE VAI PARA O PAPEL
                A placa colada na prateleira: código em letra grande, endereço
                falado e código de barras — o leitor entende a placa como
                entende a etiqueta do produto.
            ========================== */}

            <div className={`hidden print:grid ${tamanho.classe}`}>

                {paraImprimir.map((endereco) => (

                    <div
                        key={endereco.id}
                        className={`flex ${tamanho.altura} break-inside-avoid flex-col items-center justify-center border-4 border-black p-6 text-center`}
                    >

                        <p className={`num font-extrabold leading-none tracking-tight text-black ${tamanho.codigo}`}>
                            {endereco.codigo}
                        </p>

                        <p className="mt-4 text-lg font-bold uppercase tracking-wide text-black">
                            {endereco.nome}
                        </p>

                        <p className="mt-1 text-sm uppercase tracking-widest text-black">
                            {endereco.tipo_nome}
                            {endereco.zona ? ` · ${endereco.zona}` : ""}
                        </p>

                        <div className="mt-5 flex justify-center">
                            <Barcode valor={endereco.codigo} className={`w-full ${tamanho.barras}`} />
                        </div>

                    </div>

                ))}

            </div>
        </>
    )
}

/** Um número da faixa de resumo. */
function Indicador({
    icone,
    cor,
    rotulo,
    valor,
    destaque = "",
    borda = false,
}: {
    icone: React.ReactNode
    cor: string
    rotulo: string
    valor: number
    destaque?: string
    borda?: boolean
}) {
    return (
        <div className={`flex items-center gap-3 p-4 ${borda ? "border-b border-[#EBEBEB] md:border-b-0" : ""}`}>

            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cor}`}>
                {icone}
            </span>

            <span className="min-w-0">
                <span className="block text-xs text-[#616161]">{rotulo}</span>
                <span className={`num block text-xl font-extrabold ${destaque || "text-[#303030]"}`}>{valor}</span>
            </span>

        </div>
    )
}

/**
 * Montar a estrutura de uma vez.
 *
 * Cadastrar prateleira a prateleira é o que faz o lojista desistir do
 * endereçamento no primeiro dia — cinco ruas com três blocos de quatro
 * andares e dois lados são 120 formulários. A estrutura de um estoque real é
 * regular, então ela se descreve por quantos de cada nível existem.
 */
function FormularioEstrutura({
    aoFechar,
    aoMudar,
    avisar,
    falhar,
}: {
    aoFechar: () => void
    aoMudar: () => Promise<void>
    avisar: (texto: string) => void
    falhar: (texto: string) => void
}) {

    const [ruaInicial, setRuaInicial] = useState("1")
    const [ruaFinal, setRuaFinal] = useState("3")
    const [blocos, setBlocos] = useState("2")
    const [andares, setAndares] = useState("3")
    const [lados, setLados] = useState<LadoDaPrateleira[]>(["A"])
    const [tipo, setTipo] = useState<TipoEndereco>("picking")
    const [capacidade, setCapacidade] = useState("")
    const [zona, setZona] = useState("")
    const [montando, setMontando] = useState(false)

    const estrutura = useMemo(() => ({
        rua_inicial: parseInt(ruaInicial, 10) || 0,
        rua_final: parseInt(ruaFinal, 10) || 0,
        blocos: parseInt(blocos, 10) || 0,
        andares: parseInt(andares, 10) || 0,
        lados,
        tipo,
        capacidade: parseInt(capacidade, 10) || 0,
        zona: zona.trim(),
    }), [ruaInicial, ruaFinal, blocos, andares, lados, tipo, capacidade, zona])

    const quantidade = quantidadeDaEstrutura(estrutura)

    function alternarLado(escolhido: LadoDaPrateleira) {
        setLados((atual) =>
            atual.includes(escolhido) ? atual.filter((item) => item !== escolhido) : [...atual, escolhido]
        )
    }

    async function montar() {

        falhar("")
        avisar("")
        setMontando(true)

        try {
            const resultado = await montarEstrutura(estrutura)

            avisar(
                resultado.quantidade > 0
                    ? `${resultado.quantidade} endereço(s) criado(s)${resultado.existentes > 0 ? `, ${resultado.existentes} já existiam` : ""}. Marque as linhas para imprimir as placas.`
                    : "Nada a criar: todos esses endereços já existem."
            )

            await aoMudar()

            if (resultado.quantidade > 0) aoFechar()

        } catch (e) {
            falhar(e instanceof ApiError ? e.message : "Não foi possível montar a estrutura.")
        } finally {
            setMontando(false)
        }
    }

    return (
        <Painel titulo="Montar a estrutura" aoFechar={aoFechar}>

            <p className="text-sm text-[#616161]">
                Diga quantos de cada nível o seu estoque tem. O endereço é{" "}
                <strong>rua · bloco · andar · lado</strong> — a loja pequena usa um bloco, um andar
                e o lado A, e cresce a estrutura quando o estoque crescer. Rodar de novo é seguro:
                o que já existe fica como está.
            </p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

                <Campo id="rua-inicial" rotulo="Da rua">
                    <input id="rua-inicial" type="number" min="1" value={ruaInicial}
                        onChange={(e) => setRuaInicial(e.target.value)} className="field num" />
                </Campo>

                <Campo id="rua-final" rotulo="Até a rua">
                    <input id="rua-final" type="number" min="1" value={ruaFinal}
                        onChange={(e) => setRuaFinal(e.target.value)} className="field num" />
                </Campo>

                <Campo id="blocos" rotulo="Blocos por rua">
                    <input id="blocos" type="number" min="1" value={blocos}
                        onChange={(e) => setBlocos(e.target.value)} className="field num" />
                </Campo>

                <Campo id="andares" rotulo="Andares por bloco">
                    <input id="andares" type="number" min="1" value={andares}
                        onChange={(e) => setAndares(e.target.value)} className="field num" />
                </Campo>

            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                <div className="space-y-1.5">
                    <span className="rotulo">Lados de cada andar</span>
                    <div className="flex gap-4 pt-1.5">
                        {LADOS.map((opcao) => (
                            <label key={opcao} className="flex cursor-pointer items-center gap-2 text-sm text-[#303030]">
                                <input
                                    type="checkbox"
                                    checked={lados.includes(opcao)}
                                    onChange={() => alternarLado(opcao)}
                                    className="h-4 w-4 cursor-pointer accent-[#005BD3]"
                                />
                                Lado {opcao}
                            </label>
                        ))}
                    </div>
                </div>

                <Campo id="tipo-lote" rotulo="Serve para">
                    <select
                        id="tipo-lote"
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value as TipoEndereco)}
                        className="field cursor-pointer"
                    >
                        {TIPOS_ENDERECO.map((item) => (
                            <option key={item.chave} value={item.chave}>{item.nome}</option>
                        ))}
                    </select>
                </Campo>

                <Campo id="capacidade-lote" rotulo="Capacidade de cada uma">
                    <input id="capacidade-lote" type="number" min="0" value={capacidade}
                        onChange={(e) => setCapacidade(e.target.value)}
                        placeholder="0 = sem limite" className="field num" />
                </Campo>

            </div>

            <Campo id="zona-lote" rotulo="Zona">
                <input id="zona-lote" type="text" value={zona}
                    onChange={(e) => setZona(e.target.value)}
                    placeholder="Ex: loja, depósito, mezanino" className="field" />
            </Campo>

            <p className="text-xs text-[#616161]">
                {TIPOS_ENDERECO.find((item) => item.chave === tipo)?.descricao}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F1F1F1] p-4">

                <p className="text-sm text-[#303030]">
                    Vai criar até <span className="num font-bold">{quantidade}</span> endereço(s).{" "}
                    <span className="text-[#616161]">Os que já existirem ficam como estão.</span>
                </p>

                <button type="button" onClick={montar} disabled={montando || quantidade === 0} className="btn btn-primario">
                    {montando ? "Criando..." : "Criar endereços"}
                </button>

            </div>

        </Painel>
    )
}

/**
 * Cadastrar um endereço só: o lugar que foge da grade — a doca, o canto da
 * avaria, uma prateleira solta.
 */
function FormularioAvulso({
    aoFechar,
    aoMudar,
    avisar,
    falhar,
}: {
    aoFechar: () => void
    aoMudar: () => Promise<void>
    avisar: (texto: string) => void
    falhar: (texto: string) => void
}) {

    const [rua, setRua] = useState("")
    const [bloco, setBloco] = useState("")
    const [andar, setAndar] = useState("")
    const [lado, setLado] = useState<LadoDaPrateleira>("A")
    const [tipo, setTipo] = useState<TipoEndereco>("picking")
    const [capacidade, setCapacidade] = useState("")
    const [zona, setZona] = useState("")
    const [descricao, setDescricao] = useState("")
    const [salvando, setSalvando] = useState(false)

    async function cadastrar(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault()

        falhar("")
        avisar("")

        const numeroRua = parseInt(rua, 10)

        if (!Number.isFinite(numeroRua) || numeroRua <= 0) {
            falhar("Informe o número da rua.")
            return
        }

        try {
            setSalvando(true)

            await criarEndereco({
                rua: numeroRua,
                bloco: parseInt(bloco, 10) || 1,
                andar: parseInt(andar, 10) || 1,
                lado,
                zona: zona.trim(),
                tipo,
                capacidade: parseInt(capacidade, 10) || 0,
                descricao: descricao.trim(),
            })

            avisar("Endereço cadastrado.")
            await aoMudar()
            aoFechar()

        } catch (e) {
            falhar(e instanceof ApiError ? e.message : "Não foi possível cadastrar o endereço.")
        } finally {
            setSalvando(false)
        }
    }

    return (
        <Painel titulo="Novo endereço" aoFechar={aoFechar}>

            <form onSubmit={cadastrar} className="space-y-5">

                <p className="text-sm text-[#616161]">
                    Só a rua é obrigatória — bloco e andar em branco valem 1 e o lado nasce no A. O
                    código sai daí pronto para a etiqueta (<span className="num">001.005.01.A</span>{" "}
                    é a rua 1, bloco 5, andar 1, lado A).
                </p>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

                    <Campo id="rua" rotulo="Rua">
                        <input id="rua" type="number" min="1" value={rua}
                            onChange={(e) => setRua(e.target.value)} className="field num" />
                    </Campo>

                    <Campo id="bloco" rotulo="Bloco">
                        <input id="bloco" type="number" min="1" value={bloco}
                            onChange={(e) => setBloco(e.target.value)} placeholder="1" className="field num" />
                    </Campo>

                    <Campo id="andar" rotulo="Andar">
                        <input id="andar" type="number" min="1" value={andar}
                            onChange={(e) => setAndar(e.target.value)} placeholder="1" className="field num" />
                    </Campo>

                    <Campo id="lado" rotulo="Lado">
                        <select
                            id="lado"
                            value={lado}
                            onChange={(e) => setLado(e.target.value as LadoDaPrateleira)}
                            className="field cursor-pointer"
                        >
                            {LADOS.map((opcao) => (
                                <option key={opcao} value={opcao}>Lado {opcao}</option>
                            ))}
                        </select>
                    </Campo>

                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                    <Campo id="tipo" rotulo="Serve para">
                        <select
                            id="tipo"
                            value={tipo}
                            onChange={(e) => setTipo(e.target.value as TipoEndereco)}
                            className="field cursor-pointer"
                        >
                            {TIPOS_ENDERECO.map((item) => (
                                <option key={item.chave} value={item.chave}>{item.nome}</option>
                            ))}
                        </select>
                    </Campo>

                    <Campo id="capacidade" rotulo="Capacidade">
                        <input id="capacidade" type="number" min="0" value={capacidade}
                            onChange={(e) => setCapacidade(e.target.value)}
                            placeholder="0 = sem limite" className="field num" />
                    </Campo>

                    <Campo id="zona" rotulo="Zona">
                        <input id="zona" type="text" value={zona}
                            onChange={(e) => setZona(e.target.value)}
                            placeholder="Ex: mezanino, fundo da loja" className="field" />
                    </Campo>

                    <Campo id="descricao" rotulo="Descrição">
                        <input id="descricao" type="text" value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            placeholder="Ex: prateleira do fundo, ao lado da porta" className="field" />
                    </Campo>

                </div>

                <p className="text-xs text-[#616161]">
                    {TIPOS_ENDERECO.find((item) => item.chave === tipo)?.descricao}
                </p>

                <button type="submit" disabled={salvando} className="btn btn-primario">
                    {salvando ? "Cadastrando..." : "Cadastrar endereço"}
                </button>

            </form>

        </Painel>
    )
}

/** A moldura dos painéis de cadastro, com o título e o X de fechar. */
function Painel({
    titulo,
    aoFechar,
    children,
}: {
    titulo: string
    aoFechar: () => void
    children: React.ReactNode
}) {
    return (
        <section className="card mt-6 space-y-5 p-5 sm:p-7">

            <div className="flex items-start justify-between gap-4">

                <h3 className="font-display text-base text-[#303030]">{titulo}</h3>

                <button
                    type="button"
                    onClick={aoFechar}
                    aria-label="Fechar"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[#616161] transition-colors hover:bg-[#F1F1F1]"
                >
                    <FiX className="w-4" aria-hidden />
                </button>

            </div>

            {children}

        </section>
    )
}

/** Rótulo e campo, que é o par que se repete em todo formulário do painel. */
function Campo({ id, rotulo, children }: { id: string; rotulo: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="rotulo" htmlFor={id}>{rotulo}</label>
            {children}
        </div>
    )
}
