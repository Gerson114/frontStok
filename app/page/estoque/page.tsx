"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto, Unidade } from "@/app/type/type"
import { listarProdutos, listarTodasUnidades, transferirUnidade, avariarUnidade, excluirUnidade, identificarPeca } from "@/middleware/produtos"
import { listarEnderecos, type EnderecoEstoque } from "@/middleware/estoque"
import { validarTransferencia } from "@/security/validate"
import { ApiError } from "@/middleware/client"
import Pagination from "@/app/components/pagination/pagination"
import {
    FiSearch,
    FiX,
    FiPlus,
    FiMapPin,
    FiBookmark,
    FiBox,
    FiGrid,
    FiLock,
    FiTrash2,
    FiAlertTriangle,
    FiRepeat,
} from "react-icons/fi"
import { urlDaImagem } from "@/security/imagem"

const ITENS_POR_PAGINA = 10

/** Como o servidor descreve a peça que ainda não foi guardada. */
const SEM_LUGAR = "sem lugar definido"

interface CartaoUnidade {
    unidade: Unidade
    produto: Produto | undefined
}

/**
 * Um lugar do estoque com o que está guardado nele.
 *
 * O cadastro (`endereco`) vem da tela de Endereços e traz tipo, capacidade e
 * a ordem em que se anda pelo estoque. Ele pode faltar quando a peça aponta
 * para um endereço que não existe mais — e aí o que sobra é o código escrito
 * na própria peça, que ainda diz onde ela está.
 */
interface Local {
    chave: string
    codigo: string
    nome: string
    endereco: EnderecoEstoque | undefined
    unidades: CartaoUnidade[]
}

interface TransferenciaAlvo {
    unidadeId: number
    produtoNome: string
    codigo: string
    enderecoAtual: string
    localAtual: string
}

interface AvariaAlvo {
    unidadeId: number
    produtoNome: string
    codigo: string
}

interface ExclusaoAlvo {
    unidadeId: number
    produtoNome: string
    codigo: string
}

/** A cor de cada tipo de lugar, para o card dizer o que ele é de longe. */
const CORES_TIPO: Record<string, string> = {
    picking: "bg-[#0086FF] text-white",
    pulmao: "bg-[#1E2428] text-white",
    recebimento: "bg-[#5A6469] text-white",
    expedicao: "bg-[#5A6469] text-white",
    quarentena: "bg-[#FFB800] text-[#1E2428]",
    avaria: "bg-[#D4351C] text-white",
}

