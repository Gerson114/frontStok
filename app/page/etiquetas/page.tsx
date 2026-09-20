"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { Etiqueta } from "@/app/type/type"
import { listarEtiquetas } from "@/middleware/pedidos"
import Barcode from "@/app/components/barcode/barcode"
import { formatarMoeda } from "@/app/components/preco/preco"
import { FiAlertCircle, FiPrinter, FiRefreshCw, FiShoppingCart } from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"
import { MARCA } from "@/app/marca"

/**
 * Etiquetas dos pedidos confirmados.
 *
 * Um pedido confirmado, uma etiqueta: o código do pedido em código de
 * barras e, dentro, cada produto com código, nome e valor — é o papel que se
 * cola no pacote na hora de embalar.
 *
 * Quem decide quais pedidos entram aqui, e faz as somas, é o backend
 * (`GET /api/pedidos/etiquetas`). Esta tela só desenha e manda imprimir.
 */
export default function EtiquetasPage() {
    const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    // Quais etiquetas vão para o papel. Todas, por padrão — o caso comum é
    // imprimir a fila inteira do dia; desmarcar é a exceção.
    const [selecionadas, setSelecionadas] = useState<number[]>([])

    const [recarregar, setRecarregar] = useState(0)

    useEffect(() => {
        let cancelado = false

        async function buscar() {
            setCarregando(true)

            try {
                const lista = await listarEtiquetas()

                if (cancelado) return

                setEtiquetas(lista)
                setSelecionadas(lista.map((etiqueta) => etiqueta.pedido_id))
                setErro("")
            } catch (e) {
                if (cancelado) return

                setErro(e instanceof Error ? e.message : "Não foi possível carregar as etiquetas")
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        buscar()

        return () => {
            cancelado = true
        }
    }, [recarregar])

    function alternar(pedidoID: number) {
        setSelecionadas((atual) =>
            atual.includes(pedidoID)
                ? atual.filter((id) => id !== pedidoID)
                : [...atual, pedidoID]
        )
    }

    const paraImprimir = etiquetas.filter((etiqueta) => selecionadas.includes(etiqueta.pedido_id))

    // O que sai no papel é volume, não pedido: um pedido de três peças
    // rende três etiquetas, e é esse número que o botão promete.
    const volumesSelecionados = paraImprimir.reduce((soma, etiqueta) => soma + etiqueta.volumes.length, 0)

    if (carregando) {
        return (
            <Pagina titulo="Etiquetas" paraImpressao>
                <div className="card p-8 text-center text-sm text-[var(--ink-2)]">Carregando etiquetas...</div>
            </Pagina>
        )
    }

    return (
        <Pagina
            titulo="Etiquetas"
            descricao={
                <>
                    Uma etiqueta para cada unidade dos pedidos confirmados, numeradas 1/3, 2/3, 3/3
                    dentro de cada pedido. Confirme o pedido em{" "}
                    <Link href="/page/pedidos" className="font-semibold text-[var(--azul)] hover:underline">
                        Pedidos
                    </Link>{" "}
                    e ele aparece aqui.
                </>
            }
            paraImpressao
            acoes={
                <button
                    type="button"
                    onClick={() => setRecarregar((n) => n + 1)}
                    title="Atualizar"
                    aria-label="Atualizar a fila de etiquetas"
                    className="btn btn-neutro"
                >
                    <FiRefreshCw className="w-4" aria-hidden />
                    <span>Atualizar</span>
                </button>
            }
        >

            <div className="space-y-6 print:hidden">

                {erro && (
                    <div
                        role="alert"
                        className="mt-5 flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]"
                    >
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                {!erro && etiquetas.length === 0 && (
                    <div className="card mt-6 flex flex-col items-center p-10 text-center">
                        <FiShoppingCart className="w-8 text-[var(--ink-4)]" aria-hidden />
                        <p className="mt-3 font-display text-lg text-[var(--ink)]">
                            Nenhuma etiqueta na fila
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-[var(--ink-2)]">
                            Assim que um pedido for confirmado, a etiqueta dele aparece
                            aqui pronta para imprimir.
                        </p>
                        <Link href="/page/pedidos" className="btn btn-secundario mt-5">
                            Ver pedidos
                        </Link>
                    </div>
                )}

                {etiquetas.length > 0 && (
                    <div className="mt-6 flex flex-wrap items-center gap-3">

                        <button
                            type="button"
                            onClick={() => window.print()}
                            disabled={volumesSelecionados === 0}
                            className="btn btn-primario flex items-center gap-2"
                        >
                            <FiPrinter className="w-4" aria-hidden />
                            <span>
                                Imprimir {volumesSelecionados} etiqueta(s)
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                setSelecionadas(
                                    selecionadas.length === etiquetas.length
                                        ? []
                                        : etiquetas.map((etiqueta) => etiqueta.pedido_id)
                                )
                            }
                            className="btn btn-neutro"
                        >
                            {selecionadas.length === etiquetas.length
                                ? "Desmarcar todas"
                                : "Marcar todas"}
                        </button>

                    </div>
                )}

                {/* Marcar e desmarcar fica fora da etiqueta: a caixa de
                    seleção não deve sair no papel. */}
                {etiquetas.length > 0 && (
                    <ul className="mt-5 space-y-2">
                        {etiquetas.map((etiqueta) => (
                            <li key={etiqueta.pedido_id}>
                                <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-[var(--superficie)] px-4 py-3 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={selecionadas.includes(etiqueta.pedido_id)}
                                        onChange={() => alternar(etiqueta.pedido_id)}
                                        className="h-4 w-4"
                                    />
                                    <span className="num font-bold text-[var(--ink)]">
                                        {etiqueta.codigo}
                                    </span>
                                    <span className="truncate text-[var(--ink-2)]">
                                        {etiqueta.cliente_nome || "Cliente"} · {etiqueta.pecas} etiqueta(s)
                                    </span>
                                    <span className="num ml-auto shrink-0 font-bold text-[var(--ink)]">
                                        {formatarMoeda(etiqueta.total)}
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}



            </div>

        {/* ETIQUETAS — o que efetivamente vai para o papel.
            Uma por unidade: um pedido de três unidades imprime três, numeradas
            1/3, 2/3 e 3/3, para quem embala saber quando a sacola está
            fechada e quem recebe perceber se chegou volume faltando. */}
        <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 print:mt-0 print:max-w-none print:grid-cols-2">

            {paraImprimir.flatMap((etiqueta) =>
                etiqueta.volumes.map((volume) => (

                    <div
                        key={`${etiqueta.pedido_id}-${volume.indice}`}
                        className="w-full rounded-lg border border-[var(--linha)] bg-[var(--superficie)] p-5 print:break-inside-avoid print:rounded-none print:border print:p-4 print:shadow-none"
                    >

                        {/* De quem é o pacote vem primeiro e vem grande:
                            a etiqueta é lida por quem separa, por quem
                            embala e por quem entrega, e os três procuram
                            o nome. O produto, que já está dentro da
                            sacola, desceu para o pé. */}

                        <div className="flex items-baseline justify-between gap-2">
                            <p className="text-[0.6rem] font-bold text-[var(--ink-2)]">
                                {MARCA}
                            </p>

                            {/* O número do volume é o que fecha o pacote:
                                quem embala sabe quando acabou, e quem
                                recebe percebe se faltou volume. */}
                            <p className="num text-lg font-extrabold text-[var(--ink)]">
                                {volume.indice}/{volume.total}
                            </p>
                        </div>

                        <h2 className="font-display mt-2 break-words text-2xl leading-tight text-[var(--ink)]">
                            {etiqueta.cliente_nome || "Cliente"}
                        </h2>

                        {etiqueta.cliente_contato && (
                            <p className="num mt-0.5 text-sm font-bold text-[var(--ink-2)]">
                                {etiqueta.cliente_contato}
                            </p>
                        )}

                        {/* Os dados do pedido, logo abaixo do nome: é o
                            que se confere no balcão quando o cliente
                            chega dizendo "vim buscar o meu". */}
                        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[var(--linha)] pt-3 text-xs">

                            <dt className="text-[var(--ink-2)]">Pedido</dt>
                            <dd className="num text-right font-bold text-[var(--ink)]">{etiqueta.codigo}</dd>

                            <dt className="text-[var(--ink-2)]">Data</dt>
                            <dd className="text-right text-[var(--ink)]">{etiqueta.criado_em}</dd>

                            <dt className="text-[var(--ink-2)]">Unidades</dt>
                            <dd className="num text-right text-[var(--ink)]">{etiqueta.pecas}</dd>

                            <dt className="text-[var(--ink-2)]">Total do pedido</dt>
                            <dd className="num text-right font-bold text-[var(--ink)]">{formatarMoeda(etiqueta.total)}</dd>

                        </dl>

                        <div className="mt-3 flex justify-center border-t border-[var(--linha)] pt-3">
                            <Barcode valor={volume.codigo} className="max-w-full" />
                        </div>

                        {/* A unidade deste volume. */}
                        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-[var(--linha)] pt-3">

                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[var(--ink)]">
                                    {volume.nome}
                                </p>
                                <p className="text-xs text-[var(--ink-2)]">
                                    {[volume.tamanho, volume.cor].filter(Boolean).join(" · ") || "—"}
                                </p>
                            </div>

                            <p className="num shrink-0 text-base font-extrabold text-[var(--ink)]">
                                {formatarMoeda(volume.valor)}
                            </p>

                        </div>

                    </div>
                ))
            )}

        </div>
        </Pagina>
    )
}
