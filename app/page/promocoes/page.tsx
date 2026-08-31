"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Produto } from "@/app/type/type"
import { listarProdutos } from "@/middleware/produtos"
import { criarPromocao, removerPromocao } from "@/middleware/promocoes"
import { validarPromocao } from "@/security/validate"
import { ApiError } from "@/middleware/client"
import Preco, { Desconto, formatarMoeda } from "@/app/components/preco/preco"
import { FiAlertCircle, FiCheckCircle, FiSearch, FiTag, FiX } from "react-icons/fi"

/**
 * Promoções: o preço promocional de cada produto, num lugar só.
 *
 * Dá para mexer na promoção pela tela de Produtos, produto a produto, mas
 * quem monta uma liquidação está fazendo outra coisa — está olhando o que já
 * está em promoção, decidindo o que entra e o que sai. Esta tela responde a
 * essa pergunta primeiro: mostra o que está com desconto agora, com o
 * desconto calculado, e deixa o resto do catálogo abaixo.
 *
 * Cada produto tem no máximo uma promoção ativa: cadastrar de novo substitui
 * o preço anterior (é um upsert no servidor), e remover devolve o produto ao
 * preço cheio.
 */

export default function Promocoes() {

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")
    const [busca, setBusca] = useState("")

    // Qual produto está sendo editado, e por quanto.
    const [alvo, setAlvo] = useState<Produto | null>(null)
    const [preco, setPreco] = useState("")
    const [salvando, setSalvando] = useState(false)
    const [removendo, setRemovendo] = useState<number | null>(null)

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

    const emPromocao = useMemo(
        () => produtos.filter((produto) => produto.preco_promocional),
        [produtos]
    )

    const termo = busca.trim().toLowerCase()

    const semPromocao = useMemo(
        () => produtos
            .filter((produto) => !produto.preco_promocional)
            .filter((produto) =>
                !termo ||
                produto.nome.toLowerCase().includes(termo) ||
                (produto.codigo ?? "").toLowerCase().includes(termo)
            ),
        [produtos, termo]
    )

    function abrir(produto: Produto) {
        setAlvo(produto)
        setPreco(produto.preco_promocional ? String(produto.preco_promocional) : "")
        setErro("")
    }

    async function salvar() {

        if (!alvo) return

        const promocao = {
            produto_id: alvo.id,
            preco_promocional: parseFloat(preco.replace(",", ".")),
        }

        const erros = validarPromocao(promocao)

        // O preço promocional maior que o cheio não é promoção nenhuma — e o
        // cliente veria um "de R$ 10 por R$ 20" na vitrine.
        if (erros.length === 0 && promocao.preco_promocional >= Number(alvo.preco)) {
            erros.push("O preço promocional precisa ser menor que o preço normal.")
        }

        if (erros.length > 0) {
            setErro(erros[0])
            return
        }

        try {
            setSalvando(true)
            setAviso("")

            await criarPromocao(promocao)

            setAviso(`${alvo.nome} agora sai por ${formatarMoeda(promocao.preco_promocional)}.`)
            setAlvo(null)

            await carregar()

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível salvar a promoção.")
        } finally {
            setSalvando(false)
        }
    }

    async function remover(produto: Produto) {

        setErro("")
        setAviso("")
        setRemovendo(produto.id)

        try {
            await removerPromocao(produto.id)
            setAviso(`${produto.nome} voltou ao preço normal.`)
            await carregar()

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível remover a promoção.")
        } finally {
            setRemovendo(null)
        }
    }

    return (
        <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">
            <div className="mx-auto max-w-4xl space-y-6">

                <div>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#5A6469]">
                        Minha loja
                    </p>
                    <h1 className="font-display text-2xl text-[#1E2428]">
                        Promoções
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-[#5A6469]">
                        O preço promocional de cada produto. Cada um tem no máximo uma promoção por
                        vez: salvar de novo troca o preço, remover devolve o produto ao preço cheio.
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

                {/* ==========================
                    O QUE ESTÁ EM PROMOÇÃO
                ========================== */}

                <section className="card space-y-4 p-5 sm:p-7">

                    <div>
                        <h2 className="font-display flex items-center gap-2 text-base text-[#1E2428]">
                            <FiTag className="w-4 text-[#0086FF]" aria-hidden />
                            Em promoção agora
                        </h2>
                        <p className="mt-1 text-sm text-[#5A6469]">
                            {emPromocao.length > 0
                                ? `${emPromocao.length} produto(s) com desconto na vitrine.`
                                : "Nenhum produto com desconto no momento."}
                        </p>
                    </div>

                    {carregando ? (

                        <p className="text-[#5A6469]">Carregando...</p>

                    ) : emPromocao.length > 0 && (

                        <ul className="divide-y divide-[#D3DADD]">

                            {emPromocao.map((produto) => (

                                <li key={produto.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">

                                    <div className="min-w-0">

                                        <p className="truncate text-sm font-medium text-[#1E2428]">
                                            {produto.nome}
                                            {produto.variacao ? ` · ${produto.variacao}` : ""}
                                        </p>

                                        <p className="font-mono text-xs text-[#5A6469]">
                                            {produto.codigo}
                                        </p>

                                    </div>

                                    <div className="flex shrink-0 items-center gap-3">

                                        <Preco
                                            valor={Number(produto.preco_promocional)}
                                            valorAntigo={Number(produto.preco)}
                                        />

                                        <Desconto de={Number(produto.preco)} para={Number(produto.preco_promocional)} />

                                        <button
                                            type="button"
                                            onClick={() => abrir(produto)}
                                            className="btn btn-neutro text-sm"
                                        >
                                            Alterar
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => remover(produto)}
                                            disabled={removendo === produto.id}
                                            aria-label="Remover promoção"
                                            className="btn btn-neutro text-sm"
                                        >
                                            <FiX className="w-4" aria-hidden />
                                        </button>

                                    </div>

                                </li>

                            ))}

                        </ul>

                    )}

                </section>

                {/* ==========================
                    PÔR OUTRO EM PROMOÇÃO
                ========================== */}

                <section className="card space-y-4 p-5 sm:p-7">

                    <div className="flex flex-wrap items-end justify-between gap-4">

                        <div>
                            <h2 className="font-display text-base text-[#1E2428]">
                                Pôr em promoção
                            </h2>
                            <p className="mt-1 text-sm text-[#5A6469]">
                                O resto do catálogo, no preço cheio.
                            </p>
                        </div>

                        <div className="relative w-full sm:w-72">

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

                    </div>

                    {semPromocao.length === 0 ? (

                        <p className="rounded-lg border border-dashed border-[#D3DADD] p-8 text-center text-sm text-[#5A6469]">
                            {termo ? "Nenhum produto corresponde à busca." : "Todo o catálogo já está em promoção."}
                        </p>

                    ) : (

                        <ul className="max-h-96 divide-y divide-[#D3DADD] overflow-y-auto">

                            {semPromocao.map((produto) => (

                                <li key={produto.id} className="flex flex-wrap items-center justify-between gap-3 py-3">

                                    <div className="min-w-0">

                                        <p className="truncate text-sm font-medium text-[#1E2428]">
                                            {produto.nome}
                                            {produto.variacao ? ` · ${produto.variacao}` : ""}
                                        </p>

                                        <p className="font-mono text-xs text-[#5A6469]">
                                            {produto.codigo}
                                        </p>

                                    </div>

                                    <div className="flex shrink-0 items-center gap-3">

                                        <span className="num text-sm font-bold text-[#1E2428]">
                                            {formatarMoeda(Number(produto.preco))}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => abrir(produto)}
                                            className="btn btn-neutro text-sm"
                                        >
                                            Dar desconto
                                        </button>

                                    </div>

                                </li>

                            ))}

                        </ul>

                    )}

                </section>

            </div>

            {/* ==========================
                MODAL DO PREÇO
            ========================== */}

            {alvo && (

                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => setAlvo(null)}
                >

                    <div className="absolute inset-0 bg-[#1E2428]/50" />

                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="card relative w-full max-w-md p-6"
                    >

                        <button
                            type="button"
                            onClick={() => setAlvo(null)}
                            aria-label="Fechar"
                            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#5A6469] transition-colors hover:bg-[#F0F3F4]"
                        >
                            <FiX className="w-4" aria-hidden />
                        </button>

                        <h2 className="font-display truncate pr-8 text-lg text-[#1E2428]">
                            {alvo.nome}
                        </h2>

                        <p className="mt-1 text-sm text-[#5A6469]">
                            Preço normal: <span className="num font-bold text-[#1E2428]">{formatarMoeda(Number(alvo.preco))}</span>
                        </p>

                        <div className="mt-5 space-y-1.5">

                            <label className="rotulo" htmlFor="promo">Preço promocional</label>

                            <input
                                id="promo"
                                type="text"
                                inputMode="decimal"
                                autoFocus
                                value={preco}
                                onChange={(e) => setPreco(e.target.value)}
                                placeholder="Ex: 49,90"
                                className="field num"
                            />

                        </div>

                        <div className="mt-6 flex gap-2">

                            <button
                                type="button"
                                onClick={() => setAlvo(null)}
                                disabled={salvando}
                                className="btn btn-neutro flex-1"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={salvar}
                                disabled={salvando}
                                className="btn btn-primario flex-1"
                            >
                                {salvando ? "Salvando..." : "Salvar promoção"}
                            </button>

                        </div>

                    </div>

                </div>

            )}

        </main>
    )
}
