"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { FiAlertCircle, FiChevronLeft, FiChevronRight, FiTruck } from "react-icons/fi"
import { Pagina, Estado } from "@/app/components/pagina/pagina"
import { formatarMoeda } from "@/app/components/preco/preco"
import type { Pedido } from "@/app/type/type"
import { consultarAgenda, marcarDiaDeEnvio } from "@/middleware/pedidos"
import { ApiError } from "@/middleware/client"

/**
 * A agenda de entregas.
 *
 * A tela de Pedidos responde "em que pé está cada pedido". Esta responde
 * outra pergunta, que uma lista ordenada por data de criação não consegue
 * responder: **o que eu tenho de mandar em cada dia**. É a mesma venda vista
 * pelo calendário — e é assim que se enxerga a terça cheia, a quinta vazia e,
 * acima de tudo, o que passou do dia de sair sem ninguém perceber.
 *
 * O que se decide aqui é uma coisa só: o dia em que cada pedido sai. Pedido
 * confirmado é pedido que a loja aceitou e está preparando — e enquanto
 * ninguém disse quando ele sai, ele não ocupa dia nenhum do calendário. De
 * três pedidos que chegaram juntos, um pode sair hoje, outro na semana que vem
 * e o terceiro quando a mercadoria chegar; quem sabe disso é o lojista, e é
 * aqui que ele põe cada um no seu dia.
 *
 * O resto continua na tela de Pedidos — gravar rastreio e mudar situação —, e
 * cada cartão daqui leva para lá: duas telas gravando a mesma coisa é o
 * caminho mais curto para duas telas discordarem.
 *
 * A data que posiciona o pedido é a do ENVIO: o dia que a loja escolheu ao
 * confirmar o pedido, ou o dia em que ela de fato despachou, quando já
 * despachou. Quem lê esta tela é quem embala, e o que ele precisa saber é o
 * que sai hoje.
 *
 * A data de chegada vai em cada cartão, porque é a consequência daquela — e é
 * o que ele responde ao cliente que liga. Ela é calculada pelo servidor (ver
 * PrevisaoDeEntrega): o prazo da tabela de frete contado a partir do envio.
 */

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]

const MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

/** "AAAA-MM" do mês de uma data. */
function chaveDoMes(data: Date): string {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
}

