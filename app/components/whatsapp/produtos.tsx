"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { listarProdutos } from "@/middleware/produtos"
import { lancarPedido, type Falta, type ItemLancado } from "@/middleware/pedidos"
import { ApiError } from "@/middleware/client"
import { formatarMoeda } from "@/app/components/preco/preco"
import { atributosParaFicha } from "@/app/components/produto/campos"
import type { Pedido, Produto } from "@/app/type/type"
import { FiBox, FiCheck, FiMinus, FiPlus, FiRefreshCw, FiSearch, FiShoppingCart, FiX } from "react-icons/fi"

/**
 * A caixa de produtos dentro da conversa.
 *
 * O cliente pergunta o preço de três coisas. Sem isto, o atendimento vira
 * uma ginástica: sair da conversa, abrir Produtos, procurar o primeiro,
 * decorar nome e preço, voltar, digitar, e repetir mais duas vezes — quando
 * não se troca de aba e se esquece de voltar, que é onde a venda esfria.
 * Aqui o lojista procura, marca os três e eles caem prontos na mensagem.
 *
 * O que a caixa monta é TEXTO, e não um formato próprio: do outro lado está
 * o WhatsApp comum do cliente, que não conhece nada nosso. Por isso o negrito
 * vai nos asteriscos que o próprio WhatsApp entende.
 *
 * Ela não envia. Põe o texto na caixa de escrever e sai da frente, para o
 * lojista acrescentar o "bom dia, seguem os valores" antes de mandar — e para
 * existir um lugar só de onde a mensagem sai, que é o botão de sempre.
 *
 * A mesma caixa serve às duas coisas que se faz com uma lista de produtos no
 * meio de um atendimento, e por isso tem dois modos:
 *
 *   - "mensagem": o cliente perguntou o preço. Marca-se o que ele quer saber
 *     e o texto vai para a caixa de escrever.
 *   - "pedido": o cliente fechou. Marca-se o mesmo, agora com quantidade, e
 *     sai um pedido de verdade — reservado no estoque, na fila de separação,
 *     com código para o cliente acompanhar.
 *
 * São duas tarefas diferentes com a mesma pergunta no meio ("o que ele
 * quer?"), então é uma caixa só com dois destinos — e não duas telas que se
 * parecem, onde o lojista teria de lembrar em qual das duas está.
 */

/** Um produto com o preço que vale hoje já resolvido. */
interface Linha {
    produto: Produto
    /** O promocional quando existe; senão, o de tabela. */
    preco: number
    /** O de tabela, só quando há promoção — é o "de" do "de/por". */
    precoAntigo: number | null
    disponivel: number
}

/**
 * Como o produto se identifica na mensagem: o nome mais a variação, quando
 * ela existe. "Camiseta preta" e "Camiseta preta — P" são coisas diferentes
 * para quem vai comprar, e mandar as duas como "Camiseta preta" obrigaria o
 * cliente a perguntar de novo.
 */
function nomeCompleto(produto: Produto): string {
    const variacao = produto.variacao?.trim()
    return variacao ? `${produto.nome} — ${variacao}` : produto.nome
}

/** O código impresso na etiqueta; o id preenche o produto cadastrado antes dele. */
function codigoDoProduto(produto: Produto): string {
    return produto.codigo || String(produto.id).padStart(6, "0")
}

/**
 * O texto que vai para o cliente.
 *
 * Leva o que descreve o produto — nome, variação, preço, descrição e a ficha
 * técnica — e deixa de fora o que é controle da loja. Essa divisão não é
 * estética: o código da etiqueta e a contagem do estoque servem a quem
 * guarda a mercadoria, não a quem vai comprá-la, e o CUSTO então nunca pode
 * sair daqui — mandar ao cliente por quanto a peça foi comprada é entregar a
 * margem da loja numa conversa.
 *
 * Quem escolhe é esta função, e não a tela: a lista da caixa continua
 * mostrando código e estoque ao lojista, que é para quem eles servem.
 */
