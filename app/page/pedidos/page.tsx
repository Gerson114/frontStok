"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { Pedido, StatusPedido } from "@/app/type/type"
import { listarPedidos, listarPedidosAguardando, verificarPagamento, confirmarPagamentoManual, atualizarStatusPedido, salvarRastreio, SEM_CONTAGENS, type ContagensDePedidos, type MeioManual } from "@/middleware/pedidos"
import { escutarLoja } from "@/middleware/whatsapp"
import { ApiError } from "@/middleware/client"
import Pagination from "@/app/components/pagination/pagination"
import Preco, { formatarMoeda } from "@/app/components/preco/preco"
import {
    FiCalendar, FiFileText, FiSearch, FiAlertTriangle, FiFilePlus } from "react-icons/fi"
import { urlDaImagem } from "@/security/imagem"
import { telefoneLegivel } from "@/app/components/contato/telefone"
import { Pagina, Estado } from "@/app/components/pagina/pagina"

/**
 * Pedidos: a lista de tudo o que foi pedido, em qualquer situação.
 *
 * Cancelado não é outro assunto, é o mesmo pedido num outro fim — e por isso
 * não tem tela própria. Ter duas telas iguais, uma mostrando o que não foi
 * cancelado e outra só o que foi, obrigava o lojista a adivinhar em qual
 * delas o pedido #48 estava para poder procurá-lo, e fazia a mesma busca, o
 * mesmo cartão e o mesmo seletor de status existirem em dois arquivos.
 *
 * Aqui é uma lista só, com abas de situação em cima. A aba escolhida vai
 * para o endereço (?status=cancelados), então o link continua servindo para
 * mandar alguém direto ao que interessa — inclusive o link antigo de
 * /page/cancelados, que aponta para cá.
 */

const ITENS_POR_PAGINA = 10

const STATUS_OPCOES: StatusPedido[] = ["pendente", "confirmado", "enviado", "entregue", "cancelado"]

const STATUS_LABEL: Record<StatusPedido, string> = {
    pendente: "Pendente",
    // Confirmado é a loja tendo aceitado o pedido e estando com ele na mão:
    // "Preparando" é o que o lojista chama isso, e é o que a agenda de
    // entregas mostra na fila de quem ainda não tem dia de saída.
    confirmado: "Preparando",
    enviado: "Enviado",
    entregue: "Entregue",
    cancelado: "Cancelado",
}

const STATUS_TAG: Record<StatusPedido, string> = {
    pendente: "tag-warning",
    confirmado: "tag-info",
    enviado: "tag-info",
    entregue: "tag-success",
    cancelado: "tag-danger",
}


// ==============================
// ABAS DE SITUAÇÃO
// ==============================

type Filtro = "andamento" | "aguardando" | "entregues" | "cancelados" | "todos"

const FILTROS: { chave: Filtro; nome: string }[] = [
    { chave: "andamento", nome: "Em andamento" },
    { chave: "aguardando", nome: "Aguardando pagamento" },
    { chave: "entregues", nome: "Entregues" },
    { chave: "cancelados", nome: "Cancelados" },
    { chave: "todos", nome: "Todos" },
]

/** A aba padrão é "em andamento": é o que ainda dá trabalho hoje. */
function filtroDoEndereco(valor: string | null): Filtro {
    return FILTROS.some((filtro) => filtro.chave === valor) ? (valor as Filtro) : "andamento"
}

function pertenceAoFiltro(pedido: Pedido, filtro: Filtro): boolean {

    switch (filtro) {
        // Esta aba vem de uma consulta própria ao servidor (a lista normal
        // exclui os não pagos), então tudo o que chegou aqui pertence a ela.
        case "aguardando":
            return true
        case "entregues":
            return pedido.status === "entregue"
        case "cancelados":
            return pedido.status === "cancelado"
        case "todos":
            return true
        default:
            return pedido.status !== "entregue" && pedido.status !== "cancelado"
    }
}

/** O texto da tela muda com a aba — o resto dela, não. */
const TEXTOS: Record<Filtro, { titulo: string; explicacao: string; rotulo: string; vazio: string }> = {
    andamento: {
        titulo: "Pedidos em andamento",
        explicacao: "O que ainda passa pela sua mão: acompanhe e atualize a situação de cada pedido.",
        rotulo: "Em andamento",
        vazio: "Nenhum pedido em andamento no momento.",
    },
    aguardando: {
        titulo: "Aguardando pagamento",
        explicacao:
            "Pedidos que o cliente fechou no site e ainda não foram pagos. Eles não entram no " +
            "seu trabalho do dia e as unidades voltam ao estoque depois de 30 minutos. Se o cliente " +
            "diz que já pagou, use \"verificar pagamento\" — o sistema pergunta direto ao seu provedor.",
        rotulo: "Aguardando pagamento",
        vazio: "Nenhum pedido esperando pagamento.",
    },
    entregues: {
        titulo: "Pedidos entregues",
        explicacao: "Pedidos que chegaram ao cliente. As unidades que saíram estão em Vendidos.",
        rotulo: "Entregues",
        vazio: "Nenhum pedido entregue até agora.",
    },
    cancelados: {
        titulo: "Pedidos cancelados",
        explicacao: "Pedidos que não vão ser atendidos. Mudar a situação aqui traz o pedido de volta.",
        rotulo: "Cancelados",
        vazio: "Nenhum pedido foi cancelado até agora.",
    },
    todos: {
        titulo: "Todos os pedidos",
        explicacao: "A lista inteira, em qualquer situação — é aqui que se acha um pedido antigo.",
        rotulo: "Pedidos",
        vazio: "Ainda não há pedidos de clientes registrados.",
    },
}


