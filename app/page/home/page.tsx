"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto, Unidade } from "@/app/type/type"
import { listarProdutos, listarTodasUnidades, venderUnidade } from "@/middleware/produtos"
import { criarPromocao, removerPromocao } from "@/middleware/promocoes"
import { validarPromocao } from "@/security/validate"
import { ApiError } from "@/middleware/client"

interface CartaoProduto {
    produto: Produto
    unidade: Unidade | null
}

export default function Home() {

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [unidades, setUnidades] = useState<Unidade[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
    const [precoPromoInput, setPrecoPromoInput] = useState("")
    const [erroPromo, setErroPromo] = useState("")
    const [salvandoPromo, setSalvandoPromo] = useState(false)

    const [vendendoUnidade, setVendendoUnidade] = useState(false)
    const [mensagemVenda, setMensagemVenda] = useState("")

    const [busca, setBusca] = useState("")

    async function carregarProdutos() {

        try {

            const [listaProdutos, listaUnidades] = await Promise.all([
                listarProdutos(),
                listarTodasUnidades(),
            ])

            setProdutos(listaProdutos)
            setUnidades(listaUnidades)

        } catch (error) {

            console.error("Erro ao buscar produtos:", error)

            setErro("Não foi possível carregar os produtos.")

        } finally {

            setLoading(false)

        }
    }

    useEffect(() => {

        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregarProdutos()

    }, [])

    function abrirModal(produto: Produto) {
        setProdutoSelecionado(produto)
        setPrecoPromoInput(produto.preco_promocional ? String(produto.preco_promocional) : "")
        setErroPromo("")
        setMensagemVenda("")
    }

    function fecharModal() {
        setProdutoSelecionado(null)
        setPrecoPromoInput("")
        setErroPromo("")
        setMensagemVenda("")
    }

    async function venderUnidadeSelecionada() {

        if (!produtoSelecionado) return

        try {

            setVendendoUnidade(true)
            setMensagemVenda("")

            const resposta = await venderUnidade(produtoSelecionado.id)

            setProdutoSelecionado(resposta.produto)
            setMensagemVenda(`Unidade ${resposta.unidade.codigo} vendida.`)

            await carregarProdutos()

        } catch (error) {

            console.error("Erro ao vender unidade:", error)

            setMensagemVenda(
                error instanceof ApiError ? error.message : "Não foi possível vender a unidade."
            )

        } finally {

            setVendendoUnidade(false)

        }
    }

    async function salvarPromocao() {

        if (!produtoSelecionado) return

        const promocao = {
            produto_id: produtoSelecionado.id,
            preco_promocional: parseFloat(precoPromoInput.replace(",", ".")),
        }

        const erros = validarPromocao(promocao)

        if (erros.length > 0) {
            setErroPromo(erros[0])
            return
        }

        try {

            setSalvandoPromo(true)

            await criarPromocao(promocao)

            fecharModal()

            await carregarProdutos()

        } catch (error) {

            console.error("Erro ao salvar promoção:", error)

            setErroPromo(
                error instanceof ApiError ? error.message : "Não foi possível salvar a promoção."
            )

        } finally {

            setSalvandoPromo(false)

        }
    }

    async function excluirPromocao() {

        if (!produtoSelecionado) return

        try {

            setSalvandoPromo(true)

            await removerPromocao(produtoSelecionado.id)

            fecharModal()

            await carregarProdutos()

        } catch (error) {

            console.error("Erro ao remover promoção:", error)

            setErroPromo("Não foi possível remover a promoção.")

        } finally {

            setSalvandoPromo(false)

        }
    }

    useEffect(() => {

        if (!produtoSelecionado) return

        function aoTeclar(e: KeyboardEvent) {
            if (e.key === "Escape") fecharModal()
        }

        window.addEventListener("keydown", aoTeclar)

        return () => window.removeEventListener("keydown", aoTeclar)

    }, [produtoSelecionado])

    // ==============================
    // ESTATÍSTICAS
    // ==============================

    const totalProdutos = produtos.length

    const totalEstoque = produtos.reduce(
        (total, produto) =>
            total + Number(produto.estoque || 0),
        0
    )

    const semEstoque = produtos.filter(
        produto => Number(produto.estoque) <= 0
    ).length

    const valorEmEstoque = produtos.reduce(
        (total, produto) =>
            total + Number(produto.preco || 0) * Number(produto.estoque || 0),
        0
    )

    const formatarMoeda = (valor: number) =>
        valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })


    // ==============================
    // CARTÕES — um por unidade em estoque, não um por produto
    // ==============================

    const cartoes = useMemo(() => {

        const disponiveisPorProduto = new Map<number, Unidade[]>()

        for (const unidade of unidades) {

            if (unidade.vendida || unidade.avariada) continue

            if (!disponiveisPorProduto.has(unidade.produto_id)) {
                disponiveisPorProduto.set(unidade.produto_id, [])
            }

            disponiveisPorProduto.get(unidade.produto_id)!.push(unidade)
        }

        const lista: CartaoProduto[] = []

        for (const produto of produtos) {

            const unidadesDoProduto = (disponiveisPorProduto.get(produto.id) ?? [])
                .slice()
                .sort((a, b) => a.sequencia - b.sequencia)

            if (unidadesDoProduto.length > 0) {
                for (const unidade of unidadesDoProduto) {
                    lista.push({ produto, unidade })
                }
            } else {
                // Sem unidade disponível: produto esgotado (ou cadastrado
                // antes de unidades individuais existirem) — ainda assim
                // mostra 1 cartão, pra não sumir do catálogo.
                lista.push({ produto, unidade: null })
            }
        }

        return lista

    }, [produtos, unidades])


    // ==============================
    // FILTRO DE BUSCA
    // ==============================

    const termoBusca = busca.trim().toLowerCase()

    function codigoDoCartao(cartao: CartaoProduto): string {
        return cartao.unidade?.codigo || cartao.produto.codigo || String(cartao.produto.id).padStart(6, "0")
    }

    const cartoesFiltrados = termoBusca
        ? cartoes.filter((cartao) => {
            return (
                cartao.produto.nome.toLowerCase().includes(termoBusca) ||
                codigoDoCartao(cartao).toLowerCase().includes(termoBusca)
            )
        })
        : cartoes


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

                    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

                        {[1, 2, 3, 4, 5, 6, 7, 8].map(item => (

                            <div
                                key={item}
                                className="overflow-hidden rounded-2xl border border-[#EAE7DE] bg-white"
                            >

                                <div className="h-56 animate-pulse bg-[#EFEDE6]" />

                                <div className="space-y-3 p-5">

                                    <div className="h-5 animate-pulse rounded bg-[#EFEDE6]" />

                                    <div className="h-4 w-1/2 animate-pulse rounded bg-[#EFEDE6]" />

                                    <div className="h-8 w-2/3 animate-pulse rounded bg-[#EFEDE6]" />

                                </div>

                            </div>

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
                        Erro ao carregar produtos
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
                            Produtos
                        </h1>

                    </div>

                    <div className="flex items-center gap-3">

                        <Link
                            href="/page/produto"
                            className="hidden items-center gap-2 rounded-lg bg-[#2F5D4E] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#264C40] sm:flex"
                        >
                            <span>＋</span>
                            <span>Novo produto</span>
                        </Link>

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C9A227]/20 font-mono text-sm font-semibold text-[#C9A227]">
                            AD
                        </div>

                        <div className="hidden sm:block">

                            <p className="text-sm font-semibold text-[#1C1B19]">
                                Administrador
                            </p>

                            <p className="text-xs text-[#8E8B80]">
                                Loja única
                            </p>

                        </div>

                    </div>

                </div>

            </header>


            {/* ==========================
                CONTEÚDO
            ========================== */}

            <div className="p-6 md:p-10">

                <div className="mx-auto max-w-7xl">

                    {/* INTRODUÇÃO */}

                    <div className="mb-8">

                        <h2 className="font-display text-3xl font-medium tracking-tight text-[#1C1B19] sm:text-4xl">
                            Gestão de produtos
                        </h2>

                        <p className="mt-2 max-w-md text-[#6F6C61]">
                            Visualize os produtos cadastrados no seu sistema.
                        </p>

                        <div className="mt-6 h-2 stitch max-w-xs opacity-70" />

                    </div>


                    {/* ==========================
                        ESTATÍSTICAS
                    ========================== */}

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">

                        {/* TOTAL */}

                        <div className="rounded-2xl border border-[#EAE7DE] bg-white p-6">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-sm text-[#8E8B80]">
                                        Produtos
                                    </p>

                                    <p className="font-mono mt-2 text-3xl font-semibold text-[#1C1B19]">
                                        {totalProdutos}
                                    </p>

                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2F5D4E]/10 text-xl">
                                    📦
                                </div>

                            </div>

                        </div>


                        {/* ESTOQUE */}

                        <div className="rounded-2xl border border-[#EAE7DE] bg-white p-6">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-sm text-[#8E8B80]">
                                        Itens em estoque
                                    </p>

                                    <p className="font-mono mt-2 text-3xl font-semibold text-[#1C1B19]">
                                        {totalEstoque}
                                    </p>

                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-xl">
                                    ✓
                                </div>

                            </div>

                        </div>


                        {/* SEM ESTOQUE */}

                        <div className="rounded-2xl border border-[#EAE7DE] bg-white p-6">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-sm text-[#8E8B80]">
                                        Sem estoque
                                    </p>

                                    <p className="font-mono mt-2 text-3xl font-semibold text-[#1C1B19]">
                                        {semEstoque}
                                    </p>

                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-xl">
                                    !
                                </div>

                            </div>

                        </div>


                        {/* VALOR EM ESTOQUE */}

                        <div className="rounded-2xl border border-[#EAE7DE] bg-white p-6">

                            <div className="flex items-center justify-between gap-3">

                                <div className="min-w-0">

                                    <p className="text-sm text-[#8E8B80]">
                                        Valor em estoque
                                    </p>

                                    <p className="font-mono mt-2 truncate text-2xl font-semibold text-[#2F5D4E]">
                                        {formatarMoeda(valorEmEstoque)}
                                    </p>

                                </div>

                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#C9A227]/15 text-xl">
                                    ◆
                                </div>

                            </div>

                        </div>

                    </div>


                    {/* ==========================
                        PRODUTOS
                    ========================== */}

                    <div className="mt-12">

                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                            <div>

                                <h2 className="font-display text-xl font-medium text-[#1C1B19]">
                                    Produtos cadastrados
                                </h2>

                                <p className="mt-1 text-sm text-[#8E8B80]">
                                    {cartoesFiltrados.length} de {cartoes.length} peça(s) encontrada(s)
                                </p>

                            </div>

                            <div className="relative w-full sm:w-72">

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

                        </div>


                        {cartoesFiltrados.length === 0 ? (

                            <div className="rounded-2xl border border-dashed border-[#D9D5C8] bg-white p-16 text-center">

                                <div className="text-5xl">
                                    📦
                                </div>

                                <h3 className="font-display mt-5 text-xl font-medium text-[#1C1B19]">
                                    Nenhum produto encontrado
                                </h3>

                                <p className="mt-2 text-sm text-[#8E8B80]">
                                    {totalProdutos === 0
                                        ? "Não existem produtos cadastrados."
                                        : "Nenhum produto corresponde à busca."}
                                </p>

                                {totalProdutos === 0 ? (

                                    <Link
                                        href="/page/produto"
                                        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#2F5D4E] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#264C40]"
                                    >
                                        <span>＋</span>
                                        <span>Cadastrar produto</span>
                                    </Link>

                                ) : (

                                    <button
                                        type="button"
                                        onClick={() => setBusca("")}
                                        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[#EAE7DE] px-6 py-3 text-sm font-medium text-[#1C1B19] transition hover:bg-[#EFEDE6]"
                                    >
                                        Limpar busca
                                    </button>

                                )}

                            </div>

                        ) : (

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

                                {cartoesFiltrados.map((cartao) => {

                                    const { produto, unidade } = cartao

                                    return (

                                    <article
                                        key={unidade ? `unidade-${unidade.id}` : `produto-${produto.id}`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => abrirModal(produto)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault()
                                                abrirModal(produto)
                                            }
                                        }}
                                        className="group cursor-pointer overflow-hidden rounded-2xl border border-[#EAE7DE] bg-white text-left transition hover:-translate-y-1 hover:shadow-lg hover:shadow-black/5"
                                    >

                                        {/* IMAGEM */}

                                        <div className="relative h-56 overflow-hidden bg-[#F6F5F1]">

                                            {produto.imagem_url ? (

                                                <img
                                                    src={produto.imagem_url}
                                                    alt={produto.nome}
                                                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                                />

                                            ) : (

                                                <div className="flex h-full items-center justify-center text-[#A19E93]">

                                                    <div className="text-center">

                                                        <div className="text-4xl">
                                                            📷
                                                        </div>

                                                        <p className="mt-2 text-sm">
                                                            Sem imagem
                                                        </p>

                                                    </div>

                                                </div>

                                            )}


                                            {/* CATEGORIA */}

                                            <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#2F5D4E] shadow">
                                                {produto.categoria || "Sem categoria"}
                                            </span>


                                            {/* DISPONIBILIDADE */}

                                            <span
                                                className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold ${
                                                    unidade
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-red-100 text-red-700"
                                                }`}
                                            >
                                                {unidade ? "Disponível" : "Sem estoque"}
                                            </span>

                                        </div>


                                        {/* DADOS */}

                                        <div className="p-5">

                                            <h3 className="font-display truncate text-lg font-medium text-[#1C1B19]">
                                                {produto.nome}
                                            </h3>

                                            <p className="mt-1 font-mono text-xs text-[#A19E93]">
                                                {codigoDoCartao(cartao)}
                                            </p>


                                            {/* PREÇO */}

                                            <div className="mt-5">

                                                {produto.preco_promocional ? (() => {

                                                    const percentual = Math.round(
                                                        ((produto.preco_promocional - produto.preco) / produto.preco) * 100
                                                    )
                                                    const aumento = percentual > 0

                                                    return (
                                                        <div className="flex items-baseline gap-2">

                                                            <span className="text-sm text-[#A19E93] line-through">
                                                                {formatarMoeda(Number(produto.preco))}
                                                            </span>

                                                            <span
                                                                className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                                                                    aumento
                                                                        ? "bg-amber-100 text-amber-700"
                                                                        : "bg-emerald-100 text-emerald-700"
                                                                }`}
                                                            >
                                                                {aumento ? "+" : ""}{percentual}%
                                                            </span>

                                                        </div>
                                                    )

                                                })() : null}

                                                <p
                                                    className={`font-mono text-2xl font-semibold ${
                                                        produto.preco_promocional ? "text-emerald-600" : "text-[#2F5D4E]"
                                                    }`}
                                                >
                                                    {formatarMoeda(Number(produto.preco_promocional ?? produto.preco))}
                                                </p>

                                                <p className="mt-1 text-xs text-[#8E8B80]">
                                                    {produto.preco_promocional ? "Promoção ativa" : "Sem promoção"} · clique para gerenciar
                                                </p>

                                            </div>


                                            {/* INFORMAÇÕES */}

                                            <div className="mt-5 space-y-3 border-t border-[#EAE7DE] pt-5">

                                                <div className="flex justify-between text-sm">

                                                    <span className="text-[#8E8B80]">
                                                        Tamanho
                                                    </span>

                                                    <span className="font-medium text-[#1C1B19]">
                                                        {produto.tamanho || "-"}
                                                    </span>

                                                </div>


                                                <div className="flex justify-between text-sm">

                                                    <span className="text-[#8E8B80]">
                                                        Cor
                                                    </span>

                                                    <span className="font-medium text-[#1C1B19]">
                                                        {produto.cor || "-"}
                                                    </span>

                                                </div>


                                                <div className="flex justify-between text-sm">

                                                    <span className="text-[#8E8B80]">
                                                        Tecido
                                                    </span>

                                                    <span className="font-medium text-[#1C1B19]">
                                                        {produto.tecido || "-"}
                                                    </span>

                                                </div>


                                                <div className="flex justify-between text-sm">

                                                    <span className="text-[#8E8B80]">
                                                        Local
                                                    </span>

                                                    <span className="font-mono font-medium text-[#1C1B19]">
                                                        {unidade && unidade.rua > 0
                                                            ? `Rua ${unidade.rua} · ${unidade.bloco}`
                                                            : "—"}
                                                    </span>

                                                </div>


                                                <div className="flex justify-between text-sm">

                                                    <span className="text-[#8E8B80]">
                                                        Código
                                                    </span>

                                                    <span className="font-mono font-medium text-[#1C1B19]">
                                                        {codigoDoCartao(cartao)}
                                                    </span>

                                                </div>

                                            </div>

                                        </div>

                                    </article>

                                    )
                                })}

                            </div>

                        )}

                    </div>

                </div>

            </div>

        </main>

        {/* ==========================
            MODAL DE PROMOÇÃO
        ========================== */}

        {produtoSelecionado && (() => {

            const precoDigitado = parseFloat(precoPromoInput.replace(",", "."))
            const temPreview = Number.isFinite(precoDigitado) && precoDigitado > 0
            const percentual = temPreview
                ? Math.round(((precoDigitado - produtoSelecionado.preco) / produtoSelecionado.preco) * 100)
                : 0
            const aumento = percentual > 0

            return (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={fecharModal}
                >
                    <div className="absolute inset-0 bg-black/50" />

                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-md rounded-2xl border border-[#EAE7DE] bg-white p-6"
                    >

                        <button
                            type="button"
                            onClick={fecharModal}
                            aria-label="Fechar"
                            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#8E8B80] transition hover:bg-[#EFEDE6]"
                        >
                            ✕
                        </button>

                        <div className="flex items-center gap-4 pr-8">

                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F6F5F1]">
                                {produtoSelecionado.imagem_url ? (
                                    <img
                                        src={produtoSelecionado.imagem_url}
                                        alt={produtoSelecionado.nome}
                                        className="h-full w-full object-cover"
                                    />
                                ) : null}
                            </div>

                            <div className="min-w-0">
                                <h2 className="font-display truncate text-lg font-medium text-[#1C1B19]">
                                    {produtoSelecionado.nome}
                                </h2>
                                <p className="text-sm text-[#8E8B80]">
                                    Preço atual: {formatarMoeda(Number(produtoSelecionado.preco))}
                                </p>
                            </div>

                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-[#EAE7DE] bg-[#F6F5F1] px-4 py-3">

                            <div>
                                <p className="text-xs text-[#8E8B80]">
                                    Estoque disponível
                                </p>
                                <p className="font-mono text-lg font-semibold text-[#1C1B19]">
                                    {produtoSelecionado.estoque} un.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={venderUnidadeSelecionada}
                                disabled={vendendoUnidade || produtoSelecionado.estoque <= 0}
                                className="rounded-lg bg-[#1C1B19] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1C1B19]/85 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {vendendoUnidade ? "Vendendo..." : "Vender 1 unidade"}
                            </button>

                        </div>

                        {mensagemVenda && (
                            <p className="mt-2 text-xs text-[#6F6C61]">
                                {mensagemVenda}
                            </p>
                        )}

                        <div className="mt-6 space-y-1.5">

                            <label className="block text-xs font-medium text-[#6F6C61]">
                                Novo preço (R$)
                            </label>

                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                autoFocus
                                value={precoPromoInput}
                                onChange={(e) => setPrecoPromoInput(e.target.value)}
                                placeholder="Ex: 59.90"
                                className="field font-mono"
                            />

                            <p className="text-xs text-[#8E8B80]">
                                Escolha um valor menor (desconto) ou maior (reajuste) que o preço atual.
                            </p>

                        </div>

                        {temPreview && percentual !== 0 && (
                            <div className="mt-3 flex items-center gap-2">
                                <span className="text-sm text-[#A19E93] line-through">
                                    {formatarMoeda(Number(produtoSelecionado.preco))}
                                </span>
                                <span className="font-mono text-lg font-semibold text-emerald-600">
                                    {formatarMoeda(precoDigitado)}
                                </span>
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                                        aumento
                                            ? "bg-amber-100 text-amber-700"
                                            : "bg-emerald-100 text-emerald-700"
                                    }`}
                                >
                                    {aumento ? "+" : ""}{percentual}%
                                </span>
                            </div>
                        )}

                        {erroPromo && (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                                {erroPromo}
                            </div>
                        )}

                        <div className="mt-6 flex flex-col gap-2">

                            <button
                                type="button"
                                onClick={salvarPromocao}
                                disabled={salvandoPromo}
                                className="w-full rounded-lg bg-[#2F5D4E] py-2.5 text-sm font-semibold text-white transition hover:bg-[#264C40] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {salvandoPromo ? "Salvando..." : "Salvar promoção"}
                            </button>

                            <Link
                                href={`/page/produto/editar/${produtoSelecionado.id}`}
                                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#EAE7DE] py-2.5 text-sm font-medium text-[#1C1B19] transition hover:bg-[#EFEDE6]"
                            >
                                <span>✎</span>
                                <span>Editar produto</span>
                            </Link>

                            <Link
                                href={`/page/produto/etiqueta/${produtoSelecionado.id}`}
                                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#EAE7DE] py-2.5 text-sm font-medium text-[#1C1B19] transition hover:bg-[#EFEDE6]"
                            >
                                <span>🖨</span>
                                <span>Imprimir etiqueta</span>
                            </Link>

                            <div className="flex gap-2">

                                {produtoSelecionado.preco_promocional ? (
                                    <button
                                        type="button"
                                        onClick={excluirPromocao}
                                        disabled={salvandoPromo}
                                        className="flex-1 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                    >
                                        Remover promoção
                                    </button>
                                ) : null}

                                <button
                                    type="button"
                                    onClick={fecharModal}
                                    disabled={salvandoPromo}
                                    className="flex-1 rounded-lg px-3 py-2 text-sm font-medium text-[#6F6C61] transition hover:bg-[#EFEDE6] disabled:opacity-50"
                                >
                                    Cancelar
                                </button>

                            </div>

                        </div>

                    </div>
                </div>
            )

        })()}

        </>
    )
}
