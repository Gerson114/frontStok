"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto, Unidade } from "@/app/type/type"
import { listarProdutos, listarTodasUnidades } from "@/middleware/produtos"
import { descreverVariacao } from "@/app/components/produto/campos"
import { consultarPorCodigo, type ConsultaPorCodigo } from "@/middleware/estoque"
import { ApiError } from "@/middleware/client"
import { FiAlertCircle, FiMapPin, FiSearch, FiTag, FiTruck } from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"

/**
 * Consulta do estoque: o que existe de cada produto e onde está guardado.
 *
 * Responde as duas perguntas que se faz de pé no corredor, e que são o
 * inverso uma da outra: "onde está este produto?" e "o que tem nesta rua?".
 * A primeira poupa a volta inteira pelo estoque; a segunda é o que se usa ao
 * arrumar a prateleira ou conferir um trecho.
 *
 * Só peças que ainda estão lá: o que foi vendido saiu da loja, e o que está
 * avariado não é para ser buscado.
 */

interface PecasNoLocal {
    /** Código da prateleira ("001.005.01.A"); vazio é a peça sem lugar. */
    codigo: string
    /** O endereço falado, do jeito que alguém repete no corredor. */
    nome: string
    porProduto: Map<number, number>
    total: number
}

/**
 * Como o lugar se chama na tela.
 *
 * O nome vem escrito do servidor junto da peça — o painel não monta código de
 * endereço nenhum. Peça que chegou e ainda não foi guardada não tem código, e
 * é isso que a tela precisa dizer.
 */
function nomeDoLocal(unidade: Unidade): string {
    if (!unidade.endereco) return "Sem local definido"
    return unidade.endereco_nome || unidade.endereco
}

