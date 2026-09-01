"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Produto } from "@/app/type/type"
import { listarProdutos, venderUnidade } from "@/middleware/produtos"
import { consultarPorCodigo } from "@/middleware/estoque"
import { descreverVariacao } from "@/app/components/produto/campos"
import Preco, { formatarMoeda } from "@/app/components/preco/preco"
import { ApiError } from "@/middleware/client"
import {
    FiAlertCircle,
    FiCheckCircle,
    FiSearch,
    FiShoppingBag,
    FiTag,
    FiX,
} from "react-icons/fi"
import { urlDaImagem } from "@/security/imagem"

/**
 * Venda no balcão: a peça saindo da loja na frente do cliente.
 *
 * É a tela de quem está atendendo, e por isso ela tem uma coisa só em
 * primeiro plano — o campo do código, sempre focado. O leitor de código de
 * barras digita o código e dá Enter, então bipar a etiqueta já traz o
 * produto; quem não tem leitor digita, e quem não sabe o código busca pelo
 * nome logo abaixo.
 *
 * Qual peça sai não se escolhe aqui: o servidor decide (a que vence antes,
 * prateleira antes do pulmão, e entre iguais a mais antiga). Escolher a peça
 * no balcão seria pedir a quem está com o cliente na frente uma decisão de
 * estoque que o sistema toma melhor.
 *
 * As vendas ficam listadas ao lado enquanto a tela está aberta, com o total.
 * Não é caixa nem fechamento — é a conferência do atendente, que precisa
 * saber o que acabou de passar pela mão dele. O histórico que fica é o de
 * Vendidos.
 */

/** Uma venda registrada nesta sessão, para a lista da direita. */
interface VendaFeita {
    unidadeId: number
    nome: string
    codigo: string
    sequencia: number
    valor: number
}

/** O preço que vale hoje: o promocional, quando existe. */
function precoAtual(produto: Produto): number {
    return produto.preco_promocional && produto.preco_promocional > 0
        ? Number(produto.preco_promocional)
        : Number(produto.preco)
}

