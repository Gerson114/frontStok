"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto } from "@/app/type/type"
import { listarProdutos, publicarProduto } from "@/middleware/produtos"
import { ApiError } from "@/middleware/client"
import { formatarMoeda } from "@/app/components/preco/preco"
import {
    FiAlertCircle,
    FiCheckCircle,
    FiEye,
    FiEyeOff,
    FiPackage,
    FiSearch,
} from "react-icons/fi"

/**
 * Produtos do site: o que a vitrine mostra.
 *
 * Aqui não se cadastra produto. O produto nasce no estoque — quem cadastra
 * está recebendo mercadoria —, e esta tela é a segunda decisão: qual parte
 * desse estoque vai para a internet. Nem tudo que entra na loja é para
 * vender online (a peça de mostruário, o que sai só no balcão, o que ainda
 * não tem foto), e ter dois lugares para criar produto criaria duas verdades
 * sobre o que a loja vende.
 *
 * Tirar do site não apaga nada: a mercadoria continua no estoque, contada e
 * endereçada como antes — some apenas da vitrine.
 */

export default function ProdutosDoSite() {

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")
    const [busca, setBusca] = useState("")

    // Qual produto está sendo publicado/despublicado agora, para o botão da
    // linha desabilitar sozinho sem travar a lista inteira.
    const [ocupado, setOcupado] = useState<number | null>(null)

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

    const termo = busca.trim().toLowerCase()

    function combina(produto: Produto): boolean {
        return !termo ||
            produto.nome.toLowerCase().includes(termo) ||
            (produto.codigo ?? "").toLowerCase().includes(termo)
    }

    const naVitrine = useMemo(
        () => produtos.filter((produto) => produto.publicado).filter(combina),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- combina depende só do termo
        [produtos, termo]
    )

    const soNoEstoque = useMemo(
        () => produtos.filter((produto) => !produto.publicado).filter(combina),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- combina depende só do termo
        [produtos, termo]
    )

    async function alternar(produto: Produto, publicado: boolean) {

        setErro("")
        setAviso("")
        setOcupado(produto.id)

        try {
            await publicarProduto(produto.id, publicado)

            setAviso(publicado
                ? `${produto.nome} está no site.`
                : `${produto.nome} saiu do site — continua no estoque.`)

            await carregar()

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível atualizar a vitrine.")
        } finally {
            setOcupado(null)
        }
    }

    function linha(produto: Produto, publicado: boolean) {

        const preco = Number(produto.preco_promocional ?? produto.preco)
        const semEstoque = Number(produto.estoque) <= 0

        return (
            <li key={produto.id} className="flex flex-wrap items-center justify-between gap-3 py-3">

                <div className="flex min-w-0 items-center gap-3">

                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F0F3F4]">
                        {produto.imagem_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={produto.imagem_url} alt={produto.nome} className="h-full w-full object-cover" />
                        ) : null}
                    </div>

                    <div className="min-w-0">

                        <p className="truncate text-sm font-medium text-[#1E2428]">
                            {produto.nome}
                            {produto.variacao ? ` · ${produto.variacao}` : ""}
                        </p>

                        <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-[#5A6469]">
                            <span>{produto.codigo}</span>
                            <span className="font-sans">{formatarMoeda(preco)}</span>
                            <span className="font-sans">{produto.estoque} em estoque</span>

                            {produto.preco_promocional ? (
                                <span className="tag tag-success font-sans">em promoção</span>
                            ) : null}

                            {publicado && semEstoque ? (
                                <span className="tag tag-warning font-sans">esgotado no site</span>
                            ) : null}
                        </p>

                    </div>

                </div>

                <button
                    type="button"
                    onClick={() => alternar(produto, !publicado)}
                    disabled={ocupado === produto.id}
                    className={publicado ? "btn btn-neutro text-sm" : "btn btn-primario text-sm"}
                >
                    {publicado ? (
                        <>
                            <FiEyeOff className="w-4" aria-hidden />
                            Tirar do site
                        </>
                    ) : (
                        <>
                            <FiEye className="w-4" aria-hidden />
                            Pôr no site
                        </>
                    )}
                </button>

            </li>
        )
    }

    return (
        <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">
            <div className="mx-auto max-w-4xl space-y-6">

                <div>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5A6469]">
                        Meu site
                    </p>
                    <h1 className="font-display text-2xl text-[#1E2428]">
                        Produtos do site
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-[#5A6469]">
                        Escolha, do que já existe no estoque, o que a vitrine mostra. Aqui não se
                        cadastra produto — ele nasce no estoque, e esta é a segunda decisão. Tirar do
                        site não apaga nada: a mercadoria continua contada e endereçada.
                    </p>
                </div>

                {erro && (
                    <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]">
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                {aviso && (
                    <div role="status" className="flex items-start gap-2.5 rounded-lg bg-[#E0FFEE] px-4 py-3 text-sm font-semibold text-[#08A022]">
                        <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{aviso}</span>
                    </div>
                )}

                <div className="relative w-full sm:w-80">

                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8C969B]" aria-hidden />

                    <input
                        type="text"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar por nome ou código"
                        className="field"
                        style={{ paddingLeft: "2.25rem" }}
                    />

                </div>

                {/* ==========================
                    NA VITRINE
                ========================== */}

                <section className="card space-y-4 p-5 sm:p-7">

                    <div>
                        <h2 className="font-display flex items-center gap-2 text-base text-[#1E2428]">
                            <FiEye className="w-4 text-[#0086FF]" aria-hidden />
                            No site
                        </h2>
                        <p className="mt-1 text-sm text-[#5A6469]">
                            {carregando
                                ? "Carregando..."
                                : `${naVitrine.length} produto(s) aparecendo para quem visita a loja.`}
                        </p>
                    </div>

                    {!carregando && (
                        naVitrine.length === 0 ? (

                            <p className="rounded-lg border border-dashed border-[#D3DADD] p-8 text-center text-sm text-[#5A6469]">
                                {termo
                                    ? "Nenhum produto do site corresponde à busca."
                                    : "Sua vitrine está vazia. Escolha abaixo o que vai para o site."}
                            </p>

                        ) : (

                            <ul className="divide-y divide-[#D3DADD]">
                                {naVitrine.map((produto) => linha(produto, true))}
                            </ul>

                        )
                    )}

                </section>

                {/* ==========================
                    SÓ NO ESTOQUE
                ========================== */}

                <section className="card space-y-4 p-5 sm:p-7">

                    <div>
                        <h2 className="font-display flex items-center gap-2 text-base text-[#1E2428]">
                            <FiPackage className="w-4 text-[#5A6469]" aria-hidden />
                            Só no estoque
                        </h2>
                        <p className="mt-1 text-sm text-[#5A6469]">
                            Existe na loja, não aparece no site.
                        </p>
                    </div>

                    {!carregando && (
                        soNoEstoque.length === 0 ? (

                            <p className="rounded-lg border border-dashed border-[#D3DADD] p-8 text-center text-sm text-[#5A6469]">
                                {termo
                                    ? "Nenhum produto fora do site corresponde à busca."
                                    : (
                                        <>
                                            Todo o estoque já está no site. Mercadoria nova entra por{" "}
                                            <Link href="/page/estoque/inserir" className="font-bold underline">
                                                Entrada de mercadoria
                                            </Link>
                                            .
                                        </>
                                    )}
                            </p>

                        ) : (

                            <ul className="divide-y divide-[#D3DADD]">
                                {soNoEstoque.map((produto) => linha(produto, false))}
                            </ul>

                        )
                    )}

                </section>

            </div>
        </main>
    )
}
