"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto, Unidade } from "@/app/type/type"
import { listarProdutos, listarTodasUnidades, excluirProduto, publicarProduto } from "@/middleware/produtos"
import { criarPromocao, removerPromocao } from "@/middleware/promocoes"
import { consultarMenu } from "@/middleware/assinatura"
import { validarPromocao } from "@/security/validate"
import { ApiError } from "@/middleware/client"
import Pagination from "@/app/components/pagination/pagination"
import { atributosParaFicha } from "@/app/components/produto/campos"
import Preco, { Desconto, formatarMoeda } from "@/app/components/preco/preco"
import {
    FiSearch,
    FiX,
    FiBox,
    FiCheck,
    FiAlertTriangle,
    FiDollarSign,
    FiCamera,
    FiEdit2,
    FiPrinter,
    FiPlus,
    FiEye,
    FiEyeOff,
} from "react-icons/fi"

interface CartaoProduto {
    produto: Produto
    unidade: Unidade | null
}

const ITENS_POR_PAGINA = 10

export default function Home() {

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [unidades, setUnidades] = useState<Unidade[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
    const [precoPromoInput, setPrecoPromoInput] = useState("")
    const [erroPromo, setErroPromo] = useState("")
    const [salvandoPromo, setSalvandoPromo] = useState(false)

    // Pôr no site e tirar do site. Produto nasce fora da vitrine (o padrão
    // da coluna é falso), então esta é a chave que faz a peça aparecer para
    // o cliente — e ela mora aqui porque esta é a lista do que a loja
    // oferece. Tirar do site não apaga nada: a mercadoria continua no
    // estoque, contada e endereçada como antes.
    const [publicandoId, setPublicandoId] = useState<number | null>(null)
    const [erroSite, setErroSite] = useState("")

    // Só faz sentido oferecer "pôr no site" a quem tem site: no plano de
    // estoque a rota de publicar responde 402, e um botão que só sabe falhar
    // é pior do que botão nenhum.
    //
    // Quem responde isso é o menu, e não a tela da loja: /private/loja
    // também exige o plano com site, então perguntar por lá seria levar o
    // mesmo 402 que se está tentando evitar.
    const [temSite, setTemSite] = useState(false)

    const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
    const [excluindoProduto, setExcluindoProduto] = useState(false)
    const [erroExclusao, setErroExclusao] = useState("")

    const [busca, setBusca] = useState("")
    const [paginaAtual, setPaginaAtual] = useState(1)

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

        let cancelado = false

        consultarMenu()
            .then((itens) => {
                if (!cancelado) setTemSite(itens.some((item) => item.chave === "loja"))
            })
            .catch(() => {
                // Sem resposta, a loja fica sem os botões de vitrine. Errar
                // para o lado de não oferecer é o barato: o resto da tela
                // (preço, promoção, etiqueta) continua inteiro.
            })

        return () => {
            cancelado = true
        }

    }, [])

    function abrirModal(produto: Produto) {
        setProdutoSelecionado(produto)
        setPrecoPromoInput(produto.preco_promocional ? String(produto.preco_promocional) : "")
        setErroPromo("")
        setConfirmandoExclusao(false)
        setErroExclusao("")
    }

    async function alternarSite(produto: Produto) {

        setErroSite("")
        setPublicandoId(produto.id)

        try {
            await publicarProduto(produto.id, !produto.publicado)

            await carregarProdutos()

            // O modal segura uma cópia do produto: sem atualizá-la, o botão
            // continuaria oferecendo o que acabou de ser feito.
            setProdutoSelecionado((atual) =>
                atual && atual.id === produto.id
                    ? { ...atual, publicado: !produto.publicado }
                    : atual
            )

        } catch (e) {
            setErroSite(e instanceof ApiError ? e.message : "Não foi possível atualizar a vitrine.")
        } finally {
            setPublicandoId(null)
        }
    }

    function fecharModal() {
        setProdutoSelecionado(null)
        setErroSite("")
        setPrecoPromoInput("")
        setErroPromo("")
        setConfirmandoExclusao(false)
        setErroExclusao("")
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

    async function excluirProdutoSelecionado() {

        if (!produtoSelecionado) return

        try {

            setExcluindoProduto(true)
            setErroExclusao("")

            await excluirProduto(produtoSelecionado.id)

            fecharModal()

            await carregarProdutos()

        } catch (error) {

            console.error("Erro ao excluir produto:", error)

            setErroExclusao(
                error instanceof ApiError ? error.message : "Não foi possível excluir o produto."
            )

        } finally {

            setExcluindoProduto(false)

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
        // Um código só, o do produto: a peça não tem outro. O id com seis
        // dígitos cobre o produto cadastrado antes de o código existir.
        return cartao.produto.codigo || String(cartao.produto.id).padStart(6, "0")
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
    // PAGINAÇÃO
    // ==============================

    const totalPaginas = Math.max(1, Math.ceil(cartoesFiltrados.length / ITENS_POR_PAGINA))
    const paginaAtualCorrigida = Math.min(paginaAtual, totalPaginas)

    const cartoesDaPagina = cartoesFiltrados.slice(
        (paginaAtualCorrigida - 1) * ITENS_POR_PAGINA,
        paginaAtualCorrigida * ITENS_POR_PAGINA
    )

    function aoMudarBusca(valor: string) {
        setBusca(valor)
        setPaginaAtual(1)
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

                    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

                        {[1, 2, 3, 4, 5, 6, 7, 8].map(item => (

                            <div
                                key={item}
                                className="card overflow-hidden"
                            >

                                <div className="h-56 animate-pulse bg-[#F0F3F4]" />

                                <div className="space-y-3 p-5">

                                    <div className="h-5 animate-pulse rounded bg-[#F0F3F4]" />

                                    <div className="h-4 w-1/2 animate-pulse rounded bg-[#F0F3F4]" />

                                    <div className="h-8 w-2/3 animate-pulse rounded bg-[#F0F3F4]" />

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

            <main className="min-h-screen bg-[#F0F3F4] p-8 md:ml-64">

                <div className="card mx-auto max-w-xl p-10 text-center">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FDECEA] text-[#D4351C]">
                        <FiAlertTriangle className="w-7" aria-hidden />
                    </div>

                    <h1 className="font-display mt-5 text-2xl text-[#1E2428]">
                        Erro ao carregar produtos
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
                            Produtos
                        </h1>

                    </div>

                    <div className="flex items-center gap-3">

                        <Link
                            href="/page/produto"
                            className="btn btn-primario hidden sm:inline-flex"
                        >
                            <FiPlus className="w-4" aria-hidden />
                            <span>Novo produto</span>
                        </Link>

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F3FF] text-sm font-extrabold text-[#0075E2]">
                            AD
                        </div>

                        <div className="hidden sm:block">

                            <p className="text-sm font-bold text-[#1E2428]">
                                Administrador
                            </p>

                            <p className="text-xs text-[#8C969B]">
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

                        <h2 className="font-display text-3xl text-[#1E2428] sm:text-4xl">
                            Gestão de produtos
                        </h2>

                        <p className="mt-2 max-w-md text-[#5A6469]">
                            Visualize os produtos cadastrados no seu sistema.
                        </p>

                    </div>


                    {/* ==========================
                        ESTATÍSTICAS
                    ========================== */}

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">

                        {/* TOTAL */}

                        <div className="card p-6">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-sm text-[#5A6469]">
                                        Produtos
                                    </p>

                                    <p className="num mt-2 text-3xl font-extrabold text-[#1E2428]">
                                        {totalProdutos}
                                    </p>

                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E6F3FF] text-[#0086FF]">
                                    <FiBox className="w-5" aria-hidden />
                                </div>

                            </div>

                        </div>


                        {/* ESTOQUE */}

                        <div className="card p-6">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-sm text-[#5A6469]">
                                        Itens em estoque
                                    </p>

                                    <p className="num mt-2 text-3xl font-extrabold text-[#1E2428]">
                                        {totalEstoque}
                                    </p>

                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E0FFEE] text-[#08A022]">
                                    <FiCheck className="w-5" aria-hidden />
                                </div>

                            </div>

                        </div>


                        {/* SEM ESTOQUE */}

                        <div className="card p-6">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-sm text-[#5A6469]">
                                        Sem estoque
                                    </p>

                                    <p className="num mt-2 text-3xl font-extrabold text-[#1E2428]">
                                        {semEstoque}
                                    </p>

                                </div>

                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FDECEA] text-[#D4351C]">
                                    <FiAlertTriangle className="w-5" aria-hidden />
                                </div>

                            </div>

                        </div>


                        {/* VALOR EM ESTOQUE */}

                        <div className="card p-6">

                            <div className="flex items-center justify-between gap-3">

                                <div className="min-w-0">

                                    <p className="text-sm text-[#5A6469]">
                                        Valor em estoque
                                    </p>

                                    <p className="num mt-2 truncate text-2xl font-extrabold text-[#0086FF]">
                                        {formatarMoeda(valorEmEstoque)}
                                    </p>

                                </div>

                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFF6E0] text-[#8A6C1B]">
                                    <FiDollarSign className="w-5" aria-hidden />
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

                                <h2 className="font-display text-xl text-[#1E2428]">
                                    Produtos cadastrados
                                </h2>

                                <p className="mt-1 text-sm text-[#5A6469]">
                                    <span className="num">{cartoesFiltrados.length}</span> de{" "}
                                    <span className="num">{cartoes.length}</span> produto(s) encontrado(s)
                                </p>

                            </div>

                            <div className="relative w-full sm:w-72">

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

                        </div>


                        {cartoesFiltrados.length === 0 ? (

                            <div className="rounded-lg border border-dashed border-[#D3DADD] bg-white p-16 text-center">

                                <FiBox className="mx-auto w-10 text-[#8C969B]" aria-hidden />

                                <h3 className="font-display mt-5 text-xl text-[#1E2428]">
                                    Nenhum produto encontrado
                                </h3>

                                <p className="mt-2 text-sm text-[#5A6469]">
                                    {totalProdutos === 0
                                        ? "Não existem produtos cadastrados."
                                        : "Nenhum produto corresponde à busca."}
                                </p>

                                {totalProdutos === 0 ? (

                                    <Link
                                        href="/page/produto"
                                        className="btn btn-primario mt-6"
                                    >
                                        <FiPlus className="w-4" aria-hidden />
                                        <span>Cadastrar produto</span>
                                    </Link>

                                ) : (

                                    <button
                                        type="button"
                                        onClick={() => aoMudarBusca("")}
                                        className="btn btn-neutro mt-6"
                                    >
                                        Limpar busca
                                    </button>

                                )}

                            </div>

                        ) : (

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

                                {cartoesDaPagina.map((cartao) => {

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
                                        className="card card-hover group cursor-pointer overflow-hidden text-left"
                                    >

                                        {/* IMAGEM */}

                                        <div className="relative h-56 overflow-hidden bg-[#F0F3F4]">

                                            {produto.imagem_url ? (

                                                <img
                                                    src={produto.imagem_url}
                                                    alt={produto.nome}
                                                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                                />

                                            ) : (

                                                <div className="flex h-full items-center justify-center text-[#8C969B]">

                                                    <div className="text-center">

                                                        <FiCamera className="mx-auto w-7" aria-hidden />

                                                        <p className="mt-2 text-sm">
                                                            Sem imagem
                                                        </p>

                                                    </div>

                                                </div>

                                            )}


                                            {/* CATEGORIA */}

                                            <span className="tag tag-info absolute left-4 top-4 bg-white/95 shadow-sm">
                                                {produto.categoria || "Sem categoria"}
                                            </span>


                                            {/* DISPONIBILIDADE */}

                                            <span
                                                className={`tag absolute right-4 top-4 shadow-sm ${
                                                    unidade ? "tag-success bg-white/95" : "tag-danger bg-white/95"
                                                }`}
                                            >
                                                {unidade ? "Disponível" : "Sem estoque"}
                                            </span>


                                            {/* FORA DO SITE — só quando está
                                                fora. Um selo em todo produto
                                                publicado seria ruído: o normal
                                                é estar no site. */}

                                            {temSite && !produto.publicado && (
                                                <span className="tag tag-neutral absolute bottom-4 left-4 bg-white/95 shadow-sm">
                                                    <FiEyeOff className="w-3.5" aria-hidden />
                                                    Fora do site
                                                </span>
                                            )}

                                        </div>


                                        {/* DADOS */}

                                        <div className="p-5">

                                            <h3 className="font-display truncate text-lg text-[#1E2428]">
                                                {produto.nome}
                                            </h3>

                                            <p className="mt-1 font-mono text-xs text-[#8C969B]">
                                                {codigoDoCartao(cartao)}
                                            </p>


                                            {/* PREÇO */}

                                            <div className="mt-5">

                                                {produto.preco_promocional ? (
                                                    <div className="mb-1">
                                                        <Desconto
                                                            de={Number(produto.preco)}
                                                            para={Number(produto.preco_promocional)}
                                                        />
                                                    </div>
                                                ) : null}

                                                <Preco
                                                    valor={Number(produto.preco_promocional ?? produto.preco)}
                                                    valorAntigo={produto.preco_promocional ? Number(produto.preco) : null}
                                                    className="text-2xl"
                                                />

                                                <p className="mt-1 text-xs text-[#5A6469]">
                                                    {produto.preco_promocional ? "Promoção ativa" : "Sem promoção"} · clique para gerenciar
                                                </p>

                                            </div>


                                            {/* INFORMAÇÕES */}

                                            <div className="mt-5 space-y-3 border-t border-[#D3DADD] pt-5">

                                                {produto.variacao && (
                                                    <div className="flex justify-between text-sm">

                                                        <span className="text-[#5A6469]">
                                                            {produto.variacao_rotulo || "Variação"}
                                                        </span>

                                                        <span className="font-bold text-[#1E2428]">
                                                            {produto.variacao}
                                                        </span>

                                                    </div>
                                                )}

                                                {atributosParaFicha(produto.atributos).map(({ nome, valor }) => (
                                                    <div key={nome} className="flex justify-between gap-3 text-sm">

                                                        <span className="text-[#5A6469]">{nome}</span>

                                                        <span className="min-w-0 break-words text-right font-bold text-[#1E2428]">
                                                            {valor}
                                                        </span>

                                                    </div>
                                                ))}

                                                <div className="flex justify-between text-sm">

                                                    <span className="text-[#5A6469]">
                                                        Local
                                                    </span>

                                                    <span className="font-mono font-bold text-[#1E2428]">
                                                        {unidade?.endereco || "—"}
                                                    </span>

                                                </div>


                                                <div className="flex justify-between text-sm">

                                                    <span className="text-[#5A6469]">
                                                        Código
                                                    </span>

                                                    <span className="font-mono font-bold text-[#1E2428]">
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

                        <Pagination
                            paginaAtual={paginaAtualCorrigida}
                            totalPaginas={totalPaginas}
                            aoMudarPagina={setPaginaAtual}
                        />

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

            return (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={fecharModal}
                >
                    <div className="absolute inset-0 bg-[#1E2428]/50" />

                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="card relative w-full max-w-md p-6"
                    >

                        <button
                            type="button"
                            onClick={fecharModal}
                            aria-label="Fechar"
                            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#5A6469] transition-colors hover:bg-[#F0F3F4]"
                        >
                            <FiX className="w-4" aria-hidden />
                        </button>

                        <div className="flex items-center gap-4 pr-8">

                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#F0F3F4]">
                                {produtoSelecionado.imagem_url ? (
                                    <img
                                        src={produtoSelecionado.imagem_url}
                                        alt={produtoSelecionado.nome}
                                        className="h-full w-full object-cover"
                                    />
                                ) : null}
                            </div>

                            <div className="min-w-0">
                                <h2 className="font-display truncate text-lg text-[#1E2428]">
                                    {produtoSelecionado.nome}
                                </h2>
                                <p className="text-sm text-[#5A6469]">
                                    Preço atual: <span className="num">{formatarMoeda(Number(produtoSelecionado.preco))}</span>
                                </p>
                            </div>

                        </div>

                        <div className="mt-5 rounded-lg border border-[#D3DADD] bg-[#F0F3F4] px-4 py-3">
                            <p className="text-xs text-[#5A6469]">
                                Estoque disponível
                            </p>
                            <p className="num text-lg font-extrabold text-[#1E2428]">
                                {produtoSelecionado.estoque} un.
                            </p>
                        </div>

                        <div className="mt-6 space-y-1.5">

                            <label className="rotulo">
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
                                className="field num"
                            />

                            <p className="text-xs text-[#5A6469]">
                                Escolha um valor menor (desconto) ou maior (reajuste) que o preço atual.
                            </p>

                        </div>

                        {temPreview && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Preco
                                    valor={precoDigitado}
                                    valorAntigo={Number(produtoSelecionado.preco)}
                                    className="text-lg"
                                />
                                <Desconto
                                    de={Number(produtoSelecionado.preco)}
                                    para={precoDigitado}
                                />
                            </div>
                        )}

                        {erroPromo && (
                            <div className="mt-4 rounded-lg bg-[#FDECEA] px-4 py-2.5 text-sm font-semibold text-[#D4351C]">
                                {erroPromo}
                            </div>
                        )}

                        {erroSite && (
                            <div className="mt-4 rounded-lg bg-[#FDECEA] px-4 py-2.5 text-sm font-semibold text-[#D4351C]">
                                {erroSite}
                            </div>
                        )}

                        <div className="mt-6 flex flex-col gap-2">

                            <button
                                type="button"
                                onClick={salvarPromocao}
                                disabled={salvandoPromo}
                                className="btn btn-primario w-full"
                            >
                                {salvandoPromo ? "Salvando..." : "Salvar promoção"}
                            </button>

                            {temSite && (
                            <button
                                type="button"
                                onClick={() => alternarSite(produtoSelecionado)}
                                disabled={publicandoId === produtoSelecionado.id}
                                className="btn btn-neutro w-full"
                            >
                                {produtoSelecionado.publicado ? (
                                    <>
                                        <FiEyeOff className="w-4" aria-hidden />
                                        <span>Tirar do site</span>
                                    </>
                                ) : (
                                    <>
                                        <FiEye className="w-4" aria-hidden />
                                        <span>Pôr no site</span>
                                    </>
                                )}
                            </button>
                            )}

                            <Link
                                href={`/page/produto/editar/${produtoSelecionado.id}`}
                                className="btn btn-neutro w-full"
                            >
                                <FiEdit2 className="w-4" aria-hidden />
                                <span>Editar produto</span>
                            </Link>

                            <Link
                                href={`/page/produto/etiqueta/${produtoSelecionado.id}`}
                                className="btn btn-neutro w-full"
                            >
                                <FiPrinter className="w-4" aria-hidden />
                                <span>Imprimir etiqueta</span>
                            </Link>

                            <div className="flex gap-2">

                                {produtoSelecionado.preco_promocional ? (
                                    <button
                                        type="button"
                                        onClick={excluirPromocao}
                                        disabled={salvandoPromo}
                                        className="flex-1 rounded-lg px-3 py-2 text-sm font-bold text-[#D4351C] transition-colors hover:bg-[#FDECEA] disabled:opacity-50"
                                    >
                                        Remover promoção
                                    </button>
                                ) : null}

                                <button
                                    type="button"
                                    onClick={fecharModal}
                                    disabled={salvandoPromo}
                                    className="flex-1 rounded-lg px-3 py-2 text-sm font-bold text-[#5A6469] transition-colors hover:bg-[#F0F3F4] disabled:opacity-50"
                                >
                                    Cancelar
                                </button>

                            </div>

                        </div>

                        {/* EXCLUIR PRODUTO */}

                        <div className="mt-4 border-t border-[#D3DADD] pt-4">

                            {confirmandoExclusao ? (

                                <div className="space-y-2">

                                    <p className="text-sm font-semibold text-[#D4351C]">
                                        Excluir permanentemente &ldquo;{produtoSelecionado.nome}&rdquo;? Essa ação não pode ser desfeita.
                                    </p>

                                    {erroExclusao && (
                                        <div className="rounded-lg bg-[#FDECEA] px-4 py-2.5 text-sm font-semibold text-[#D4351C]">
                                            {erroExclusao}
                                        </div>
                                    )}

                                    <div className="flex gap-2">

                                        <button
                                            type="button"
                                            onClick={() => setConfirmandoExclusao(false)}
                                            disabled={excluindoProduto}
                                            className="flex-1 rounded-lg px-3 py-2 text-sm font-bold text-[#5A6469] transition-colors hover:bg-[#F0F3F4] disabled:opacity-50"
                                        >
                                            Cancelar
                                        </button>

                                        <button
                                            type="button"
                                            onClick={excluirProdutoSelecionado}
                                            disabled={excluindoProduto}
                                            className="btn btn-perigo flex-1"
                                        >
                                            {excluindoProduto ? "Excluindo..." : "Sim, excluir"}
                                        </button>

                                    </div>

                                </div>

                            ) : (

                                <button
                                    type="button"
                                    onClick={() => setConfirmandoExclusao(true)}
                                    className="w-full rounded-lg px-3 py-2 text-sm font-bold text-[#D4351C] transition-colors hover:bg-[#FDECEA]"
                                >
                                    Excluir produto
                                </button>

                            )}

                        </div>

                    </div>
                </div>
            )

        })()}

        </>
    )
}
