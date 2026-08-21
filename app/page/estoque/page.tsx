"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto, Unidade } from "@/app/type/type"
import { listarProdutos, listarTodasUnidades, transferirUnidade, avariarUnidade } from "@/middleware/produtos"
import { validarTransferencia } from "@/security/validate"
import { ApiError } from "@/middleware/client"

interface CartaoUnidade {
    unidade: Unidade
    produto: Produto | undefined
}

interface Local {
    rua: number
    bloco: string
    unidades: CartaoUnidade[]
}

interface TransferenciaAlvo {
    unidadeId: number
    produtoNome: string
    codigo: string
    ruaAtual: number
    blocoAtual: string
}

interface AvariaAlvo {
    unidadeId: number
    produtoNome: string
    codigo: string
}

const CORES_BLOCO: Record<string, string> = {
    A: "bg-[#2F5D4E] text-white",
    B: "bg-[#C9A227] text-white",
}

export default function Estoque() {

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [unidades, setUnidades] = useState<Unidade[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    const [busca, setBusca] = useState("")

    const [alvo, setAlvo] = useState<TransferenciaAlvo | null>(null)
    const [ruaDestinoInput, setRuaDestinoInput] = useState("")
    const [blocoDestinoInput, setBlocoDestinoInput] = useState("")
    const [erroTransferencia, setErroTransferencia] = useState("")
    const [transferindo, setTransferindo] = useState(false)

    const [alvoAvaria, setAlvoAvaria] = useState<AvariaAlvo | null>(null)
    const [erroAvaria, setErroAvaria] = useState("")
    const [registrandoAvaria, setRegistrandoAvaria] = useState(false)

    async function carregar() {

        try {

            const [listaProdutos, listaUnidades] = await Promise.all([
                listarProdutos(),
                listarTodasUnidades(),
            ])

            setProdutos(listaProdutos)
            setUnidades(listaUnidades)

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

    const { semLocal, locais, ruas } = useMemo(() => {

        const disponiveis: CartaoUnidade[] = unidades
            .filter((unidade) => !unidade.vendida && !unidade.avariada)
            .map((unidade) => ({ unidade, produto: produtosPorId.get(unidade.produto_id) }))

        const mapaLocais = new Map<string, Local>()

        for (const item of disponiveis) {

            const chave = `${item.unidade.rua}-${item.unidade.bloco}`

            if (!mapaLocais.has(chave)) {
                mapaLocais.set(chave, { rua: item.unidade.rua, bloco: item.unidade.bloco, unidades: [] })
            }

            mapaLocais.get(chave)!.unidades.push(item)
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

        const todos = Array.from(mapaLocais.values())

        const semLocal = todos.find((local) => local.rua <= 0 || !local.bloco)?.unidades ?? []
        const locais = todos.filter((local) => local.rua > 0 && local.bloco)
        const ruas = Array.from(new Set(locais.map((local) => local.rua))).sort((a, b) => a - b)

        return { semLocal, locais, ruas }

    }, [unidades, produtosPorId])


    // ==============================
    // FILTRO DE BUSCA
    // ==============================

    const termoBusca = busca.trim().toLowerCase()

    function correspondeABusca(item: CartaoUnidade): boolean {
        if (!termoBusca) return true

        const nome = item.produto?.nome.toLowerCase() ?? ""
        const codigo = item.unidade.codigo.toLowerCase()

        return nome.includes(termoBusca) || codigo.includes(termoBusca)
    }

    const semLocalFiltrado = semLocal.filter(correspondeABusca)

    const locaisFiltrados = locais.map((local) => ({
        ...local,
        unidades: local.unidades.filter(correspondeABusca),
    }))

    const ruasFiltradas = termoBusca
        ? ruas.filter((rua) => locaisFiltrados.some((local) => local.rua === rua && local.unidades.length > 0))
        : ruas


    // ==============================
    // ESTATÍSTICAS
    // ==============================

    const totalPecas = useMemo(
        () => unidades.filter((unidade) => !unidade.vendida && !unidade.avariada).length,
        [unidades]
    )

    const totalSemLocal = semLocal.length

    const blocosOcupados = useMemo(
        () => locais.filter((local) => local.unidades.length > 0).length,
        [locais]
    )


    // ==============================
    // TRANSFERÊNCIA
    // ==============================

    function abrirTransferencia(item: CartaoUnidade) {
        setAlvo({
            unidadeId: item.unidade.id,
            produtoNome: item.produto?.nome ?? `Produto #${item.unidade.produto_id}`,
            codigo: item.unidade.codigo,
            ruaAtual: item.unidade.rua,
            blocoAtual: item.unidade.bloco,
        })
        setRuaDestinoInput("")
        setBlocoDestinoInput("")
        setErroTransferencia("")
    }

    function fecharTransferencia() {
        setAlvo(null)
        setErroTransferencia("")
    }

    async function confirmarTransferencia() {

        if (!alvo) return

        const transferencia = {
            rua_destino: parseInt(ruaDestinoInput, 10),
            bloco_destino: blocoDestinoInput,
        }

        const erros = validarTransferencia(transferencia)

        if (
            alvo.ruaAtual === transferencia.rua_destino &&
            alvo.blocoAtual === transferencia.bloco_destino
        ) {
            erros.push("Origem e destino são o mesmo local.")
        }

        if (erros.length > 0) {
            setErroTransferencia(erros[0])
            return
        }

        try {

            setTransferindo(true)

            await transferirUnidade(alvo.unidadeId, transferencia)

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
            codigo: item.unidade.codigo,
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
    // LOADING
    // ==============================

    if (loading) {

        return (

            <main className="min-h-screen bg-[#F6F5F1] p-6 md:ml-64 md:p-10">

                <div className="mx-auto max-w-7xl">

                    <div className="h-9 w-64 animate-pulse rounded-lg bg-[#EAE7DE]" />

                    <div className="mt-3 h-4 w-80 animate-pulse rounded bg-[#EAE7DE]" />

                    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">

                        {[1, 2, 3, 4].map(item => (

                            <div
                                key={item}
                                className="h-28 animate-pulse rounded-2xl border border-[#EAE7DE] bg-white"
                            />

                        ))}

                    </div>

                    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">

                        {[1, 2, 3, 4, 5, 6].map(item => (

                            <div
                                key={item}
                                className="h-48 animate-pulse rounded-2xl border border-[#EAE7DE] bg-white"
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

            <main className="min-h-screen bg-[#F6F5F1] p-8 md:ml-64">

                <div className="mx-auto max-w-xl rounded-2xl border border-[#EAE7DE] bg-white p-10 text-center">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
                        !
                    </div>

                    <h1 className="font-display mt-5 text-2xl font-medium text-[#1C1B19]">
                        Erro ao carregar estoque
                    </h1>

                    <p className="mt-2 text-[#6F6C61]">
                        {erro}
                    </p>

                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 rounded-lg bg-[#2F5D4E] px-6 py-3 font-medium text-white transition hover:bg-[#264C40]"
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

        <main className="min-h-screen bg-[#F6F5F1] text-[#1C1B19] md:ml-64">

            {/* ==========================
                HEADER
            ========================== */}

            <header className="sticky top-16 z-30 border-b border-[#EAE7DE] bg-[#F6F5F1]/95 backdrop-blur md:top-0">

                <div className="flex min-h-20 items-center justify-between gap-6 px-6 md:px-10">

                    <div>

                        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8E8B80]">
                            Painel administrativo
                        </p>

                        <h1 className="font-display text-2xl font-medium text-[#1C1B19]">
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

                            <h2 className="font-display text-3xl font-medium tracking-tight text-[#1C1B19] sm:text-4xl">
                                Onde cada peça está guardada
                            </h2>

                            <p className="mt-2 max-w-md text-[#6F6C61]">
                                Mapa das ruas e blocos do estoque, peça por peça. Transfira ou marque avaria individualmente.
                            </p>

                            <div className="mt-6 h-2 stitch max-w-xs opacity-70" />

                        </div>

                        <Link
                            href="/page/avarias"
                            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#EAE7DE] bg-white px-4 py-2.5 text-sm font-medium text-[#1C1B19] transition hover:bg-[#EFEDE6]"
                        >
                            <span>⚠</span>
                            <span>Ver avarias</span>
                        </Link>

                    </div>


                    {/* ==========================
                        ESTATÍSTICAS
                    ========================== */}

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">

                        <div className="rounded-2xl border border-[#EAE7DE] bg-white p-6">

                            <div className="flex items-center justify-between">

                                <div>
                                    <p className="text-sm text-[#8E8B80]">
                                        Peças em estoque
                                    </p>
                                    <p className="font-mono mt-2 text-3xl font-semibold text-[#1C1B19]">
                                        {totalPecas}
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2F5D4E]/10 text-xl">
                                    📦
                                </div>

                            </div>

                        </div>

                        <div className="rounded-2xl border border-[#EAE7DE] bg-white p-6">

                            <div className="flex items-center justify-between">

                                <div>
                                    <p className="text-sm text-[#8E8B80]">
                                        Ruas ocupadas
                                    </p>
                                    <p className="font-mono mt-2 text-3xl font-semibold text-[#1C1B19]">
                                        {ruas.length}
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-xl">
                                    🛣
                                </div>

                            </div>

                        </div>

                        <div className="rounded-2xl border border-[#EAE7DE] bg-white p-6">

                            <div className="flex items-center justify-between">

                                <div>
                                    <p className="text-sm text-[#8E8B80]">
                                        Blocos ocupados
                                    </p>
                                    <p className="font-mono mt-2 text-3xl font-semibold text-[#1C1B19]">
                                        {blocosOcupados}
                                    </p>
                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C9A227]/15 text-xl">
                                    ◆
                                </div>

                            </div>

                        </div>

                        <div className="rounded-2xl border border-[#EAE7DE] bg-white p-6">

                            <div className="flex items-center justify-between">

                                <div>
                                    <p className="text-sm text-[#8E8B80]">
                                        Sem local
                                    </p>
                                    <p className={`font-mono mt-2 text-3xl font-semibold ${totalSemLocal > 0 ? "text-amber-600" : "text-[#1C1B19]"}`}>
                                        {totalSemLocal}
                                    </p>
                                </div>

                                <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl ${totalSemLocal > 0 ? "bg-amber-100" : "bg-[#EFEDE6]"}`}>
                                    !
                                </div>

                            </div>

                        </div>

                    </div>


                    {/* ==========================
                        BUSCA
                    ========================== */}

                    <div className="mt-8 relative w-full sm:w-80">

                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A19E93]">
                            🔍
                        </span>

                        <input
                            type="text"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder="Buscar por nome ou código"
                            className="field"
                            style={{ paddingLeft: "2.25rem", paddingRight: busca ? "2.25rem" : undefined }}
                        />

                        {busca && (
                            <button
                                type="button"
                                onClick={() => setBusca("")}
                                aria-label="Limpar busca"
                                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#8E8B80] transition hover:bg-[#EFEDE6]"
                            >
                                ✕
                            </button>
                        )}

                    </div>


                    {/* ==========================
                        SEM LOCAL DEFINIDO
                    ========================== */}

                    {semLocalFiltrado.length > 0 && (

                        <div className="mt-10 overflow-hidden rounded-2xl border border-[#EAE7DE] bg-white">

                            <div className="flex items-center gap-4 border-l-4 border-amber-400 bg-amber-50/60 p-5">

                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg text-amber-700">
                                    !
                                </div>

                                <div>
                                    <h3 className="font-display text-base font-medium text-[#1C1B19]">
                                        Sem local definido
                                    </h3>
                                    <p className="text-sm text-[#8E8B80]">
                                        Peças recém-chegadas que ainda não foram guardadas em uma rua/bloco.
                                    </p>
                                </div>

                            </div>

                            <ul className="divide-y divide-[#EAE7DE] px-5">

                                {semLocalFiltrado.map((item) => (

                                    <li
                                        key={item.unidade.id}
                                        className="flex items-center gap-3 py-3.5"
                                    >

                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F6F5F1]">
                                            {item.produto?.imagem_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={item.produto.imagem_url}
                                                    alt={item.produto.nome}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : null}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-[#1C1B19]">
                                                {item.produto?.nome ?? `Produto #${item.unidade.produto_id}`}
                                            </p>
                                            <p className="font-mono text-xs text-[#8E8B80]">
                                                {item.unidade.codigo}
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 gap-2">

                                            <button
                                                type="button"
                                                onClick={() => abrirAvaria(item)}
                                                className="rounded-lg border border-[#EAE7DE] px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                                            >
                                                Avariar
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => abrirTransferencia(item)}
                                                className="rounded-lg bg-[#1C1B19] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-[#1C1B19]/85"
                                            >
                                                Guardar
                                            </button>

                                        </div>

                                    </li>

                                ))}

                            </ul>

                            <div className="h-5" />

                        </div>

                    )}


                    {/* ==========================
                        LOCAIS
                    ========================== */}

                    {locais.length === 0 && semLocal.length === 0 ? (

                        <div className="mt-10 rounded-2xl border border-dashed border-[#D9D5C8] bg-white p-16 text-center">

                            <div className="text-5xl">
                                📍
                            </div>

                            <h3 className="font-display mt-5 text-xl font-medium text-[#1C1B19]">
                                Nenhuma peça guardada ainda
                            </h3>

                            <p className="mt-2 text-sm text-[#8E8B80]">
                                Cadastre um produto e escolha a rua e o bloco onde ele vai ficar.
                            </p>

                            <Link
                                href="/page/produto"
                                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#2F5D4E] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#264C40]"
                            >
                                <span>＋</span>
                                <span>Cadastrar produto</span>
                            </Link>

                        </div>

                    ) : ruasFiltradas.length === 0 && semLocalFiltrado.length === 0 ? (

                        <div className="mt-10 rounded-2xl border border-dashed border-[#D9D5C8] bg-white p-16 text-center">

                            <div className="text-5xl">
                                🔍
                            </div>

                            <h3 className="font-display mt-5 text-xl font-medium text-[#1C1B19]">
                                Nenhum produto corresponde à busca
                            </h3>

                            <button
                                type="button"
                                onClick={() => setBusca("")}
                                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[#EAE7DE] px-6 py-3 text-sm font-medium text-[#1C1B19] transition hover:bg-[#EFEDE6]"
                            >
                                Limpar busca
                            </button>

                        </div>

                    ) : (

                        <div className="mt-10 space-y-10">

                            {ruasFiltradas.map((rua) => {

                                const locaisDaRua = locaisFiltrados.filter((local) => local.rua === rua)

                                return (

                                    <div key={rua}>

                                        <div className="mb-4 flex items-center gap-3">

                                            <span className="font-mono flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1C1B19] text-sm font-semibold text-white">
                                                {rua}
                                            </span>

                                            <h3 className="font-display text-lg font-medium text-[#1C1B19]">
                                                Rua {rua}
                                            </h3>

                                            <div className="h-px flex-1 bg-[#EAE7DE]" />

                                        </div>

                                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

                                            {["A", "B"].map((bloco) => {

                                                const local = locaisDaRua.find((item) => item.bloco === bloco)
                                                const itens = local?.unidades ?? []

                                                return (

                                                    <div
                                                        key={bloco}
                                                        className="overflow-hidden rounded-2xl border border-[#EAE7DE] bg-white transition hover:shadow-lg hover:shadow-black/5"
                                                    >

                                                        <div className="flex items-center justify-between gap-3 border-b border-[#EAE7DE] p-5">

                                                            <div className="flex items-center gap-3">

                                                                <span className={`font-display flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${CORES_BLOCO[bloco]}`}>
                                                                    {bloco}
                                                                </span>

                                                                <h4 className="font-display text-base font-medium text-[#1C1B19]">
                                                                    Bloco {bloco}
                                                                </h4>

                                                            </div>

                                                            <span className="font-mono rounded-full bg-[#F6F5F1] px-2.5 py-1 text-xs font-semibold text-[#6F6C61]">
                                                                {itens.length} {itens.length === 1 ? "item" : "itens"}
                                                            </span>

                                                        </div>

                                                        {itens.length === 0 ? (

                                                            <p className="p-5 text-sm text-[#A19E93]">
                                                                Nenhuma peça neste bloco.
                                                            </p>

                                                        ) : (

                                                            <ul className="divide-y divide-[#EAE7DE] px-5">

                                                                {itens.map((item) => (

                                                                    <li
                                                                        key={item.unidade.id}
                                                                        className="flex items-center gap-3 py-3.5"
                                                                    >

                                                                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F6F5F1]">
                                                                            {item.produto?.imagem_url ? (
                                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                                <img
                                                                                    src={item.produto.imagem_url}
                                                                                    alt={item.produto.nome}
                                                                                    className="h-full w-full object-cover"
                                                                                />
                                                                            ) : null}
                                                                        </div>

                                                                        <div className="min-w-0 flex-1">

                                                                            <p className="truncate text-sm font-medium text-[#1C1B19]">
                                                                                {item.produto?.nome ?? `Produto #${item.unidade.produto_id}`}
                                                                            </p>

                                                                            <p className="font-mono text-xs text-[#8E8B80]">
                                                                                {item.unidade.codigo}
                                                                            </p>

                                                                        </div>

                                                                        <div className="flex shrink-0 gap-2">

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => abrirAvaria(item)}
                                                                                className="rounded-lg border border-[#EAE7DE] px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                                                                            >
                                                                                Avariar
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => abrirTransferencia(item)}
                                                                                className="rounded-lg border border-[#EAE7DE] px-3.5 py-2 text-xs font-medium text-[#1C1B19] transition hover:bg-[#EFEDE6]"
                                                                            >
                                                                                Transferir
                                                                            </button>

                                                                        </div>

                                                                    </li>

                                                                ))}

                                                            </ul>

                                                        )}

                                                        <div className="h-5" />

                                                    </div>

                                                )

                                            })}

                                        </div>

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

                <div className="absolute inset-0 bg-black/50" />

                <div
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-md rounded-2xl border border-[#EAE7DE] bg-white p-6"
                >

                    <button
                        type="button"
                        onClick={fecharTransferencia}
                        aria-label="Fechar"
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#8E8B80] transition hover:bg-[#EFEDE6]"
                    >
                        ✕
                    </button>

                    <div className="flex items-center gap-2 pr-8">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2F5D4E]/10 text-xs text-[#2F5D4E]">
                            ⇄
                        </span>
                        <h2 className="font-display truncate text-lg font-medium text-[#1C1B19]">
                            Transferir {alvo.produtoNome}
                        </h2>
                    </div>

                    <p className="mt-2 font-mono text-xs text-[#8E8B80]">
                        {alvo.codigo}
                    </p>

                    <p className="mt-2 text-sm text-[#8E8B80]">
                        De <span className="font-medium text-[#1C1B19]">
                            {alvo.ruaAtual > 0 ? `Rua ${alvo.ruaAtual} · Bloco ${alvo.blocoAtual}` : "sem local definido"}
                        </span>
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-3">

                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-[#6F6C61]">
                                Rua de destino
                            </label>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                autoFocus
                                value={ruaDestinoInput}
                                onChange={(e) => setRuaDestinoInput(e.target.value)}
                                placeholder="Ex: 3"
                                className="field font-mono"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-[#6F6C61]">
                                Bloco de destino
                            </label>
                            <select
                                value={blocoDestinoInput}
                                onChange={(e) => setBlocoDestinoInput(e.target.value)}
                                className="field cursor-pointer"
                            >
                                <option value="">Selecione...</option>
                                <option value="A">Bloco A</option>
                                <option value="B">Bloco B</option>
                            </select>
                        </div>

                    </div>

                    {erroTransferencia && (
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                            {erroTransferencia}
                        </div>
                    )}

                    <div className="mt-6 flex gap-2">

                        <button
                            type="button"
                            onClick={fecharTransferencia}
                            disabled={transferindo}
                            className="flex-1 rounded-lg px-3 py-2.5 text-sm font-medium text-[#6F6C61] transition hover:bg-[#EFEDE6] disabled:opacity-50"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={confirmarTransferencia}
                            disabled={transferindo}
                            className="flex-1 rounded-lg bg-[#2F5D4E] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#264C40] disabled:cursor-not-allowed disabled:opacity-50"
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

                <div className="absolute inset-0 bg-black/50" />

                <div
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-md rounded-2xl border border-[#EAE7DE] bg-white p-6"
                >

                    <button
                        type="button"
                        onClick={fecharAvaria}
                        aria-label="Fechar"
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#8E8B80] transition hover:bg-[#EFEDE6]"
                    >
                        ✕
                    </button>

                    <div className="flex items-center gap-2 pr-8">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs text-red-600">
                            !
                        </span>
                        <h2 className="font-display truncate text-lg font-medium text-[#1C1B19]">
                            Registrar avaria
                        </h2>
                    </div>

                    <p className="mt-3 text-sm text-[#1C1B19]">
                        {alvoAvaria.produtoNome}
                    </p>

                    <p className="mt-1 font-mono text-xs text-[#8E8B80]">
                        {alvoAvaria.codigo}
                    </p>

                    <p className="mt-3 text-sm text-[#6F6C61]">
                        Essa unidade sai do estoque vendável. Dá pra restaurar depois em &ldquo;Ver avarias&rdquo; se for engano.
                    </p>

                    {erroAvaria && (
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                            {erroAvaria}
                        </div>
                    )}

                    <div className="mt-6 flex gap-2">

                        <button
                            type="button"
                            onClick={fecharAvaria}
                            disabled={registrandoAvaria}
                            className="flex-1 rounded-lg px-3 py-2.5 text-sm font-medium text-[#6F6C61] transition hover:bg-[#EFEDE6] disabled:opacity-50"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={confirmarAvaria}
                            disabled={registrandoAvaria}
                            className="flex-1 rounded-lg bg-red-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {registrandoAvaria ? "Registrando..." : "Registrar avaria"}
                        </button>

                    </div>

                </div>

            </div>

        )}

        </>

    )
}
