"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { Pedido, StatusPedido } from "@/app/type/type"
import { listarPedidos, listarPedidosAguardando, verificarPagamento, confirmarPagamentoManual, atualizarStatusPedido, salvarRastreio, type MeioManual } from "@/middleware/pedidos"
import { escutarLoja } from "@/middleware/whatsapp"
import { ApiError } from "@/middleware/client"
import Pagination from "@/app/components/pagination/pagination"
import Preco, { formatarMoeda } from "@/app/components/preco/preco"
import { FiFileText, FiSearch, FiX, FiAlertTriangle, FiDollarSign, FiTag } from "react-icons/fi"
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
            "seu trabalho do dia e as peças voltam ao estoque depois de 30 minutos. Se o cliente " +
            "diz que já pagou, use \"verificar pagamento\" — o sistema pergunta direto ao seu provedor.",
        rotulo: "Aguardando pagamento",
        vazio: "Nenhum pedido esperando pagamento.",
    },
    entregues: {
        titulo: "Pedidos entregues",
        explicacao: "Pedidos que chegaram ao cliente. As peças que saíram estão em Vendidos.",
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
            const lista = filtro === "aguardando"
                ? await listarPedidosAguardando()
                : await listarPedidos()

            setPedidos(lista)

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
    const contagens = useMemo(() => {

        const conta = {} as Record<Filtro, number>

        for (const { chave } of FILTROS) {
            conta[chave] = pedidos.filter((pedido) => pertenceAoFiltro(pedido, chave)).length
        }

        return conta

    }, [pedidos])


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
        const itens = pedido.itens.reduce((total, item) => total + item.quantidade * item.preco_unitario, 0)
        return itens + (pedido.frete ?? 0)
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
                /* Pedido confirmado vira etiqueta: o caminho natural daqui é a fila de impressão. */
                <Link href="/page/etiquetas" className="btn btn-secundario">
                    <FiTag className="w-4" aria-hidden />
                    <span>Etiquetas</span>
                </Link>
            }
        >


            {/* ==========================
                ABAS DE SITUAÇÃO
            ========================== */}

            <div
                role="tablist"
                aria-label="Situação dos pedidos"
                className="flex flex-wrap gap-2 border-b border-[#E1E1E1] pb-px"
            >

                {FILTROS.map(({ chave, nome }) => {

                    const ativa = chave === filtro

                    return (

                        <button
                            key={chave}
                            type="button"
                            role="tab"
                            aria-selected={ativa}
                            onClick={() => trocarFiltro(chave)}
                            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                                ativa
                                    ? "border-[#005BD3] text-[#005BD3]"
                                    : "border-transparent text-[#616161] hover:text-[#303030]"
                            }`}
                        >

                            {nome}

                            <span className={`num rounded-full px-2 py-0.5 text-xs font-bold ${
                                ativa ? "bg-[#EAF4FF] text-[#005BD3]" : "bg-[#F1F1F1] text-[#616161]"
                            }`}>
                                {contagens[chave]}
                            </span>

                        </button>

                    )

                })}

            </div>


            {/* ==========================
                ESTATÍSTICAS
            ========================== */}

            <div className={`grid grid-cols-1 gap-5 ${mostraPendentes ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>

                <div className="card p-6">

                    <div className="flex items-center justify-between">

                        <div>
                            <p className="text-sm text-[#616161]">
                                {textos.rotulo}
                            </p>
                            <p className="num mt-2 text-3xl font-bold text-[#303030]">
                                {daAba.length}
                            </p>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#005BD3]">
                            <FiFileText className="w-5" aria-hidden />
                        </div>

                    </div>

                </div>

                {mostraPendentes && (

                    <div className="card p-6">

                        <div className="flex items-center justify-between">

                            <div>
                                <p className="text-sm text-[#616161]">
                                    Pendentes
                                </p>
                                <p className={`num mt-2 text-3xl font-bold ${pendentes > 0 ? "text-[#5E4200]" : "text-[#303030]"}`}>
                                    {pendentes}
                                </p>
                            </div>

                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${pendentes > 0 ? "bg-[#FFF1E3] text-[#5E4200]" : "bg-[#F1F1F1] text-[#616161]"}`}>
                                <FiAlertTriangle className="w-5" aria-hidden />
                            </div>

                        </div>

                    </div>

                )}

                <div className="card p-6">

                    <div className="flex items-center justify-between gap-3">

                        <div className="min-w-0">
                            <p className="text-sm text-[#616161]">
                                Valor total
                            </p>
                            <p className="num mt-2 truncate text-2xl font-bold text-[#303030]">
                                {formatarMoeda(valorTotal)}
                            </p>
                        </div>

                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EAF4FF] text-[#005BD3]">
                            <FiDollarSign className="w-5" aria-hidden />
                        </div>

                    </div>

                </div>

            </div>


            {/* ==========================
                BUSCA
            ========================== */}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                <p className="text-sm text-[#616161]">
                    {pedidosFiltrados.length} de {daAba.length} pedido(s) encontrado(s)
                </p>

                <div className="relative w-full sm:w-72">

                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8A8A8A]" aria-hidden />

                    <input
                        type="text"
                        value={busca}
                        onChange={(e) => aoMudarBusca(e.target.value)}
                        placeholder="Buscar por cliente, código ou nº do pedido"
                        className="field"
                        style={{ paddingLeft: "2.25rem", paddingRight: busca ? "2.25rem" : undefined }}
                    />

                    {busca && (
                        <button
                            type="button"
                            onClick={() => aoMudarBusca("")}
                            aria-label="Limpar busca"
                            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#616161] transition hover:bg-[#F1F1F1]"
                        >
                            <FiX className="w-4" aria-hidden />
                        </button>
                    )}

                </div>

            </div>

            {erroAtualizacao && (
                <div className="mt-4 rounded-lg bg-[#FEE9E8] px-4 py-2.5 text-sm font-semibold text-[#8E1F0B]">
                    {erroAtualizacao}
                </div>
            )}

            {/* A VENDA QUE ACABOU DE ENTRAR.
                A lista se atualiza sozinha, mas uma linha nova aparecendo no
                meio de uma tela cheia passa despercebida por quem estava
                olhando para outra parte dela. */}
            {chegou > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#0C5132] bg-[#EAFBF1] px-4 py-3">

                    <p className="text-sm font-bold text-[#0C5132]">
                        Chegou pedido novo — a lista já está atualizada.
                    </p>

                    <div className="flex items-center gap-3">
                        {filtro !== "aguardando" && (
                            <button
                                type="button"
                                onClick={() => { setChegou(0); trocarFiltro("aguardando") }}
                                className="text-sm font-semibold text-[#0C5132] underline underline-offset-4"
                            >
                                ver aguardando pagamento
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setChegou(0)}
                            aria-label="Dispensar aviso"
                            className="text-sm text-[#0C5132] opacity-70 transition-opacity hover:opacity-100"
                        >
                            dispensar
                        </button>
                    </div>
                </div>
            )}

            {avisoVerificacao && (
                <p className="mt-3 border-l-2 border-[#0C5132] bg-[#EAFBF1] px-3 py-2 text-sm text-[#0C5132]">
                    {avisoVerificacao}
                </p>
            )}


            {/* ==========================
                LISTA DE PEDIDOS
            ========================== */}

            {pedidosFiltrados.length === 0 ? (

                <div className="mt-10 rounded-lg border border-dashed border-[#E1E1E1] bg-white p-16 text-center">

                    <FiFileText className="mx-auto w-10 text-[#8A8A8A]" aria-hidden />

                    <h3 className="font-display mt-5 text-xl text-[#303030]">
                        Nenhum pedido encontrado
                    </h3>

                    <p className="mt-2 text-sm text-[#616161]">
                        {daAba.length === 0
                            ? textos.vazio
                            : "Nenhum pedido corresponde à busca."}
                    </p>

                    {daAba.length > 0 && (

                        <button
                            type="button"
                            onClick={() => aoMudarBusca("")}
                            className="btn btn-neutro mt-6"
                        >
                            Limpar busca
                        </button>

                    )}

                </div>

            ) : (

                <div className="mt-10 space-y-4">

                    {pedidosDaPagina.map((pedido) => (

                        <div
                            key={pedido.id}
                            className="card overflow-hidden"
                        >

                            <div className="flex flex-col gap-4 border-b border-[#E1E1E1] p-5 sm:flex-row sm:items-center sm:justify-between">

                                <div>

                                    <div className="flex items-center gap-2">

                                        <span className="font-mono text-sm font-semibold text-[#303030]">
                                            Pedido #{pedido.id}
                                        </span>

                                        {pedido.codigo && (
                                            <span className="font-mono text-xs text-[#8A8A8A]">
                                                · código {pedido.codigo}
                                            </span>
                                        )}

                                        <span className={`tag ${STATUS_TAG[pedido.status]}`}>
                                            {STATUS_LABEL[pedido.status]}
                                        </span>

                                        <SeloPagamento pedido={pedido} />

                                    </div>

                                    <p className="mt-1 text-sm text-[#616161]">
                                        {pedido.cliente_nome || `Cliente #${pedido.cliente_id}`}
                                        {pedido.cliente_contato ? ` · ${pedido.cliente_contato}` : ""}
                                        {pedido.telefone ? ` · ${telefoneLegivel(pedido.telefone)}` : ""}
                                    </p>

                                    <p className="mt-0.5 text-xs text-[#8A8A8A]">
                                        {formatarData(pedido.created_at)}
                                    </p>

                                </div>

                                <div className="flex items-center gap-2">

                                    {filtro === "aguardando" ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => verificar(pedido)}
                                                disabled={verificandoCodigo === pedido.codigo}
                                                className="btn btn-secundario px-3 py-2 text-sm disabled:opacity-50"
                                            >
                                                {verificandoCodigo === pedido.codigo
                                                    ? "verificando..."
                                                    : "verificar pagamento"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAvisoVerificacao("")
                                                    setErroAtualizacao("")
                                                    setManualCodigo(
                                                        manualCodigo === pedido.codigo ? "" : pedido.codigo,
                                                    )
                                                }}
                                                className="btn btn-neutro px-3 py-2 text-sm"
                                            >
                                                recebi por fora
                                            </button>
                                        </>
                                    ) : null}

                                    <label className="sr-only" htmlFor={`status-${pedido.id}`}>
                                        Status do pedido
                                    </label>

                                    <select
                                        id={`status-${pedido.id}`}
                                        value={pedido.status}
                                        onChange={(e) => mudarStatus(pedido, e.target.value as StatusPedido)}
                                        disabled={atualizandoId === pedido.id}
                                        className="field cursor-pointer py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {STATUS_OPCOES.map((status) => (
                                            <option key={status} value={status}>
                                                {STATUS_LABEL[status]}
                                            </option>
                                        ))}
                                    </select>

                                    {/* Onde este pedido está na agenda. O dia
                                        da saída não se escolhe aqui: quem o
                                        marca é a agenda de entregas, que é a
                                        tela em que se enxerga a terça cheia e
                                        a quinta vazia. Aqui vai só o recado de
                                        que ele ainda não tem dia — e o
                                        caminho para marcá-lo. */}
                                    {pedido.status === "confirmado" &&
                                        pedido.entrega_tipo === "entrega" &&
                                        !pedido.envio_previsto_em && (
                                        <Link
                                            href="/page/entregas"
                                            className="w-full rounded-lg border border-[#FFD59E] bg-[#FFF1E3] px-3 py-2 text-xs font-semibold text-[#5E4200] transition-colors hover:bg-[#FFE4C4]"
                                        >
                                            Em preparo, sem dia de saída —
                                            marque na agenda de entregas o dia
                                            em que ele sai
                                        </Link>
                                    )}

                                    {pedido.status === "confirmado" &&
                                        pedido.entrega_tipo === "entrega" &&
                                        pedido.envio_previsto_em && (
                                        <p className="w-full text-xs text-[#616161]">
                                            Marcado para sair em{" "}
                                            {new Date(pedido.envio_previsto_em).toLocaleDateString("pt-BR")}.
                                        </p>
                                    )}

                                </div>

                            </div>

                            {/* Confirmar à mão que o dinheiro entrou.
                                Aparece embaixo do pedido, e não numa janela
                                solta, para não haver dúvida sobre QUAL pedido
                                está sendo dado como pago. */}
                            {manualCodigo === pedido.codigo && (
                                <div className="mx-5 mb-4 border border-[#E0B3B2] bg-[#FEE9E8] p-4">

                                    <p className="text-sm font-bold text-[#8E1F0B]">
                                        Confirmar que o pedido {pedido.codigo} foi pago?
                                    </p>

                                    <p className="mt-1.5 text-xs leading-relaxed text-[#303030]">
                                        O provedor de pagamento não confirmou este pedido. Ao
                                        continuar, quem está afirmando que o dinheiro entrou é
                                        você — o sistema grava o seu nome nessa confirmação e o
                                        valor passa a contar no faturamento. Se o cliente pagou
                                        pelo site, tente antes <strong>verificar pagamento</strong>,
                                        que pergunta ao provedor e traz prova.
                                    </p>

                                    <div className="mt-3 flex flex-wrap items-center gap-2">

                                        <label className="sr-only" htmlFor={`meio-${pedido.id}`}>
                                            Como o cliente pagou
                                        </label>

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
                                            className="btn bg-[#8E1F0B] px-3 py-2 text-sm text-white disabled:opacity-50"
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

                            <ul className="divide-y divide-[#E1E1E1] px-5">

                                {pedido.itens.map((item) => {

                                    const detalhes = [item.produto_categoria, item.produto_tamanho, item.produto_tecido, item.produto_cor]
                                        .filter(Boolean)

                                    return (

                                        <li
                                            key={item.id}
                                            className="flex items-start gap-3 py-3.5 text-sm"
                                        >

                                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#F1F1F1]">
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

                                                <p className="truncate font-medium text-[#303030]">
                                                    {item.produto_nome || `Produto #${item.produto_id}`}
                                                    {item.produto_codigo && (
                                                        <span className="font-mono ml-1.5 text-xs font-normal text-[#8A8A8A]">
                                                            #{item.produto_codigo}
                                                        </span>
                                                    )}
                                                </p>

                                                {detalhes.length > 0 && (
                                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                                        {detalhes.map((detalhe, indice) => (
                                                            <span
                                                                key={indice}
                                                                className="rounded-full bg-[#F1F1F1] px-2 py-0.5 text-xs text-[#616161]"
                                                            >
                                                                {detalhe}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {item.produto_descricao && (
                                                    <p className="mt-1 line-clamp-2 text-xs text-[#8A8A8A]">
                                                        {item.produto_descricao}
                                                    </p>
                                                )}

                                                <p className="mt-1 text-xs text-[#616161]">
                                                    {item.quantidade}x {formatarMoeda(item.preco_unitario)}
                                                </p>

                                            </div>

                                            <span className="shrink-0">
                                                <Preco
                                                    valor={item.quantidade * item.preco_unitario}
                                                    className="text-sm"
                                                />
                                            </span>

                                        </li>

                                    )

                                })}

                            </ul>

                            {/* ==========================
                                ENTREGA E RASTREIO
                                Só nos pedidos que têm endereço: pedido de
                                retirada e pedido lançado no balcão não têm o
                                que despachar.
                            ========================== */}
                            {pedido.entrega_tipo === "entrega" && (
                                <div className="border-t border-[#EBEBEB] px-5 py-4">

                                    <div className="flex flex-wrap items-start justify-between gap-4">

                                        <div className="min-w-0">
                                            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                                                Entregar em
                                            </p>

                                            <address className="mt-1 not-italic text-sm leading-relaxed text-[#303030]">
                                                {pedido.logradouro}, {pedido.numero}
                                                {pedido.complemento ? ` — ${pedido.complemento}` : ""}
                                                <br />
                                                {pedido.bairro} · {pedido.cidade}
                                                {pedido.uf ? `/${pedido.uf}` : ""}
                                                {pedido.cep ? (
                                                    <span className="num text-[#616161]"> · CEP {pedido.cep}</span>
                                                ) : null}
                                            </address>
                                        </div>

                                        {pedido.codigo_rastreio ? (
                                            <div className="shrink-0 text-right">
                                                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                                                    Rastreio
                                                </p>
                                                <p className="num mt-1 text-sm font-semibold text-[#303030]">
                                                    {pedido.codigo_rastreio}
                                                </p>
                                                {pedido.transportadora ? (
                                                    <p className="text-xs text-[#616161]">{pedido.transportadora}</p>
                                                ) : null}
                                            </div>
                                        ) : null}

                                    </div>

                                    {/* O formulário fica sempre à mão, inclusive
                                        depois de preenchido: código digitado
                                        errado é o caso mais comum de precisar
                                        mexer nisto de novo. */}
                                    <form
                                        onSubmit={(e) => handleRastreio(e, pedido)}
                                        className="mt-3 flex flex-wrap items-end gap-2"
                                    >
                                        <div className="min-w-[9rem] flex-1">
                                            <label className="rotulo" htmlFor={`transp-${pedido.id}`}>
                                                Transportadora
                                            </label>
                                            <input
                                                id={`transp-${pedido.id}`}
                                                defaultValue={pedido.transportadora ?? ""}
                                                name="transportadora"
                                                placeholder="Correios, Jadlog..."
                                                className="field"
                                            />
                                        </div>

                                        <div className="min-w-[11rem] flex-1">
                                            <label className="rotulo" htmlFor={`rastreio-${pedido.id}`}>
                                                Código de rastreio
                                            </label>
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
                            )}

                            <div className="flex items-center justify-between gap-3 bg-[#F1F1F1] px-5 py-3">

                                <span className="text-xs font-semibold uppercase tracking-wide text-[#616161]">
                                    Total
                                </span>

                                <Preco valor={totalDoPedido(pedido)} className="text-lg" />

                            </div>

                        </div>

                    ))}

                </div>

            )}

            <Pagination
                paginaAtual={paginaAtualCorrigida}
                totalPaginas={totalPaginas}
                aoMudarPagina={setPaginaAtual}
            />

        </Pagina>

    )
}

// A aba vem do endereço, e ler o endereço exige Suspense no App Router.
export default function Pedidos() {
    return (
        <Suspense fallback={<main className="min-h-[calc(100dvh-3.5rem)] bg-[#F1F1F1] md:ml-64" />}>
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
                className="tag bg-[#EAFBF1] text-[#0C5132]"
                title={pedido.pago_em ? `Pago em ${dataCurta(pedido.pago_em)}` : "Pago pelo site"}
            >
                {meio ? `pago · ${meio}` : "pago"}
            </span>
        )
    }

    if (situacao === "estornado") {
        return <span className="tag bg-[#FEE9E8] text-[#8E1F0B]">estornado</span>
    }

    if (situacao === "recusado") {
        return <span className="tag bg-[#FEE9E8] text-[#8E1F0B]">pagamento recusado</span>
    }

    return <span className="tag bg-[#E3E3E3] text-[#616161]">{situacao}</span>
}

/** A data do pagamento, para a dica que aparece ao passar o mouse no selo. */
function dataCurta(iso: string): string {
    const data = new Date(iso)
    return Number.isNaN(data.getTime())
        ? ""
        : data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}