export default function ConsultarEstoque() {
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [unidades, setUnidades] = useState<Unidade[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [busca, setBusca] = useState("")

    // Consulta pelo código: é a pergunta do balcão — passo o código e ele me
    // diz a rua. Funciona digitado ou com o leitor de código de barras, que
    // digita o código e dá Enter.
    const [codigo, setCodigo] = useState("")
    const [consulta, setConsulta] = useState<ConsultaPorCodigo | null>(null)
    const [erroCodigo, setErroCodigo] = useState("")
    const [consultando, setConsultando] = useState(false)

    useEffect(() => {
        let cancelado = false

        async function carregar() {
            try {
                const [listaProdutos, listaUnidades] = await Promise.all([
                    listarProdutos(),
                    listarTodasUnidades(),
                ])

                if (cancelado) return

                setProdutos(listaProdutos)
                setUnidades(listaUnidades)
            } catch (e) {
                if (!cancelado) setErro(e instanceof Error ? e.message : "Não foi possível carregar o estoque")
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

    // Só o que está guardado: vendida saiu, avariada não é para buscar.
    const guardadas = useMemo(
        () => unidades.filter((unidade) => !unidade.vendida && !unidade.avariada),
        [unidades]
    )

    const locais = useMemo(() => {
        const mapa = new Map<string, PecasNoLocal>()

        for (const unidade of guardadas) {

            const chave = unidade.endereco || "sem-local"
            const local = mapa.get(chave) ?? {
                codigo: unidade.endereco,
                nome: nomeDoLocal(unidade),
                porProduto: new Map<number, number>(),
                total: 0,
            }

            local.porProduto.set(unidade.produto_id, (local.porProduto.get(unidade.produto_id) ?? 0) + 1)
            local.total++

            mapa.set(chave, local)
        }

        // Na ordem do código, que é a ordem do caminho pelo estoque — o
        // formato com zeros à esquerda existe justamente para ordenar como
        // texto dar o mesmo resultado que ordenar pelos números. O que não
        // tem lugar definido vai para o fim, que é onde vai dar trabalho
        // procurar mesmo.
        return [...mapa.values()].sort((a, b) => {

            if (!a.codigo !== !b.codigo) return a.codigo ? -1 : 1

            return a.codigo.localeCompare(b.codigo)
        })
    }, [guardadas])

    const termo = busca.trim().toLowerCase()

    /** Onde estão as peças de cada produto que casa com a busca. */
    const achados = useMemo(() => {
        if (!termo) return []

        return produtos
            .filter(
                (produto) =>
                    produto.nome.toLowerCase().includes(termo) ||
                    produto.codigo?.toLowerCase().includes(termo) ||
                    produto.variacao?.toLowerCase().includes(termo)
            )
            .map((produto) => {

                const porLocal = new Map<string, number>()

                for (const unidade of guardadas) {
                    if (unidade.produto_id !== produto.id) continue

                    const nome = nomeDoLocal(unidade)
                    porLocal.set(nome, (porLocal.get(nome) ?? 0) + 1)
                }

                return { produto, porLocal }
            })
    }, [termo, produtos, guardadas])

    async function consultarCodigo(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault()

        const lido = codigo.trim()

        setErroCodigo("")
        setConsulta(null)

        if (!lido) return

        try {
            setConsultando(true)
            setConsulta(await consultarPorCodigo(lido))
        } catch (e) {
            setErroCodigo(
                e instanceof ApiError && e.status === 404
                    ? `Nenhum produto com o código "${lido}" nesta loja.`
                    : e instanceof Error
                        ? e.message
                        : "Não foi possível consultar o código"
            )
        } finally {
            setConsultando(false)
        }
    }

    if (carregando) {
        return (
            <Pagina titulo="Consultar">
                <div className="card p-8 text-center text-sm text-[#616161]">Carregando estoque...</div>
            </Pagina>
        )
    }

    return (
        <Pagina
            titulo="Consultar"
            descricao={
                <>
                Passe o código da etiqueta e o sistema diz em que rua o produto
                está, quanto existe e de onde ele veio. Também dá para buscar pelo
                nome ou percorrer a lista de trechos. Para mover uma peça de lugar,
                use{" "}
                <Link href="/page/estoque" className="font-semibold text-[#005BD3] hover:underline">
                Estoque
                </Link>.
                </>
            }
        >

            {erro && (
                <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]"
                >
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {/* PELO CÓDIGO — a pergunta do balcão */}
            <section className="card p-5 sm:p-6">

                <form onSubmit={consultarCodigo} className="space-y-1.5">

                    <label className="rotulo" htmlFor="codigo">
                        Código do produto
                    </label>

                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <FiTag className="absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8A8A8A]" aria-hidden />
                            <input
                                id="codigo"
                                type="text"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                placeholder="Digite ou bipe o código da etiqueta"
                                autoComplete="off"
                                className="field num pl-9"
                            />
                        </div>

                        <button type="submit" disabled={consultando} className="btn btn-primario">
                            {consultando ? "Consultando..." : "Consultar"}
                        </button>
                    </div>

                    <p className="text-xs text-[#616161]">
                        O leitor de código de barras funciona aqui: ele digita o código e
                        dá Enter sozinho.
                    </p>

                </form>

                {erroCodigo && (
                    <p role="alert" className="mt-4 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]">
                        {erroCodigo}
                    </p>
                )}

                {consulta && (
                    <div className="mt-5 border-t border-[#EBEBEB] pt-5">

                        <p className="font-display text-lg text-[#303030]">
                            {consulta.produto.nome}
                        </p>

                        <p className="num text-xs text-[#616161]">
                            {consulta.produto.codigo}
                            {(() => {
                                const variacao = descreverVariacao(
                                    consulta.produto.variacao_rotulo,
                                    consulta.produto.variacao
                                )
                                return variacao ? ` · ${variacao}` : ""
                            })()}
                            {consulta.produto.categoria ? ` · ${consulta.produto.categoria}` : ""}
                        </p>

                        {/* ONDE ESTÁ — a resposta que se procurou */}
                        <div className="mt-4 rounded-lg bg-[#EAF4FF] p-4">

                            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#00369B]">
                                Onde está
                            </p>

                            {Object.keys(consulta.locais).length === 0 ? (
                                <p className="mt-1 text-sm text-[#303030]">
                                    Nenhuma peça disponível na prateleira agora.
                                </p>
                            ) : (
                                <ul className="mt-2 space-y-1.5">
                                    {Object.entries(consulta.locais).map(([local, quantidade]) => {
                                        const [rua, bloco] = local.split("-")

                                        return (
                                            <li key={local} className="flex items-center justify-between gap-3">
                                                <span className="flex items-center gap-2 font-display text-lg text-[#303030]">
                                                    <FiMapPin className="w-4 shrink-0 text-[#00369B]" aria-hidden />
                                                    Rua {rua} · Bloco {bloco}
                                                </span>
                                                <span className="num font-bold text-[#303030]">
                                                    {quantidade} peça(s)
                                                </span>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}

                        </div>

                        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
                            <dt className="text-[#616161]">Disponíveis</dt>
                            <dd className="num font-bold text-[#303030]">{consulta.resumo.disponiveis}</dd>
                            <dt className="text-[#616161]">Reservadas</dt>
                            <dd className="num font-bold text-[#303030]">{consulta.resumo.reservadas}</dd>
                            <dt className="text-[#616161]">Vendidas</dt>
                            <dd className="num font-bold text-[#303030]">{consulta.resumo.vendidas}</dd>
                            <dt className="text-[#616161]">Avariadas</dt>
                            <dd className="num font-bold text-[#303030]">{consulta.resumo.avariadas}</dd>
                        </dl>

                        {/* DE ONDE VEIO */}
                        {consulta.procedencia && (
                            <div className="mt-4 border-t border-[#EBEBEB] pt-4">

                                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#616161]">
                                    <FiTruck className="w-3.5" aria-hidden />
                                    De onde veio
                                </p>

                                <p className="mt-1.5 text-sm text-[#303030]">
                                    {consulta.procedencia.fornecedor || "Fornecedor não informado"}
                                    {consulta.procedencia.documento ? ` · ${consulta.procedencia.documento}` : ""}
                                </p>

                                <p className="text-xs text-[#616161]">
                                    Recebido em{" "}
                                    {new Date(consulta.procedencia.recebida_em).toLocaleDateString("pt-BR")}
                                    {consulta.procedencia.contato ? ` · ${consulta.procedencia.contato}` : ""}
                                </p>

                            </div>
                        )}

                    </div>
                )}

            </section>

            {/* POR NOME — quando não se tem o código na mão */}
            <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8A8A8A]" aria-hidden />
                <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Ou busque por nome, código ou variação"
                    className="field pl-9"
                />
            </div>

            {/* ONDE ESTÁ ESTE PRODUTO */}
            {termo && (
                <section className="space-y-3">
                    {achados.length === 0 && (
                        <p className="card p-6 text-center text-sm text-[#616161]">
                            Nenhum produto encontrado com “{busca.trim()}”.
                        </p>
                    )}

                    {achados.map(({ produto, porLocal }) => {

                        const variacao = descreverVariacao(produto.variacao_rotulo, produto.variacao)

                        return (
                            <article key={produto.id} className="card p-5">

                                <p className="font-display text-base text-[#303030]">
                                    {produto.nome}
                                </p>

                                <p className="num text-xs text-[#616161]">
                                    {produto.codigo}
                                    {variacao ? ` · ${variacao}` : ""}
                                </p>

                                {porLocal.size === 0 ? (
                                    <p className="mt-3 text-sm text-[#616161]">
                                        Nenhuma peça guardada — todas foram vendidas, avariadas, ou o
                                        estoque está zerado.
                                    </p>
                                ) : (
                                    <ul className="mt-3 space-y-1.5">
                                        {[...porLocal.entries()].map(([local, quantidade]) => (
                                            <li key={local} className="flex items-center justify-between gap-3 text-sm">
                                                <span className="flex items-center gap-2 text-[#303030]">
                                                    <FiMapPin className="w-4 shrink-0 text-[#005BD3]" aria-hidden />
                                                    {local}
                                                </span>
                                                <span className="num font-bold text-[#303030]">
                                                    {quantidade} peça(s)
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                            </article>
                        )
                    })}
                </section>
            )}

            {/* O QUE TEM EM CADA TRECHO */}
            <section className="space-y-3">

                <h2 className="font-display text-lg text-[#303030]">
                    O que tem em cada trecho
                </h2>

                {locais.length === 0 && (
                    <p className="card p-6 text-center text-sm text-[#616161]">
                        Nenhuma peça guardada no estoque ainda.
                    </p>
                )}

                {locais.map((local) => (
                    <article key={local.codigo || "sem-local"} className="card p-5">

                        <div className="flex items-center justify-between gap-3">

                            <p className="flex items-center gap-2 font-display text-base text-[#303030]">
                                <FiMapPin className="w-4 shrink-0 text-[#005BD3]" aria-hidden />
                                {local.nome}
                            </p>

                            <span className="num text-sm font-bold text-[#616161]">
                                {local.total} peça(s)
                            </span>

                        </div>

                        <ul className="mt-3 space-y-1.5 border-t border-[#EBEBEB] pt-3">
                            {[...local.porProduto.entries()].map(([produtoId, quantidade]) => {

                                const produto = produtosPorId.get(produtoId)
                                const variacao = descreverVariacao(produto?.variacao_rotulo, produto?.variacao)

                                return (
                                    <li key={produtoId} className="flex items-center justify-between gap-3 text-sm">

                                        <span className="min-w-0 truncate text-[#303030]">
                                            {produto?.nome ?? `Produto #${produtoId}`}
                                            {variacao ? (
                                                <span className="text-[#616161]"> · {variacao}</span>
                                            ) : null}
                                        </span>

                                        <span className="num shrink-0 font-bold text-[#303030]">
                                            {quantidade}
                                        </span>

                                    </li>
                                )
                            })}
                        </ul>

                    </article>
                ))}

            </section>

        </Pagina>
    )
}
