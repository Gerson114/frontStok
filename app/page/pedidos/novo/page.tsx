"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto } from "@/app/type/type"
import { listarProdutos } from "@/middleware/produtos"
import {
    conferirDisponibilidade,
    lancarPedido,
    type Conferencia,
    type Falta,
    type ItemLancado,
} from "@/middleware/pedidos"
import { ApiError } from "@/middleware/client"
import { formatarMoeda } from "@/app/components/preco/preco"
import {
    FiAlertCircle,
    FiAlertTriangle,
    FiCheckCircle,
    FiPlus,
    FiSearch,
    FiTrash2,
} from "react-icons/fi"

/**
 * Lançar um pedido que veio de fora.
 *
 * Nem toda venda nasce na vitrine: o pedido chega por WhatsApp, por telefone,
 * na lista de papel do cliente de atacado. Alguém do serviço compara essa
 * lista com o que o sistema diz que há, lança aqui, e a partir daí ele é um
 * pedido como qualquer outro — reserva as peças, entra na separação e pode ir
 * numa onda com os demais.
 *
 * Conferir e lançar são dois passos separados de propósito. Conferir é
 * consulta e não reserva nada: acontece enquanto a pessoa ainda está
 * digitando a lista, e é o momento de descobrir que faltam três camisetas —
 * antes de o cliente ser avisado de que está tudo certo.
 */

interface Linha {
    produtoId: number
    quantidade: string
}

/** Um pedido lançado nesta sessão, para a lista do rodapé. */
interface Lancado {
    id: number
    codigo: string
    cliente: string
    pecas: number
    faltas: Falta[]
    quando: Date
}

