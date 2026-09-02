"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto } from "@/app/type/type"
import { listarProdutos } from "@/middleware/produtos"
import {
    registrarEntrada,
    type EnderecoDaEntrada,
    type ItemEntrada,
} from "@/middleware/estoque"
import { ApiError } from "@/middleware/client"
import { descreverVariacao } from "@/app/components/produto/campos"
import { formatarMoeda } from "@/app/components/preco/preco"
import {
    FiAlertCircle,
    FiCheckCircle,
    FiMapPin,
    FiPackage,
    FiPlus,
    FiSearch,
    FiTruck,
    FiX,
} from "react-icons/fi"

/**
 * Entrada de mercadoria: o que chegou do fornecedor virando peça no estoque.
 *
 * O caminho é o do recebimento de qualquer estoque sério: diz-se de onde a
 * remessa veio, escolhem-se os produtos que chegaram, informa-se quantas
 * peças de cada um, por quanto e em que endereço foram guardadas. O sistema
 * cria as peças, soma o estoque e deixa as etiquetas prontas para imprimir.
 *
 * Produto novo nasce em Cadastrar produto, e só lá. Esta tela já teve um
 * cadastro rápido embutido, e ele era uma segunda porta para a mesma coisa:
 * dois formulários de produto, com campos diferentes, e o lojista tendo de
 * adivinhar em qual dos dois cadastrar. Aqui entra o que a loja já vende —
 * é a diferença entre "comprei mais do mesmo" e "passei a vender uma coisa
 * nova".
 */

/** Uma linha da remessa em edição, com os campos ainda como texto. */
interface LinhaEntrada {
    produtoId: number
    quantidade: string
    custo: string
}

