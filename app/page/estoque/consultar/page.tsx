"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Produto, Unidade } from "@/app/type/type"
import { listarProdutos, listarTodasUnidades } from "@/middleware/produtos"
import { descreverVariacao } from "@/app/components/produto/campos"
import { consultarPorCodigo, type ConsultaPorCodigo } from "@/middleware/estoque"
import { ApiError } from "@/middleware/client"
import { FiAlertCircle, FiMapPin, FiPackage, FiSearch, FiTag, FiTruck } from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"
import {
    BarraDaLista,
    ListaDeRecursos,
    ListaVazia,
    RodapeDaLista,
    Visoes,
} from "@/app/components/lista/lista"

/**
 * Consulta do estoque: o que existe de cada produto e onde está guardado.
 *
 * Responde as duas perguntas que se faz de pé no corredor, e que são o
 * inverso uma da outra: "onde está este produto?" e "o que tem nesta rua?".
 * A primeira poupa a volta inteira pelo estoque; a segunda é o que se usa ao
 * arrumar a prateleira ou conferir um trecho.
 *
 * As duas eram duas seções empilhadas, cada uma com a própria busca e o
 * próprio formato de cartão — o que fazia a tela parecer duas telas coladas.
 * Aqui elas são duas VISÕES da mesma lista (ver components/lista/lista.tsx):
 * a mesma busca serve as duas, e trocar de pergunta é trocar de aba.
 *
 * Só peças que ainda estão lá: o que foi vendido saiu da loja, e o que está
 * avariado não é para ser buscado.
 */

/** Uma linha da lista: um produto num endereço, e quantas peças dele há ali. */
interface Linha {
    /** Código da prateleira ("001.005.01.A"); vazio é a peça sem lugar. */
    codigo: string
    /** O endereço falado, do jeito que alguém repete no corredor. */
    local: string
    produtoId: number
    produto: string
    variacao: string
    codigoProduto: string
    quantidade: number
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
    const [visao, setVisao] = useState("endereco")

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

    /*
     * As linhas da lista.
     *
     * Uma por par produto × endereço, que é a menor unidade que responde às
     * duas perguntas: lida por endereço conta o que há no trecho, lida por
     * produto conta onde ele está. Antes eram duas estruturas diferentes para
     * a mesma contagem, montadas em dois `useMemo` que podiam divergir.
     */
    const linhas = useMemo(() => {

        const mapa = new Map<string, Linha>()

        for (const unidade of guardadas) {

            const chave = `${unidade.endereco || "sem-local"}|${unidade.produto_id}`
            const existente = mapa.get(chave)

            if (existente) {
                existente.quantidade++
                continue
            }

            const produto = produtosPorId.get(unidade.produto_id)

            mapa.set(chave, {
                codigo: unidade.endereco,
                local: nomeDoLocal(unidade),
                produtoId: unidade.produto_id,
                produto: produto?.nome ?? `Produto #${unidade.produto_id}`,
                variacao: descreverVariacao(produto?.variacao_rotulo, produto?.variacao) ?? "",
                codigoProduto: produto?.codigo ?? "",
                quantidade: 1,
            })
        }

        return [...mapa.values()]

    }, [guardadas, produtosPorId])

    const termo = busca.trim().toLowerCase()

    const filtradas = useMemo(() => {

        const casam = termo
            ? linhas.filter((linha) =>
                linha.produto.toLowerCase().includes(termo) ||
                linha.codigoProduto.toLowerCase().includes(termo) ||
                linha.variacao.toLowerCase().includes(termo) ||
                linha.local.toLowerCase().includes(termo) ||
                linha.codigo.toLowerCase().includes(termo)
            )
            : linhas

        /*
         * Por endereço, a ordem é a do código — que é a ordem do caminho pelo
         * estoque. O formato com zeros à esquerda existe justamente para
         * ordenar como texto dar o mesmo resultado que ordenar pelos números.
         * O que não tem lugar definido vai para o fim, que é onde vai dar
         * trabalho procurar mesmo.
         */
        if (visao === "endereco") {
            return [...casam].sort((a, b) => {
                if (!a.codigo !== !b.codigo) return a.codigo ? -1 : 1
                if (a.codigo !== b.codigo) return a.codigo.localeCompare(b.codigo)
                return a.produto.localeCompare(b.produto)
            })
        }

        return [...casam].sort((a, b) =>
            a.produto.localeCompare(b.produto) || a.codigo.localeCompare(b.codigo)
        )

    }, [linhas, termo, visao])

    const totalPecas = filtradas.reduce((soma, linha) => soma + linha.quantidade, 0)

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
                    className="mb-4 flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]"
                >
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {/* PELO CÓDIGO — a pergunta do balcão.
                Fica fora da lista, e acima dela, porque não é um recorte do
                que está embaixo: é um atalho que responde sozinho, com o
                leitor na mão, sem olhar lista nenhuma. */}
            <section className="card mb-4 p-4 sm:p-5">

                <form onSubmit={consultarCodigo}>