export function montarMensagem(linhas: Linha[]): string {

    return linhas
        .map(({ produto, preco, precoAntigo, disponivel }) => {

            const partes: string[] = [`*${nomeCompleto(produto)}*`]

            // O preço fica sozinho na sua linha, e é aí que ele se destaca —
            // sem negrito. O nome logo acima já está em negrito, e duas
            // linhas fortes seguidas achatam uma à outra: nada sobressai
            // quando tudo sobressai.
            //
            // Em promoção é diferente: o negrito volta, mas só no valor novo,
            // porque ali ele tem contra o que se destacar — o preço antigo
            // riscado ao lado. É o que faz o desconto ser VISTO, e não apenas
            // informado.
            partes.push(
                precoAntigo
                    ? `de ~${formatarMoeda(precoAntigo)}~ por *${formatarMoeda(preco)}* 🔥`
                    : formatarMoeda(preco)
            )

            // A descrição em itálico: é a fala do produto, e o itálico a
            // separa dos dados sem precisar de rótulo dizendo "descrição".
            const descricao = produto.descricao?.trim()

            if (descricao) partes.push(`_${descricao}_`)

            // A ficha técnica no vocabulário do ramo da loja — tecido e
            // gramatura numa camiseta, potência e voltagem num ventilador. É
            // a resposta das perguntas que viriam a seguir, dada antes.
            const ficha = atributosParaFicha(produto.atributos)

            if (ficha.length > 0) {
                partes.push(ficha.map(({ nome, valor }) => `• ${nome}: ${valor}`).join("\n"))
            }

            // A falta de estoque continua sendo dita — sem número, que é
            // conta da loja. Prometer o que não existe custa mais caro do que
            // avisar na hora.
            if (disponivel <= 0) partes.push("⏳ sem estoque no momento")

            return partes.join("\n")
        })
        .join("\n\n")
}