export default function LancarPedido() {

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    const [nome, setNome] = useState("")
    const [contato, setContato] = useState("")

    const [linhas, setLinhas] = useState<Linha[]>([])
    const [busca, setBusca] = useState("")

    const [conferencia, setConferencia] = useState<Conferencia | null>(null)
    const [conferindo, setConferindo] = useState(false)

    const [parcial, setParcial] = useState(false)
    const [lancando, setLancando] = useState(false)

    // Os pedidos lançados desde que a tela abriu, do mais novo para o mais
    // velho. Ficam numa lista no rodapé em vez de um aviso que some: quem
    // lança pedido lança vários seguidos, e a pergunta "o do João já entrou?"
    // é feita o tempo todo. A lista morre com a tela — o histórico de
    // verdade é a tela de Pedidos.
    const [lancados, setLancados] = useState<Lancado[]>([])

    const carregar = useCallback(async () => {

        try {
            setProdutos(await listarProdutos())
            setErro("")

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os produtos.")
        } finally {
            setCarregando(false)
        }

    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()
    }, [carregar])

    const produtosPorId = useMemo(() => {
        const mapa = new Map<number, Produto>()
        for (const produto of produtos) mapa.set(produto.id, produto)
        return mapa
    }, [produtos])

    const termo = busca.trim().toLowerCase()

    const disponiveisParaAdicionar = useMemo(
        () => produtos
            .filter((produto) => !linhas.some((linha) => linha.produtoId === produto.id))
            .filter((produto) =>
                !termo ||
                produto.nome.toLowerCase().includes(termo) ||
                (produto.codigo ?? "").toLowerCase().includes(termo)
            )
            .slice(0, 8),
        [produtos, linhas, termo]
    )

    // Qualquer mudança na lista invalida a conferência: o número que estava
    // na tela era sobre outra lista.
    function mudou() {
        setConferencia(null)
        setParcial(false)
        setLancados([])
    }

    function adicionar(produtoId: number) {
        setLinhas((atual) => [...atual, { produtoId, quantidade: "1" }])
        setBusca("")
        mudou()
    }

    function remover(produtoId: number) {
        setLinhas((atual) => atual.filter((linha) => linha.produtoId !== produtoId))
        mudou()
    }

    function mudarQuantidade(produtoId: number, quantidade: string) {
        setLinhas((atual) =>
            atual.map((linha) => (linha.produtoId === produtoId ? { ...linha, quantidade } : linha))
        )
        mudou()
    }

    const itens: ItemLancado[] = linhas
        .map((linha) => ({ produto_id: linha.produtoId, quantidade: parseInt(linha.quantidade, 10) || 0 }))
        .filter((item) => item.quantidade > 0)

    const total = itens.reduce((soma, item) => {
        const produto = produtosPorId.get(item.produto_id)
        const preco = Number(produto?.preco_promocional ?? produto?.preco ?? 0)
        return soma + preco * item.quantidade
    }, 0)

    async function conferir() {

        setErro("")
        setConferindo(true)

        try {
            const resultado = await conferirDisponibilidade(itens)

            setConferencia(resultado)
            setParcial(false)

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível conferir o estoque.")
        } finally {
            setConferindo(false)
        }
    }

    async function lancar() {

        setErro("")
        setLancando(true)

        try {
            const resultado = await lancarPedido({ nome: nome.trim(), contato: contato.trim() }, itens, parcial)

            setLancados((atuais) => [
                {
                    id: resultado.pedido?.id ?? 0,
                    codigo: resultado.pedido?.codigo ?? "",
                    cliente: nome.trim(),
                    pecas: itens.reduce((total, item) => total + item.quantidade, 0),
                    faltas: resultado.faltas,
                    quando: new Date(),
                },
                ...atuais,
            ])

            setLinhas([])
            setNome("")
            setContato("")
            setConferencia(null)
            setParcial(false)

        } catch (e) {
            // 409 é o caso normal aqui: entre conferir e lançar, alguém pode
            // ter vendido a peça no balcão.
            setErro(e instanceof ApiError ? e.message : "Não foi possível lançar o pedido.")
        } finally {
            setLancando(false)
        }
    }

    const faltaAlgo = conferencia !== null && !conferencia.atende_tudo
    const podeLancar = itens.length > 0 && nome.trim() !== "" && conferencia !== null && (!faltaAlgo || parcial)

    return (
        <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">
            <div className="mx-auto max-w-4xl space-y-6">

                <div>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5A6469]">
                        Vendas
                    </p>
                    <h1 className="font-display text-2xl text-[#1E2428]">
                        Lançar pedido
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-[#5A6469]">
                        O pedido que chegou por fora — WhatsApp, telefone, lista de papel. Confira a
                        lista contra o estoque, lance, e ele entra na separação como qualquer pedido
                        da vitrine.
                    </p>
                </div>

                {erro && (
                    <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]">
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                {/* A mensagem do que acabou de ser lançado. Sem botão de
                    "próximo passo": o pedido já entrou na separação sozinho,
                    e a fila de botões que havia aqui — gerar lista, ver
                    pedidos, montar onda, imprimir etiqueta — dava quatro
                    caminhos para quem só queria lançar o próximo. O que foi
                    lançado fica na lista do rodapé. */}
                {lancados.length > 0 && (

                    <p role="status" className="flex items-start gap-2.5 rounded-lg bg-[#E0FFEE] px-4 py-3 text-sm font-semibold text-[#08A022]">
                        <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>
                            Pedido <span className="num">#{lancados[0].codigo}</span> lançado e peças
                            reservadas. Ele já está na separação.
                        </span>
                    </p>

                )}

                {/* ==========================
                    QUEM PEDIU
                ========================== */}

                <section className="card space-y-4 p-5 sm:p-7">

                    <h2 className="font-display text-base text-[#1E2428]">
                        Quem pediu
                    </h2>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="nome">Nome</label>
                            <input
                                id="nome"
                                type="text"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                placeholder="Como o cliente se identificou"
                                className="field"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="rotulo" htmlFor="contato">Contato</label>
                            <input
                                id="contato"
                                type="text"
                                value={contato}
                                onChange={(e) => setContato(e.target.value)}
                                placeholder="Telefone ou e-mail"
                                className="field"
                            />
                        </div>

                    </div>

                </section>

                {/* ==========================
                    A LISTA
                ========================== */}

                <section className="card space-y-4 p-5 sm:p-7">

                    <div>
                        <h2 className="font-display text-base text-[#1E2428]">
                            O que ele pediu
                        </h2>
                        <p className="mt-1 text-sm text-[#5A6469]">
                            Busque o produto e diga a quantidade. O preço é o mesmo da vitrine,
                            promoção incluída.
                        </p>
                    </div>

                    {carregando ? (

                        <p className="text-[#5A6469]">Carregando produtos...</p>

                    ) : (

                        <>
                            {linhas.length > 0 && (

                                <ul className="divide-y divide-[#D3DADD]">

                                    {linhas.map((linha) => {

                                        const produto = produtosPorId.get(linha.produtoId)
                                        const preco = Number(produto?.preco_promocional ?? produto?.preco ?? 0)
                                        const conferida = conferencia?.itens.find((item) => item.produto_id === linha.produtoId)

                                        return (
                                            <li key={linha.produtoId} className="flex flex-wrap items-center gap-3 py-3">

                                                <div className="min-w-0 flex-1">

                                                    <p className="truncate text-sm font-medium text-[#1E2428]">
                                                        {produto?.nome ?? `Produto #${linha.produtoId}`}
                                                        {produto?.variacao ? ` · ${produto.variacao}` : ""}
                                                    </p>

                                                    <p className="flex items-center gap-2 font-mono text-xs text-[#5A6469]">
                                                        <span>{produto?.codigo}</span>
                                                        <span className="font-sans">{formatarMoeda(preco)}</span>

                                                        {conferida && (
                                                            conferida.falta > 0 ? (
                                                                <span className="tag tag-danger font-sans">
                                                                    faltam {conferida.falta} (há {conferida.disponivel})
                                                                </span>
                                                            ) : (
                                                                <span className="tag tag-success font-sans">
                                                                    tem em estoque
                                                                </span>
                                                            )
                                                        )}
                                                    </p>

                                                </div>

                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={linha.quantidade}
                                                    onChange={(e) => mudarQuantidade(linha.produtoId, e.target.value)}
                                                    aria-label={`Quantidade de ${produto?.nome ?? "produto"}`}
                                                    className="field num w-20 shrink-0"
                                                />

                                                <button
                                                    type="button"
                                                    onClick={() => remover(linha.produtoId)}
                                                    aria-label="Remover item"
                                                    className="shrink-0 rounded-lg border border-[#D3DADD] px-2.5 py-2 text-xs font-bold text-[#5A6469] transition-colors hover:border-[#D4351C] hover:bg-[#FDECEA] hover:text-[#D4351C]"
                                                >
                                                    <FiTrash2 className="w-3.5" aria-hidden />
                                                </button>

                                            </li>
                                        )
                                    })}

                                </ul>

                            )}

                            <div className="relative">

                                <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8C969B]" aria-hidden />

                                <input
                                    type="text"
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                    placeholder="Buscar produto por nome ou código"
                                    className="field"
                                    style={{ paddingLeft: "2.25rem" }}
                                />

                            </div>

                            {termo && (

                                <ul className="divide-y divide-[#D3DADD] rounded-lg border border-[#D3DADD]">

                                    {disponiveisParaAdicionar.length === 0 ? (

                                        <li className="px-4 py-3 text-sm text-[#5A6469]">
                                            Nenhum produto encontrado.
                                        </li>

                                    ) : disponiveisParaAdicionar.map((produto) => (

                                        <li key={produto.id}>
                                            <button
                                                type="button"
                                                onClick={() => adicionar(produto.id)}
                                                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#F0F3F4]"
                                            >
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm text-[#1E2428]">
                                                        {produto.nome}
                                                        {produto.variacao ? ` · ${produto.variacao}` : ""}
                                                    </span>
                                                    <span className="block font-mono text-xs text-[#5A6469]">
                                                        {produto.codigo}
                                                    </span>
                                                </span>

                                                <FiPlus className="w-4 shrink-0 text-[#0086FF]" aria-hidden />
                                            </button>
                                        </li>

                                    ))}

                                </ul>

                            )}
                        </>

                    )}

                    {itens.length > 0 && (

                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F0F3F4] p-4">

                            <p className="text-sm text-[#1E2428]">
                                <span className="num font-bold">{itens.length}</span> produto(s) ·{" "}
                                <span className="num font-bold">{formatarMoeda(total)}</span>
                            </p>

                            <button
                                type="button"
                                onClick={conferir}
                                disabled={conferindo}
                                className="btn btn-neutro"
                            >
                                {conferindo ? "Conferindo..." : "Conferir estoque"}
                            </button>

                        </div>

                    )}

                </section>

                {/* ==========================
                    CONFERÊNCIA E LANÇAMENTO
                ========================== */}

                {conferencia && (

                    <section className="card space-y-4 p-5 sm:p-7">

                        {faltaAlgo ? (

                            <>
                                <div className="flex items-start gap-2.5 rounded-lg border-l-4 border-[#FFB800] bg-[#FFF6E0] px-4 py-3 text-sm text-[#8A6C1B]">
                                    <FiAlertTriangle className="mt-0.5 w-4 shrink-0" aria-hidden />
                                    <span>
                                        O estoque não cobre a lista inteira. Ou você lança só o que há
                                        agora e acerta a diferença com o cliente, ou espera a
                                        mercadoria chegar e lança tudo de uma vez.
                                    </span>
                                </div>

                                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[#1E2428]">
                                    <input
                                        type="checkbox"
                                        checked={parcial}
                                        onChange={(e) => setParcial(e.target.checked)}
                                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#0086FF]"
                                    />
                                    <span>
                                        Lançar só o que há em estoque.{" "}
                                        <span className="text-[#5A6469]">
                                            O que faltar não entra no pedido, e a diferença aparece na
                                            confirmação.
                                        </span>
                                    </span>
                                </label>
                            </>

                        ) : (

                            <p className="flex items-start gap-2.5 rounded-lg bg-[#E0FFEE] px-4 py-3 text-sm font-semibold text-[#08A022]">
                                <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                                <span>Tem peça para tudo. Pode lançar.</span>
                            </p>

                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3">

                            <p className="text-sm text-[#5A6469]">
                                O pedido nasce confirmado e reserva as peças na hora.
                            </p>

                            <button
                                type="button"
                                onClick={lancar}
                                disabled={!podeLancar || lancando}
                                className="btn btn-primario"
                            >
                                {lancando ? "Lançando..." : "Lançar pedido"}
                            </button>

                        </div>

                        {!nome.trim() && (
                            <p className="text-xs text-[#D4351C]">
                                Informe o nome de quem fez o pedido.
                            </p>
                        )}

                    </section>

                )}


                {/* ==========================
                    LANÇADOS AGORA
                    O rodapé responde "o do João já entrou?" sem trocar de
                    tela. Some quando a tela fecha: o histórico de verdade é a
                    tela de Pedidos, e duplicá-lo aqui seria criar uma segunda
                    verdade sobre o que existe.
                ========================== */}

                {lancados.length > 0 && (

                    <section className="card overflow-hidden">

                        <div className="flex items-center justify-between gap-3 border-b border-[#D3DADD] px-5 py-3.5">

                            <h2 className="font-display text-base text-[#1E2428]">
                                Lançados agora
                                <span className="num ml-2 text-sm font-bold text-[#5A6469]">
                                    {lancados.length}
                                </span>
                            </h2>

                            <Link href="/page/pedidos" className="text-sm font-bold text-[#0086FF] hover:underline">
                                Ver todos os pedidos
                            </Link>

                        </div>

                        <ul className="divide-y divide-[#E4E9EB]">

                            {lancados.map((pedido) => (

                                <li key={pedido.id} className="px-5 py-3.5">

                                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">

                                        <p className="font-bold text-[#1E2428]">
                                            {pedido.cliente}
                                            <span className="font-mono ml-2 text-xs font-normal text-[#5A6469]">
                                                #{pedido.codigo}
                                            </span>
                                        </p>

                                        <p className="text-xs text-[#5A6469]">
                                            <span className="num">{pedido.pecas}</span> peça(s) ·{" "}
                                            {pedido.quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                        </p>

                                    </div>

                                    {pedido.faltas.length > 0 && (

                                        <p className="mt-1.5 text-xs text-[#8A6C1B]">
                                            Foi lançado só o que havia:{" "}
                                            {pedido.faltas.map((falta, indice) => (
                                                <span key={falta.produto_id}>
                                                    {indice > 0 ? ", " : ""}
                                                    {falta.produto_nome} (pedido{" "}
                                                    <span className="num">{falta.pedido}</span>, havia{" "}
                                                    <span className="num">{falta.disponivel}</span>)
                                                </span>
                                            ))}
                                            . Fale com o cliente sobre a diferença.
                                        </p>

                                    )}

                                </li>

                            ))}

                        </ul>

                    </section>

                )}

            </div>
        </main>
    )
}