                    <label className="rotulo" htmlFor="codigo">
                        Código do produto
                    </label>

                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <FiTag className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8A8A8A]" aria-hidden />
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

                        <button type="submit" disabled={consultando} className="btn btn-primario shrink-0">
                            {consultando ? "Consultando..." : "Consultar"}
                        </button>
                    </div>

                    <p className="mt-1.5 text-xs text-[#616161]">
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

                        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">

                            {/* ONDE ESTÁ — a resposta que se procurou */}
                            <div className="rounded-lg bg-[#EAF4FF] p-4">

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

                            {/* O resumo em quatro números fica ao lado, e não
                                embaixo em quatro colunas de definição: são
                                estados do mesmo produto, e lê-se de cima para
                                baixo como uma ficha. */}
                            <dl className="divide-y divide-[#EBEBEB] rounded-lg border border-[#E1E1E1] px-4">

                                {[
                                    { rotulo: "Disponíveis", valor: consulta.resumo.disponiveis },
                                    { rotulo: "Reservadas", valor: consulta.resumo.reservadas },
                                    { rotulo: "Vendidas", valor: consulta.resumo.vendidas },
                                    { rotulo: "Avariadas", valor: consulta.resumo.avariadas },
                                ].map((item) => (
                                    <div key={item.rotulo} className="flex items-center justify-between gap-3 py-2 text-sm">
                                        <dt className="text-[#616161]">{item.rotulo}</dt>
                                        <dd className="num font-semibold text-[#303030]">{item.valor}</dd>
                                    </div>
                                ))}

                            </dl>

                        </div>

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

            {/* A LISTA — as duas perguntas inversas, uma aba cada */}
            <ListaDeRecursos>

                <Visoes
                    visoes={[
                        { chave: "endereco", nome: "Por endereço" },
                        { chave: "produto", nome: "Por produto" },
                    ]}
                    ativa={visao}
                    aoTrocar={setVisao}
                />

                <BarraDaLista
                    busca={busca}
                    aoBuscar={setBusca}
                    placeholder="Buscar por produto, código, variação ou endereço"
                />

                {filtradas.length === 0 ? (

                    <ListaVazia
                        icone={termo ? FiSearch : FiPackage}
                        titulo={termo ? "Nada com esse texto" : "Nenhuma peça guardada"}
                    >
                        {termo
                            ? `Nenhum produto ou endereço casa com “${busca.trim()}”.`
                            : "Assim que a primeira entrada for registrada, as peças aparecem aqui com o endereço de cada uma."}
                    </ListaVazia>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="tabela">

                            <thead>
                                <tr>
                                    {visao === "endereco" ? (
                                        <>
                                            <th scope="col">Endereço</th>
                                            <th scope="col">Produto</th>
                                        </>
                                    ) : (
                                        <>
                                            <th scope="col">Produto</th>
                                            <th scope="col">Endereço</th>
                                        </>
                                    )}
                                    <th scope="col" className="text-right">Peças</th>
                                </tr>
                            </thead>

                            <tbody>

                                {filtradas.map((linha, indice) => {

                                    /*
                                     * O endereço só aparece quando muda.
                                     *
                                     * Repetido em todas as linhas do mesmo trecho, ele
                                     * vira uma coluna de texto igual que o olho tem de
                                     * varrer para achar onde um grupo termina. Escrito
                                     * uma vez, a lista volta a ser lida como o corredor
                                     * é percorrido: um lugar, o que tem nele.
                                     */
                                    const anterior = filtradas[indice - 1]
                                    const repetido = visao === "endereco" && anterior?.local === linha.local

                                    const celulaEndereco = (
                                        <td className={repetido ? "text-[#8A8A8A]" : ""}>
                                            {repetido ? (
                                                <span className="sr-only">{linha.local}</span>
                                            ) : (
                                                <span className="flex items-center gap-1.5">
                                                    <FiMapPin className="w-3.5 shrink-0 text-[#8A8A8A]" aria-hidden />
                                                    <span className="num text-[#303030]">{linha.local}</span>
                                                </span>
                                            )}
                                        </td>
                                    )

                                    const celulaProduto = (
                                        <td>
                                            <span className="text-[#303030]">{linha.produto}</span>
                                            {linha.variacao && (
                                                <span className="text-[#616161]"> · {linha.variacao}</span>
                                            )}
                                            {linha.codigoProduto && (
                                                <span className="num block text-xs text-[#8A8A8A]">
                                                    {linha.codigoProduto}
                                                </span>
                                            )}
                                        </td>
                                    )

                                    return (
                                        <tr key={`${linha.codigo}-${linha.produtoId}`}>

                                            {visao === "endereco" ? (
                                                <>
                                                    {celulaEndereco}
                                                    {celulaProduto}
                                                </>
                                            ) : (
                                                <>
                                                    {celulaProduto}
                                                    {celulaEndereco}
                                                </>
                                            )}

                                            <td className="num text-right font-medium text-[#303030]">
                                                {linha.quantidade}
                                            </td>

                                        </tr>
                                    )
                                })}

                            </tbody>

                        </table>

                    </div>

                )}

                <RodapeDaLista
                    primeiro={1}
                    ultimo={filtradas.length}
                    total={filtradas.length}
                    nome={visao === "endereco" ? "posições ocupadas" : "produtos por endereço"}
                    extra={<><span className="num">{totalPecas}</span> peças ao todo</>}
                />

            </ListaDeRecursos>

        </Pagina>
    )
}
