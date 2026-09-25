"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto, Unidade } from "@/app/type/type"
import { listarProdutos, listarTodasUnidades, restaurarUnidade, identificarPeca } from "@/middleware/produtos"
import { ApiError } from "@/middleware/client"
import { useAoVivo } from "@/middleware/aoVivo"
import { FiMapPin, FiAlertTriangle, FiCheck } from "react-icons/fi"
import { urlDaImagem } from "@/security/imagem"
import { Pagina, Estado } from "@/app/components/pagina/pagina"

export default function Avarias() {

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [unidades, setUnidades] = useState<Unidade[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    const [restaurando, setRestaurando] = useState<number | null>(null)
    const [erroRestaurar, setErroRestaurar] = useState("")

    async function carregar() {

        try {

            const [listaProdutos, listaUnidades] = await Promise.all([
                listarProdutos(),
                listarTodasUnidades(),
            ])

            setProdutos(listaProdutos)
            setUnidades(listaUnidades)

        } catch (error) {

            console.error("Erro ao buscar avarias:", error)

            setErro("Não foi possível carregar as avarias.")

        } finally {

            setLoading(false)

        }
    }

    useEffect(() => {

        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()

    }, [])

    // Uma peça avariada em outro terminal aparece aqui sozinha: quem dá baixa
    // por avaria costuma estar no corredor, com o conferente olhando esta
    // tela de outro computador.
    useAoVivo(["estoque"], carregar)

    const produtosPorId = useMemo(() => {
        const mapa = new Map<number, Produto>()
        for (const produto of produtos) mapa.set(produto.id, produto)
        return mapa
    }, [produtos])

    const avariadas = useMemo(() => {

        return unidades
            .filter((unidade) => unidade.avariada)
            .map((unidade) => ({
                unidade,
                produto: produtosPorId.get(unidade.produto_id),
            }))
            .sort((a, b) => {
                const dataA = a.unidade.avariada_em ?? ""
                const dataB = b.unidade.avariada_em ?? ""
                return dataB.localeCompare(dataA)
            })

    }, [unidades, produtosPorId])

    async function handleRestaurar(unidadeId: number) {

        try {

            setRestaurando(unidadeId)
            setErroRestaurar("")

            await restaurarUnidade(unidadeId)

            await carregar()

        } catch (error) {

            console.error("Erro ao restaurar unidade:", error)

            setErroRestaurar(
                error instanceof ApiError ? error.message : "Não foi possível restaurar a unidade."
            )

        } finally {

            setRestaurando(null)

        }
    }

    function formatarData(data: string | null | undefined): string {
        if (!data) return "—"
        return new Date(data).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        })
    }


    // ==============================
    // LOADING
    // ==============================

    if (loading) {

        return (

            <Pagina titulo="Avarias">

                <div className="space-y-3">
                    {[1, 2, 3, 4].map(item => (
                        <div key={item} className="card h-16 animate-pulse" />
                    ))}
                </div>

            </Pagina>

        )
    }


    // ==============================
    // ERRO
    // ==============================

    if (erro) {

        return (

            <Pagina titulo="Avarias">

                <Estado
                    Icone={FiAlertTriangle}
                    tom="erro"
                    titulo="Erro ao carregar avarias"
                    texto={erro}
                    acao={
                        <button onClick={() => window.location.reload()} className="btn btn-primario">
                            Tentar novamente
                        </button>
                    }
                />

            </Pagina>

        )
    }


    // ==============================
    // PÁGINA
    // ==============================

    return (

        <Pagina
            titulo="Avarias"
            descricao="Unidades marcadas como avariadas saem do estoque vendável, mas continuam registradas aqui."
            acoes={
                <Link href="/page/estoque" className="btn btn-neutro">
                    <FiMapPin className="w-4" aria-hidden />
                    <span>Ver estoque</span>
                </Link>
            }
        >
            {/* ESTATÍSTICA */}

            <div className="card p-6">

                <div className="flex items-center justify-between">

                    <div>
                        <p className="text-sm text-[var(--ink-2)]">
                            Total de unidades avariadas
                        </p>
                        <p className="num mt-2 text-3xl font-extrabold text-[var(--ink)]">
                            {avariadas.length}
                        </p>
                    </div>

                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--vermelho-fundo)] text-[var(--vermelho)]">
                        <FiAlertTriangle className="w-5" aria-hidden />
                    </div>

                </div>

            </div>


            {erroRestaurar && (
                <div role="alert" className="rounded-lg bg-[var(--vermelho-fundo)] px-4 py-2.5 text-sm font-semibold text-[var(--vermelho)]">
                    {erroRestaurar}
                </div>
            )}


            {/* ==========================
                LISTA
            ========================== */}

            {avariadas.length === 0 ? (

                <Estado
                    Icone={FiCheck}
                    titulo="Nenhuma avaria registrada"
                    texto="Quando uma unidade for avariada, ela aparece aqui."
                />

            ) : (

                <div className="card overflow-hidden">

                    <ul className="divide-y divide-[var(--linha-suave)] px-5">

                        {avariadas.map(({ unidade, produto }) => (

                            <li
                                key={unidade.id}
                                className="flex items-center gap-3 py-3.5"
                            >

                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--fundo)]">
                                    {produto?.imagem_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={urlDaImagem(produto.imagem_url)}
                                            alt={produto.nome}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : null}
                                </div>

                                <div className="min-w-0 flex-1">

                                    <p className="truncate text-sm font-semibold text-[var(--ink)]">
                                        {produto?.nome ?? `Produto #${unidade.produto_id}`}
                                    </p>

                                    <p className="text-xs text-[var(--ink-2)]">
                                        <span className="font-mono">{identificarPeca(produto?.codigo, unidade.sequencia)}</span>
                                        {" · "}
                                        {unidade.endereco_nome || "sem lugar definido"}
                                        {" · "}
                                        {formatarData(unidade.avariada_em)}
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleRestaurar(unidade.id)}
                                    disabled={restaurando === unidade.id}
                                    className="shrink-0 rounded-lg border border-[var(--linha)] bg-[var(--superficie)] px-3.5 py-2 text-xs font-bold text-[var(--ink)] transition-colors hover:bg-[var(--fundo)] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {restaurando === unidade.id ? "Restaurando..." : "Restaurar ao estoque"}
                                </button>

                            </li>

                        ))}

                    </ul>

                    <div className="h-5" />

                </div>

            )}

        </Pagina>

    )
}