/** "AAAA-MM-DD" no fuso local — `toISOString` devolveria em UTC e trocaria o dia. */
function chaveDoDia(data: Date): string {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`
}

/**
 * Um cartão de pedido dentro de um dia do calendário.
 *
 * A cor diz o que a loja tem de FAZER com ele naquele dia, que é a única
 * pergunta que se faz olhando um calendário de trabalho:
 *
 *   AZUL    — o cliente vem buscar. Separe e deixe no balcão.
 *   LARANJA — tem de ser despachado. Embale e mande.
 *
 * São duas coisas diferentes na mão de quem trabalha, e por isso duas cores.
 * Já despachado perde a saturação em vez de ganhar uma terceira cor: continua
 * sendo uma entrega, só não é mais trabalho.
 */
function CartaoEntrega({ pedido }: { pedido: Pedido }) {

    const ehEntrega = pedido.entrega_tipo === "entrega"
    const jaSaiu = Boolean(pedido.enviado_em)

    const cor = ehEntrega
        ? jaSaiu
            ? "bg-[#FFF1E3] text-[#5E4200] hover:bg-[#FFE4C4]"
            : "bg-[#FFE4C4] text-[#5E4200] hover:bg-[#FFD59E]"
        : "bg-[#EAF4FF] text-[#00369B] hover:bg-[#CDE3FF]"

    return (
        <Link
            href="/page/pedidos"
            title={`Pedido ${pedido.codigo} — ${pedido.cliente_nome} — ${ehEntrega ? "entregar" : "retirada no balcão"}`}
            className={`block rounded-md px-1.5 py-1 text-left text-[0.6875rem] leading-tight transition-colors ${cor}`}
        >
            <span className="block truncate font-semibold">{pedido.cliente_nome || "Cliente"}</span>

            <span className="num block truncate opacity-80">
                #{pedido.codigo}
                {ehEntrega && pedido.cidade ? ` · ${pedido.cidade}${pedido.uf ? `/${pedido.uf}` : ""}` : ""}
            </span>

            {/* Na entrega, a consequência do dia em que ela sai: quando chega.
                É o que o lojista responde a quem liga perguntando. Na
                retirada não existe essa data — o cliente vem quando quiser. */}
            {ehEntrega && pedido.previsao_entrega ? (
                <span className="num block truncate opacity-70">
                    chega {new Date(pedido.previsao_entrega).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                    })}
                </span>
            ) : !ehEntrega ? (
                <span className="block truncate opacity-70">vem buscar</span>
            ) : null}
        </Link>
    )
}

/**
 * Uma linha de pedido que ainda espera um dia — e os controles que o dão a ele.
 *
 * "Sai hoje" fica separado do seletor de data porque é o que acontece na
 * maioria das vezes: o lojista olha a fila de manhã, escolhe o que vai embalar
 * hoje e clica. Quem vai sair noutro dia usa o seletor ao lado, e é um clique a
 * mais — que é a ordem certa, porque é o caso mais raro.
 *
 * O teto do seletor é o prazo que a loja prometeu ao cliente: marcar depois
 * dele é combinar um atraso. O servidor recusa de qualquer forma; travar aqui
 * evita que a recusa seja a forma de descobrir isso — a não ser no pedido que
 * já estourou o prazo, onde não há teto que ajude e o que importa é conseguir
 * marcar um dia.
 */
function LinhaSemDia({
    pedido,
    ocupado,
    aoMarcar,
    complemento,
}: {
    pedido: Pedido
    ocupado: boolean
    aoMarcar: (pedido: Pedido, dia: string) => void
    complemento: ReactNode
}) {

    const hoje = chaveDoDia(new Date())

    const [dia, setDia] = useState(
        pedido.envio_previsto_em ? chaveDoDia(new Date(pedido.envio_previsto_em)) : hoje,
    )

    const limite = pedido.prazo_limite_envio ? pedido.prazo_limite_envio.slice(0, 10) : ""

    return (
        <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">

            <Link href="/page/pedidos" className="num text-sm font-semibold text-[#005BD3] hover:underline">
                #{pedido.codigo}
            </Link>

            <span className="min-w-0 flex-1 truncate text-sm text-[#303030]">
                {pedido.cliente_nome}
            </span>

            <span className="text-xs text-[#616161]">
                {pedido.cidade}
                {pedido.uf ? `/${pedido.uf}` : ""}
            </span>

            {complemento}

            <div className="flex items-center gap-2">

                <button
                    type="button"
                    onClick={() => aoMarcar(pedido, hoje)}
                    disabled={ocupado}
                    className="btn btn-primario px-3 py-1.5 text-sm disabled:opacity-50"
                >
                    {ocupado ? "Marcando..." : "Sai hoje"}
                </button>

                <label className="sr-only" htmlFor={`dia-${pedido.id}`}>
                    Dia em que o pedido {pedido.codigo} sai
                </label>

                <input
                    id={`dia-${pedido.id}`}
                    type="date"
                    value={dia}
                    onChange={(e) => setDia(e.target.value)}
                    min={hoje}
                    max={limite && limite >= hoje ? limite : undefined}
                    className="field py-1.5 text-sm"
                />

                <button
                    type="button"
                    onClick={() => aoMarcar(pedido, dia)}
                    disabled={ocupado || !dia}
                    className="btn btn-neutro px-3 py-1.5 text-sm disabled:opacity-50"
                >
                    Marcar
                </button>

            </div>

        </li>
    )
}

export default function Entregas() {

    // O mês que o calendário está mostrando. Começa no corrente.
    const [mes, setMes] = useState(() => {
        const hoje = new Date()
        return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    })

    const [entregas, setEntregas] = useState<Pedido[]>([])
    const [atrasados, setAtrasados] = useState<Pedido[]>([])
    const [emPreparo, setEmPreparo] = useState<Pedido[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    // Qual pedido está gravando o dia agora, para travar só os botões dele.
    const [marcandoId, setMarcandoId] = useState<number | null>(null)

    // O dia aberto na ficha à direita, e qual das duas listas ela mostra.
    //
    // Começa em HOJE porque é o dia que o lojista veio olhar quando abre a
    // agenda de manhã — abrir num dia vazio custaria um clique para chegar
    // onde ele já queria estar.
    const [diaAberto, setDiaAberto] = useState(() => chaveDoDia(new Date()))
    const [painel, setPainel] = useState<"dia" | "sem-dia">("dia")

    // Sobe de um a cada dia marcado. Um pedido que ganha dia muda de lista —
    // sai do preparo e entra num dia do calendário —, e reler o mês do
    // servidor é mais honesto do que remendar as três listas aqui.
    const [versao, setVersao] = useState(0)

    const chave = chaveDoMes(mes)

    useEffect(() => {

        let cancelado = false

        async function buscar() {
            setCarregando(true)

            try {
                const dados = await consultarAgenda(chave)

                if (!cancelado) {
                    setEntregas(dados.entregas)
                    setAtrasados(dados.atrasados)
                    setEmPreparo(dados.em_preparo)
                    setErro("")
                }
            } catch (e) {
                if (!cancelado) {
                    setErro(e instanceof Error ? e.message : "Não foi possível carregar a agenda.")
                }
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        buscar()

        return () => {
            cancelado = true
        }
    }, [chave, versao])

    /**
     * Põe o pedido num dia — é o que o tira do preparo e o bota no calendário.
     *
     * Data vazia desmarca, e o pedido volta para a fila: é como se desfaz um
     * dia escolhido cedo demais sem ter de inventar outro.
     */
    async function marcar(pedido: Pedido, dia: string) {

        setMarcandoId(pedido.id)
        setErro("")
        setAviso("")

        try {

            await marcarDiaDeEnvio(pedido.id, dia)

            setAviso(
                dia
                    ? `Pedido #${pedido.codigo} marcado para sair em ${new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR")}.`
                    : `Pedido #${pedido.codigo} voltou para o preparo, sem dia de saída.`,
            )

            setVersao((atual) => atual + 1)

        } catch (e) {
            setErro(e instanceof ApiError ? e.message : "Não foi possível marcar o dia da saída.")
        } finally {
            setMarcandoId(null)
        }
    }

    /**
     * Os pedidos de cada dia do mês.
     *
     * O dia vem resolvido do servidor (ver DiaNaAgenda): retirada cai no dia
     * do pedido, entrega cai no dia do envio. Refazer essa conta aqui seria
     * ter duas versões dela para divergirem.
     */
    const porDia = useMemo(() => {

        const mapa = new Map<string, Pedido[]>()

        for (const pedido of entregas) {

            if (!pedido.dia_na_agenda) continue

            const dia = chaveDoDia(new Date(pedido.dia_na_agenda))

            mapa.set(dia, [...(mapa.get(dia) ?? []), pedido])
        }

        return mapa
    }, [entregas])

    /**
     * As casas do calendário: o mês inteiro, precedido dos dias vazios que
     * empurram o dia 1º para a coluna do dia da semana certo.
     */
    const casas = useMemo(() => {

        const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1)
        const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()

        const vazias: null[] = Array(primeiro.getDay()).fill(null)
        const dias = Array.from({ length: diasNoMes }, (_, i) =>
            new Date(mes.getFullYear(), mes.getMonth(), i + 1))

        return [...vazias, ...dias]
    }, [mes])

    const hoje = chaveDoDia(new Date())

    function andar(meses: number) {
        setMes(new Date(mes.getFullYear(), mes.getMonth() + meses, 1))
    }

    const totalDoMes = entregas.length

    /**
     * Os pedidos confirmados que ainda não ocupam dia nenhum.
     *
     * Atrasados primeiro: os dois casos pedem a mesma decisão — marcar o dia
     * de saída —, mas um deles já custou prazo ao cliente.
     */
    const semDia = [...atrasados, ...emPreparo]

    return (
        <Pagina
            titulo="Agenda de entregas"
            descricao="O que a loja tem de fazer em cada dia. Quem vem buscar cai no dia da compra; quem pediu entrega entra no calendário quando você marcar o dia em que ele sai."
            acoes={
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => andar(-1)} aria-label="Mês anterior" className="btn btn-neutro">
                        <FiChevronLeft className="w-4" aria-hidden />
                    </button>

                    <span className="min-w-[10rem] px-2 text-center text-sm font-semibold text-[#303030]">
                        {MESES[mes.getMonth()]} de {mes.getFullYear()}
                    </span>

                    <button type="button" onClick={() => andar(1)} aria-label="Mês seguinte" className="btn btn-neutro">
                        <FiChevronRight className="w-4" aria-hidden />
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            const agora = new Date()
                            setMes(new Date(agora.getFullYear(), agora.getMonth(), 1))
                            setDiaAberto(chaveDoDia(agora))
                            setPainel("dia")
                        }}
                        className="btn btn-neutro ml-1"
                    >
                        Hoje
                    </button>
                </div>
            }
        >

            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aviso && (
                <div role="status" className="rounded-lg bg-[#E5F5E5] px-4 py-3 text-sm font-semibold text-[#0C5132]">
                    {aviso}
                </div>
            )}

            {/* ATRASADOS — uma faixa, e não uma lista aberta.
                É o que precisa de alguém hoje, então continua vindo antes de
                tudo e em qualquer mês; mas aberta ela empurrava o calendário
                para baixo da dobra, que é justamente o que se veio ver. O
                clique abre a lista no painel da direita. */}
            {atrasados.length > 0 && (
                <button
                    type="button"
                    onClick={() => setPainel("sem-dia")}
                    className="flex w-full items-center gap-2.5 rounded-lg border-l-4 border-[#8E1F0B] bg-[#FEE9E8] px-4 py-3 text-left"
                >
                    <FiAlertCircle className="w-4 shrink-0 text-[#8E1F0B]" aria-hidden />

                    <span className="flex-1 text-sm font-semibold text-[#8E1F0B]">
                        {atrasados.length} pedido(s) passaram do dia de sair e ninguém despachou
                    </span>

                    <span className="shrink-0 text-xs font-semibold text-[#8E1F0B] underline underline-offset-2">
                        remarcar
                    </span>
                </button>
            )}

            {carregando ? (
                <div className="card p-8 text-center text-sm text-[#616161]">Carregando a agenda...</div>
            ) : totalDoMes === 0 && semDia.length === 0 ? (
                <Estado
                    Icone={FiTruck}
                    titulo="Nenhum pedido neste mês"
                    texto="Aparecem aqui os pedidos do site: os que o cliente vem buscar, no dia da compra, e os que você despacha, no dia que marcar para eles saírem."
                    acao={<Link href="/page/pedidos" className="btn btn-neutro">Ver pedidos</Link>}
                />
            ) : (

                /* Calendário à esquerda, ficha do dia à direita — a mesma
                   anatomia das outras telas do painel. O calendário responde
                   "como está o mês"; a ficha responde "o que eu faço neste
                   dia", com o pedido inteiro legível em vez de um cartãozinho
                   espremido numa casa de 6,5rem. */
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">

                    {/* ---------------------------------------------------
                        O CALENDÁRIO
                        --------------------------------------------------- */}
                    <div className="card overflow-hidden">

                        <div className="grid grid-cols-7 border-b border-[#E1E1E1] bg-[#F7F7F7]">
                            {DIAS.map((dia) => (
                                <div key={dia} className="px-2 py-2 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                                    {dia}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7">
                            {casas.map((data, indice) => {

                                // As casas antes do dia 1º existem só para
                                // empurrar a primeira semana até a coluna certa.
                                if (!data) {
                                    return <div key={`vazio-${indice}`} className="min-h-[5rem] border-b border-r border-[#EBEBEB] bg-[#F7F7F7]" />
                                }

                                const dia = chaveDoDia(data)
                                const doDia = porDia.get(dia) ?? []
                                const ehHoje = dia === hoje
                                const aberto = dia === diaAberto && painel === "dia"

                                const retiradas = doDia.filter((p) => p.entrega_tipo !== "entrega").length
                                const envios = doDia.length - retiradas

                                return (
                                    <button
                                        key={dia}
                                        type="button"
                                        onClick={() => { setDiaAberto(dia); setPainel("dia") }}
                                        aria-current={aberto ? "true" : undefined}
                                        className={`min-h-[5rem] border-b border-r border-[#EBEBEB] p-1.5 text-left transition-colors ${
                                            aberto
                                                ? "bg-[#303030]/5 ring-1 ring-inset ring-[#303030]"
                                                : ehHoje ? "bg-[#EAF4FF]" : "hover:bg-[#F7F7F7]"
                                        }`}
                                    >
                                        <span className="flex items-baseline justify-between gap-1">
                                            <span className={`num text-xs ${
                                                ehHoje ? "font-bold text-[#005BD3]" : "font-medium text-[#8A8A8A]"
                                            }`}>
                                                {data.getDate()}
                                            </span>

                                            {doDia.length > 0 && (
                                                <span className="num text-[0.625rem] font-semibold text-[#616161]">
                                                    {doDia.length}
                                                </span>
                                            )}
                                        </span>

                                        {/* Quanto trabalho tem no dia, por tipo.
                                            A casa não cabe o pedido inteiro — e
                                            não precisa: quem olha o mês quer
                                            saber onde está cheio. O detalhe
                                            está a um clique, na ficha. */}
                                        {doDia.length > 0 && (
                                            <span className="mt-1 block space-y-0.5">
                                                {envios > 0 && (
                                                    <span className="block truncate rounded bg-[#FFE4C4] px-1.5 py-0.5 text-[0.625rem] font-semibold text-[#5E4200]">
                                                        {envios} para despachar
                                                    </span>
                                                )}

                                                {retiradas > 0 && (
                                                    <span className="block truncate rounded bg-[#EAF4FF] px-1.5 py-0.5 text-[0.625rem] font-semibold text-[#005BD3]">
                                                        {retiradas} para retirar
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* ---------------------------------------------------
                        A FICHA — o dia escolhido, ou os que não têm dia
                        --------------------------------------------------- */}
                    <section className="card flex max-h-[calc(100dvh-16rem)] flex-col overflow-hidden p-0">

                        <div className="flex border-b border-[#EBEBEB]">
                            <button
                                type="button"
                                onClick={() => setPainel("dia")}
                                className={`flex-1 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                                    painel === "dia"
                                        ? "border-[#005BD3] text-[#005BD3]"
                                        : "border-transparent text-[#616161] hover:text-[#303030]"
                                }`}
                            >
                                {new Date(`${diaAberto}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                            </button>

                            <button
                                type="button"
                                onClick={() => setPainel("sem-dia")}
                                className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                                    painel === "sem-dia"
                                        ? "border-[#005BD3] text-[#005BD3]"
                                        : "border-transparent text-[#616161] hover:text-[#303030]"
                                }`}
                            >
                                Sem dia

                                {semDia.length > 0 && (
                                    <span className={`num rounded-full px-2 py-0.5 text-xs font-bold ${
                                        painel === "sem-dia" ? "bg-[#EAF4FF] text-[#005BD3]" : "bg-[#F1F1F1] text-[#616161]"
                                    }`}>
                                        {semDia.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto">

                            {painel === "dia" ? (
                                (porDia.get(diaAberto) ?? []).length === 0 ? (
                                    <p className="px-4 py-8 text-center text-sm text-[#616161]">
                                        Nada marcado para este dia.
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-[#EBEBEB]">
                                        {(porDia.get(diaAberto) ?? []).map((pedido) => (
                                            <li key={pedido.id} className="p-4">
                                                <CartaoEntrega pedido={pedido} />
                                            </li>
                                        ))}
                                    </ul>
                                )
                            ) : semDia.length === 0 ? (
                                <p className="px-4 py-8 text-center text-sm text-[#616161]">
                                    Todo pedido confirmado já tem dia de saída.
                                </p>
                            ) : (
                                <ul className="divide-y divide-[#EBEBEB]">
                                    {semDia.map((pedido) => {

                                        const atrasado = atrasados.some((outro) => outro.id === pedido.id)

                                        return (
                                            <LinhaSemDia
                                                key={pedido.id}
                                                pedido={pedido}
                                                ocupado={marcandoId === pedido.id}
                                                aoMarcar={marcar}
                                                complemento={
                                                    atrasado ? (
                                                        <span className="text-xs font-semibold text-[#8E1F0B]">
                                                            devia sair em{" "}
                                                            {pedido.envio_previsto_em
                                                                ? new Date(pedido.envio_previsto_em).toLocaleDateString("pt-BR")
                                                                : "—"}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-[#8A8A8A]">
                                                            pedido em {new Date(pedido.created_at).toLocaleDateString("pt-BR")}
                                                        </span>
                                                    )
                                                }
                                            />
                                        )
                                    })}
                                </ul>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {/* A legenda existe porque a cor está carregando informação: sem
                ela, dois tons diferentes são só decoração. */}
            {totalDoMes > 0 && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#616161]">
                    <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded bg-[#FFE4C4]" aria-hidden />
                        Para despachar neste dia
                    </span>

                    <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded bg-[#EAF4FF]" aria-hidden />
                        O cliente vem buscar
                    </span>

                    <span className="num ml-auto">
                        {totalDoMes} pedido(s) no mês · {formatarMoeda(entregas.reduce((s, p) => s + (p.total ?? 0), 0))}
                    </span>
                </div>
            )}

        </Pagina>
    )
}
