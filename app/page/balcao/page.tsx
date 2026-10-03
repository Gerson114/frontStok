"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    FiAlertCircle,
    FiAlertTriangle,
    FiCheck,
    FiMinus,
    FiPackage,
    FiPlus,
    FiRotateCcw,
    FiSearch,
    FiShoppingBag,
    FiTag,
    FiTrash2,
} from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"
import { formatarMoeda } from "@/app/components/preco/preco"
import {
    cancelarVendaDoBalcao,
    consultarItemDoBalcao,
    listarVendasDoBalcao,
    venderNoBalcao,
} from "@/middleware/balcao"
import type { LinhaParaVender } from "@/middleware/balcao"
import { MEIOS_DE_PAGAMENTO } from "@/app/type/type"
import type {
    ItemDoBalcao,
    MeioDePagamento,
    VendaDoBalcao,
    VendaResumida,
} from "@/app/type/type"

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
 * # Nenhum preço é calculado aqui
 *
 * O preço mostrado é o preço COBRADO, e ele vem da mesma fonte que a venda
 * usa. Três casos passam por esta tela e nenhum deles é decidido nela:
 *
 *   - o preço de tabela e a promoção saem do cadastro, no servidor;
 *   - o valor da ETIQUETA DE BALANÇA sai de dentro do código de barras. A tela
 *     guarda o código bipado e o manda de volta ao fechar a venda; o servidor
 *     relê o valor de lá. Mandar o número seria deixar o navegador escolher
 *     quanto o cliente paga;
 *   - o TROCO é calculado no servidor, inclusive a contagem de cédulas e
 *     moedas. A tela só mostra.
 *
 * O meio de pagamento é obrigatório e fica ao lado do total, e não escondido
 * numa segunda etapa: é a última pergunta que o vendedor faz ao cliente e a
 * primeira coisa que falta quando o dia não fecha com a gaveta.
 *
 * O que esta tela NÃO faz, e é deliberado: desconto. Ele precisa de teto e de
 * permissão — desconto sem controle sai do lucro da loja e ainda paga
 * comissão cheia —, e isso é uma decisão de produto, não um campo a mais.
 */

/**
 * Uma linha da sacola.
 *
 * `chave` existe porque o produto_id deixou de identificar uma linha. Dois
 * pedaços de queijo pesados separadamente são o MESMO produto com preços
 * diferentes, e precisam ser duas linhas — agrupá-los cobraria o segundo pelo
 * preço do primeiro. Para o que vem do cadastro a chave é o produto; para o
 * que vem da balança, é a etiqueta.
 */
interface NaSacola extends ItemDoBalcao {
    chave: string
    quantidade: number
}

/** Como a linha é identificada na sacola (ver NaSacola.chave). */
function chaveDaLinha(item: ItemDoBalcao): string {
    return item.preco_da_etiqueta && item.etiqueta
        ? `etiqueta:${item.etiqueta}`
        : `produto:${item.produto_id}`
}

/**
 * Quantas unidades desta linha ainda cabem.
 *
 * Produto sem contagem não tem teto: pão não se conta na prateleira, e um
 * limite ali faria a tela recusar a sexta unidade de algo que não tem
 * contagem nenhuma. A etiqueta de balança também não: ela já descreve uma
 * pesagem, e o teto dela é um.
 */
function tetoDaLinha(item: ItemDoBalcao): number {
    if (item.preco_da_etiqueta) return 1
    if (item.sem_contagem) return Number.POSITIVE_INFINITY
    return item.disponiveis
}

