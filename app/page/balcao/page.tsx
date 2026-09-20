"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { FiAlertCircle, FiCheck, FiMinus, FiPlus, FiSearch, FiShoppingBag, FiTrash2 } from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"
import { formatarMoeda } from "@/app/components/preco/preco"
import { consultarItemDoBalcao, venderNoBalcao } from "@/middleware/balcao"
import { MEIOS_DE_PAGAMENTO } from "@/app/type/type"
import type { ItemDoBalcao, MeioDePagamento, VendaDoBalcao } from "@/app/type/type"

/**
 * A venda com o cliente na frente.
 *
 * O gesto que esta tela serve é um só, e ele manda em todo o resto: bipar,
 * bipar, bipar, cobrar. Por isso o campo do código é o primeiro elemento, ele
 * nasce com o cursor dentro, e o cursor VOLTA para ele depois de cada peça
 * adicionada e depois de cada venda concluída. Leitor USB é um teclado que
 * digita o código e dá Enter — uma tela que exigisse um clique entre uma peça
 * e outra dobraria o trabalho de quem atende.
 *
 * A sacola é do navegador, e a venda é do servidor. Nada do que está montado
 * aqui existe para o sistema até "Concluir venda": a peça só sai do estoque
 * na chamada final, e ela sai inteira ou não sai — três peças com a terceira
 * faltando não deixam o cliente com duas cobradas.
 *
 * O preço mostrado é o preço COBRADO, com a promoção já aplicada, porque vem
 * da mesma fonte que a venda usa. A consulta do estoque devolveria o de
 * tabela, e uma tela de venda que mostrasse um e cobrasse outro estaria
 * mentindo para o vendedor na frente do cliente.
 *
 * O meio de pagamento é obrigatório e fica ao lado do total, e não escondido
 * numa segunda etapa: é a última pergunta que o vendedor faz ao cliente e a
 * primeira coisa que falta quando o dia não fecha com a gaveta.
 *
 * O que esta tela NÃO faz, e é deliberado: desconto. Ele precisa de teto e de
 * permissão — desconto sem controle sai do lucro da loja e ainda paga
 * comissão cheia —, e isso é uma decisão de produto, não um campo a mais.
 */

/** Uma linha da sacola. */
interface NaSacola extends ItemDoBalcao {
    quantidade: number
}

