"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
    definirPicking,
    gerarReposicoes,
    listarReposicoes,
    type Reposicao,
} from "@/middleware/wms"
import { listarEnderecos, type EnderecoEstoque } from "@/middleware/estoque"
import { listarProdutos } from "@/middleware/produtos"
import type { Produto } from "@/app/type/type"
import { ApiError } from "@/middleware/client"
import {
    FiAlertCircle,
    FiAlertTriangle,
    FiArrowDown,
    FiCheckCircle,
    FiMapPin,
    FiPlusCircle,
} from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"

/**
 * Ressuprimento: o que está faltando na prateleira de venda agora.
 *
 * É o problema que a loja que só conta quantidade nunca enxerga: o sistema
 * diz "20 peças" e o cliente ouve "acabou", porque as 20 estão no pulmão e a
 * prateleira está vazia. Ver isso exige duas informações que só o picking
 * fixo dá — onde o produto DEVE estar e quanto ele tem de ter ali —, e é por
 * isso que esta tela também é onde se define esse par.
 *
 * Ver o que falta e criar o trabalho são dois botões diferentes de propósito:
 * consultar acontece a cada abertura de tela; mandar alguém subir a escada é
 * decisão, e decisão não se toma sozinha ao carregar uma página.
 */

export default function Reposicao() {

    const [reposicoes, setReposicoes] = useState<Reposicao[]>([])
    const [urgentes, setUrgentes] = useState(0)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")
    const [gerando, setGerando] = useState(false)

    // O formulário do picking fixo vive nesta tela porque é aqui que a falta
    // dele aparece: sem mínimo declarado, o produto simplesmente não entra na
    // conta do que está faltando.
    const [produtos, setProdutos] = useState<Produto[]>([])
    const [enderecos, setEnderecos] = useState<EnderecoEstoque[]>([])
    const [produtoId, setProdutoId] = useState("")
    const [endereco, setEndereco] = useState("")
    const [minimo, setMinimo] = useState("")
    const [maximo, setMaximo] = useState("")
    const [salvando, setSalvando] = useState(false)

    const carregar = useCallback(async () => {

        try {
            const resumo = await listarReposicoes()

            setReposicoes(resumo.reposicoes)
            setUrgentes(resumo.urgentes)
            setErro("")

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível carregar o ressuprimento.")
        } finally {
            setCarregando(false)
        }

    }, [])

    useEffect(() => {
        let cancelado = false

        async function cadastros() {
            try {
                const [listaProdutos, listaEnderecos] = await Promise.all([
                    listarProdutos(),
                    listarEnderecos(),
                ])

                if (cancelado) return

                setProdutos(listaProdutos)
                // Prateleira de venda é o único tipo que faz sentido como
                // picking fixo: pulmão é de onde se tira, não onde se vende.
                setEnderecos(listaEnderecos.filter((item) => !item.bloqueado && item.tipo === "picking"))

            } catch {
                // Sem os cadastros, a lista do que falta continua de pé — só
                // o formulário de picking fica sem opções.
            }
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao montar a página
        carregar()
        cadastros()

        return () => {
            cancelado = true
        }
    }, [carregar])

    async function porNaFila() {

        setErro("")
        setAviso("")
        setGerando(true)

        try {
            const resultado = await gerarReposicoes()

            setAviso(
                resultado.criadas > 0
                    ? `${resultado.criadas} tarefa(s) de reposição na fila.`
                    : "Nada a repor: as prateleiras estão acima do mínimo."
            )

            await carregar()

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível gerar as tarefas.")
        } finally {
            setGerando(false)
        }
    }

    async function salvarPicking(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault()

        setErro("")
        setAviso("")

        const id = parseInt(produtoId, 10)
        const quantidadeMinima = parseInt(minimo, 10)

        if (!Number.isFinite(id) || id <= 0) {
            setErro("Escolha o produto.")
            return
        }

        if (!endereco) {
            setErro("Escolha a prateleira de venda do produto.")
            return
        }

        if (!Number.isFinite(quantidadeMinima) || quantidadeMinima <= 0) {
            setErro("O mínimo tem de ser maior que zero — é ele que diz quando repor.")
            return
        }

        try {
            setSalvando(true)

            const picking = await definirPicking(id, {
                endereco,
                minimo: quantidadeMinima,
                maximo: parseInt(maximo, 10) || 0,
            })

            setAviso(
                `${picking.produto_nome} mora em ${picking.endereco}: repõe abaixo de ${picking.minimo}, até ${picking.maximo}.`
            )

            setProdutoId("")
            setEndereco("")
            setMinimo("")
            setMaximo("")

            await carregar()

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível definir a prateleira.")
        } finally {
            setSalvando(false)
        }
    }

    return (
        <Pagina
            titulo="Reposição"
            descricao="O que está abaixo do mínimo na prateleira de venda, com o pulmão de onde tirar. Ver não mexe em nada; pôr na fila é que cria trabalho para alguém."
            acoes={
                <button
                    type="button"
                    onClick={porNaFila}
                    disabled={gerando || reposicoes.length === 0}
                    className="btn btn-primario"
                >
                    <FiPlusCircle className="w-4" aria-hidden />
                    {gerando ? "Gerando..." : "Pôr na fila"}
                </button>
            }
        >

            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aviso && (
                <div role="status" className="flex items-start gap-2.5 rounded-lg bg-[#CDFEE1] px-4 py-3 text-sm font-semibold text-[#0C5132]">
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{aviso}</span>
                </div>
            )}

            {urgentes > 0 && (
                <div className="flex items-start gap-2.5 rounded-lg border-l-4 border-[#8E1F0B] bg-[#FEE9E8] px-4 py-3 text-sm text-[#8E1F0B]">
                    <FiAlertTriangle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>
                        <span className="num font-bold">{urgentes}</span> prateleira(s) já estão
                        vazias. Não falta pouco: falta tudo — e é venda perdida agora, não amanhã.
                    </span>
                </div>
            )}

            {carregando ? (

                <p className="text-[#616161]">Carregando o ressuprimento...</p>

            ) : reposicoes.length === 0 ? (

                <div className="rounded-lg border border-dashed border-[#E1E1E1] bg-white p-12 text-center">

                    <FiCheckCircle className="mx-auto w-9 text-[#8A8A8A]" aria-hidden />

                    <h2 className="font-display mt-4 text-lg text-[#303030]">
                        Nada faltando na prateleira
                    </h2>

                    <p className="mt-2 text-sm text-[#616161]">
                        Ou está tudo acima do mínimo, ou nenhum produto tem prateleira de venda
                        definida ainda — sem dizer onde o produto deve ficar e quanto tem de ter
                        ali, &ldquo;abaixo do mínimo&rdquo; não quer dizer nada.
                    </p>

                </div>

            ) : (

                <ul className="space-y-3">

                    {reposicoes.map((reposicao) => (

                        <li
                            key={`${reposicao.produto_id}-${reposicao.destino_id}`}
                            className={`card border-l-4 p-5 ${reposicao.urgente ? "border-l-[#8E1F0B]" : "border-l-[#C7920A]"}`}
                        >

                            <div className="flex flex-wrap items-start justify-between gap-3">

                                <div className="min-w-0">

                                    <p className="font-display text-base text-[#303030]">
                                        {reposicao.produto_nome}
                                        {reposicao.variacao ? ` · ${reposicao.variacao}` : ""}
                                    </p>

                                    <p className="font-mono text-xs text-[#616161]">
                                        {reposicao.produto_codigo}
                                    </p>

                                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">

                                        {reposicao.origem ? (
                                            <>
                                                <span className="num font-medium text-[#303030]">{reposicao.origem}</span>
                                                <FiArrowDown className="w-3.5 text-[#616161]" aria-hidden />
                                            </>
                                        ) : null}

                                        <span className="num font-medium text-[#303030]">{reposicao.destino}</span>

                                        <span className="text-[#616161]">{reposicao.destino_nome}</span>

                                    </p>

                                    <p className="mt-2 flex flex-wrap items-center gap-2">

                                        {reposicao.urgente && (
                                            <span className="tag tag-danger">prateleira vazia</span>
                                        )}

                                        <span className="tag tag-neutral num">
                                            tem {reposicao.no_picking} de {reposicao.minimo}
                                        </span>

                                        <span className="tag tag-neutral num">
                                            pulmão: {reposicao.no_pulmao}
                                        </span>

                                    </p>

                                    {!reposicao.origem && (
                                        <p className="mt-2 text-sm text-[#8E1F0B]">
                                            Não há de onde tirar: o produto acabou na loja inteira. O
                                            problema aqui não é de reposição, é de compra.
                                        </p>
                                    )}

                                </div>

                                <div className="shrink-0 text-right">
                                    <p className="text-xs text-[#616161]">Repor</p>
                                    <p className="num text-3xl font-bold text-[#303030]">
                                        {reposicao.quantidade}
                                    </p>
                                    <p className="num text-xs text-[#616161]">
                                        até {reposicao.maximo}
                                    </p>
                                </div>

                            </div>

                        </li>

                    ))}

                </ul>

            )}

            {/* ==========================
                PICKING FIXO
            ========================== */}

            <section className="card space-y-4 p-5 sm:p-7">

                <div>
                    <h2 className="font-display flex items-center gap-2 text-base text-[#303030]">
                        <FiMapPin className="w-4 text-[#005BD3]" aria-hidden />
                        Prateleira de venda de um produto
                    </h2>
                    <p className="mt-1 text-sm text-[#616161]">
                        Onde o produto mora e quanto ele tem de ter ali. É o par sem o qual não
                        existe reposição — e sem o qual a loja descobre a prateleira vazia pela
                        boca do cliente, com o estoque cheio no fundo.
                    </p>
                </div>

                {enderecos.length === 0 ? (

                    <p className="rounded-lg bg-[#FFF1E3] px-4 py-3 text-sm text-[#5E4200]">
                        Nenhuma prateleira de venda cadastrada.{" "}
                        <Link href="/page/estoque/enderecos" className="font-bold underline">
                            Cadastre um endereço do tipo &ldquo;prateleira de venda&rdquo;
                        </Link>{" "}
                        para poder dizer onde cada produto fica.
                    </p>

                ) : (

                    <form onSubmit={salvarPicking} className="space-y-4">

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                            <div className="space-y-1.5">
                                <label className="rotulo" htmlFor="produto">Produto</label>
                                <select
                                    id="produto"
                                    value={produtoId}
                                    onChange={(e) => setProdutoId(e.target.value)}
                                    className="field cursor-pointer"
                                >
                                    <option value="">Selecione...</option>
                                    {produtos.map((produto) => (
                                        <option key={produto.id} value={produto.id}>
                                            {produto.nome}
                                            {produto.variacao ? ` · ${produto.variacao}` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="rotulo" htmlFor="endereco">Prateleira</label>
                                <select
                                    id="endereco"
                                    value={endereco}
                                    onChange={(e) => setEndereco(e.target.value)}
                                    className="field cursor-pointer"
                                >
                                    <option value="">Selecione...</option>
                                    {enderecos.map((item) => (
                                        <option key={item.id} value={item.codigo}>
                                            {item.codigo} · {item.nome}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="rotulo" htmlFor="minimo">Mínimo</label>
                                <input
                                    id="minimo"
                                    type="number"
                                    min="1"
                                    value={minimo}
                                    onChange={(e) => setMinimo(e.target.value)}
                                    placeholder="Repõe abaixo disto"
                                    className="field num"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="rotulo" htmlFor="maximo">Máximo</label>
                                <input
                                    id="maximo"
                                    type="number"
                                    min="0"
                                    value={maximo}
                                    onChange={(e) => setMaximo(e.target.value)}
                                    placeholder="0 = a capacidade da prateleira"
                                    className="field num"
                                />
                            </div>

                        </div>

                        <button type="submit" disabled={salvando} className="btn btn-primario">
                            {salvando ? "Salvando..." : "Definir prateleira"}
                        </button>

                    </form>

                )}

            </section>

        </Pagina>
    )
}