export default function VendaNoBalcao() {

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    const [codigo, setCodigo] = useState("")
    const [alvo, setAlvo] = useState<Produto | null>(null)
    const [ondeEsta, setOndeEsta] = useState<string[]>([])
    const [buscandoCodigo, setBuscandoCodigo] = useState(false)
    const [erroCodigo, setErroCodigo] = useState("")

    const [vendendo, setVendendo] = useState(false)
    const [vendas, setVendas] = useState<VendaFeita[]>([])

    const [busca, setBusca] = useState("")

    const campoCodigo = useRef<HTMLInputElement>(null)

    async function carregar() {
        try {
            setProdutos(await listarProdutos())
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível carregar os produtos")
        } finally {
            setCarregando(false)
        }
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()
    }, [])

    /** Devolve o foco ao campo do código: é para lá que a próxima peça vai. */
    function voltarAoCampo() {
        campoCodigo.current?.focus()
        campoCodigo.current?.select()
    }

    async function bipar(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        const termo = codigo.trim()

        if (!termo) return

        setErroCodigo("")
        setBuscandoCodigo(true)

        try {
            const consulta = await consultarPorCodigo(termo)

            // A consulta responde pelo código do produto, com o resumo do
            // estoque; o preço promocional e o resto do cadastro vêm da
            // lista que a tela já tem.
            const completo = produtos.find((produto) => produto.id === consulta.produto.id)

            if (!completo) {
                setErroCodigo("Produto encontrado, mas fora da lista carregada. Recarregue a página.")
                return
            }

            setAlvo(completo)

            setOndeEsta(
                Object.entries(consulta.locais)
                    .filter(([, quantas]) => quantas > 0)
                    .map(([lugar, quantas]) => `${lugar} (${quantas})`)
            )

        } catch (e) {
            setAlvo(null)
            setOndeEsta([])
            setErroCodigo(
                e instanceof ApiError
                    ? e.message
                    : "Não foi possível consultar este código."
            )
        } finally {
            setBuscandoCodigo(false)
        }
    }

    function escolher(produto: Produto) {
        setAlvo(produto)
        setOndeEsta([])
        setErroCodigo("")
        setCodigo(produto.codigo)
        setBusca("")
        voltarAoCampo()
    }

    async function vender() {
        if (!alvo) return

        setErroCodigo("")
        setVendendo(true)

        try {
            const resposta = await venderUnidade(alvo.id)

            setVendas((atual) => [
                {
                    unidadeId: resposta.unidade.id,
                    nome: alvo.nome,
                    codigo: alvo.codigo,
                    sequencia: resposta.unidade.sequencia,
                    valor: precoAtual(alvo),
                },
                ...atual,
            ])

            // A lista inteira de novo: o estoque do produto vendido mudou, e
            // é ele que a tela mostra como "disponíveis".
            const atualizados = await listarProdutos()

            setProdutos(atualizados)

            // O balcão vende uma peça atrás da outra do mesmo produto. Manter
            // o alvo (só que com o estoque novo) poupa bipar de novo a cada
            // peça; quando acaba, o próprio cartão avisa.
            setAlvo(atualizados.find((produto) => produto.id === alvo.id) ?? null)

        } catch (e) {
            setErroCodigo(
                e instanceof ApiError
                    ? e.message
                    : "Não foi possível dar baixa nesta peça."
            )
        } finally {
            setVendendo(false)
            voltarAoCampo()
        }
    }

    function limparVenda() {
        setAlvo(null)
        setOndeEsta([])
        setCodigo("")
        setErroCodigo("")
        voltarAoCampo()
    }

    const encontrados = useMemo(() => {
        const termo = busca.trim().toLowerCase()

        if (!termo) return []

        return produtos
            .filter((produto) =>
                produto.nome.toLowerCase().includes(termo) ||
                produto.codigo?.toLowerCase().includes(termo)
            )
            .slice(0, 8)

    }, [produtos, busca])

    const total = vendas.reduce((soma, venda) => soma + venda.valor, 0)

    const disponiveis = alvo ? Number(alvo.estoque) : 0

    return (
        <main className="mx-auto max-w-5xl px-4 py-10">

            <h1 className="font-display text-2xl text-[#1E2428]">
                Venda no balcão
            </h1>

            <p className="mt-1 text-sm text-[#5A6469]">
                Bipe a etiqueta da peça, confira o preço e dê baixa. O sistema
                escolhe qual peça sai do estoque.
            </p>

            {erro && (
                <div
                    role="alert"
                    className="mt-6 flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]"
                >
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">

                {/* ==========================
                    BALCÃO
                ========================== */}

                <div>

                    <form onSubmit={bipar} className="card p-6">

                        <label htmlFor="codigo" className="rotulo">
                            Código da peça
                        </label>

                        <div className="mt-1 flex items-stretch gap-2">
                            <input
                                id="codigo"
                                ref={campoCodigo}
                                autoFocus
                                autoComplete="off"
                                spellCheck={false}
                                placeholder="Bipe a etiqueta ou digite o código"
                                className="field font-mono text-lg"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                            />

                            <button
                                type="submit"
                                disabled={buscandoCodigo || !codigo.trim()}
                                className="btn btn-primario shrink-0"
                            >
                                {buscandoCodigo ? "Buscando..." : "Buscar"}
                            </button>
                        </div>

                        <p className="mt-1.5 text-xs text-[#8C969B]">
                            O leitor de código de barras digita e dá Enter sozinho —
                            é só bipar com o campo em foco.
                        </p>

                    </form>

                    {erroCodigo && (
                        <div
                            role="alert"
                            className="mt-4 flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]"
                        >
                            <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                            <span>{erroCodigo}</span>
                        </div>
                    )}

                    {/* PEÇA NA MÃO */}

                    {alvo && (
                        <section className="card mt-4 p-6">

                            <div className="flex items-start gap-4">

                                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[#F0F3F4]">
                                    {alvo.imagem_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={urlDaImagem(alvo.imagem_url)}
                                            alt={alvo.nome}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : null}
                                </div>

                                <div className="min-w-0 flex-1">

                                    <h2 className="font-display truncate text-lg text-[#1E2428]">
                                        {alvo.nome}
                                    </h2>

                                    <p className="mt-0.5 truncate text-sm text-[#5A6469]">
                                        <span className="num">{alvo.codigo}</span>
                                        {descreverVariacao(alvo.variacao_rotulo, alvo.variacao)
                                            ? ` · ${descreverVariacao(alvo.variacao_rotulo, alvo.variacao)}`
                                            : ""}
                                    </p>

                                    <div className="mt-2">
                                        <Preco
                                            valor={precoAtual(alvo)}
                                            valorAntigo={
                                                alvo.preco_promocional && alvo.preco_promocional > 0
                                                    ? Number(alvo.preco)
                                                    : undefined
                                            }
                                            className="text-xl"
                                        />
                                    </div>

                                </div>

                                <button
                                    type="button"
                                    onClick={limparVenda}
                                    aria-label="Limpar"
                                    className="shrink-0 rounded-lg p-2 text-[#8C969B] transition-colors hover:bg-[#F0F3F4] hover:text-[#1E2428]"
                                >
                                    <FiX className="w-4" aria-hidden />
                                </button>

                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                                <span className={`tag ${disponiveis > 0 ? "tag-success" : "tag-danger"}`}>
                                    {disponiveis > 0
                                        ? `${disponiveis} ${disponiveis === 1 ? "peça disponível" : "peças disponíveis"}`
                                        : "sem peça disponível"}
                                </span>

                                {ondeEsta.map((lugar) => (
                                    <span key={lugar} className="tag tag-neutral num">
                                        {lugar}
                                    </span>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={vender}
                                disabled={vendendo || disponiveis <= 0}
                                className="btn btn-primario mt-5 w-full py-3 text-base"
                            >
                                <FiShoppingBag className="w-4" aria-hidden />
                                {vendendo ? "Dando baixa..." : "Vender uma peça"}
                            </button>

                        </section>
                    )}

                    {/* BUSCA POR NOME — para quem não tem o código na mão */}

                    {!alvo && (
                        <section className="card mt-4 p-6">

                            <label htmlFor="busca" className="rotulo">
                                Sem o código? Busque pelo nome
                            </label>

                            <div className="relative mt-1">
                                <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8C969B]" aria-hidden />

                                <input
                                    id="busca"
                                    className="field pl-9"
                                    placeholder="Ex: camisa listrada"
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                />
                            </div>

                            {carregando && (
                                <p className="mt-3 text-sm text-[#5A6469]">Carregando produtos...</p>
                            )}

                            <ul className="mt-3 space-y-1.5">
                                {encontrados.map((produto) => (
                                    <li key={produto.id}>
                                        <button
                                            type="button"
                                            onClick={() => escolher(produto)}
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#F0F3F4]"
                                        >
                                            <FiTag className="w-4 shrink-0 text-[#8C969B]" aria-hidden />

                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-[#1E2428]">
                                                    {produto.nome}
                                                </span>
                                                <span className="num block truncate text-xs text-[#8C969B]">
                                                    {produto.codigo} · {produto.estoque} em estoque
                                                </span>
                                            </span>

                                            <span className="num shrink-0 text-sm font-bold text-[#1E2428]">
                                                {formatarMoeda(precoAtual(produto))}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            {busca.trim() && encontrados.length === 0 && !carregando && (
                                <p className="mt-3 text-sm text-[#5A6469]">
                                    Nenhum produto com esse nome.
                                </p>
                            )}

                        </section>
                    )}

                </div>

                {/* ==========================
                    O QUE JÁ PASSOU
                ========================== */}

                <aside className="card h-fit p-6">

                    <h2 className="font-display text-lg text-[#1E2428]">
                        Vendas de agora
                    </h2>

                    <p className="mt-0.5 text-xs text-[#8C969B]">
                        O que passou por aqui desde que a tela foi aberta. O
                        histórico que fica está em Vendidos.
                    </p>

                    {vendas.length === 0 ? (
                        <p className="mt-5 text-sm text-[#5A6469]">
                            Nenhuma peça ainda.
                        </p>
                    ) : (
                        <>
                            <ul className="mt-4 space-y-2">
                                {vendas.map((venda) => (
                                    <li
                                        key={venda.unidadeId}
                                        className="flex items-start gap-2 border-b border-[#E4E9EB] pb-2 last:border-0"
                                    >
                                        <FiCheckCircle className="mt-0.5 w-4 shrink-0 text-[#08A022]" aria-hidden />

                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-[#1E2428]">
                                                {venda.nome}
                                            </span>
                                            <span className="num block truncate text-xs text-[#8C969B]">
                                                {venda.codigo} · peça {venda.sequencia}
                                            </span>
                                        </span>

                                        <span className="num shrink-0 text-sm font-bold text-[#1E2428]">
                                            {formatarMoeda(venda.valor)}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-4 flex items-baseline justify-between border-t border-[#D3DADD] pt-3">
                                <span className="text-sm font-semibold text-[#5A6469]">
                                    {vendas.length} {vendas.length === 1 ? "peça" : "peças"}
                                </span>

                                <span className="num text-xl font-extrabold text-[#0086FF]">
                                    {formatarMoeda(total)}
                                </span>
                            </div>
                        </>
                    )}

                </aside>

            </div>

        </main>
    )
}