function PedidosInterno() {

    const router = useRouter()
    const parametros = useSearchParams()

    const filtro = filtroDoEndereco(parametros.get("status"))

    const [pedidos, setPedidos] = useState<Pedido[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    // Qual pedido está gravando o rastreio agora, para travar só o botão dele.
    const [salvandoRastreio, setSalvandoRastreio] = useState<number | null>(null)

    const [contagens, setContagens] = useState<ContagensDePedidos>(SEM_CONTAGENS)

    // Qual pedido está aberto na ficha à direita. Null é "nenhum escolhido
    // ainda", e a ficha então explica o que ela mostra em vez de ficar vazia.
    const [selecionado, setSelecionado] = useState<number | null>(null)

    const [busca, setBusca] = useState("")
    const [paginaAtual, setPaginaAtual] = useState(1)

    const [atualizandoId, setAtualizandoId] = useState<number | null>(null)
    const [erroAtualizacao, setErroAtualizacao] = useState("")
    // Quando a última venda entrou. Serve à faixa que aparece no topo da
    // lista: um pedido que surge sozinho no meio da tela passa despercebido
    // por quem estava olhando para outra parte dela.
    const [chegou, setChegou] = useState(0)

    const [verificandoCodigo, setVerificandoCodigo] = useState("")
    const [avisoVerificacao, setAvisoVerificacao] = useState("")

    // Qual pedido está com o painel de "recebi por fora" aberto, e o meio
    // escolhido nele. Um por vez: dois painéis abertos convidam a confirmar o
    // pedido errado.
    const [manualCodigo, setManualCodigo] = useState("")
    const [meioManual, setMeioManual] = useState<MeioManual>("pix")
    const [salvandoManual, setSalvandoManual] = useState(false)

    /**
     * Pergunta ao provedor se aquele pedido foi pago.
     *
     * O caminho normal é o provedor avisar sozinho, mas esse aviso se perde —
     * queda de rede, deploy na hora errada, instabilidade do provedor. Sem
     * este botão, o cliente paga, o dinheiro entra e o pedido fica preso para
     * sempre, sem nada que o lojista possa fazer pela tela.
     *
     * Quem decide continua sendo o servidor, com as mesmas conferências do
     * aviso automático: consulta feita com a chave da loja e valor conferido
     * contra os itens gravados.
     */
    async function verificar(pedido: Pedido) {

        setVerificandoCodigo(pedido.codigo)
        setAvisoVerificacao("")
        setErroAtualizacao("")

        try {
            const resultado = await verificarPagamento(pedido.codigo)
            setAvisoVerificacao(resultado.mensagem)

            // Confirmado, ele sai desta aba e entra na lista de trabalho.
            if (resultado.pagamento_status === "aprovado") await carregar()

        } catch (error) {
            setErroAtualizacao(
                error instanceof ApiError ? error.message : "Não foi possível verificar o pagamento.",
            )
        } finally {
            setVerificandoCodigo("")
        }
    }

    /**
     * A saída para quando o provedor não confirma e o dinheiro entrou assim
     * mesmo: Pix direto na conta, dinheiro na entrega, maquininha no balcão,
     * ou o aviso do provedor que simplesmente não chegou.
     *
     * É uma AFIRMAÇÃO da loja, não uma consulta — e o sistema a registra como
     * tal, com o nome de quem confirmou. Por isso fica ao lado de "verificar
     * pagamento" e não no lugar dele: verificar é de graça e traz prova, e é
     * o que se deve tentar primeiro.
     */
    async function confirmarManual(pedido: Pedido) {

        setSalvandoManual(true)
        setAvisoVerificacao("")
        setErroAtualizacao("")

        try {
            const resultado = await confirmarPagamentoManual(pedido.codigo, meioManual)

            setAvisoVerificacao(`Pedido ${pedido.codigo}: ${resultado.mensagem}`)
            setManualCodigo("")

            await carregar()

        } catch (error) {
            setErroAtualizacao(
                error instanceof ApiError ? error.message : "Não foi possível confirmar o pagamento.",
            )
        } finally {
            setSalvandoManual(false)
        }
    }

    async function carregar() {

        try {

            // A aba de aguardando pagamento vem de outra consulta: a lista
            // normal exclui esses pedidos de propósito.
            const resposta = filtro === "aguardando"
                ? await listarPedidosAguardando()
                : await listarPedidos()

            setPedidos(resposta.pedidos)
            setContagens(resposta.contagens)

        } catch (error) {

            console.error("Erro ao buscar pedidos:", error)

            setErro("Não foi possível carregar os pedidos.")

        } finally {

            setLoading(false)

        }
    }

    // Recarrega ao trocar de aba: "aguardando pagamento" vem de outra consulta
    // ao servidor, então não dá para filtrar a lista já carregada.
    useEffect(() => {

        carregar()

        // `carregar` é recriada a cada render e não entra nas dependências de
        // propósito: incluí-la faria o efeito rodar em todo render, uma busca
        // ao servidor por vez. O que deve disparar a busca é a aba mudar.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtro])

    // A faixa de venda nova se apaga sozinha. Aviso que fica na tela para
    // sempre deixa de ser aviso: no dia seguinte ele ainda estaria lá,
    // anunciando um pedido de ontem.
    useEffect(() => {

        if (!chegou) return

        const relogio = setTimeout(() => setChegou(0), 20000)

        return () => clearTimeout(relogio)
    }, [chegou])

    /**
     * O pedido novo aparece sozinho, sem F5.
     *
     * Usa o mesmo socket das conversas (ver middleware/whatsapp.escutarLoja):
     * é um canal por loja, e cada tela reage só ao que é dela. Por isso a
     * primeira linha aqui descarta tudo que não for de pedido — sem ela, esta
     * lista recarregaria a cada mensagem de WhatsApp que chegasse na loja.
     *
     * O aviso não traz o pedido, só o id: quem busca continua sendo a mesma
     * rota de sempre. Assim existe um formato só de resposta para manter, e um
     * aviso que chegue fora de ordem não desenha um pedido velho por cima de
     * um mais novo.
     *
     * A varredura de segurança continua existindo? Não precisa: se o socket
     * cair, ele mesmo se reconecta (com espera crescente) e a próxima troca de
     * aba recarrega tudo. O pior caso é o que existia antes disto — atualizar
     * a tela na mão.
     */
    useEffect(() => {

        const fechar = escutarLoja((aviso) => {

            if (aviso.tipo !== "pedido") return

            // "novo" nasce sempre aguardando pagamento; "pago" tira o pedido
            // daquela aba e o põe em andamento. Nos dois casos as duas listas
            // mudam, então a tela recarrega a que está aberta — em vez de
            // tentar adivinhar em qual aba aquele pedido caiu.
            void carregar()

            if (aviso.evento === "novo") setChegou(Date.now())
        })

        return fechar

        // Mesma razão do efeito acima: `carregar` é recriada a cada render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtro])

    // Trocar de aba volta para a primeira página: a página 3 da lista de
    // andamento não quer dizer nada na lista de cancelados.
    function trocarFiltro(novo: Filtro) {

        if (novo === filtro) return

        setPaginaAtual(1)
        router.replace(novo === "andamento" ? "/page/pedidos" : `/page/pedidos?status=${novo}`, { scroll: false })
    }

    function aoMudarBusca(valor: string) {
        setBusca(valor)
        setPaginaAtual(1)
    }

    /**
     * Muda a situação do pedido.
     *
     * Confirmar não pergunta o dia da saída: confirmar é aceitar o pedido e
     * começar a prepará-lo, e o dia em que ele sai a loja marca depois, na
     * agenda de entregas — quando souber. Três pedidos que chegaram juntos
     * podem sair hoje, na semana que vem e quando a mercadoria chegar.
     */
    async function mudarStatus(pedido: Pedido, novoStatus: StatusPedido) {

        if (novoStatus === pedido.status) return

        try {

            setAtualizandoId(pedido.id)
            setErroAtualizacao("")

            const pedidoAtualizado = await atualizarStatusPedido(pedido.id, novoStatus)

            setPedidos((atual) =>
                atual.map((item) => (item.id === pedido.id ? pedidoAtualizado : item))
            )

        } catch (error) {

            console.error("Erro ao atualizar status do pedido:", error)

            setErroAtualizacao(
                error instanceof ApiError ? error.message : "Não foi possível atualizar o status."
            )

        } finally {

            setAtualizandoId(null)

        }
    }


    // ==============================
    // A LISTA DA ABA ESCOLHIDA
    // ==============================

    // O pedido que muda de situação troca de aba na hora, sem recarregar:
    // confirmar um cancelamento aqui faz o cartão sair da lista de andamento
    // e aparecer na de cancelados, que é o que acabou de acontecer com ele.
    const daAba = useMemo(
        () => pedidos.filter((pedido) => pertenceAoFiltro(pedido, filtro)),
        [pedidos, filtro]
    )

    // Quantos há em cada aba, para o lojista ver o que existe antes de clicar.
    //
    // Vêm do SERVIDOR, contados no banco. Contá-los aqui era o defeito antigo:
    // a tela carrega uma aba por vez, "aguardando pagamento" vem de outra
    // consulta, e o teste de pertencimento devolve `true` para tudo nessas duas
    // abas — então cada número saía da lista que por acaso estivesse carregada,
    // e "Todos" aparecia menor que "Aguardando".


    // ==============================
    // ESTATÍSTICAS
    // ==============================

    const textos = TEXTOS[filtro]

    const pendentes = daAba.filter((pedido) => pedido.status === "pendente").length

    // Pendentes só aparece onde pode haver algum: em Entregues e Cancelados
    // seria um cartão fixo em zero ocupando um terço da linha.
    const mostraPendentes = filtro === "andamento" || filtro === "todos"

    // O frete entra no total porque é o que o cliente pagou de fato — e é
    // contra este número que a confirmação do provedor foi conferida (ver
    // services/pagamento/webhook.go). Somar só as peças mostraria ao lojista
    // um valor menor que o do extrato dele.
    function totalDoPedido(pedido: Pedido): number {
        return somaDosItens(pedido) + (pedido.frete ?? 0)
    }

    /** O que foi cobrado pelas peças, sem frete. */
    function somaDosItens(pedido: Pedido): number {
        return pedido.itens.reduce((total, item) => total + item.quantidade * item.preco_unitario, 0)
    }

    /**
     * Quanto o cliente deixou de pagar por causa de promoção.
     *
     * Sai da diferença entre o preço cheio GRAVADO NA VENDA e o que foi
     * cobrado — nunca do preço de hoje, que já mudou. Item sem preço cheio
     * (pedido anterior ao campo) não entra na conta, e aí a linha de desconto
     * simplesmente não aparece.
     */
    function descontoDoPedido(pedido: Pedido): number {
        return pedido.itens.reduce((total, item) => {

            const cheio = item.preco_cheio ?? 0

            if (cheio <= item.preco_unitario) return total

            return total + item.quantidade * (cheio - item.preco_unitario)
        }, 0)
    }

    async function handleRastreio(evento: React.FormEvent<HTMLFormElement>, pedido: Pedido) {
        evento.preventDefault()

        const campos = new FormData(evento.currentTarget)

        setSalvandoRastreio(pedido.id)

        try {
            await salvarRastreio(pedido.id, {
                transportadora: String(campos.get("transportadora") ?? ""),
                codigo_rastreio: String(campos.get("codigo_rastreio") ?? ""),
            })

            await carregar()
        } catch (e) {
            setErroAtualizacao(e instanceof Error ? e.message : "Não foi possível salvar o rastreio.")
        } finally {
            setSalvandoRastreio(null)
        }
    }

    const valorTotal = daAba.reduce((total, pedido) => total + totalDoPedido(pedido), 0)

    const formatarData = (iso: string) =>
        new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })


    // ==============================
    // FILTRO DE BUSCA
    // ==============================

    const termoBusca = busca.trim().toLowerCase()

    const pedidosFiltrados = termoBusca
        ? daAba.filter((pedido) => {
            return (
                pedido.cliente_nome.toLowerCase().includes(termoBusca) ||
                pedido.cliente_contato.toLowerCase().includes(termoBusca) ||
                (pedido.telefone ?? "").includes(termoBusca.replace(/\D+/g, "")) ||
                pedido.codigo.toLowerCase().includes(termoBusca) ||
                String(pedido.id).includes(termoBusca)
            )
        })
        : daAba


    // ==============================
    // PAGINAÇÃO
    // ==============================

    const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / ITENS_POR_PAGINA))
    const paginaAtualCorrigida = Math.min(paginaAtual, totalPaginas)

    const pedidosDaPagina = pedidosFiltrados.slice(
        (paginaAtualCorrigida - 1) * ITENS_POR_PAGINA,
        paginaAtualCorrigida * ITENS_POR_PAGINA
    )

    /**
     * O pedido aberto na ficha.
     *
     * Sai da lista da página, e não de um estado próprio, para o que a ficha
     * mostra acompanhar a lista sozinho: mudar a situação de um pedido
     * reescreve a linha dele, e a ficha tem de contar a mesma história no
     * mesmo instante.
     *
     * Quando o escolhido sai da aba — foi cancelado, foi pago, a busca mudou —
     * a ficha cai no primeiro da página em vez de ficar em branco: o lojista
     * continua olhando para um pedido, que é o que ele veio fazer.
     */
    const pedidoAberto =
        pedidosDaPagina.find((pedido) => pedido.id === selecionado) ?? pedidosDaPagina[0] ?? null


    // ==============================
    // LOADING
    // ==============================

    if (loading) {

        return (

            <Pagina titulo="Pedidos">

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    {[1, 2, 3].map(item => (
                        <div key={item} className="card h-24 animate-pulse" />
                    ))}
                </div>

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

            <Pagina titulo="Pedidos">

                <Estado
                    Icone={FiAlertTriangle}
                    tom="erro"
                    titulo="Erro ao carregar pedidos"
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
            titulo={textos.titulo}
            descricao={textos.explicacao}
            acoes={
                /* Lançar pedido é a única ação de cabeçalho aqui: é o que se
                   faz nesta tela quando a venda chega por fora do site. As
                   etiquetas têm tela própria no menu, dentro de Pedidos, e o
                   botão daqui só repetia esse caminho. */
                <Link href="/page/pedidos/novo" className="btn btn-primario">
                    <FiFilePlus className="w-4" aria-hidden />
                    <span>Lançar pedido</span>
                </Link>
            }
        >

            {/* ==========================
                ABAS DE SITUAÇÃO
                As contagens vêm do servidor (ver o comentário em `contagens`).
            ========================== */}
            <div role="tablist" aria-label="Situação dos pedidos" className="flex flex-wrap gap-1 border-b border-[var(--linha)]">

                {FILTROS.map(({ chave, nome }) => {

                    const ativa = filtro === chave

                    return (
                        <button
                            key={chave}
                            role="tab"
                            type="button"
                            aria-selected={ativa}
                            onClick={() => trocarFiltro(chave)}
                            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                                ativa
                                    ? "border-[var(--azul)] text-[var(--azul)]"
                                    : "border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]"
                            }`}
                        >
                            {nome}

                            <span className={`num rounded-full px-2 py-0.5 text-xs font-bold ${
                                ativa ? "bg-[var(--azul-suave)] text-[var(--azul)]" : "bg-[var(--fundo)] text-[var(--ink-2)]"
                            }`}>
                                {contagens[chave]}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* O resumo da aba, numa linha só. Era uma fileira de cartões
                grandes que empurrava a lista para baixo da dobra — e o número
                que importa aqui é quanto a aba soma, não o enfeite ao redor. */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">

                <span className="text-[var(--ink-2)]">
                    <strong className="num text-[var(--ink)]">{daAba.length}</strong> pedido(s)
                </span>

                <span className="text-[var(--ink-2)]">
                    Somam <strong className="num text-[var(--ink)]">{formatarMoeda(valorTotal)}</strong>
                </span>

                {mostraPendentes && pendentes > 0 && (
                    <span className="text-[var(--amarelo)]">
                        <strong className="num">{pendentes}</strong> esperando confirmação
                    </span>
                )}
            </div>

            {erroAtualizacao && (
                <div role="alert" className="rounded-lg bg-[var(--vermelho-fundo)] px-4 py-2.5 text-sm font-semibold text-[var(--vermelho)]">
                    {erroAtualizacao}
                </div>
            )}

            {avisoVerificacao && (
                <p role="status" className="border-l-2 border-[var(--verde)] bg-[var(--verde-suave)] px-3 py-2 text-sm text-[var(--verde)]">
                    {avisoVerificacao}
                </p>
            )}

            {/* A VENDA QUE ACABOU DE ENTRAR.
                A lista se atualiza sozinha, mas uma linha nova aparecendo no
                meio de uma tela cheia passa despercebida por quem estava
                olhando para outra parte dela. */}
            {chegou > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-[var(--verde)] bg-[var(--verde-suave)] px-4 py-3">

                    <p className="text-sm font-bold text-[var(--verde)]">
                        Chegou pedido novo — a lista já está atualizada.
                    </p>

                    <div className="flex items-center gap-3">
                        {filtro !== "aguardando" && (
                            <button
                                type="button"
                                onClick={() => { setChegou(0); trocarFiltro("aguardando") }}
                                className="text-sm font-semibold text-[var(--verde)] underline underline-offset-4"
                            >
                                ver aguardando pagamento
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setChegou(0)}
                            aria-label="Dispensar aviso"
                            className="text-sm text-[var(--verde)] opacity-70 transition-opacity hover:opacity-100"
                        >
                            dispensar
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="card p-8 text-center text-sm text-[var(--ink-2)]">Carregando pedidos...</div>
            ) : erro ? (
                <Estado Icone={FiAlertTriangle} titulo="Não foi possível carregar" texto={erro} tom="erro" />
            ) : daAba.length === 0 ? (
                <Estado Icone={FiFileText} titulo={textos.vazio} />
            ) : (

                /* Lista estreita e ficha larga — a mesma anatomia de
                   Funcionários e Minhas lojas. Antes cada pedido era um cartão
                   com itens, endereço, rastreio e formulário abertos: três
                   pedidos ocupavam a tela inteira, e comparar dois exigia
                   rolar. Agora a lista responde "o que tem para hoje" e a
                   ficha responde "o que é este aqui". */
                <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">

                    {/* ---------------------------------------------------
                        A LISTA
                        --------------------------------------------------- */}
                    <section className="card flex max-h-[calc(100dvh-18rem)] flex-col overflow-hidden p-0">

                        <div className="border-b border-[var(--linha-suave)] p-3">
                            <div className="relative">
                                <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 w-4 -translate-y-1/2 text-[var(--ink-3)]" aria-hidden />

                                <input
                                    type="search"
                                    value={busca}
                                    onChange={(e) => aoMudarBusca(e.target.value)}
                                    placeholder="Cliente, código ou nº"
                                    aria-label="Buscar pedido"
                                    className="field w-full pl-8"
                                />
                            </div>

                            <p className="mt-2 text-xs text-[var(--ink-3)]">
                                {pedidosFiltrados.length} de {daAba.length} nesta aba
                            </p>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto">

                            {pedidosDaPagina.length === 0 && (
                                <p className="px-4 py-6 text-center text-sm text-[var(--ink-2)]">
                                    Nenhum pedido com esse termo.
                                </p>
                            )}

                            {pedidosDaPagina.map((pedido) => {

                                const escolhido = pedido.id === pedidoAberto?.id

                                return (
                                    <button
                                        key={pedido.id}
                                        type="button"
                                        onClick={() => setSelecionado(pedido.id)}
                                        aria-current={escolhido ? "true" : undefined}
                                        className={`flex w-full flex-col gap-1 border-b border-[var(--fundo)] px-3 py-2.5 text-left transition-colors last:border-b-0 ${
                                            escolhido ? "bg-[var(--fundo)]" : "hover:bg-[var(--superficie-2)]"
                                        }`}
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="num truncate text-xs font-semibold text-[var(--ink-2)]">
                                                {pedido.codigo || `#${pedido.id}`}
                                            </span>

                                            <Preco valor={totalDoPedido(pedido)} className="text-sm" />
                                        </span>

                                        <span className="truncate text-sm font-semibold text-[var(--ink)]">
                                            {pedido.cliente_nome || `Cliente #${pedido.cliente_id}`}
                                        </span>

                                        <span className="flex flex-wrap items-center gap-1.5">
                                            <span className={`tag ${STATUS_TAG[pedido.status]}`}>
                                                {STATUS_LABEL[pedido.status]}
                                            </span>

                                            <SeloPagamento pedido={pedido} />

                                            <span className="text-xs text-[var(--ink-3)]">
                                                {formatarData(pedido.created_at)}
                                            </span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="border-t border-[var(--linha-suave)]">
                            <Pagination
                                paginaAtual={paginaAtualCorrigida}
                                totalPaginas={totalPaginas}
                                aoMudarPagina={setPaginaAtual}
                            />
                        </div>
                    </section>

                    {/* ---------------------------------------------------
                        A FICHA — todos os dados do pedido escolhido
                        --------------------------------------------------- */}
                    <section className="card p-6">

                        {!pedidoAberto ? (
                            <div className="flex min-h-[18rem] flex-col items-center justify-center text-center">
                                <FiFileText className="w-8 text-[var(--ink-4)]" aria-hidden />

                                <p className="mt-3 font-display text-base text-[var(--ink)]">
                                    Escolha um pedido na lista
                                </p>

                                <p className="mt-1 max-w-sm text-sm text-[var(--ink-2)]">
                                    A ficha mostra o cliente, o que ele comprou, como pagou, para
                                    onde vai e a conta fechada.
                                </p>
                            </div>
                        ) : (
                            <FichaDoPedido
                                pedido={pedidoAberto}
                                filtro={filtro}
                                formatarData={formatarData}
                                somaDosItens={somaDosItens}
                                descontoDoPedido={descontoDoPedido}
                                totalDoPedido={totalDoPedido}
                                mudarStatus={mudarStatus}
                                atualizandoId={atualizandoId}
                                verificar={verificar}
                                verificandoCodigo={verificandoCodigo}
                                manualCodigo={manualCodigo}
                                setManualCodigo={setManualCodigo}
                                meioManual={meioManual}
                                setMeioManual={setMeioManual}
                                confirmarManual={confirmarManual}
                                salvandoManual={salvandoManual}
                                handleRastreio={handleRastreio}
                                salvandoRastreio={salvandoRastreio}
                                limparAvisos={() => { setAvisoVerificacao(""); setErroAtualizacao("") }}
                            />
                        )}
                    </section>
                </div>
            )}

        </Pagina>

    )
}

// A aba vem do endereço, e ler o endereço exige Suspense no App Router.
export default function Pedidos() {
    return (
        <Suspense fallback={<main className="com-menu min-h-[calc(100dvh-3.5rem)] bg-[var(--fundo)]" />}>
            <PedidosInterno />
        </Suspense>
    )
}

/**
 * Diz de onde veio o dinheiro deste pedido.
 *
 * Existe porque a mesma lista mistura duas coisas que o lojista trata de
 * formas diferentes: o pedido que caiu pelo site, com o dinheiro já na conta
 * dele, e o que ele mesmo lançou no balcão, que ainda vai ser combinado. Sem
 * essa marca, os dois pareciam iguais na tela e a diferença só aparecia na
 * hora de fechar o caixa.
 *
 * Pedido esperando pagamento não chega aqui: o servidor o esconde da lista
 * até o provedor confirmar. Então "aprovado" é a única boa notícia possível,
 * e as outras marcas são exceções que merecem ser vistas.
 */
/**
 * O meio de pagamento em português.
 *
 * Cada provedor tem o próprio vocabulário. O que não estiver aqui não vira
 * nada na tela — melhor o selo dizer só "pago" do que mostrar "bank_transfer"
 * para o lojista.
 */
const METODOS_DE_PAGAMENTO: Record<string, string> = {
    pix: "Pix",
    bank_transfer: "Pix",
    credit_card: "cartão",
    card: "cartão",
    debit_card: "débito",
    ticket: "boleto",
    boleto: "boleto",
    account_money: "carteira",
}

function SeloPagamento({ pedido }: { pedido: Pedido }) {

    const situacao = pedido.pagamento_status ?? ""

    // Sem gateway: pedido antigo ou lançado à mão pelo balcão. Não recebe
    // marca nenhuma — inventar um "não pago" aqui acusaria de pendência o
    // pedido que o lojista já combinou pessoalmente.
    if (situacao === "") return null

    if (situacao === "aprovado") {

        // O meio entra no próprio selo quando o provedor informa: "pago ·
        // Pix" e "pago · cartão" são linhas diferentes na hora de conferir o
        // caixa, e o lojista não devia precisar abrir o pedido para saber
        // qual é qual.
        const meio = METODOS_DE_PAGAMENTO[pedido.pagamento_metodo ?? ""] ?? ""

        return (
            <span
                className="tag bg-[var(--verde-suave)] text-[var(--verde)]"
                title={pedido.pago_em ? `Pago em ${dataCurta(pedido.pago_em)}` : "Pago pelo site"}
            >
                {meio ? `pago · ${meio}` : "pago"}
            </span>
        )
    }

    /* Entrada paga: metade do dinheiro entrou e a outra metade está na rua.
    
       Selo azul, e não verde nem âmbar, porque é um terceiro estado de
       verdade: verde diria "pago" a um pedido que ainda deve, e âmbar diria
       "não pagou" a quem já pagou — e pagamento recebido não pode aparecer
       como não recebido. A loja SEPARA e ENTREGA este pedido; o que falta é
       receber o resto na porta. */
    if (situacao === "entrada_paga") {

        const falta = (pedido.total ?? 0) - (pedido.valor_pago ?? 0)

        return (
            <span
                className="tag bg-[var(--azul-suave)] text-[var(--azul-escuro)]"
                title={`Entrada recebida. Faltam ${formatarMoeda(falta)} a receber na entrega.`}
            >
                entrada paga · falta {formatarMoeda(falta)}
            </span>
        )
    }

    // Combinado por WhatsApp: o pedido está na tela porque há uma conversa
    // acontecendo, e não porque o dinheiro entrou. O selo é âmbar de
    // propósito — verde aqui faria o lojista separar mercadoria de uma venda
    // que ainda não foi paga.
    if (situacao === "combinando") {
        return (
            <span
                className="tag bg-[var(--amarelo-fundo)] text-[var(--amarelo)]"
                title="O cliente escolheu combinar o pagamento no WhatsApp. Confirme o recebimento quando o dinheiro cair."
            >
                combinando no WhatsApp
            </span>
        )
    }

    if (situacao === "estornado") {
        return <span className="tag bg-[var(--vermelho-fundo)] text-[var(--vermelho)]">estornado</span>
    }

    if (situacao === "recusado") {
        return <span className="tag bg-[var(--vermelho-fundo)] text-[var(--vermelho)]">pagamento recusado</span>
    }

    return <span className="tag bg-[#E3E3E3] text-[var(--ink-2)]">{situacao}</span>
}

/** A data do pagamento, para a dica que aparece ao passar o mouse no selo. */
function dataCurta(iso: string): string {
    const data = new Date(iso)
    return Number.isNaN(data.getTime())
        ? ""
        : data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

/**
 * A ficha do pedido: tudo o que se sabe dele, numa tela só.
 *
 * Está fora do componente da lista de propósito. Ela é grande — cliente,
 * pagamento, itens, entrega, rastreio e a conta fechada —, e deixá-la inline
 * fazia o arquivo da lista responder por duas telas ao mesmo tempo.
 *
 * Recebe as ações por parâmetro em vez de refazê-las aqui: quem fala com o
 * servidor continua sendo a tela de cima, que é onde a lista é recarregada
 * depois de cada mudança.
 */
function FichaDoPedido({
    pedido,
    filtro,
    formatarData,
    somaDosItens,
    descontoDoPedido,
    totalDoPedido,
    mudarStatus,
    atualizandoId,
    verificar,
    verificandoCodigo,
    manualCodigo,
    setManualCodigo,
    meioManual,
    setMeioManual,
    confirmarManual,
    salvandoManual,
    handleRastreio,
    salvandoRastreio,
    limparAvisos,
}: {
    pedido: Pedido
    filtro: Filtro
    formatarData: (iso: string) => string
    somaDosItens: (pedido: Pedido) => number
    descontoDoPedido: (pedido: Pedido) => number
    totalDoPedido: (pedido: Pedido) => number
    mudarStatus: (pedido: Pedido, status: StatusPedido) => void
    atualizandoId: number | null
    verificar: (pedido: Pedido) => void
    verificandoCodigo: string
    manualCodigo: string
    setManualCodigo: (codigo: string) => void
    meioManual: MeioManual
    setMeioManual: (meio: MeioManual) => void
    confirmarManual: (pedido: Pedido) => void
    salvandoManual: boolean
    handleRastreio: (evento: React.FormEvent<HTMLFormElement>, pedido: Pedido) => void
    salvandoRastreio: number | null
    limparAvisos: () => void
}) {

    const desconto = descontoDoPedido(pedido)

    return (
        <div className="space-y-6">

            {/* IDENTIFICAÇÃO E SITUAÇÃO */}
            <div className="flex flex-wrap items-start justify-between gap-3">

                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="num text-sm font-semibold text-[var(--ink)]">
                            {pedido.codigo || `Pedido #${pedido.id}`}
                        </span>

                        <span className={`tag ${STATUS_TAG[pedido.status]}`}>
                            {STATUS_LABEL[pedido.status]}
                        </span>

                        <SeloPagamento pedido={pedido} />
                    </div>

                    <p className="mt-1 text-xs text-[var(--ink-3)]">
                        Nº interno {pedido.id} · feito em {formatarData(pedido.created_at)}
                    </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`status-${pedido.id}`}>Situação do pedido</label>

                    <select
                        id={`status-${pedido.id}`}
                        value={pedido.status}
                        onChange={(e) => mudarStatus(pedido, e.target.value as StatusPedido)}
                        disabled={atualizandoId === pedido.id}
                        className="field cursor-pointer py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {STATUS_OPCOES.map((status) => (
                            <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* QUEM COMPROU */}
            <div className="grid gap-4 sm:grid-cols-2">

                <div>
                    <p className="text-[0.6875rem] font-semibold text-[var(--ink-3)]">
                        Cliente
                    </p>

                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">
                        {pedido.cliente_nome || `Cliente #${pedido.cliente_id}`}
                    </p>

                    {pedido.cliente_contato && (
                        <p className="text-sm text-[var(--ink-2)]">{pedido.cliente_contato}</p>
                    )}

                    {pedido.telefone && (
                        <p className="num text-sm text-[var(--ink-2)]">{telefoneLegivel(pedido.telefone)}</p>
                    )}

                    {/* A hora marcada, quando existe.
                    
                        Em destaque, e não em cinza ao lado do resto: numa
                        cozinha ela é a informação que decide a ordem da fila
                        do dia, e um pedido marcado para as 12h lido como
                        "para agora" é comida pronta três horas cedo. */}
                    {pedido.agendado_para && (
                        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[var(--azul-suave)] px-2 py-1 text-[0.8125rem] font-semibold text-[var(--azul)]">
                            <FiCalendar className="w-3.5 shrink-0" aria-hidden />
                            {horaMarcada(pedido.agendado_para)}
                        </p>
                    )}
                </div>

                <div>
                    <p className="text-[0.6875rem] font-semibold text-[var(--ink-3)]">
                        Pagamento
                    </p>

                    <p className="mt-1 text-sm text-[var(--ink)]">
                        {pedido.pagamento_status === "aprovado"
                            ? `Pago${pedido.pagamento_metodo ? ` · ${METODOS_DE_PAGAMENTO[pedido.pagamento_metodo] ?? pedido.pagamento_metodo}` : ""}`
                            : pedido.pagamento_status === "entrada_paga"
                                ? "Entrada recebida"
                                : pedido.pagamento_status === "aguardando"
                                    ? "Esperando o dinheiro cair"
                                    : pedido.pagamento_status
                                        ? pedido.pagamento_status
                                        : "Combinado fora do site"}
                    </p>

                    {/* A conta do que falta, escrita: o lojista cobra na porta
                        e precisa do número na mão, não de uma subtração. */}
                    {pedido.pagamento_status === "entrada_paga" && (
                        <p className="num text-sm font-semibold text-[var(--azul-escuro)]">
                            {formatarMoeda(pedido.valor_pago ?? 0)} pagos ·{" "}
                            {formatarMoeda((pedido.total ?? 0) - (pedido.valor_pago ?? 0))} a receber
                        </p>
                    )}

                    {pedido.pago_em && (
                        <p className="text-sm text-[var(--ink-2)]">em {formatarData(pedido.pago_em)}</p>
                    )}
                </div>
            </div>

            {/* O RESTANTE DE QUEM PAGOU ENTRADA

                O pedido já está separado e a caminho — o que falta é a loja
                receber o resto na porta e dizer aqui que recebeu. Fica junto
                do pedido, e não numa tela de cobrança à parte, porque é no
                pedido que o lojista está quando o cliente paga. */}
            {pedido.pagamento_status === "entrada_paga" && (
                <button
                    type="button"
                    onClick={() => {
                        limparAvisos()
                        setManualCodigo(manualCodigo === pedido.codigo ? "" : pedido.codigo)
                    }}
                    className="btn btn-primario"
                >
                    Recebi o restante
                </button>
            )}

            {/* AS DUAS SAÍDAS DE QUEM ESPERA PAGAMENTO */}
            {filtro === "aguardando" && (
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => verificar(pedido)}
                        disabled={verificandoCodigo === pedido.codigo}
                        className="btn btn-secundario disabled:opacity-50"
                    >
                        {verificandoCodigo === pedido.codigo ? "verificando..." : "Verificar pagamento"}
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            limparAvisos()
                            setManualCodigo(manualCodigo === pedido.codigo ? "" : pedido.codigo)
                        }}
                        className="btn btn-neutro"
                    >
                        Recebi por fora
                    </button>
                </div>
            )}

            {/* Confirmar à mão que o dinheiro entrou. Fica dentro da ficha do
                pedido, e não numa janela solta, para não haver dúvida sobre
                QUAL pedido está sendo dado como pago. */}
            {manualCodigo === pedido.codigo && (
                <div className="border border-[#E0B3B2] bg-[var(--vermelho-fundo)] p-4">

                    <p className="text-sm font-bold text-[var(--vermelho)]">
                        Confirmar que o pedido {pedido.codigo} foi pago?
                    </p>

                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink)]">
                        Você está afirmando que o dinheiro entrou — fica gravado no seu nome. Pagou pelo
                        site? Tente <strong>verificar pagamento</strong> antes, que traz prova do provedor.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`meio-${pedido.id}`}>Como o cliente pagou</label>

                        <select
                            id={`meio-${pedido.id}`}
                            value={meioManual}
                            onChange={(e) => setMeioManual(e.target.value as MeioManual)}
                            className="field cursor-pointer py-2 text-sm"
                        >
                            <option value="pix">Pix</option>
                            <option value="dinheiro">Dinheiro</option>
                            <option value="maquininha">Maquininha</option>
                            <option value="transferencia">Transferência</option>
                            <option value="outro">Outro</option>
                        </select>

                        <button
                            type="button"
                            onClick={() => confirmarManual(pedido)}
                            disabled={salvandoManual}
                            className="btn bg-[var(--vermelho)] px-3 py-2 text-sm text-white disabled:opacity-50"
                        >
                            {salvandoManual ? "confirmando..." : "confirmar recebimento"}
                        </button>

                        <button
                            type="button"
                            onClick={() => setManualCodigo("")}
                            disabled={salvandoManual}
                            className="btn btn-neutro px-3 py-2 text-sm"
                        >
                            cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* O QUE ELE COMPROU */}
            <div>
                <p className="text-[0.6875rem] font-semibold text-[var(--ink-3)]">
                    {pedido.itens.length} item(ns)
                </p>

                <ul className="mt-2 divide-y divide-[var(--linha-suave)] border-y border-[var(--linha-suave)]">
                    {pedido.itens.map((item) => {

                        const detalhes = [item.produto_categoria, item.produto_tamanho, item.produto_tecido, item.produto_cor]
                            .filter(Boolean)

                        const cheio = item.preco_cheio ?? 0

                        return (
                            <li key={item.id} className="flex items-start gap-3 py-3 text-sm">

                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--fundo)]">
                                    {item.produto_imagem_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={urlDaImagem(item.produto_imagem_url)}
                                            alt={item.produto_nome}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : null}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium text-[var(--ink)]">
                                        {item.produto_nome || `Produto #${item.produto_id}`}

                                        {item.produto_codigo && (
                                            <span className="num ml-1.5 text-xs font-normal text-[var(--ink-3)]">
                                                #{item.produto_codigo}
                                            </span>
                                        )}
                                    </p>

                                    {detalhes.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                            {detalhes.map((detalhe, indice) => (
                                                <span key={indice} className="rounded-full bg-[var(--fundo)] px-2 py-0.5 text-xs text-[var(--ink-2)]">
                                                    {detalhe}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* "2x R$ 39,90" — e, quando houve promoção, o
                                        preço cheio riscado. É o que o cliente viu na
                                        vitrine, e responde "por que veio mais barato?" */}
                                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-2)]">
                                        <span>{item.quantidade}x {formatarMoeda(item.preco_unitario)}</span>

                                        {cheio > item.preco_unitario && (
                                            <>
                                                <span className="text-[var(--ink-3)] line-through">
                                                    {formatarMoeda(cheio)}
                                                </span>
                                                <span className="font-semibold text-[var(--verde)]">promoção</span>
                                            </>
                                        )}
                                    </p>
                                </div>

                                <span className="shrink-0">
                                    <Preco valor={item.quantidade * item.preco_unitario} className="text-sm" />
                                </span>
                            </li>
                        )
                    })}
                </ul>
            </div>

            {/* PARA ONDE VAI, E COM QUE CÓDIGO */}
            {pedido.entrega_tipo === "entrega" ? (
                <div>
                    <p className="text-[0.6875rem] font-semibold text-[var(--ink-3)]">
                        Entregar em
                    </p>

                    <address className="mt-1 not-italic text-sm leading-relaxed text-[var(--ink)]">
                        {pedido.logradouro}, {pedido.numero}
                        {pedido.complemento ? ` — ${pedido.complemento}` : ""}
                        <br />
                        {pedido.bairro} · {pedido.cidade}{pedido.uf ? `/${pedido.uf}` : ""}
                        {pedido.cep ? <span className="num text-[var(--ink-2)]"> · CEP {pedido.cep}</span> : null}
                    </address>

                    {pedido.previsao_entrega && (
                        <p className="mt-1 text-sm text-[var(--ink-2)]">
                            Previsão de chegada: {new Date(pedido.previsao_entrega).toLocaleDateString("pt-BR")}
                        </p>
                    )}

                    {/* O dia da saída não se escolhe aqui: quem o marca é a
                        agenda de entregas, que é a tela em que se enxerga a
                        terça cheia e a quinta vazia. */}
                    {pedido.status === "confirmado" && !pedido.envio_previsto_em && (
                        <Link
                            href="/page/entregas"
                            className="mt-2 inline-block rounded-lg border border-[#FFD59E] bg-[var(--amarelo-fundo)] px-3 py-2 text-xs font-semibold text-[var(--amarelo)] transition-colors hover:bg-[#FFE4C4]"
                        >
                            Em preparo, sem dia de saída — marque na agenda de entregas
                        </Link>
                    )}

                    {pedido.envio_previsto_em && (
                        <p className="mt-1 text-sm text-[var(--ink-2)]">
                            Sai em {new Date(pedido.envio_previsto_em).toLocaleDateString("pt-BR")}.
                        </p>
                    )}

                    {/* O formulário fica sempre à mão, inclusive depois de
                        preenchido: código digitado errado é o caso mais comum
                        de precisar mexer nisto de novo. */}
                    <form onSubmit={(e) => handleRastreio(e, pedido)} className="mt-3 flex flex-wrap items-end gap-2">

                        <div className="min-w-[9rem] flex-1">
                            <label className="rotulo" htmlFor={`transp-${pedido.id}`}>Transportadora</label>
                            <input
                                id={`transp-${pedido.id}`}
                                defaultValue={pedido.transportadora ?? ""}
                                name="transportadora"
                                placeholder="Correios, Jadlog..."
                                className="field"
                            />
                        </div>

                        <div className="min-w-[11rem] flex-1">
                            <label className="rotulo" htmlFor={`rastreio-${pedido.id}`}>Código de rastreio</label>
                            <input
                                id={`rastreio-${pedido.id}`}
                                defaultValue={pedido.codigo_rastreio ?? ""}
                                name="codigo_rastreio"
                                placeholder="AA123456789BR"
                                required
                                className="field"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={salvandoRastreio === pedido.id}
                            className="btn btn-neutro"
                        >
                            {salvandoRastreio === pedido.id ? "Salvando..." : "Salvar rastreio"}
                        </button>
                    </form>
                </div>
            ) : (
                <p className="text-sm text-[var(--ink-2)]">
                    {pedido.entrega_tipo === "retirada"
                        ? "O cliente vem buscar na loja."
                        : "Sem entrega registrada — pedido lançado no painel."}
                </p>
            )}

            {/* A CONTA, ABERTA.
                Um "Total" sozinho obriga o lojista a somar de cabeça para
                conferir com o extrato: ele precisa saber quanto foi de unidade,
                quanto saiu de desconto e quanto entrou de frete. */}
            <div className="space-y-1 border-t border-[var(--linha-suave)] pt-4 text-sm">

                <div className="flex items-center justify-between gap-3 text-[var(--ink-2)]">
                    <span>Produtos</span>
                    <span className="num">{formatarMoeda(somaDosItens(pedido))}</span>
                </div>

                {desconto > 0 && (
                    <div className="flex items-center justify-between gap-3 text-[var(--verde)]">
                        <span>Desconto</span>
                        <span className="num">− {formatarMoeda(desconto)}</span>
                    </div>
                )}

                {(pedido.frete ?? 0) > 0 && (
                    <div className="flex items-center justify-between gap-3 text-[var(--ink-2)]">
                        <span>Frete</span>
                        <span className="num">{formatarMoeda(pedido.frete ?? 0)}</span>
                    </div>
                )}

                <div className="flex items-center justify-between gap-3 border-t border-[var(--linha)] pt-1.5">
                    <span className="text-xs font-semibold text-[var(--ink-2)]">Total</span>
                    <Preco valor={totalDoPedido(pedido)} className="text-lg" />
                </div>
            </div>
        </div>
    )
}

/**
 * A hora marcada, escrita como a cozinha lê.
 *
 * Dia e hora juntos, e sempre: "12:30" sozinho obriga quem lê a descobrir se
 * é hoje ou amanhã, e essa é justamente a pergunta que a linha existe para
 * responder.
 */
function horaMarcada(quando: string): string {

    const data = new Date(quando)

    if (Number.isNaN(data.getTime())) return quando

    return data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}
