"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import type { Produto, Unidade } from "@/app/type/type"
import { buscarProdutoPorId, listarUnidades } from "@/middleware/produtos"
import Barcode from "@/app/components/barcode/barcode"

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

    const formatarMoeda = (valor: number) =>
        valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })


    if (loading) {
        return (
            <main className="min-h-screen bg-[#F6F5F1] p-6 md:ml-64 md:p-10 print:hidden">
                <p className="text-[#8E8B80]">Carregando...</p>
            </main>
        )
    }

    if (erro || !produto) {
        return (
            <main className="min-h-screen bg-[#F6F5F1] p-6 md:ml-64 md:p-10 print:hidden">
                <div className="mx-auto max-w-md rounded-2xl border border-[#EAE7DE] bg-white p-8 text-center">
                    <p className="text-[#1C1B19]">{erro || "Produto não encontrado."}</p>
                    <button
                        onClick={() => router.push("/page/home")}
                        className="mt-4 rounded-lg bg-[#2F5D4E] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#264C40]"
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

    // Produtos cadastrados antes das unidades individuais existirem ainda
    // não têm registros em "unidades" — nesse caso imprimimos uma única
    // etiqueta com o código do produto, como antes.
    const codigosParaImprimir = unidades.length === 0
        ? [codigoProduto]
        : disponiveis.map((unidade) => unidade.codigo)

    return (
        <main className="min-h-screen bg-[#F6F5F1] p-6 md:ml-64 md:p-10 print:m-0 print:min-h-0 print:bg-white print:p-0">

            {/* AÇÕES — somem na impressão */}

            <div className="mx-auto max-w-md print:hidden">

                <button
                    onClick={() => router.back()}
                    className="mb-6 text-sm font-medium text-[#6F6C61] transition hover:text-[#1C1B19]"
                >
                    ← Voltar
                </button>

                <h1 className="font-display text-2xl font-medium text-[#1C1B19]">
                    Etiquetas do produto
                </h1>

                <p className="mt-1 text-sm text-[#8E8B80]">
                    {codigosParaImprimir.length > 0
                        ? `${codigosParaImprimir.length} etiqueta(s) pronta(s), uma para cada unidade em estoque.`
                        : "Todas as unidades deste produto já foram vendidas."}
                </p>

                {codigosParaImprimir.length > 0 && (
                    <button
                        onClick={() => window.print()}
                        className="mt-6 flex items-center gap-2 rounded-lg bg-[#2F5D4E] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#264C40]"
                    >
                        <span>🖨</span>
                        <span>Imprimir etiquetas</span>
                    </button>
                )}

            </div>


            {/* ETIQUETAS — o que efetivamente é impresso, uma por unidade */}

            <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 print:mt-0 print:max-w-none print:grid-cols-2">

                {codigosParaImprimir.map((codigo) => (

                    <div
                        key={codigo}
                        className="w-full rounded-2xl border border-[#EAE7DE] bg-white p-5 print:break-inside-avoid print:rounded-none print:border print:p-4 print:shadow-none"
                    >

                        <p className="font-display text-center text-sm font-medium text-[#1C1B19]">
                            Minha Loja
                        </p>

                        <div className="mt-3 h-2 stitch opacity-70" />

                        <h2 className="font-display mt-4 text-center text-lg font-medium leading-snug text-[#1C1B19]">
                            {produto.nome}
                        </h2>

                        <p className="mt-1 text-center text-xs text-[#8E8B80]">
                            {[produto.categoria, produto.tamanho, produto.cor].filter(Boolean).join(" · ") || "—"}
                        </p>

                        <div className="mt-3 flex items-center justify-center gap-2">

                            {produto.preco_promocional ? (
                                <span className="text-sm text-[#A19E93] line-through">
                                    {formatarMoeda(Number(produto.preco))}
                                </span>
                            ) : null}

                            <span className="font-mono text-2xl font-semibold text-[#2F5D4E]">
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
