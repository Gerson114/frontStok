"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import type { Produto, Unidade } from "@/app/type/type"
import { buscarProdutoPorId, listarUnidades } from "@/middleware/produtos"
import Barcode from "@/app/components/barcode/barcode"
import { descreverVariacao } from "@/app/components/produto/campos"
import { formatarMoeda } from "@/app/components/preco/preco"
import { FiArrowLeft, FiPrinter } from "react-icons/fi"

export default function EtiquetaProduto() {
    const params = useParams<{ id: string }>()
    const router = useRouter()

    const [produto, setProduto] = useState<Produto | null>(null)
    const [unidades, setUnidades] = useState<Unidade[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    useEffect(() => {

        async function carregar() {

            try {

                const id = Number(params.id)
                const [encontrado, listaUnidades] = await Promise.all([
                    buscarProdutoPorId(id),
                    listarUnidades(id),
                ])

                if (!encontrado) {
                    setErro("Produto não encontrado.")
                } else {
                    setProduto(encontrado)
                    setUnidades(listaUnidades)
                }

            } catch (error) {

                console.error("Erro ao carregar produto:", error)

                setErro("Não foi possível carregar o produto.")

            } finally {

                setLoading(false)

            }
        }

        carregar()

    }, [params.id])


    if (loading) {
        return (
            <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10 print:hidden">
                <p className="text-[#5A6469]">Carregando...</p>
            </main>
        )
    }

    if (erro || !produto) {
        return (
            <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10 print:hidden">
                <div className="card mx-auto max-w-md p-8 text-center">
                    <p className="text-[#1E2428]">{erro || "Produto não encontrado."}</p>
                    <button
                        onClick={() => router.push("/page/produtos")}
                        className="btn btn-primario mt-4"
                    >
                        Voltar
                    </button>
                </div>
            </main>
        )
    }

    // Produtos cadastrados antes do backend passar a gravar o código
    // (coluna "codigo") ainda não têm esse valor salvo — nesse caso caímos
    // de volta para o mesmo cálculo que o backend usa (ID com 6 dígitos).
    const codigoProduto = produto.codigo || String(produto.id).padStart(6, "0")
    const precoExibido = produto.preco_promocional ?? produto.preco

    const disponiveis = unidades.filter((unidade) => !unidade.vendida)

    // Uma etiqueta por peça disponível, todas com o MESMO código: o do
    // produto. As cinco camisetas P brancas são intercambiáveis, e dar
    // código próprio a cada uma só criaria o trabalho de colar a etiqueta
    // certa na peça certa, sem responder nada que o lojista precise saber.
    //
    // Produto sem peça cadastrada (dado antigo, de antes das unidades) rende
    // ao menos uma etiqueta — senão a tela não imprime nada.
    const quantidade = unidades.length === 0 ? 1 : disponiveis.length
    const codigosParaImprimir = Array.from({ length: quantidade }, () => codigoProduto)

    return (
        <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10 print:m-0 print:min-h-0 print:bg-white print:p-0">

            {/* AÇÕES — somem na impressão */}

            <div className="mx-auto max-w-md print:hidden">

                <button
                    onClick={() => router.back()}
                    className="mb-6 flex items-center gap-1.5 text-sm font-medium text-[#5A6469] transition hover:text-[#1E2428]"
                >
                    <FiArrowLeft className="w-4" aria-hidden />
                    <span>Voltar</span>
                </button>

                <h1 className="font-display text-2xl text-[#1E2428]">
                    Etiquetas do produto
                </h1>

                <p className="mt-1 text-sm text-[#5A6469]">
                    {codigosParaImprimir.length > 0
                        ? `${codigosParaImprimir.length} etiqueta(s) pronta(s), uma para cada peça em estoque — todas com o código ${codigoProduto}.`
                        : "Todas as unidades deste produto já foram vendidas."}
                </p>

                {codigosParaImprimir.length > 0 && (
                    <button
                        onClick={() => window.print()}
                        className="btn btn-primario mt-6"
                    >
                        <FiPrinter className="w-4" aria-hidden />
                        <span>Imprimir etiquetas</span>
                    </button>
                )}

            </div>


            {/* ETIQUETAS — o que efetivamente é impresso, uma por unidade */}

            <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 print:mt-0 print:max-w-none print:grid-cols-2">

                {codigosParaImprimir.map((codigo, indice) => (

                    <div
                        key={indice}
                        className="w-full rounded-lg border border-[#D3DADD] bg-white p-5 print:break-inside-avoid print:rounded-none print:border print:p-4 print:shadow-none"
                    >

                        <p className="font-display text-center text-sm text-[#1E2428]">
                            Arara
                        </p>

                        <div className="mt-3 border-t border-[#D3DADD]" />

                        <h2 className="font-display mt-4 text-center text-lg leading-snug text-[#1E2428]">
                            {produto.nome}
                        </h2>

                        <p className="mt-1 text-center text-xs text-[#5A6469]">
                            {[produto.categoria, descreverVariacao(produto.variacao_rotulo, produto.variacao)]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                        </p>

                        <div className="mt-3 flex items-center justify-center gap-2">

                            {produto.preco_promocional ? (
                                <span className="preco-antigo text-sm">
                                    {formatarMoeda(Number(produto.preco))}
                                </span>
                            ) : null}

                            {/* Etiqueta física: valor cheio em preto, sem os centavos
                                reduzidos da vitrine — imprime legível e não gasta
                                tinta colorida em impressora monocromática. */}
                            <span className="num text-2xl font-extrabold text-[#1E2428]">
                                {formatarMoeda(Number(precoExibido))}
                            </span>

                        </div>

                        <div className="mt-4 flex justify-center">
                            <Barcode valor={codigo} className="max-w-full" />
                        </div>

                    </div>

                ))}

            </div>

        </main>
    )
}