export default function Balcao() {

    const [codigo, setCodigo] = useState("")
    const [sacola, setSacola] = useState<NaSacola[]>([])
    const [meio, setMeio] = useState<MeioDePagamento | "">("")

    const [buscando, setBuscando] = useState(false)
    const [vendendo, setVendendo] = useState(false)
    const [erro, setErro] = useState("")
    const [concluida, setConcluida] = useState<VendaDoBalcao | null>(null)

    const campo = useRef<HTMLInputElement>(null)

    // O cursor volta para o campo do código sempre que a tela para de estar
    // ocupada: é onde a próxima tecla precisa cair, sempre.
    useEffect(() => {
        if (!buscando && !vendendo) campo.current?.focus()
    }, [buscando, vendendo, sacola.length, concluida])

    const total = useMemo(
        () => sacola.reduce((soma, linha) => soma + linha.preco * linha.quantidade, 0),
        [sacola],
    )

    const unidades = useMemo(
        () => sacola.reduce((soma, linha) => soma + linha.quantidade, 0),
        [sacola],
    )

    /**
     * Acrescenta o que foi bipado.
     *
     * Bipar a mesma peça de novo soma na linha que já existe em vez de criar
     * uma segunda: três camisetas iguais são "3", não três linhas de 1 — que
     * é como o vendedor confere em voz alta com o cliente.
     */
    async function bipar(evento: React.FormEvent) {
        evento.preventDefault()

        const lido = codigo.trim()

        if (lido === "" || buscando) return

        setBuscando(true)
        setErro("")
        setConcluida(null)

        try {
            const item = await consultarItemDoBalcao(lido)

            setSacola((atual) => {

                const jaEsta = atual.find((linha) => linha.produto_id === item.produto_id)

                if (!jaEsta) return [...atual, { ...item, quantidade: 1 }]

                // O estoque é conferido de novo no servidor na hora de
                // vender. Aqui ele serve para avisar ANTES, com o cliente na
                // frente, em vez de deixar a venda inteira ser recusada no
                // fim por causa de uma peça a mais.
                if (jaEsta.quantidade >= item.disponiveis) {
                    setErro(`Só há ${item.disponiveis} unidade(s) de ${item.nome} no estoque.`)
                    return atual
                }

                return atual.map((linha) =>
                    linha.produto_id === item.produto_id
                        ? { ...linha, quantidade: linha.quantidade + 1 }
                        : linha)
            })

            setCodigo("")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível ler este código")
        } finally {
            setBuscando(false)
        }
    }

    function mudarQuantidade(produtoID: number, passo: number) {

        setErro("")

        setSacola((atual) =>
            atual.flatMap((linha) => {

                if (linha.produto_id !== produtoID) return [linha]

                const nova = linha.quantidade + passo

                // Zerar a quantidade remove a linha: é o mesmo gesto de
                // "tirei isto da sacola", e obrigar a apertar a lixeira
                // depois de chegar a zero seria um clique a mais para dizer
                // o que já foi dito.
                if (nova < 1) return []

                if (nova > linha.disponiveis) {
                    setErro(`Só há ${linha.disponiveis} unidade(s) de ${linha.nome} no estoque.`)
                    return [linha]
                }

                return [{ ...linha, quantidade: nova }]
            }))
    }

    function remover(produtoID: number) {
        setErro("")
        setSacola((atual) => atual.filter((linha) => linha.produto_id !== produtoID))
    }

    function novaVenda() {
        setSacola([])
        setMeio("")
        setCodigo("")
        setErro("")
        setConcluida(null)
    }

    async function concluir() {

        if (sacola.length === 0 || meio === "" || vendendo) return

        setVendendo(true)
        setErro("")

        try {
            const venda = await venderNoBalcao(
                sacola.map((linha) => ({ produto_id: linha.produto_id, quantidade: linha.quantidade })),
                meio,
            )

            setConcluida(venda)
            setSacola([])
            setMeio("")
            setCodigo("")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível concluir a venda")
        } finally {
            setVendendo(false)
        }
    }

    return (
        <Pagina
            titulo="Venda no balcão"
            descricao="Bipe o código de cada unidade, escolha como o cliente pagou e conclua. A unidade sai do estoque na hora."
        >

            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {/* A venda que acabou de sair. Fica até a próxima unidade ser bipada
                — é o comprovante que o vendedor confere em voz alta com o
                cliente antes de ele ir embora. */}
            {concluida && (
                <div className="card border-l-4 border-l-[var(--verde)] p-5">

                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <p className="flex items-center gap-2 font-display text-lg text-[var(--verde)]">
                            <FiCheck className="w-5" aria-hidden />
                            Venda concluída
                        </p>

                        <p className="num font-display text-2xl text-[var(--ink)]">
                            {formatarMoeda(concluida.total)}
                        </p>
                    </div>

                    <p className="mt-1 text-sm text-[var(--ink-2)]">
                        {concluida.pecas} unidade(s) · {concluida.meio_nome}
                        {concluida.vendida_por ? ` · ${concluida.vendida_por}` : ""}
                    </p>

                    <button type="button" onClick={novaVenda} className="btn btn-neutro mt-4">
                        Nova venda
                    </button>
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">

                {/* ---------------------------------------------------------
                    A SACOLA
                    --------------------------------------------------------- */}
                <section className="card overflow-hidden p-0">

                    <form onSubmit={bipar} className="border-b border-[var(--linha-suave)] p-4">
                        <label htmlFor="codigo" className="rotulo">Código da unidade</label>

                        <div className="relative">
                            <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 w-4 -translate-y-1/2 text-[var(--ink-3)]" aria-hidden />

                            <input
                                id="codigo"
                                ref={campo}
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                maxLength={60}
                                autoComplete="off"
                                placeholder="Bipe ou digite o código"
                                className="field w-full pl-8"
                            />
                        </div>

                        <p className="mt-1.5 text-xs text-[var(--ink-2)]">
                            O leitor de código de barras digita e dá Enter sozinho. Bipar a mesma
                            unidade de novo soma na linha dela.
                        </p>
                    </form>

                    {sacola.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                            <FiShoppingBag className="w-8 text-[var(--ink-4)]" aria-hidden />

                            <p className="mt-3 font-display text-base text-[var(--ink)]">
                                Nada na sacola ainda
                            </p>

                            <p className="mt-1 max-w-sm text-sm text-[var(--ink-2)]">
                                Bipe a etiqueta da primeira unidade. Nada sai do estoque até você
                                concluir a venda.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--linha-suave)] text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--ink-3)]">
                                        <th className="px-4 py-2.5">Unidade</th>
                                        <th className="px-4 py-2.5 text-center">Quantidade</th>
                                        <th className="px-4 py-2.5 text-right">Preço</th>
                                        <th className="px-4 py-2.5 text-right">Subtotal</th>
                                        <th className="px-4 py-2.5" />
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-[var(--fundo)]">
                                    {sacola.map((linha) => (
                                        <tr key={linha.produto_id}>

                                            <td className="px-4 py-2.5">
                                                <span className="block font-semibold text-[var(--ink)]">{linha.nome}</span>

                                                <span className="num block text-xs text-[var(--ink-3)]">
                                                    {linha.codigo}
                                                    {linha.disponiveis > 0 && ` · ${linha.disponiveis} no estoque`}
                                                </span>
                                            </td>

                                            <td className="px-4 py-2.5">
                                                <div className="mx-auto flex w-fit items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => mudarQuantidade(linha.produto_id, -1)}
                                                        aria-label={`Tirar uma unidade de ${linha.nome}`}
                                                        className="rounded-lg border border-[var(--linha)] p-1.5 text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)]"
                                                    >
                                                        <FiMinus className="w-3.5" aria-hidden />
                                                    </button>

                                                    <span className="num w-8 text-center font-semibold text-[var(--ink)]">
                                                        {linha.quantidade}
                                                    </span>

                                                    <button
                                                        type="button"
                                                        onClick={() => mudarQuantidade(linha.produto_id, 1)}
                                                        aria-label={`Somar uma unidade de ${linha.nome}`}
                                                        className="rounded-lg border border-[var(--linha)] p-1.5 text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)]"
                                                    >
                                                        <FiPlus className="w-3.5" aria-hidden />
                                                    </button>
                                                </div>
                                            </td>

                                            <td className="num px-4 py-2.5 text-right">
                                                {formatarMoeda(linha.preco)}

                                                {/* O de tabela riscado ao lado: é a resposta
                                                    para "mas a etiqueta diz outro valor". */}
                                                {linha.em_promocao && (
                                                    <span className="num ml-1.5 text-xs text-[var(--ink-3)] line-through">
                                                        {formatarMoeda(linha.preco_de_tabela)}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="num px-4 py-2.5 text-right font-semibold text-[var(--ink)]">
                                                {formatarMoeda(linha.preco * linha.quantidade)}
                                            </td>

                                            <td className="px-4 py-2.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => remover(linha.produto_id)}
                                                    aria-label={`Tirar ${linha.nome} da sacola`}
                                                    className="rounded-lg p-1.5 text-[var(--ink-2)] transition-colors hover:bg-[var(--vermelho-fundo)] hover:text-[var(--vermelho)]"
                                                >
                                                    <FiTrash2 className="w-4" aria-hidden />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* ---------------------------------------------------------
                    O FECHAMENTO

                    Total, como pagou e o botão, nessa ordem e nessa coluna:
                    é a sequência da conversa no balcão. Fica grudado no topo
                    ao rolar porque a sacola cresce e o total não pode sair
                    da tela — é o número que o vendedor fala em voz alta.
                    --------------------------------------------------------- */}
                <section className="card h-fit p-5 lg:sticky lg:top-20">

                    <p className="text-[0.6875rem] font-semibold text-[var(--ink-3)]">
                        Total da venda
                    </p>

                    <p className="num font-display text-3xl text-[var(--ink)]">{formatarMoeda(total)}</p>

                    <p className="mt-0.5 text-sm text-[var(--ink-2)]">
                        {unidades} unidade(s) na sacola
                    </p>

                    <div className="mt-5">
                        <p className="rotulo">Como o cliente pagou</p>

                        <div className="grid grid-cols-2 gap-2">
                            {MEIOS_DE_PAGAMENTO.map((forma) => {

                                const escolhido = meio === forma.chave

                                return (
                                    <button
                                        key={forma.chave}
                                        type="button"
                                        onClick={() => setMeio(forma.chave)}
                                        aria-pressed={escolhido}
                                        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                                            escolhido
                                                ? "border-[var(--azul)] bg-[var(--azul-suave)] text-[var(--azul)]"
                                                : "border-[var(--linha)] text-[var(--ink)] hover:bg-[var(--fundo)]"
                                        }`}
                                    >
                                        {forma.nome}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Dito sempre, e não só quando falta: é o passo que o
                            vendedor apressado pula, e o que faz o caixa do
                            dia não fechar com a gaveta. */}
                        <p className="mt-2 text-xs text-[var(--ink-2)]">
                            Sem isto a venda não conclui — é o que separa o dinheiro da
                            maquininha no fechamento do dia.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={concluir}
                        disabled={sacola.length === 0 || meio === "" || vendendo}
                        className="btn btn-primario mt-5 w-full justify-center"
                    >
                        {vendendo ? "Concluindo…" : "Concluir venda"}
                    </button>

                    {sacola.length > 0 && (
                        <button
                            type="button"
                            onClick={novaVenda}
                            disabled={vendendo}
                            className="btn btn-neutro mt-2 w-full justify-center"
                        >
                            Limpar sacola
                        </button>
                    )}
                </section>
            </div>

        </Pagina>
    )
}