export default function CaixaDeProdutos({
    modo,
    cliente,
    aoInserir,
    aoPedidoCriado,
    aoFechar,
}: {
    /** "mensagem" manda preço; "pedido" fecha a venda. */
    modo: "mensagem" | "pedido"
    /**
     * Quem está do outro lado da conversa, para o pedido nascer no nome
     * certo. O contato é o telefone do WhatsApp — é por ele que este pedido
     * será reencontrado como sendo desta conversa.
     */
    cliente: { nome: string; contato: string }
    /** Recebe o texto pronto para entrar na caixa de escrever. */
    aoInserir: (texto: string) => void
    /** Chamado com o pedido recém-criado, para o topo mostrar o código. */
    aoPedidoCriado: (pedido: Pedido) => void
    aoFechar: () => void
}) {

    const [produtos, setProdutos] = useState<Produto[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    const [busca, setBusca] = useState("")
    const [soComEstoque, setSoComEstoque] = useState(true)

    // Ids, e não os produtos inteiros: a lista é recarregada e o produto
    // guardado aqui ficaria com o preço de antes.
    const [marcados, setMarcados] = useState<number[]>([])

    /**
     * Quantas peças de cada produto. Só vale no modo pedido — para mandar
     * preço, quantidade não é pergunta.
     *
     * Fica separada de `marcados` porque sobrevive ao desmarcar: quem tirou o
     * item da lista sem querer e o marca de novo recupera o "3" que já tinha
     * digitado, em vez de recomeçar do 1.
     */
    const [quantidades, setQuantidades] = useState<Record<number, number>>({})

    const [gerando, setGerando] = useState(false)
    const [erroPedido, setErroPedido] = useState("")

    /**
     * O que o estoque não cobriu na última tentativa.
     *
     * O servidor recusa o pedido inteiro quando falta peça (409) e diz o que
     * falta. Guardar isso é o que permite perguntar "lanço só o que tem?" em
     * vez de simplesmente dizer não — meio pedido só vai para a separação
     * depois de alguém decidir que pode.
     */
    const [faltas, setFaltas] = useState<Falta[]>([])

    /**
     * Busca o catálogo.
     *
     * A mensagem de erro é a do servidor, e não uma frase nossa por cima
     * dela: "não foi possível carregar" não diz se o problema é a rede da
     * loja, a sessão que venceu ou o servidor fora do ar — e sem saber qual
     * é, não há o que fazer além de tentar de novo às cegas. A frase genérica
     * só entra quando não veio nada melhor.
     */
    const carregar = useCallback(async () => {

        setCarregando(true)
        setErro("")

        try {
            setProdutos(await listarProdutos())
        } catch (e) {
            setErro(
                e instanceof ApiError
                    ? e.message
                    : "Não foi possível falar com o servidor. Verifique a conexão da loja."
            )
        } finally {
            setCarregando(false)
        }
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial ao abrir a caixa
        carregar()
    }, [carregar])

    const linhas: Linha[] = useMemo(
        () =>
            produtos.map((produto) => {
                const promocional = Number(produto.preco_promocional ?? 0)
                const tabela = Number(produto.preco ?? 0)
                const temPromocao = promocional > 0 && promocional < tabela

                return {
                    produto,
                    preco: temPromocao ? promocional : tabela,
                    precoAntigo: temPromocao ? tabela : null,
                    disponivel: Number(produto.estoque ?? 0),
                }
            }),
        [produtos]
    )

    const filtradas = useMemo(() => {

        const termo = busca.trim().toLowerCase()

        return linhas.filter((linha) => {

            if (soComEstoque && linha.disponivel <= 0) return false

            if (!termo) return true

            return (
                linha.produto.nome.toLowerCase().includes(termo) ||
                codigoDoProduto(linha.produto).toLowerCase().includes(termo) ||
                (linha.produto.variacao ?? "").toLowerCase().includes(termo)
            )
        })

    }, [linhas, busca, soComEstoque])

    // Na ordem em que foram marcados, e não na ordem da lista: o lojista
    // escolheu numa sequência, e é essa a ordem em que ele vai falar.
    const escolhidas = useMemo(
        () =>
            marcados
                .map((id) => linhas.find((linha) => linha.produto.id === id))
                .filter((linha): linha is Linha => linha !== undefined),
        [marcados, linhas]
    )

    function alternar(id: number) {
        setErroPedido("")
        setFaltas([])

        setMarcados((atual) =>
            atual.includes(id) ? atual.filter((outro) => outro !== id) : [...atual, id]
        )
    }

    /** Quantas peças deste produto — uma, enquanto ninguém disser outra coisa. */
    function quantidadeDe(id: number): number {
        return quantidades[id] ?? 1
    }

    function mudarQuantidade(id: number, passo: number) {

        setErroPedido("")
        setFaltas([])

        setQuantidades((atual) => ({
            ...atual,
            // Não desce de 1: quem quer zero desmarca o item, e é a caixinha
            // que diz isso. Um "0" na lista seria um item que está e não está.
            [id]: Math.max(1, quantidadeDe(id) + passo),
        }))

        // Mexer na quantidade é dizer que quer o item: marca sozinho, em vez
        // de deixar o número subindo num produto que não entra no pedido.
        setMarcados((atual) => (atual.includes(id) ? atual : [...atual, id]))
    }

    function inserir() {
        if (escolhidas.length === 0) return
        aoInserir(montarMensagem(escolhidas))
    }

    /** O que o pedido vai custar, com os preços que valem hoje. */
    const total = useMemo(
        () =>
            escolhidas.reduce(
                (soma, linha) => soma + linha.preco * quantidadeDe(linha.produto.id),
                0
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- quantidadeDe lê `quantidades`, que já está nas dependências
        [escolhidas, quantidades]
    )

    /**
     * Lança o pedido desta conversa.
     *
     * `aceitarParcial` só é verdadeiro na segunda tentativa, depois de o
     * lojista ver o que falta e dizer que pode. Na primeira, faltando peça, o
     * servidor recusa tudo — e é ele quem decide isso, olhando o estoque no
     * instante do lançamento, não a contagem que esta tela carregou faz dez
     * minutos.
     */
    async function gerarPedido(aceitarParcial = false) {

        if (escolhidas.length === 0 || gerando) return

        const itens: ItemLancado[] = escolhidas.map((linha) => ({
            produto_id: linha.produto.id,
            quantidade: quantidadeDe(linha.produto.id),
        }))

        setGerando(true)
        setErroPedido("")

        try {
            const lancado = await lancarPedido(cliente, itens, aceitarParcial)

            aoPedidoCriado(lancado.pedido)
            aoFechar()

        } catch (e) {

            // 409 é a recusa por falta de peça, e vem com a lista do que
            // faltou. Não é erro de sistema: é uma pergunta ao lojista.
            if (e instanceof ApiError && e.status === 409) {

                const dados = e.dados as { faltas?: Falta[] } | null

                setFaltas(Array.isArray(dados?.faltas) ? dados.faltas : [])
                setErroPedido(e.message)

            } else {
                setErroPedido(
                    e instanceof ApiError ? e.message : "Não foi possível gerar o pedido."
                )
            }

        } finally {
            setGerando(false)
        }
    }

    return (
        <div className="flex max-h-[22rem] flex-col border-t border-[var(--linha-suave)] bg-[var(--superficie)]">

            {/* ==========================
                BUSCA
            ========================== */}

            <div className="flex items-center gap-2 border-b border-[var(--linha-suave)] px-3 py-2.5">

                <div className="relative flex-1">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[var(--ink-3)]" aria-hidden />

                    <input
                        autoFocus
                        className="field pl-9"
                        placeholder="Buscar produto por nome ou código"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                    />
                </div>

                <button
                    type="button"
                    onClick={aoFechar}
                    aria-label="Fechar a caixa de produtos"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)]"
                >
                    <FiX className="w-4" aria-hidden />
                </button>

            </div>

            {/* ==========================
                LISTA
            ========================== */}

            <div className="min-h-0 flex-1 overflow-y-auto">

                {carregando && (
                    <p className="px-4 py-6 text-center text-sm text-[var(--ink-3)]">
                        Carregando o estoque...
                    </p>
                )}

                {erro && (
                    <div role="alert" className="px-4 py-6 text-center">
                        <p className="text-sm font-semibold text-[var(--vermelho)]">{erro}</p>

                        <button type="button" onClick={carregar} className="btn btn-neutro mt-3">
                            <FiRefreshCw className="w-4" aria-hidden />
                            <span>Tentar de novo</span>
                        </button>
                    </div>
                )}

                {!carregando && !erro && filtradas.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-[var(--ink-3)]">
                        {soComEstoque
                            ? "Nada com esse nome em estoque. Desmarque “só com estoque” para ver o catálogo inteiro."
                            : "Nenhum produto com esse nome ou código."}
                    </p>
                )}

                <ul className="divide-y divide-[var(--fundo)]">
                    {filtradas.map((linha) => {

                        const marcado = marcados.includes(linha.produto.id)

                        return (
                            // A linha é um <div> com um botão dentro, e não um
                            // botão inteiro: no modo pedido ela carrega os
                            // botões de mais e menos, e botão dentro de botão
                            // é HTML inválido — o navegador desmonta a marcação
                            // e o clique passa a cair em lugar imprevisível.
                            <li
                                key={linha.produto.id}
                                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                                    marcado ? "bg-[var(--azul-suave)]" : "hover:bg-[var(--superficie-2)]"
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => alternar(linha.produto.id)}
                                    aria-pressed={marcado}
                                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                >
                                    <span
                                        aria-hidden
                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                            marcado
                                                ? "border-[var(--azul)] bg-[var(--azul)] text-white"
                                                : "border-[var(--linha)] bg-[var(--superficie)]"
                                        }`}
                                    >
                                        {marcado && <FiCheck className="w-3" />}
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                                            {nomeCompleto(linha.produto)}
                                        </span>

                                        <span className="num block truncate text-xs text-[var(--ink-3)]">
                                            {codigoDoProduto(linha.produto)}
                                            {" · "}
                                            {linha.disponivel > 0
                                                ? `${linha.disponivel} em estoque`
                                                : "sem estoque"}
                                        </span>
                                    </span>
                                </button>

                                {modo === "pedido" && (
                                    <span className="flex shrink-0 items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => mudarQuantidade(linha.produto.id, -1)}
                                            disabled={quantidadeDe(linha.produto.id) <= 1}
                                            aria-label={`Menos uma unidade de ${nomeCompleto(linha.produto)}`}
                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--linha)] bg-[var(--superficie)] text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)] disabled:opacity-40"
                                        >
                                            <FiMinus className="w-3" aria-hidden />
                                        </button>

                                        <span className="num w-6 text-center text-sm font-bold text-[var(--ink)]">
                                            {quantidadeDe(linha.produto.id)}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => mudarQuantidade(linha.produto.id, 1)}
                                            aria-label={`Mais uma unidade de ${nomeCompleto(linha.produto)}`}
                                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--linha)] bg-[var(--superficie)] text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)]"
                                        >
                                            <FiPlus className="w-3" aria-hidden />
                                        </button>
                                    </span>
                                )}

                                <span className="shrink-0 text-right">
                                    {linha.precoAntigo && (
                                        <span className="num block text-[0.68rem] text-[var(--ink-3)] line-through">
                                            {formatarMoeda(linha.precoAntigo)}
                                        </span>
                                    )}

                                    <span
                                        className={`num block text-sm font-bold ${
                                            linha.precoAntigo ? "text-[var(--verde)]" : "text-[var(--ink)]"
                                        }`}
                                    >
                                        {formatarMoeda(linha.preco)}
                                    </span>
                                </span>
                            </li>
                        )
                    })}
                </ul>

            </div>

            {/* ==========================
                RODAPÉ
            ========================== */}

            {/* A recusa por falta de unidade, com a pergunta que ela levanta. */}
            {erroPedido && (
                <div role="alert" className="border-t border-[var(--linha-suave)] bg-[var(--vermelho-fundo)] px-4 py-2.5">

                    <p className="text-xs font-semibold text-[var(--vermelho)]">{erroPedido}</p>

                    {faltas.length > 0 && (
                        <>
                            <ul className="mt-1.5 space-y-0.5">
                                {faltas.map((falta) => (
                                    <li key={falta.produto_id} className="text-xs text-[var(--vermelho)]">
                                        {falta.produto_nome}: pediu{" "}
                                        <span className="num font-bold">{falta.pedido}</span>, tem{" "}
                                        <span className="num font-bold">{falta.disponivel}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                type="button"
                                onClick={() => gerarPedido(true)}
                                disabled={gerando}
                                className="btn btn-neutro mt-2.5"
                            >
                                Lançar só o que tem
                            </button>
                        </>
                    )}

                </div>
            )}

            <div className="flex items-center gap-3 border-t border-[var(--linha-suave)] px-3 py-2.5">

                <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--ink-2)]">
                    <input
                        type="checkbox"
                        checked={soComEstoque}
                        onChange={(e) => setSoComEstoque(e.target.checked)}
                        className="h-3.5 w-3.5 accent-[var(--azul)]"
                    />
                    Só com estoque
                </label>

                {modo === "pedido" ? (
                    <>
                        <span className="ml-auto text-xs text-[var(--ink-2)]">
                            Total{" "}
                            <span className="num text-sm font-bold text-[var(--ink)]">
                                {formatarMoeda(total)}
                            </span>
                        </span>

                        <button
                            type="button"
                            onClick={() => gerarPedido()}
                            disabled={escolhidas.length === 0 || gerando}
                            className="btn btn-primario"
                        >
                            <FiShoppingCart className="w-4" aria-hidden />
                            <span>{gerando ? "Gerando..." : "Confirmar pedido"}</span>
                        </button>
                    </>
                ) : (
                    <>
                        <span className="num ml-auto text-xs text-[var(--ink-3)]">
                            {escolhidas.length > 0 && `${escolhidas.length} marcado${escolhidas.length > 1 ? "s" : ""}`}
                        </span>

                        <button
                            type="button"
                            onClick={inserir}
                            disabled={escolhidas.length === 0}
                            className="btn btn-primario"
                        >
                            <FiBox className="w-4" aria-hidden />
                            <span>Pôr na mensagem</span>
                        </button>
                    </>
                )}

            </div>

        </div>
    )
}
