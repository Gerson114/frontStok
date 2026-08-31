"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { listarPedidos } from "@/middleware/pedidos"
import { separarPedido, type Separacao } from "@/middleware/wms"
import type { Pedido } from "@/app/type/type"
import { ApiError } from "@/middleware/client"
import Barcode from "@/app/components/barcode/barcode"
import {
    FiAlertCircle,
    FiMapPin,
    FiPrinter,
    FiShoppingCart,
} from "react-icons/fi"

/**
 * Picking: a lista do que buscar no estoque para atender uma venda.
 *
 * É o papel que quem separa leva na mão. Cada linha diz o produto, o código
 * que está na etiqueta dele, quantas peças pegar e em que endereço elas
 * estão — na ordem em que se anda pelo corredor, e não na ordem em que o
 * cliente pediu. É essa ordem que transforma a lista numa volta só pelo
 * estoque em vez de ida e volta a cada item.
 *
 * Nada aqui é calculado na tela: a lista vem agrupada do servidor, a mesma
 * que a onda de separação usa. Duas contas diferentes para a mesma
 * mercadoria é como uma loja separa a mais num lugar e a menos no outro.
 */

function PickingInterno() {

    const parametros = useSearchParams()
    const pedidoDaUrl = parametros.get("pedido")

    const [pedidos, setPedidos] = useState<Pedido[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    const [separacao, setSeparacao] = useState<Separacao | null>(null)
    const [cliente, setCliente] = useState("")
    const [abrindo, setAbrindo] = useState<number | null>(null)

    const abrir = useCallback(async (pedido: Pedido) => {

        setErro("")
        setAbrindo(pedido.id)

        try {
            setSeparacao(await separarPedido(pedido.id))
            setCliente(pedido.cliente_nome ?? "")

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível montar a lista de separação.")
        } finally {
            setAbrindo(null)
        }

    }, [])

    useEffect(() => {

        let cancelado = false

        async function carregar() {

            try {
                const lista = await listarPedidos()

                if (cancelado) return

                setPedidos(lista)

                // Veio do lançamento da venda: abre direto a lista daquele
                // pedido, que é o que a pessoa foi fazer ali.
                const escolhido = pedidoDaUrl
                    ? lista.find((pedido) => String(pedido.id) === pedidoDaUrl)
                    : undefined

                if (escolhido) await abrir(escolhido)

            } catch (e) {
                if (!cancelado) {
                    setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os pedidos.")
                }
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        carregar()

        return () => {
            cancelado = true
        }

    }, [pedidoDaUrl, abrir])

    // Só o que já pode ser separado: antes de confirmado não há o que
    // buscar, depois de enviado o pacote saiu da loja.
    const separaveis = pedidos.filter((pedido) => pedido.status === "confirmado")

    return (
        <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10 print:m-0 print:min-h-0 print:bg-white print:p-0">

            <div className="mx-auto max-w-4xl space-y-6 print:hidden">

                <div>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5A6469]">
                        Estoque
                    </p>
                    <h1 className="font-display text-2xl text-[#1E2428]">
                        Picking
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-[#5A6469]">
                        A lista do que buscar para cada venda: produto, código, quantidade e o
                        endereço onde a peça está — na ordem em que se anda pelo estoque. Imprima e
                        entregue a quem vai separar.
                    </p>
                </div>

                {erro && (
                    <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]">
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                {/* ==========================
                    VENDAS A SEPARAR
                ========================== */}

                <section className="card space-y-4 p-5 sm:p-7">

                    <div className="flex flex-wrap items-end justify-between gap-4">

                        <div>
                            <h2 className="font-display flex items-center gap-2 text-base text-[#1E2428]">
                                <FiShoppingCart className="w-4 text-[#0086FF]" aria-hidden />
                                Vendas a separar
                            </h2>
                            <p className="mt-1 text-sm text-[#5A6469]">
                                Pedidos confirmados, da vitrine ou lançados no painel.
                            </p>
                        </div>

                        <Link href="/page/pedidos/novo" className="btn btn-neutro text-sm">
                            Lançar venda
                        </Link>

                    </div>

                    {carregando ? (

                        <p className="text-[#5A6469]">Carregando...</p>

                    ) : separaveis.length === 0 ? (

                        <p className="rounded-lg border border-dashed border-[#D3DADD] p-8 text-center text-sm text-[#5A6469]">
                            Nenhuma venda confirmada esperando separação.
                        </p>

                    ) : (

                        <ul className="divide-y divide-[#D3DADD]">

                            {separaveis.map((pedido) => (

                                <li key={pedido.id} className="flex flex-wrap items-center justify-between gap-3 py-3">

                                    <div className="min-w-0">
                                        <p className="num text-sm font-medium text-[#1E2428]">
                                            #{pedido.codigo}
                                        </p>
                                        <p className="truncate text-xs text-[#5A6469]">
                                            {pedido.cliente_nome}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => abrir(pedido)}
                                        disabled={abrindo === pedido.id}
                                        className={separacao?.pedido.id === pedido.id ? "btn btn-primario text-sm" : "btn btn-neutro text-sm"}
                                    >
                                        {abrindo === pedido.id ? "Abrindo..." : "Montar lista"}
                                    </button>

                                </li>

                            ))}

                        </ul>

                    )}

                </section>

                {/* ==========================
                    A LISTA NA TELA
                ========================== */}

                {separacao && (

                    <section className="card space-y-4 p-5 sm:p-7">

                        <div className="flex flex-wrap items-end justify-between gap-4">

                            <div>
                                <h2 className="font-display text-base text-[#1E2428]">
                                    Pedido <span className="num">#{separacao.pedido.codigo}</span>
                                </h2>
                                <p className="mt-1 text-sm text-[#5A6469]">
                                    <span className="num">{separacao.total}</span> peça(s) em{" "}
                                    <span className="num">{separacao.paradas}</span> parada(s) do estoque.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => window.print()}
                                disabled={separacao.linhas.length === 0}
                                className="btn btn-primario"
                            >
                                <FiPrinter className="w-4" aria-hidden />
                                Imprimir lista
                            </button>

                        </div>

                        {!separacao.tem_reserva ? (

                            <p className="rounded-lg bg-[#FFF6E0] px-4 py-3 text-sm text-[#8A6C1B]">
                                Este pedido não tem peça reservada. Ele é anterior à reserva por peça —
                                o estoque sabe a quantidade, mas não quais peças são dele.
                            </p>

                        ) : (

                            <ul className="divide-y divide-[#D3DADD]">

                                {separacao.linhas.map((linha, indice) => (

                                    <li
                                        key={`${linha.endereco_id}-${linha.produto_id}-${indice}`}
                                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                                    >

                                        <div className="flex min-w-0 items-center gap-3">

                                            {/* Em que ponto da lista quem separa está: "1/3" é o que
                                                permite conferir, no fim, que nada ficou para trás. */}
                                            <span className="num shrink-0 rounded-lg bg-[#F0F3F4] px-2 py-1 text-xs font-bold text-[#5A6469]">
                                                {indice + 1}/{separacao.linhas.length}
                                            </span>

                                            <div className="min-w-0">

                                                <p className="truncate text-sm font-medium text-[#1E2428]">
                                                    <span className="num">{linha.quantidade}x</span> {linha.produto_nome}
                                                    {linha.variacao ? ` · ${linha.variacao}` : ""}
                                                </p>

                                                <p className="font-mono text-xs text-[#5A6469]">
                                                    {linha.produto_codigo}
                                                </p>

                                            </div>

                                        </div>

                                        <p className="flex shrink-0 items-center gap-1.5 text-right">
                                            <FiMapPin className="w-3.5 shrink-0 text-[#0086FF]" aria-hidden />
                                            <span>
                                                <span className="num block text-sm font-bold text-[#1E2428]">
                                                    {linha.endereco}
                                                </span>
                                                <span className="block text-xs text-[#5A6469]">
                                                    {linha.endereco_nome}
                                                </span>
                                            </span>
                                        </p>

                                    </li>

                                ))}

                            </ul>

                        )}

                    </section>

                )}

            </div>

            {/* ==========================
                O QUE VAI PARA O PAPEL
            ========================== */}

            {separacao && separacao.linhas.length > 0 && (

                <div className="hidden print:block">

                    <div className="flex items-start justify-between border-b-2 border-black pb-3">

                        <div>
                            <p className="text-xs uppercase tracking-widest text-black">Lista de separação</p>
                            <p className="num text-3xl font-extrabold text-black">
                                #{separacao.pedido.codigo}
                            </p>
                            {cliente && (
                                <p className="text-sm text-black">{cliente}</p>
                            )}
                        </div>

                        <div className="text-right">
                            <Barcode valor={separacao.pedido.codigo} className="w-48" />
                        </div>

                    </div>

                    <p className="mt-2 text-xs text-black">
                        {separacao.total} peça(s) · {separacao.paradas} parada(s) · na ordem do estoque
                    </p>

                    <table className="mt-4 w-full border-collapse text-left text-sm text-black">

                        <thead>
                            <tr className="border-b border-black">
                                <th className="w-12 py-2 pr-2">Item</th>
                                <th className="py-2 pr-2">Produto</th>
                                <th className="py-2 pr-2">Código</th>
                                <th className="py-2 pr-2 text-right">Qtd.</th>
                                <th className="py-2">Endereço</th>
                                <th className="w-10 py-2 text-center">OK</th>
                            </tr>
                        </thead>

                        <tbody>

                            {separacao.linhas.map((linha, indice) => (

                                <tr
                                    key={`impressao-${linha.endereco_id}-${linha.produto_id}-${indice}`}
                                    className="break-inside-avoid border-b border-black/30"
                                >

                                    {/* "1/3": em que ponto da lista quem separa está.
                                        É o que permite conferir, no fim da volta, que
                                        nenhuma linha ficou para trás. */}
                                    <td className="py-2 pr-2 font-mono font-bold">
                                        {indice + 1}/{separacao.linhas.length}
                                    </td>

                                    <td className="py-2 pr-2 font-semibold">
                                        {linha.produto_nome}
                                        {linha.variacao ? ` · ${linha.variacao}` : ""}
                                    </td>

                                    <td className="py-2 pr-2 font-mono text-xs">
                                        {linha.produto_codigo}
                                    </td>

                                    <td className="py-2 pr-2 text-right text-lg font-extrabold">
                                        {linha.quantidade}
                                    </td>

                                    <td className="py-2">
                                        <span className="block font-mono font-bold">{linha.endereco}</span>
                                        <span className="block text-xs">{linha.endereco_nome}</span>
                                    </td>

                                    {/* Quem separa risca aqui: é assim que a lista de papel
                                        vira conferência de quem já pegou o quê. */}
                                    <td className="py-2 text-center">
                                        <span className="inline-block h-5 w-5 border border-black" />
                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

            )}

        </main>
    )
}

export default function Picking() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">
                <p className="text-[#5A6469]">Carregando...</p>
            </main>
        }>
            <PickingInterno />
        </Suspense>
    )
}