export default function Balcao() {

    const [codigo, setCodigo] = useState("")
    const [sacola, setSacola] = useState<NaSacola[]>([])
    const [meio, setMeio] = useState<MeioDePagamento | "">("")
    const [recebido, setRecebido] = useState("")

    const [buscando, setBuscando] = useState(false)
    const [vendendo, setVendendo] = useState(false)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")
    const [concluida, setConcluida] = useState<VendaDoBalcao | null>(null)

    const [vendas, setVendas] = useState<VendaResumida[]>([])
    const [horasParaCancelar, setHorasParaCancelar] = useState(0)
    const [cancelando, setCancelando] = useState<number | null>(null)

    const campo = useRef<HTMLInputElement>(null)

    // O cursor volta para o campo do código sempre que a tela para de estar
    // ocupada: é onde a próxima tecla precisa cair, sempre.
    useEffect(() => {
        if (!buscando && !vendendo) campo.current?.focus()
    }, [buscando, vendendo, sacola.length, concluida])

    /**
     * Recarrega a lista das últimas vendas.
     *
     * Falhar aqui é engolido de propósito: a lista é apoio, não o trabalho. Uma
     * tela de caixa que não abre porque o histórico não carregou impediria de
     * vender — e vender é o que ela existe para fazer.
     */
    const recarregarVendas = useCallback(() => {
        listarVendasDoBalcao()
            .then((resposta) => {
                setVendas(resposta.vendas)
                setHorasParaCancelar(resposta.horas_para_cancelar)
            })
            .catch(() => {})
    }, [])

    // A primeira carga, com guarda de validade: a tela do caixa é trocada
    // depressa, e gravar estado depois de ela sair avisa no console sem nada
    // ter dado errado. O `.then` também é o que mantém o setState fora do
    // corpo do efeito, que é o que a regra de hooks cobra.
    useEffect(() => {

        let valeu = true

        listarVendasDoBalcao()
            .then((resposta) => {
                if (!valeu) return
                setVendas(resposta.vendas)
                setHorasParaCancelar(resposta.horas_para_cancelar)
            })
            .catch(() => {})

        return () => {
            valeu = false
        }
    }, [])

    const total = useMemo(
        () => sacola.reduce((soma, linha) => soma + linha.preco * linha.quantidade, 0),
        [sacola],
    )

    const unidades = useMemo(
        () => sacola.reduce((soma, linha) => soma + linha.quantidade, 0),
        [sacola],
    )

    const emDinheiro = meio === "dinheiro"

    /**
     * O troco PREVISTO, só para a tela.
     *
     * Quem calcula o troco de verdade é o servidor, e é o dele que vai para o
     * comprovante e para o fechamento de caixa. Este número existe para o
     * operador ver quanto volta ENQUANTO digita, antes de concluir — e é por
     * isso que ele não é usado em nenhuma decisão: a venda manda o valor
     * recebido, não o troco.
     */
    const recebidoNumero = useMemo(() => {
        const limpo = recebido.replace(",", ".").trim()
        const valor = Number.parseFloat(limpo)
        return Number.isFinite(valor) && valor > 0 ? valor : 0
    }, [recebido])

    const trocoPrevisto = recebidoNumero > 0 ? recebidoNumero - total : 0
    const faltaReceber = recebidoNumero > 0 && recebidoNumero < total ? total - recebidoNumero : 0

    /**
     * Acrescenta o que foi bipado.
     *
     * Bipar a mesma peça de novo soma na linha que já existe em vez de criar
     * uma segunda: três camisetas iguais são "3", não três linhas de 1 — que
     * é como o vendedor confere em voz alta com o cliente.
     *
     * A ETIQUETA DE BALANÇA é a exceção, e é a razão de a sacola ter chave
     * própria: cada etiqueta é uma pesagem, com o seu preço, e sempre entra
     * como linha nova.
     */
    async function bipar(evento: React.FormEvent) {
        evento.preventDefault()

        const lido = codigo.trim()

        if (lido === "" || buscando) return

        setBuscando(true)
        setErro("")
        setAviso("")
        setConcluida(null)

        try {
            const item = await consultarItemDoBalcao(lido)

            // O "tem hoje?" de quem não conta estoque. O servidor recusa a
            // venda de todo jeito; avisar aqui evita a sacola ser montada
            // inteira para ser recusada no fim.
            if (item.sem_contagem && !item.disponivel) {
                setErro(`${item.nome} está marcado como indisponível hoje.`)
                return
            }

            // A caixa fechada: a venda lança UMA unidade, porque quantas vêm
            // dentro não está no código nem no cadastro. Quem decide é quem
            // tem a caixa na mão.
            if (item.aviso_da_caixa) setAviso(item.aviso_da_caixa)

            const chave = chaveDaLinha(item)

            setSacola((atual) => {

                const jaEsta = atual.find((linha) => linha.chave === chave)

                if (!jaEsta) return [...atual, { ...item, chave, quantidade: 1 }]

                // O estoque é conferido de novo no servidor na hora de
                // vender. Aqui ele serve para avisar ANTES, com o cliente na
                // frente, em vez de deixar a venda inteira ser recusada no
                // fim por causa de uma peça a mais.
                if (jaEsta.quantidade >= tetoDaLinha(item)) {

                    setErro(item.preco_da_etiqueta
                        ? `Esta etiqueta já está na sacola. Pese de novo para vender outra porção de ${item.nome}.`
                        : `Só há ${item.disponiveis} unidade(s) de ${item.nome} no estoque.`)

                    return atual
                }

                return atual.map((linha) =>
                    linha.chave === chave
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

    function mudarQuantidade(chave: string, passo: number) {

        setErro("")

        setSacola((atual) =>
            atual.flatMap((linha) => {

                if (linha.chave !== chave) return [linha]

                const nova = linha.quantidade + passo

                // Zerar a quantidade remove a linha: é o mesmo gesto de
                // "tirei isto da sacola", e obrigar a apertar a lixeira
                // depois de chegar a zero seria um clique a mais para dizer
                // o que já foi dito.
                if (nova < 1) return []

                if (nova > tetoDaLinha(linha)) {

                    setErro(linha.preco_da_etiqueta
                        ? "Cada etiqueta de balança vale uma porção. Pese de novo para vender mais."
                        : `Só há ${linha.disponiveis} unidade(s) de ${linha.nome} no estoque.`)

                    return [linha]
                }

                return [{ ...linha, quantidade: nova }]
            }))
    }

    function remover(chave: string) {
        setErro("")
        setSacola((atual) => atual.filter((linha) => linha.chave !== chave))
    }

    function novaVenda() {
        setSacola([])
        setMeio("")
        setCodigo("")
        setRecebido("")
        setErro("")
        setAviso("")
        setConcluida(null)
    }

    async function concluir() {

        if (sacola.length === 0 || meio === "" || vendendo) return

        // Pagamento curto é recusado pelo servidor de todo jeito, e lá é a
        // trava que vale — o total daqui é um palpite da tela. Barrar antes
        // evita a ida de rede para receber o erro que já se sabe.
        if (emDinheiro && faltaReceber > 0) {
            setErro(`Faltam ${formatarMoeda(faltaReceber)} para fechar esta venda.`)
            return
        }

        setVendendo(true)
        setErro("")

        try {
            const linhas: LinhaParaVender[] = sacola.map((linha) => ({
                produto_id: linha.produto_id,
                quantidade: linha.quantidade,

                // Só vai quando a linha nasceu da balança. É o código, nunca
                // o preço (ver middleware/balcao.LinhaParaVender).
                ...(linha.preco_da_etiqueta && linha.etiqueta ? { etiqueta: linha.etiqueta } : {}),
            }))

            const venda = await venderNoBalcao(linhas, meio, emDinheiro ? recebidoNumero : 0)

            setConcluida(venda)
            setSacola([])
            setMeio("")
            setCodigo("")
            setRecebido("")
            setAviso("")

            recarregarVendas()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível concluir a venda")
        } finally {
            setVendendo(false)
        }
    }

    /**
     * Estorna uma venda.
     *
     * A confirmação é um `confirm` do navegador de propósito: é uma operação
     * de um clique que mexe em dinheiro e em estoque, e a tela do caixa não
     * pode ganhar um modal que fica no caminho do gesto principal. O freio de
     * verdade é do servidor — prazo curto e registro de quem cancelou.
     */
    async function cancelar(venda: VendaResumida) {

        if (cancelando !== null) return

        const confirmado = window.confirm(
            `Cancelar a venda de ${formatarMoeda(venda.total)} (${venda.meio_nome})?\n\n`
            + "As unidades voltam para o estoque e a venda sai do faturamento. "
            + "O cancelamento fica registrado no seu nome.",
        )

        if (!confirmado) return

        const motivo = window.prompt("Motivo (opcional):", "") ?? ""

        setCancelando(venda.id)
        setErro("")
        setAviso("")

        try {
            const resultado = await cancelarVendaDoBalcao(venda.id, motivo)

            const partes = [`Venda de ${formatarMoeda(resultado.total)} cancelada.`]

            if (resultado.pecas_devolvidas > 0) {
                partes.push(`${resultado.pecas_devolvidas} unidade(s) voltaram ao estoque.`)
            }

            if (resultado.itens_sem_contagem > 0) {
                partes.push(`${resultado.itens_sem_contagem} item(ns) não ocupam prateleira.`)
            }

            // O aviso do servidor vem por último porque é o que mais importa:
            // peça que não voltou é estoque que não bate com o que o operador
            // espera, e ele precisa saber antes de ir procurar na prateleira.
            if (resultado.aviso) partes.push(resultado.aviso)

            setAviso(partes.join(" "))

            if (concluida?.id === venda.id) setConcluida(null)

            recarregarVendas()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível cancelar a venda")
        } finally {
            setCancelando(null)
        }
    }

    return (
        <Pagina
            titulo="Venda no balcão"
            descricao="Bipe a etiqueta de cada item, escolha como o cliente pagou e conclua. O item sai do estoque na hora."
        >

            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aviso && (
                <div role="status" className="flex items-start gap-2.5 rounded-lg bg-[var(--amarelo-fundo,var(--fundo))] px-4 py-3 text-sm font-semibold text-[var(--ink)]">
                    <FiAlertTriangle className="mt-0.5 w-4 shrink-0 text-[var(--amarelo,var(--ink-2))]" aria-hidden />
                    <span>{aviso}</span>
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
                        {concluida.pecas} item(ns) · {concluida.meio_nome}
                        {concluida.vendida_por ? ` · ${concluida.vendida_por}` : ""}
                    </p>

                    {/* O TROCO, e o que entregar.
                        A contagem vem do servidor: a pergunta de quem está no
                        caixa não é "quanto volta", é "o que eu tiro da
                        gaveta" — e essa conta feita de cabeça com fila na
                        frente é onde se erra. */}
                    {concluida.recebido > 0 && (
                        <div className="mt-4 rounded-lg bg-[var(--fundo)] p-4">

                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="text-sm text-[var(--ink-2)]">
                                    Recebido {formatarMoeda(concluida.recebido)}
                                </span>

                                <span className="num font-display text-2xl text-[var(--ink)]">
                                    Troco {formatarMoeda(concluida.troco.valor)}
                                </span>
                            </div>

                            {concluida.troco.exato ? (
                                <p className="mt-1 text-sm text-[var(--ink-2)]">Valor exato, sem troco.</p>
                            ) : (
                                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                                    {concluida.troco.pecas.map((peca) => (
                                        <li
                                            key={peca.valor}
                                            className="num rounded-md border border-[var(--linha)] bg-[var(--card,transparent)] px-2 py-1 text-xs font-semibold text-[var(--ink)]"
                                        >
                                            {peca.quantidade}× {peca.cedula ? "nota" : "moeda"} de {formatarMoeda(peca.valor)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

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
                        <label htmlFor="codigo" className="rotulo">Código de barras ou etiqueta</label>

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
                            Aceita o código de barras de fábrica (EAN, UPC, caixa fechada), o código
                            que o sistema imprime e a etiqueta da balança — que já traz o preço do
                            que foi pesado. Bipar o mesmo item de novo soma na linha dele.
                        </p>
                    </form>

                    {sacola.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                            <FiShoppingBag className="w-8 text-[var(--ink-4)]" aria-hidden />

                            <p className="mt-3 font-display text-base text-[var(--ink)]">
                                Nada na sacola ainda
                            </p>

                            <p className="mt-1 max-w-sm text-sm text-[var(--ink-2)]">
                                Bipe a etiqueta do primeiro item. Nada sai do estoque até você
                                concluir a venda.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--linha-suave)] text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--ink-3)]">
                                        <th className="px-4 py-2.5">Item</th>
                                        <th className="px-4 py-2.5 text-center">Quantidade</th>
                                        <th className="px-4 py-2.5 text-right">Preço</th>
                                        <th className="px-4 py-2.5 text-right">Subtotal</th>
                                        <th className="px-4 py-2.5" />
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-[var(--fundo)]">
                                    {sacola.map((linha) => (
                                        <tr key={linha.chave}>

                                            <td className="px-4 py-2.5">
                                                <span className="block font-semibold text-[var(--ink)]">{linha.nome}</span>

                                                <span className="num block text-xs text-[var(--ink-3)]">
                                                    {linha.codigo}

                                                    {/* Produto sem contagem NÃO mostra "no estoque":
                                                        pão não se conta na prateleira, e um "0" ali
                                                        faria o operador achar que acabou. */}
                                                    {!linha.sem_contagem && linha.disponiveis > 0
                                                        && ` · ${linha.disponiveis} no estoque`}
                                                </span>

                                                {linha.preco_da_etiqueta && (
                                                    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-[var(--azul-suave)] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[var(--azul)]">
                                                        <FiTag className="w-3" aria-hidden />
                                                        preço da balança
                                                    </span>
                                                )}

                                                {linha.tipo_da_etiqueta === "caixa" && (
                                                    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-[var(--fundo)] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[var(--ink-2)]">
                                                        <FiPackage className="w-3" aria-hidden />
                                                        caixa fechada
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-4 py-2.5">
                                                <div className="mx-auto flex w-fit items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => mudarQuantidade(linha.chave, -1)}
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
                                                        onClick={() => mudarQuantidade(linha.chave, 1)}
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
                                                    onClick={() => remover(linha.chave)}
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
                        {unidades} item(ns) na sacola
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

                    {/* O DINHEIRO ENTREGUE.

                        Só no dinheiro, porque só nele existe troco: no Pix e na
                        maquininha o valor que entra é exatamente o cobrado, e
                        um campo "recebido" diferente do total ali seria dado
                        errado entrando no fechamento de caixa.

                        Vazio significa "pagou exato" — é o que acontece na
                        maioria das compras de valor redondo, e obrigar o caixa
                        a repetir o total seria trabalho por nada. */}
                    {emDinheiro && (
                        <div className="mt-4">
                            <label htmlFor="recebido" className="rotulo">Quanto o cliente deu</label>

                            <input
                                id="recebido"
                                value={recebido}
                                onChange={(e) => setRecebido(e.target.value)}
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder="Deixe vazio se pagou exato"
                                className="field w-full"
                            />

                            {faltaReceber > 0 && (
                                <p className="mt-1.5 text-xs font-semibold text-[var(--vermelho)]">
                                    Faltam {formatarMoeda(faltaReceber)}.
                                </p>
                            )}

                            {/* Prévia, não decisão: quem calcula o troco que
                                vai para o comprovante e para o caixa é o
                                servidor. Este número existe para o operador
                                ver quanto volta enquanto digita. */}
                            {faltaReceber === 0 && recebidoNumero > 0 && (
                                <p className="mt-1.5 text-sm text-[var(--ink-2)]">
                                    Troco previsto{" "}
                                    <span className="num font-semibold text-[var(--ink)]">
                                        {formatarMoeda(trocoPrevisto)}
                                    </span>
                                </p>
                            )}
                        </div>
                    )}

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

            {/* ---------------------------------------------------------------
                AS ÚLTIMAS VENDAS

                Fica DEPOIS da sacola, e não numa tela separada, porque o caso
                que ela serve é imediato: bipou duas vezes, cobrou errado, o
                cliente desistiu depois de pagar. Mandar o operador procurar
                isso em outro menu com o cliente ainda no balcão é o que faz
                ninguém usar o estorno.

                O botão aparece conforme `pode_cancelar`, que vem do servidor:
                a regra do prazo é dele, e reimplementá-la aqui seria criar
                dois lugares para divergir.
                --------------------------------------------------------------- */}
            {vendas.length > 0 && (
                <section className="card overflow-hidden p-0">

                    <div className="border-b border-[var(--linha-suave)] px-4 py-3">
                        <p className="font-display text-base text-[var(--ink)]">Últimas vendas</p>

                        <p className="mt-0.5 text-xs text-[var(--ink-2)]">
                            Cancelar devolve as unidades ao estoque e tira a venda do faturamento.
                            {horasParaCancelar > 0
                                && ` Depois de ${horasParaCancelar} horas o caso passa a ser devolução,`
                                + " para alguém conferir a peça antes de ela voltar à prateleira."}
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--linha-suave)] text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--ink-3)]">
                                    <th className="px-4 py-2.5">Hora</th>
                                    <th className="px-4 py-2.5">Pagamento</th>
                                    <th className="px-4 py-2.5 text-right">Itens</th>
                                    <th className="px-4 py-2.5 text-right">Total</th>
                                    <th className="px-4 py-2.5">Quem vendeu</th>
                                    <th className="px-4 py-2.5" />
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-[var(--fundo)]">
                                {vendas.map((venda) => (
                                    <tr key={venda.id}>

                                        <td className="num px-4 py-2.5 text-[var(--ink-2)]">
                                            {new Date(venda.vendida_em).toLocaleTimeString("pt-BR", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </td>

                                        <td className="px-4 py-2.5 text-[var(--ink)]">
                                            {venda.meio_nome}

                                            {venda.troco > 0 && (
                                                <span className="num block text-xs text-[var(--ink-3)]">
                                                    troco {formatarMoeda(venda.troco)}
                                                </span>
                                            )}
                                        </td>

                                        <td className="num px-4 py-2.5 text-right text-[var(--ink-2)]">
                                            {venda.pecas}
                                        </td>

                                        <td className="num px-4 py-2.5 text-right font-semibold text-[var(--ink)]">
                                            {formatarMoeda(venda.total)}
                                        </td>

                                        <td className="px-4 py-2.5 text-[var(--ink-2)]">
                                            {venda.vendida_por || "—"}
                                        </td>

                                        <td className="px-4 py-2.5 text-right">
                                            {venda.pode_cancelar && (
                                                <button
                                                    type="button"
                                                    onClick={() => cancelar(venda)}
                                                    disabled={cancelando !== null}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--linha)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-2)] transition-colors hover:bg-[var(--vermelho-fundo)] hover:text-[var(--vermelho)] disabled:opacity-50"
                                                >
                                                    <FiRotateCcw className="w-3.5" aria-hidden />
                                                    {cancelando === venda.id ? "Cancelando…" : "Cancelar"}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

        </Pagina>
    )
}