export default function InserirEstoque() {
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [carregando, setCarregando] = useState(true)

    const [linhas, setLinhas] = useState<LinhaEntrada[]>([])

    // O custo costuma ser o mesmo no lote inteiro: preenche-se uma vez e
    // aplica-se a todas as linhas, em vez de digitar item a item.
    const [custoPadrao, setCustoPadrao] = useState("")

    const [seletorAberto, setSeletorAberto] = useState(false)
    const [busca, setBusca] = useState("")

    const [erro, setErro] = useState("")
    const [enviando, setEnviando] = useState(false)
    // Depois de dar entrada, o que interessa é saber onde guardar a caixa
    // que está na mão: o servidor devolve o endereço de cada item.
    const [resultado, setResultado] = useState<
        { pecas: number; produtos: number; enderecos: EnderecoDaEntrada[] } | null
    >(null)

    useEffect(() => {
        let cancelado = false

        async function carregar() {
            try {
                const listaProdutos = await listarProdutos()

                if (cancelado) return

                setProdutos(listaProdutos)
            } catch (e) {
                if (!cancelado) setErro(e instanceof Error ? e.message : "Não foi possível carregar os produtos")
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        carregar()

        return () => {
            cancelado = true
        }
    }, [])

    const produtosPorId = useMemo(() => {
        const mapa = new Map<number, Produto>()
        for (const produto of produtos) mapa.set(produto.id, produto)
        return mapa
    }, [produtos])

    const termo = busca.trim().toLowerCase()

    const produtosFiltrados = termo
        ? produtos.filter(
            (produto) =>
                produto.nome.toLowerCase().includes(termo) ||
                produto.codigo?.toLowerCase().includes(termo) ||
                produto.variacao?.toLowerCase().includes(termo)
        )
        : produtos

    const escolhidos = new Set(linhas.map((linha) => linha.produtoId))

    function alternar(produtoId: number) {
        setLinhas((atual) =>
            atual.some((linha) => linha.produtoId === produtoId)
                ? atual.filter((linha) => linha.produtoId !== produtoId)
                : [...atual, novaLinha(produtoId)]
        )
    }

    function novaLinha(produtoId: number): LinhaEntrada {
        return { produtoId, quantidade: "", custo: custoPadrao }
    }

    /** Marca todos os produtos da busca atual, sem desmarcar o que já entrou. */
    function selecionarTodos() {
        setLinhas((atual) => {
            const jaTem = new Set(atual.map((linha) => linha.produtoId))
            const novos = produtosFiltrados
                .filter((produto) => !jaTem.has(produto.id))
                .map((produto) => novaLinha(produto.id))

            return [...atual, ...novos]
        })
    }

    function limparSelecao() {
        setLinhas([])
    }

    function mudarLinha(produtoId: number, campo: keyof LinhaEntrada, valor: string) {
        setLinhas((atual) =>
            atual.map((linha) => (linha.produtoId === produtoId ? { ...linha, [campo]: valor } : linha))
        )
    }

    /** Repete o custo em todas as linhas. */
    function aplicarPadroes() {
        setLinhas((atual) =>
            atual.map((linha) => ({ ...linha, custo: custoPadrao || linha.custo }))
        )
    }

    const totalPecas = linhas.reduce((soma, linha) => soma + (parseInt(linha.quantidade, 10) || 0), 0)

    const custoTotal = linhas.reduce((soma, linha) => {
        const quantidade = parseInt(linha.quantidade, 10) || 0
        const custo = parseFloat(linha.custo.replace(",", ".")) || 0
        return soma + quantidade * custo
    }, 0)

    async function darEntrada() {
        setErro("")
        setResultado(null)

        if (linhas.length === 0) {
            setErro("Escolha ao menos um produto.")
            return
        }

        const itens: ItemEntrada[] = []

        for (const linha of linhas) {

            const produto = produtosPorId.get(linha.produtoId)
            const quantidade = parseInt(linha.quantidade, 10)

            if (!Number.isFinite(quantidade) || quantidade <= 0) {
                setErro(`Informe a quantidade de "${produto?.nome ?? "produto"}".`)
                return
            }

            const custo = parseFloat(linha.custo.replace(",", ".")) || 0

            if (custo < 0) {
                setErro(`O custo de "${produto?.nome ?? "produto"}" não pode ser negativo.`)
                return
            }

            itens.push({
                produto_id: linha.produtoId,
                quantidade,
                custo_unitario: custo,
            })
        }

        try {
            setEnviando(true)

            const resposta = await registrarEntrada({ itens })

            setResultado({
                pecas: resposta.entrada?.pecas ?? totalPecas,
                produtos: itens.length,
                enderecos: resposta.enderecos ?? [],
            })

            setLinhas([])

            // Recarrega o estoque para as contagens da tela refletirem o que
            // acabou de entrar.
            setProdutos(await listarProdutos())

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível registrar a entrada")
        } finally {
            setEnviando(false)
        }
    }

    if (carregando) {
        return (
            <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">
                <p className="text-[#5A6469]">Carregando estoque...</p>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">
            <div className="mx-auto max-w-5xl space-y-6">

                <div>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5A6469]">
                        Estoque
                    </p>
                    <h1 className="font-display text-2xl text-[#1E2428]">
                        Inserir no estoque
                    </h1>
                    <p className="mt-1 text-sm text-[#5A6469]">
                        O que entra no estoque: produto novo, que ainda não existe no
                        sistema, ou mais peças do que você já vende. O endereço de cada
                        peça é escolhido pelo sistema.
                    </p>
                </div>

                {erro && (
                    <div
                        role="alert"
                        className="flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]"
                    >
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                {resultado && (
                    <section role="status" className="card border-l-4 border-l-[#1E9E5A] p-5">

                        <p className="flex items-start gap-2.5 text-sm font-semibold text-[#1E9E5A]">
                            <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                            <span>
                                Entrada registrada: {resultado.pecas} peça(s) de {resultado.produtos}{" "}
                                produto(s) entraram no estoque.
                            </span>
                        </p>

                        {resultado.enderecos.length > 0 && (
                            <>
                                <p className="mt-4 text-sm font-semibold text-[#1E2428]">
                                    Onde guardar:
                                </p>

                                <ul className="mt-2 space-y-1.5">
                                    {resultado.enderecos.map((endereco) => (
                                        <li
                                            key={`${endereco.produto_id}-${endereco.endereco}`}
                                            className="flex items-center justify-between gap-3 text-sm"
                                        >
                                            <span className="min-w-0 truncate text-[#1E2428]">
                                                <span className="num text-[#5A6469]">{endereco.quantidade}x</span>{" "}
                                                {endereco.produto_nome}
                                            </span>

                                            <span className="flex shrink-0 items-center gap-1.5 text-right font-bold text-[#0075E2]">
                                                <FiMapPin className="w-3.5 shrink-0" aria-hidden />
                                                <span>
                                                    <span className="num">{endereco.endereco}</span>
                                                    <span className="block text-xs font-normal text-[#5A6469]">
                                                        {endereco.endereco_nome}
                                                    </span>
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                <div className="mt-4 flex flex-wrap gap-3 border-t border-[#E4E9EB] pt-4">
                                    <Link href="/page/estoque/consultar" className="btn btn-neutro text-sm">
                                        Consultar estoque
                                    </Link>
                                </div>
                            </>
                        )}

                    </section>
                )}

                {/* O QUE CHEGOU */}
                <section className="card space-y-5 p-5 sm:p-7">

                    <div className="flex flex-wrap items-center justify-between gap-3">

                        <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E6F3FF] text-[#0075E2]">
                                <FiPackage className="w-4" aria-hidden />
                            </span>
                            <h2 className="font-display text-base text-[#1E2428]">O que entra no estoque</h2>
                        </div>

                        <button
                            type="button"
                            onClick={() => setSeletorAberto(true)}
                            className="btn btn-primario flex items-center gap-2"
                        >
                            <FiPackage className="w-4" aria-hidden />
                            Escolher produtos
                        </button>

                    </div>

                    {/* O custo se repete no lote inteiro; o endereço quem
                        escolhe é o sistema. */}
                    <div className="grid grid-cols-1 gap-3 rounded-lg bg-[#F0F3F4] p-4 sm:grid-cols-[1fr_auto]">

                        <div className="space-y-1.5">
                            <label className="rotulo text-xs" htmlFor="custo-padrao">
                                Custo unitário (todos)
                            </label>
                            <input
                                id="custo-padrao"
                                type="text"
                                inputMode="decimal"
                                value={custoPadrao}
                                onChange={(e) => setCustoPadrao(e.target.value)}
                                placeholder="0,00"
                                className="field num"
                            />
                        </div>

                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={aplicarPadroes}
                                disabled={linhas.length === 0}
                                className="btn btn-neutro w-full text-sm"
                            >
                                Aplicar a todos
                            </button>
                        </div>

                    </div>

                    <p className="flex items-start gap-2 text-xs text-[#5A6469]">
                        <FiMapPin className="mt-0.5 w-3.5 shrink-0 text-[#0086FF]" aria-hidden />
                        <span>
                            Você não precisa dizer a prateleira: o sistema guarda cada produto
                            junto do que já existe dele e, quando é a primeira vez, no trecho
                            mais vazio do estoque. O endereço aparece aqui assim que a entrada
                            for registrada.
                        </span>
                    </p>

                    {linhas.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-[#D3DADD] px-4 py-8 text-center text-sm text-[#5A6469]">
                            Nenhum produto escolhido ainda. Use <strong>Escolher produtos</strong> para
                            abrir o estoque e marcar o que chegou.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {linhas.map((linha) => {

                                const produto = produtosPorId.get(linha.produtoId)
                                const variacao = descreverVariacao(produto?.variacao_rotulo, produto?.variacao)

                                return (
                                    <div
                                        key={linha.produtoId}
                                        className="rounded-lg border border-[#E4E9EB] p-4"
                                    >

                                        <div className="flex items-start justify-between gap-3">

                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-[#1E2428]">
                                                    {produto?.nome ?? `Produto #${linha.produtoId}`}
                                                </p>
                                                <p className="num text-xs text-[#5A6469]">
                                                    {produto?.codigo}
                                                    {variacao ? ` · ${variacao}` : ""}
                                                    {` · ${produto?.estoque ?? 0} em estoque`}
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => alternar(linha.produtoId)}
                                                aria-label={`Tirar ${produto?.nome ?? "produto"} da remessa`}
                                                className="shrink-0 rounded-lg p-2 text-[#8C969B] transition-colors hover:bg-[#FDECEA] hover:text-[#D4351C]"
                                            >
                                                <FiX className="w-4" aria-hidden />
                                            </button>

                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-3">

                                            <div className="space-y-1">
                                                <label className="rotulo text-xs">Quantidade</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={linha.quantidade}
                                                    onChange={(e) => mudarLinha(linha.produtoId, "quantidade", e.target.value)}
                                                    className="field num"
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <label className="rotulo text-xs">Custo unit.</label>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={linha.custo}
                                                    onChange={(e) => mudarLinha(linha.produtoId, "custo", e.target.value)}
                                                    placeholder="0,00"
                                                    className="field num"
                                                />
                                            </div>

                                        </div>

                                    </div>
                                )
                            })}
                        </div>
                    )}

                </section>

                {/* FECHAMENTO */}
                <section className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-7">

                    <div className="text-sm text-[#5A6469]">
                        <p>
                            <span className="num font-bold text-[#1E2428]">{linhas.length}</span> produto(s) ·{" "}
                            <span className="num font-bold text-[#1E2428]">{totalPecas}</span> peça(s)
                        </p>
                        <p className="mt-0.5">
                            Custo total:{" "}
                            <span className="num font-bold text-[#1E2428]">{formatarMoeda(custoTotal)}</span>
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={darEntrada}
                        disabled={enviando || linhas.length === 0}
                        className="btn btn-primario flex items-center gap-2"
                    >
                        <FiTruck className="w-4" aria-hidden />
                        {enviando ? "Registrando..." : "Dar entrada"}
                    </button>

                </section>

            </div>

            {/* SELETOR DE PRODUTOS — o estoque inteiro, para marcar o que chegou */}
            {seletorAberto && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="titulo-seletor"
                    className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E2428]/50 p-4 sm:items-center"
                >
                    <div className="card flex max-h-[85vh] w-full max-w-2xl flex-col p-5 sm:p-6">

                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 id="titulo-seletor" className="font-display text-lg text-[#1E2428]">
                                    Escolher produtos
                                </h2>
                                <p className="text-sm text-[#5A6469]">
                                    {escolhidos.size} de {produtos.length} marcados
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSeletorAberto(false)}
                                aria-label="Fechar"
                                className="rounded-lg p-2 text-[#5A6469] transition-colors hover:bg-[#F0F3F4]"
                            >
                                <FiX className="w-4" aria-hidden />
                            </button>
                        </div>

                        <div className="relative mt-4">
                            <FiSearch className="absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8C969B]" aria-hidden />
                            <input
                                type="search"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar por nome, código ou variação"
                                className="field pl-9"
                            />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={selecionarTodos} className="btn btn-neutro text-sm">
                                {termo ? "Selecionar todos os encontrados" : "Selecionar todos"}
                            </button>

                            <button
                                type="button"
                                onClick={limparSelecao}
                                disabled={escolhidos.size === 0}
                                className="btn btn-neutro text-sm"
                            >
                                Limpar seleção
                            </button>
                        </div>

                        <ul className="mt-4 flex-1 space-y-1 overflow-y-auto">
                            {produtosFiltrados.map((produto) => {

                                const marcado = escolhidos.has(produto.id)
                                const variacao = descreverVariacao(produto.variacao_rotulo, produto.variacao)

                                return (
                                    <li key={produto.id}>
                                        <label
                                            className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                                                marcado ? "bg-[#E6F3FF]" : "hover:bg-[#F0F3F4]"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={marcado}
                                                onChange={() => alternar(produto.id)}
                                                className="h-4 w-4"
                                            />

                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-semibold text-[#1E2428]">
                                                    {produto.nome}
                                                </span>
                                                <span className="num block text-xs text-[#5A6469]">
                                                    {produto.codigo}
                                                    {variacao ? ` · ${variacao}` : ""}
                                                </span>
                                            </span>

                                            <span className="num shrink-0 text-xs text-[#5A6469]">
                                                {produto.estoque} em estoque
                                            </span>
                                        </label>
                                    </li>
                                )
                            })}

                            {produtosFiltrados.length === 0 && (
                                <li className="px-3 py-8 text-center text-sm text-[#5A6469]">
                                    Nenhum produto encontrado.
                                </li>
                            )}
                        </ul>

                        <div className="mt-4 flex justify-end gap-3 border-t border-[#E4E9EB] pt-4">
                            <Link href="/page/produto" className="btn btn-neutro flex items-center gap-2 text-sm">
                                <FiPlus className="w-4" aria-hidden />
                                Cadastrar produto novo
                            </Link>

                            <button
                                type="button"
                                onClick={() => setSeletorAberto(false)}
                                className="btn btn-primario"
                            >
                                Pronto
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </main>
    )
}