export default function Estoque() {

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [unidades, setUnidades] = useState<Unidade[]>([])
    const [enderecos, setEnderecos] = useState<EnderecoEstoque[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    const [busca, setBusca] = useState("")
    const [paginaSemLocal, setPaginaSemLocal] = useState(1)
    const [paginaPorLocal, setPaginaPorLocal] = useState<Record<string, number>>({})

    const [alvo, setAlvo] = useState<TransferenciaAlvo | null>(null)
    const [destinoInput, setDestinoInput] = useState("")
    const [erroTransferencia, setErroTransferencia] = useState("")
    const [transferindo, setTransferindo] = useState(false)

    const [alvoAvaria, setAlvoAvaria] = useState<AvariaAlvo | null>(null)
    const [erroAvaria, setErroAvaria] = useState("")
    const [registrandoAvaria, setRegistrandoAvaria] = useState(false)

    const [alvoExclusao, setAlvoExclusao] = useState<ExclusaoAlvo | null>(null)
    const [erroExclusao, setErroExclusao] = useState("")
    const [excluindo, setExcluindo] = useState(false)

    async function carregar() {

        try {

            // Os endereços vêm junto porque é o cadastro deles que dá a
            // ordem do caminho, o tipo e a capacidade de cada lugar — a peça
            // sozinha só sabe o código onde está.
            const [listaProdutos, listaUnidades, listaEnderecos] = await Promise.all([
                listarProdutos(),
                listarTodasUnidades(),
                listarEnderecos(),
            ])

            setProdutos(listaProdutos)
            setUnidades(listaUnidades)
            setEnderecos(listaEnderecos)

        } catch (error) {

            console.error("Erro ao buscar estoque:", error)

            setErro("Não foi possível carregar o estoque.")

        } finally {

            setLoading(false)

        }
    }

    useEffect(() => {

        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()

    }, [])

    const produtosPorId = useMemo(() => {
        const mapa = new Map<number, Produto>()
        for (const produto of produtos) mapa.set(produto.id, produto)
        return mapa
    }, [produtos])


    // ==============================
    // AGRUPAMENTO POR LOCAL — uma entrada por unidade, não por quantidade
    // ==============================

    const enderecosPorId = useMemo(() => {
        const mapa = new Map<number, EnderecoEstoque>()
        for (const endereco of enderecos) mapa.set(endereco.id, endereco)
        return mapa
    }, [enderecos])

    const { semLocal, locais } = useMemo(() => {

        const disponiveis: CartaoUnidade[] = unidades
            .filter((unidade) => !unidade.vendida && !unidade.avariada)
            .map((unidade) => ({ unidade, produto: produtosPorId.get(unidade.produto_id) }))

        const semLocal: CartaoUnidade[] = []
        const mapaLocais = new Map<string, Local>()

        for (const item of disponiveis) {

            const codigo = item.unidade.endereco

            // Peça que chegou e ainda não foi guardada: o servidor manda o
            // endereço vazio, e ela sobe para o alerta do topo em vez de
            // virar um card de lugar nenhum.
            if (!codigo) {
                semLocal.push(item)
                continue
            }

            if (!mapaLocais.has(codigo)) {

                const endereco = item.unidade.endereco_id
                    ? enderecosPorId.get(item.unidade.endereco_id)
                    : undefined

                mapaLocais.set(codigo, {
                    chave: codigo,
                    codigo,
                    nome: endereco?.nome ?? item.unidade.endereco_nome,
                    endereco,
                    unidades: [],
                })
            }

            mapaLocais.get(codigo)!.unidades.push(item)
        }

        for (const local of mapaLocais.values()) {
            local.unidades.sort((a, b) => {
                const nomeA = a.produto?.nome ?? ""
                const nomeB = b.produto?.nome ?? ""
                return nomeA !== nomeB
                    ? nomeA.localeCompare(nomeB)
                    : a.unidade.sequencia - b.unidade.sequencia
            })
        }

        // Na ordem em que se anda pelo estoque, que é o que o cadastro
        // guarda; sem ela, pelo código — que ordena como texto igual ao que
        // ordena pelos números, de propósito.
        const locais = Array.from(mapaLocais.values()).sort((a, b) => {

            const ordemA = a.endereco?.ordem ?? 0
            const ordemB = b.endereco?.ordem ?? 0

            return ordemA !== ordemB ? ordemA - ordemB : a.codigo.localeCompare(b.codigo)
        })

        return { semLocal, locais }

    }, [unidades, produtosPorId, enderecosPorId])


    // ==============================
    // FILTRO DE BUSCA
    // ==============================

    const termoBusca = busca.trim().toLowerCase()

    function correspondeABusca(item: CartaoUnidade): boolean {
        if (!termoBusca) return true

        const nome = item.produto?.nome.toLowerCase() ?? ""
        const codigo = (item.produto?.codigo ?? "").toLowerCase()

        return nome.includes(termoBusca) || codigo.includes(termoBusca)
    }

    const semLocalFiltrado = semLocal.filter(correspondeABusca)

    const locaisFiltrados = locais
        .map((local) => ({
            ...local,
            unidades: local.unidades.filter(correspondeABusca),
        }))
        // Buscando, o lugar que não tem nada do que se procura sai da tela:
        // uma grade de cards vazios não responde "onde está isto?".
        .filter((local) => !termoBusca || local.unidades.length > 0)


    // ==============================
    // PAGINAÇÃO
    // ==============================

    function aoMudarBusca(valor: string) {
        setBusca(valor)
        setPaginaSemLocal(1)
        setPaginaPorLocal({})
    }

    const totalPaginasSemLocal = Math.max(1, Math.ceil(semLocalFiltrado.length / ITENS_POR_PAGINA))
    const paginaSemLocalCorrigida = Math.min(paginaSemLocal, totalPaginasSemLocal)

    const semLocalPaginado = semLocalFiltrado.slice(
        (paginaSemLocalCorrigida - 1) * ITENS_POR_PAGINA,
        paginaSemLocalCorrigida * ITENS_POR_PAGINA
    )

    function paginaDoLocal(chave: string): number {
        return paginaPorLocal[chave] ?? 1
    }

    function mudarPaginaDoLocal(chave: string, pagina: number) {
        setPaginaPorLocal((atual) => ({ ...atual, [chave]: pagina }))
    }


    // ==============================
    // ESTATÍSTICAS
    // ==============================

    const totalPecas = useMemo(
        () => unidades.filter((unidade) => !unidade.vendida && !unidade.avariada).length,
        [unidades]
    )

    const totalSemLocal = semLocal.length

    const locaisOcupados = locais.length

    // Peça que existe, mas já tem dono: está reservada para um pedido e não
    // deveria ser vendida no balcão nem transferida sem querer.
    const totalReservadas = useMemo(
        () => unidades.filter((unidade) => unidade.reservada && !unidade.vendida).length,
        [unidades]
    )


    // ==============================
    // TRANSFERÊNCIA
    // ==============================

    // Para onde dá para mandar a peça: os endereços liberados, menos aquele
    // em que ela já está. Endereço bloqueado fica de fora porque o servidor o
    // recusaria de qualquer jeito — oferecê-lo seria prometer o que não vai
    // acontecer.
    const enderecosDisponiveis = useMemo(
        () => enderecos.filter((endereco) => !endereco.bloqueado && endereco.codigo !== alvo?.enderecoAtual),
        [enderecos, alvo]
    )

    function abrirTransferencia(item: CartaoUnidade) {
        setAlvo({
            unidadeId: item.unidade.id,
            produtoNome: item.produto?.nome ?? `Produto #${item.unidade.produto_id}`,
            codigo: identificarPeca(item.produto?.codigo, item.unidade.sequencia),
            enderecoAtual: item.unidade.endereco,
            localAtual: item.unidade.endereco || item.unidade.endereco_nome || SEM_LUGAR,
        })
        setDestinoInput("")
        setErroTransferencia("")
    }

    function fecharTransferencia() {
        setAlvo(null)
        setErroTransferencia("")
    }

    async function confirmarTransferencia() {

        if (!alvo) return

        const destino = destinoInput.trim()

        const erros = validarTransferencia({ destino })

        if (destino && destino === alvo.enderecoAtual) {
            erros.push("A peça já está neste endereço.")
        }

        if (erros.length > 0) {
            setErroTransferencia(erros[0])
            return
        }

        try {

            setTransferindo(true)

            // Se o endereço aceita mercadoria, não está bloqueado e ainda
            // cabe, quem responde é o servidor — a tela mostra o que ele
            // disser em vez de tentar adivinhar antes.
            await transferirUnidade(alvo.unidadeId, destino)

            fecharTransferencia()

            await carregar()

        } catch (error) {

            console.error("Erro ao transferir unidade:", error)

            setErroTransferencia(
                error instanceof ApiError ? error.message : "Não foi possível transferir a unidade."
            )

        } finally {

            setTransferindo(false)

        }
    }


    // ==============================
    // AVARIA
    // ==============================

    function abrirAvaria(item: CartaoUnidade) {
        setAlvoAvaria({
            unidadeId: item.unidade.id,
            produtoNome: item.produto?.nome ?? `Produto #${item.unidade.produto_id}`,
            codigo: identificarPeca(item.produto?.codigo, item.unidade.sequencia),
        })
        setErroAvaria("")
    }

    function fecharAvaria() {
        setAlvoAvaria(null)
        setErroAvaria("")
    }

    async function confirmarAvaria() {

        if (!alvoAvaria) return

        try {

            setRegistrandoAvaria(true)
            setErroAvaria("")

            await avariarUnidade(alvoAvaria.unidadeId)

            fecharAvaria()

            await carregar()

        } catch (error) {

            console.error("Erro ao registrar avaria:", error)

            setErroAvaria(
                error instanceof ApiError ? error.message : "Não foi possível registrar a avaria."
            )

        } finally {

            setRegistrandoAvaria(false)

        }
    }


    // ==============================
    // EXCLUSÃO
    // ==============================

    function abrirExclusao(item: CartaoUnidade) {
        setAlvoExclusao({
            unidadeId: item.unidade.id,
            produtoNome: item.produto?.nome ?? `Produto #${item.unidade.produto_id}`,
            codigo: identificarPeca(item.produto?.codigo, item.unidade.sequencia),
        })
        setErroExclusao("")
    }

    function fecharExclusao() {
        setAlvoExclusao(null)
        setErroExclusao("")
    }

    async function confirmarExclusao() {

        if (!alvoExclusao) return

        try {

            setExcluindo(true)
            setErroExclusao("")

            await excluirUnidade(alvoExclusao.unidadeId)

            fecharExclusao()

            await carregar()

        } catch (error) {

            console.error("Erro ao excluir unidade:", error)

            setErroExclusao(
                error instanceof ApiError ? error.message : "Não foi possível excluir a unidade."
            )

        } finally {

            setExcluindo(false)

        }
    }


    // ==============================
    // LOADING
    // ==============================

    if (loading) {

        return (

            <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">

                <div className="mx-auto max-w-7xl">

                    <div className="h-9 w-64 animate-pulse rounded-lg bg-[#D3DADD]" />

                    <div className="mt-3 h-4 w-80 animate-pulse rounded bg-[#D3DADD]" />

                    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">

                        {[1, 2, 3, 4].map(item => (

                            <div
                                key={item}
                                className="card h-28 animate-pulse"
                            />

                        ))}

                    </div>

                    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">

                        {[1, 2, 3, 4, 5, 6].map(item => (

                            <div
                                key={item}
                                className="card h-48 animate-pulse"
                            />

                        ))}

                    </div>

                </div>

            </main>

        )
    }


    // ==============================
    // ERRO
    // ==============================

    if (erro) {

        return (

            <main className="min-h-screen bg-[#F0F3F4] p-8 md:ml-64">

                <div className="card mx-auto max-w-xl p-10 text-center">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FDECEA] text-[#D4351C]">
                        <FiAlertTriangle className="w-7" aria-hidden />
                    </div>

                    <h1 className="font-display mt-5 text-2xl text-[#1E2428]">
                        Erro ao carregar estoque
                    </h1>

                    <p className="mt-2 text-[#5A6469]">
                        {erro}
                    </p>

                    <button
                        onClick={() => window.location.reload()}
                        className="btn btn-primario mt-6"
                    >
                        Tentar novamente
                    </button>

                </div>

            </main>

        )
    }


    // ==============================
    // PÁGINA
    // ==============================

    return (

        <>

        <main className="min-h-screen bg-[#F0F3F4] text-[#1E2428] md:ml-64">

            {/* ==========================
                HEADER
            ========================== */}

            <header className="sticky top-16 z-30 border-b border-[#D3DADD] bg-[#F0F3F4]/95 backdrop-blur md:top-0">

                <div className="flex min-h-20 items-center justify-between gap-6 px-6 md:px-10">

                    <div>

                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#8C969B]">
                            Painel administrativo
                        </p>

                        <h1 className="font-display text-2xl text-[#1E2428]">
                            Estoque
                        </h1>

                    </div>

                </div>

            </header>


            {/* ==========================
                CONTEÚDO
            ========================== */}

            <div className="p-6 md:p-10">

                <div className="mx-auto max-w-7xl">

                    {/* INTRODUÇÃO */}

                    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                        <div>

                            <h2 className="font-display text-3xl tracking-tight text-[#1E2428] sm:text-4xl">
                                Onde cada peça está guardada
                            </h2>

                            <p className="mt-2 max-w-md text-[#5A6469]">
                                Mapa dos endereços do estoque, peça por peça, na ordem em que se anda pelo
                                corredor. Transfira ou marque avaria individualmente.
                            </p>

                        </div>

                        <Link
                            href="/page/avarias"
                            className="btn btn-neutro shrink-0"
                        >
                            <FiAlertTriangle className="w-4" aria-hidden />
                            <span>Ver avarias</span>
                        </Link>

                    </div>


                    {/* ==========================
                        ESTATÍSTICAS
                    ========================== */}

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">

                        <div className="card p-6">

                            <div className="flex items-center justify-between">

                                <div>
                                    <p className="text-sm text-[#5A6469]">
                                        Peças em estoque
                                    </p>
                                    <p className="num mt-2 text-3xl font-bold text-[#1E2428]">
                                        {totalPecas}
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E6F3FF] text-[#0086FF]">
                                    <FiBox className="w-5" aria-hidden />
                                </div>

                            </div>

                        </div>

                        <div className="card p-6">

                            <div className="flex items-center justify-between">

                                <div>
                                    <p className="text-sm text-[#5A6469]">
                                        Endereços ocupados
                                    </p>
                                    <p className="num mt-2 text-3xl font-bold text-[#1E2428]">
                                        {locaisOcupados}
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E6F3FF] text-[#0086FF]">
                                    <FiGrid className="w-5" aria-hidden />
                                </div>

                            </div>

                        </div>

                        <div className="card p-6">

                            <div className="flex items-center justify-between">

                                <div>
                                    <p className="text-sm text-[#5A6469]">
                                        Reservadas
                                    </p>
                                    <p className="num mt-2 text-3xl font-bold text-[#1E2428]">
                                        {totalReservadas}
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E6F3FF] text-[#0086FF]">
                                    <FiBookmark className="w-5" aria-hidden />
                                </div>

                            </div>

                        </div>

                        <div className="card p-6">

                            <div className="flex items-center justify-between">

                                <div>
                                    <p className="text-sm text-[#5A6469]">
                                        Sem local
                                    </p>
                                    <p className={`num mt-2 text-3xl font-bold ${totalSemLocal > 0 ? "text-[#8A6C1B]" : "text-[#1E2428]"}`}>
                                        {totalSemLocal}
                                    </p>
                                </div>

                                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${totalSemLocal > 0 ? "bg-[#FFF6E0] text-[#8A6C1B]" : "bg-[#F0F3F4] text-[#5A6469]"}`}>
                                    <FiAlertTriangle className="w-5" aria-hidden />
                                </div>

                            </div>

                        </div>

                    </div>


                    {/* ==========================
                        BUSCA
                    ========================== */}

                    <div className="mt-8 relative w-full sm:w-80">

                        <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8C969B]" aria-hidden />

                        <input
                            type="text"
                            value={busca}
                            onChange={(e) => aoMudarBusca(e.target.value)}
                            placeholder="Buscar por nome ou código"
                            className="field"
                            style={{ paddingLeft: "2.25rem", paddingRight: busca ? "2.25rem" : undefined }}
                        />

                        {busca && (
                            <button
                                type="button"
                                onClick={() => aoMudarBusca("")}
                                aria-label="Limpar busca"
                                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#5A6469] transition-colors hover:bg-[#F0F3F4]"
                            >
                                <FiX className="w-4" aria-hidden />
                            </button>
                        )}

                    </div>


                    {/* ==========================
                        SEM LOCAL DEFINIDO
                    ========================== */}

                    {semLocalFiltrado.length > 0 && (

                        <div className="card mt-10 overflow-hidden">

                            <div className="flex items-center gap-4 border-l-4 border-[#FFB800] bg-[#FFF6E0] p-5">

                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-[#8A6C1B]">
                                    <FiAlertTriangle className="w-5" aria-hidden />
                                </div>

                                <div>
                                    <h3 className="font-display text-base text-[#1E2428]">
                                        Sem local definido
                                    </h3>
                                    <p className="text-sm text-[#5A6469]">
                                        Peças recém-chegadas que ainda não foram guardadas em nenhum endereço.
                                    </p>
                                </div>

                            </div>

                            <ul className="divide-y divide-[#D3DADD] px-5">

                                {semLocalPaginado.map((item) => (

                                    <li
                                        key={item.unidade.id}
                                        className="flex items-center gap-3 py-3.5"
                                    >

                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F0F3F4]">
                                            {item.produto?.imagem_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={urlDaImagem(item.produto.imagem_url)}
                                                    alt={item.produto.nome}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : null}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-[#1E2428]">
                                                {item.produto?.nome ?? `Produto #${item.unidade.produto_id}`}
                                            </p>
                                            <p className="font-mono text-xs text-[#5A6469]">
                                                {identificarPeca(item.produto?.codigo, item.unidade.sequencia)}
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 gap-2">

                                            <button
                                                type="button"
                                                onClick={() => abrirExclusao(item)}
                                                aria-label="Excluir unidade"
                                                className="rounded-lg border border-[#D3DADD] px-2.5 py-2 text-xs font-bold text-[#5A6469] transition-colors hover:border-[#D4351C] hover:bg-[#FDECEA] hover:text-[#D4351C]"
                                            >
                                                <FiTrash2 className="w-3.5" aria-hidden />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => abrirAvaria(item)}
                                                className="rounded-lg border border-[#D3DADD] px-3 py-2 text-xs font-bold text-[#D4351C] transition-colors hover:border-[#D4351C] hover:bg-[#FDECEA]"
                                            >
                                                Avariar
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => abrirTransferencia(item)}
                                                className="rounded-lg bg-[#0086FF] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0075E2]"
                                            >
                                                Guardar
                                            </button>

                                        </div>

                                    </li>

                                ))}

                            </ul>

                            <Pagination
                                paginaAtual={paginaSemLocalCorrigida}
                                totalPaginas={totalPaginasSemLocal}
                                aoMudarPagina={setPaginaSemLocal}
                            />

                            <div className="h-5" />

                        </div>

                    )}


                    {/* ==========================
                        LOCAIS
                    ========================== */}

                    {locais.length === 0 && semLocal.length === 0 ? (

                        <div className="mt-10 rounded-lg border border-dashed border-[#D3DADD] bg-white p-16 text-center">

                            <FiMapPin className="mx-auto w-10 text-[#8C969B]" aria-hidden />

                            <h3 className="font-display mt-5 text-xl text-[#1E2428]">
                                Nenhuma peça guardada ainda
                            </h3>

                            <p className="mt-2 text-sm text-[#5A6469]">
                                {enderecos.length === 0
                                    ? "Cadastre os endereços do seu estoque: é por eles que o sistema decide sozinho onde guardar o que entra."
                                    : "Cadastre um produto ou dê entrada numa remessa — o sistema escolhe o endereço."}
                            </p>

                            <div className="mt-6 flex flex-wrap justify-center gap-3">

                                {enderecos.length === 0 ? (
                                    <Link
                                        href="/page/estoque/enderecos"
                                        className="btn btn-primario"
                                    >
                                        <FiMapPin className="w-4" aria-hidden />
                                        <span>Cadastrar endereços</span>
                                    </Link>
                                ) : (
                                    <Link
                                        href="/page/produto"
                                        className="btn btn-primario"
                                    >
                                        <FiPlus className="w-4" aria-hidden />
                                        <span>Cadastrar produto</span>
                                    </Link>
                                )}

                            </div>

                        </div>

                    ) : locaisFiltrados.length === 0 && semLocalFiltrado.length === 0 ? (

                        <div className="mt-10 rounded-lg border border-dashed border-[#D3DADD] bg-white p-16 text-center">

                            <FiSearch className="mx-auto w-10 text-[#8C969B]" aria-hidden />

                            <h3 className="font-display mt-5 text-xl text-[#1E2428]">
                                Nenhum produto corresponde à busca
                            </h3>

                            <button
                                type="button"
                                onClick={() => aoMudarBusca("")}
                                className="btn btn-neutro mt-6"
                            >
                                Limpar busca
                            </button>

                        </div>

                    ) : (

                        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">

                            {locaisFiltrados.map((local) => {

                                const itens = local.unidades

                                const totalPaginasLocal = Math.max(1, Math.ceil(itens.length / ITENS_POR_PAGINA))
                                const paginaLocalCorrigida = Math.min(paginaDoLocal(local.chave), totalPaginasLocal)
                                const itensPaginados = itens.slice(
                                    (paginaLocalCorrigida - 1) * ITENS_POR_PAGINA,
                                    paginaLocalCorrigida * ITENS_POR_PAGINA
                                )

                                const tipo = local.endereco?.tipo ?? ""
                                const capacidade = local.endereco?.capacidade ?? 0

                                return (

                                    <div
                                        key={local.chave}
                                        className="card card-hover overflow-hidden"
                                    >

                                        <div className="flex items-start justify-between gap-3 border-b border-[#D3DADD] p-5">

                                            <div className="flex min-w-0 items-start gap-3">

                                                <span className={`font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs ${CORES_TIPO[tipo] ?? "bg-[#5A6469] text-white"}`}>
                                                    <FiMapPin className="w-4" aria-hidden />
                                                </span>

                                                <div className="min-w-0">

                                                    <h4 className="font-display num truncate text-base text-[#1E2428]">
                                                        {local.codigo}
                                                    </h4>

                                                    <p className="truncate text-xs text-[#5A6469]">
                                                        {local.nome}
                                                    </p>

                                                    <p className="mt-1 flex flex-wrap items-center gap-1.5">

                                                        {local.endereco ? (
                                                            <span className="tag tag-neutral">
                                                                {local.endereco.tipo_nome}
                                                            </span>
                                                        ) : (
                                                            <span className="tag tag-neutral">
                                                                fora do cadastro
                                                            </span>
                                                        )}

                                                        {local.endereco?.bloqueado && (
                                                            <span className="tag tag-neutral">
                                                                <FiLock className="w-3" aria-hidden />
                                                                bloqueado
                                                            </span>
                                                        )}

                                                    </p>

                                                </div>

                                            </div>

                                            <span className="tag tag-neutral num shrink-0">
                                                {itens.length}{capacidade > 0 ? ` / ${capacidade}` : ""}
                                            </span>

                                        </div>

                                        <ul className="divide-y divide-[#D3DADD] px-5">

                                            {itensPaginados.map((item) => (

                                                <li
                                                    key={item.unidade.id}
                                                    className="flex items-center gap-3 py-3.5"
                                                >

                                                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F0F3F4]">
                                                        {item.produto?.imagem_url ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={urlDaImagem(item.produto.imagem_url)}
                                                                alt={item.produto.nome}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : null}
                                                    </div>

                                                    <div className="min-w-0 flex-1">

                                                        <p className="truncate text-sm font-medium text-[#1E2428]">
                                                            {item.produto?.nome ?? `Produto #${item.unidade.produto_id}`}
                                                        </p>

                                                        <p className="flex items-center gap-2 font-mono text-xs text-[#5A6469]">
                                                            <span className="truncate">
                                                                {identificarPeca(item.produto?.codigo, item.unidade.sequencia)}
                                                            </span>

                                                            {item.unidade.reservada && (
                                                                <span className="tag tag-neutral shrink-0 font-sans">
                                                                    reservada
                                                                </span>
                                                            )}
                                                        </p>

                                                    </div>

                                                    <div className="flex shrink-0 gap-2">

                                                        <button
                                                            type="button"
                                                            onClick={() => abrirExclusao(item)}
                                                            aria-label="Excluir unidade"
                                                            className="rounded-lg border border-[#D3DADD] px-2.5 py-2 text-xs font-bold text-[#5A6469] transition-colors hover:border-[#D4351C] hover:bg-[#FDECEA] hover:text-[#D4351C]"
                                                        >
                                                            <FiTrash2 className="w-3.5" aria-hidden />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => abrirAvaria(item)}
                                                            className="rounded-lg border border-[#D3DADD] px-3 py-2 text-xs font-bold text-[#D4351C] transition-colors hover:border-[#D4351C] hover:bg-[#FDECEA]"
                                                        >
                                                            Avariar
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => abrirTransferencia(item)}
                                                            className="rounded-lg border border-[#D3DADD] px-3.5 py-2 text-xs font-bold text-[#1E2428] transition-colors hover:bg-[#F0F3F4]"
                                                        >
                                                            Transferir
                                                        </button>

                                                    </div>

                                                </li>

                                            ))}

                                        </ul>

                                        <Pagination
                                            paginaAtual={paginaLocalCorrigida}
                                            totalPaginas={totalPaginasLocal}
                                            aoMudarPagina={(pagina) => mudarPaginaDoLocal(local.chave, pagina)}
                                        />

                                        <div className="h-5" />

                                    </div>

                                )

                            })}

                        </div>

                    )}

                </div>

            </div>

        </main>


        {/* ==========================
            MODAL DE TRANSFERÊNCIA
        ========================== */}

        {alvo && (

            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={fecharTransferencia}
            >

                <div className="absolute inset-0 bg-[#1E2428]/50" />

                <div
                    onClick={(e) => e.stopPropagation()}
                    className="card relative w-full max-w-md p-6"
                >

                    <button
                        type="button"
                        onClick={fecharTransferencia}
                        aria-label="Fechar"
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#5A6469] transition-colors hover:bg-[#F0F3F4]"
                    >
                        <FiX className="w-4" aria-hidden />
                    </button>

                    <div className="flex items-center gap-2 pr-8">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E6F3FF] text-[#0086FF]">
                            <FiRepeat className="w-3.5" aria-hidden />
                        </span>
                        <h2 className="font-display truncate text-lg text-[#1E2428]">
                            Transferir {alvo.produtoNome}
                        </h2>
                    </div>

                    <p className="mt-2 font-mono text-xs text-[#5A6469]">
                        {alvo.codigo}
                    </p>

                    <p className="mt-2 text-sm text-[#5A6469]">
                        De <span className="num font-medium text-[#1E2428]">
                            {alvo.localAtual}
                        </span>
                    </p>

                    <div className="mt-5 space-y-1.5">

                        <label className="rotulo" htmlFor="destino">
                            Endereço de destino
                        </label>

                        {enderecosDisponiveis.length === 0 ? (

                            <p className="rounded-lg bg-[#FFF6E0] px-4 py-3 text-sm text-[#8A6C1B]">
                                Não há endereço liberado para receber esta peça.{" "}
                                <Link href="/page/estoque/enderecos" className="font-bold underline">
                                    Cadastre um endereço
                                </Link>{" "}
                                ou libere um dos que estão bloqueados.
                            </p>

                        ) : (

                            <select
                                id="destino"
                                autoFocus
                                value={destinoInput}
                                onChange={(e) => setDestinoInput(e.target.value)}
                                className="field cursor-pointer"
                            >
                                <option value="">Selecione...</option>

                                {enderecosDisponiveis.map((endereco) => (
                                    <option key={endereco.id} value={endereco.codigo}>
                                        {endereco.codigo} · {endereco.nome} ({endereco.tipo_nome})
                                        {endereco.capacidade > 0 ? ` — cabem ${endereco.livre ?? 0}` : ""}
                                    </option>
                                ))}

                            </select>

                        )}

                        <p className="text-xs text-[#5A6469]">
                            Só aparecem os endereços liberados. Se o escolhido não couber mais a
                            peça, quem avisa é o servidor, que tem a ocupação na frente.
                        </p>

                    </div>

                    {erroTransferencia && (
                        <div className="mt-4 rounded-lg bg-[#FDECEA] px-4 py-2.5 text-sm font-semibold text-[#D4351C]">
                            {erroTransferencia}
                        </div>
                    )}

                    <div className="mt-6 flex gap-2">

                        <button
                            type="button"
                            onClick={fecharTransferencia}
                            disabled={transferindo}
                            className="btn btn-neutro flex-1"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={confirmarTransferencia}
                            disabled={transferindo}
                            className="btn btn-primario flex-1"
                        >
                            {transferindo ? "Transferindo..." : "Transferir"}
                        </button>

                    </div>

                </div>

            </div>

        )}


        {/* ==========================
            MODAL DE AVARIA
        ========================== */}

        {alvoAvaria && (

            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={fecharAvaria}
            >

                <div className="absolute inset-0 bg-[#1E2428]/50" />

                <div
                    onClick={(e) => e.stopPropagation()}
                    className="card relative w-full max-w-md p-6"
                >

                    <button
                        type="button"
                        onClick={fecharAvaria}
                        aria-label="Fechar"
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#5A6469] transition-colors hover:bg-[#F0F3F4]"
                    >
                        <FiX className="w-4" aria-hidden />
                    </button>

                    <div className="flex items-center gap-2 pr-8">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FDECEA] text-[#D4351C]">
                            <FiAlertTriangle className="w-3.5" aria-hidden />
                        </span>
                        <h2 className="font-display truncate text-lg text-[#1E2428]">
                            Registrar avaria
                        </h2>
                    </div>

                    <p className="mt-3 text-sm text-[#1E2428]">
                        {alvoAvaria.produtoNome}
                    </p>

                    <p className="mt-1 font-mono text-xs text-[#5A6469]">
                        {alvoAvaria.codigo}
                    </p>

                    <p className="mt-3 text-sm text-[#5A6469]">
                        Essa unidade sai do estoque vendável. Dá pra restaurar depois em &ldquo;Ver avarias&rdquo; se for engano.
                    </p>

                    {erroAvaria && (
                        <div className="mt-4 rounded-lg bg-[#FDECEA] px-4 py-2.5 text-sm font-semibold text-[#D4351C]">
                            {erroAvaria}
                        </div>
                    )}

                    <div className="mt-6 flex gap-2">

                        <button
                            type="button"
                            onClick={fecharAvaria}
                            disabled={registrandoAvaria}
                            className="btn btn-neutro flex-1"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={confirmarAvaria}
                            disabled={registrandoAvaria}
                            className="btn btn-perigo flex-1"
                        >
                            {registrandoAvaria ? "Registrando..." : "Registrar avaria"}
                        </button>

                    </div>

                </div>

            </div>

        )}


        {/* ==========================
            MODAL DE EXCLUSÃO
        ========================== */}

        {alvoExclusao && (

            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={fecharExclusao}
            >

                <div className="absolute inset-0 bg-[#1E2428]/50" />

                <div
                    onClick={(e) => e.stopPropagation()}
                    className="card relative w-full max-w-md p-6"
                >

                    <button
                        type="button"
                        onClick={fecharExclusao}
                        aria-label="Fechar"
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#5A6469] transition-colors hover:bg-[#F0F3F4]"
                    >
                        <FiX className="w-4" aria-hidden />
                    </button>

                    <div className="flex items-center gap-2 pr-8">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FDECEA] text-[#D4351C]">
                            <FiTrash2 className="w-3.5" aria-hidden />
                        </span>
                        <h2 className="font-display truncate text-lg text-[#1E2428]">
                            Excluir unidade
                        </h2>
                    </div>

                    <p className="mt-3 text-sm text-[#1E2428]">
                        {alvoExclusao.produtoNome}
                    </p>

                    <p className="mt-1 font-mono text-xs text-[#5A6469]">
                        {alvoExclusao.codigo}
                    </p>

                    <p className="mt-3 text-sm text-[#5A6469]">
                        Essa unidade é removida permanentemente do estoque. Diferente de uma avaria, essa ação não pode ser desfeita.
                    </p>

                    {erroExclusao && (
                        <div className="mt-4 rounded-lg bg-[#FDECEA] px-4 py-2.5 text-sm font-semibold text-[#D4351C]">
                            {erroExclusao}
                        </div>
                    )}

                    <div className="mt-6 flex gap-2">

                        <button
                            type="button"
                            onClick={fecharExclusao}
                            disabled={excluindo}
                            className="btn btn-neutro flex-1"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={confirmarExclusao}
                            disabled={excluindo}
                            className="btn btn-perigo flex-1"
                        >
                            {excluindo ? "Excluindo..." : "Sim, excluir"}
                        </button>

                    </div>

                </div>

            </div>

        )}

        </>

    )
}
