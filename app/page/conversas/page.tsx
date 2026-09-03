"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
    consultarCanal,
    formatarTelefone,
    horaDaMensagem,
    listarConversas,
    listarMensagens,
    marcarLida,
    responder,
    consultarAparelho,
    escutarConversas,
    diaDaMensagem,
    mesmoDia,
    mesmoTelefone,
    type AparelhoWhatsApp,
    type CanalWhatsApp,
    type Conversa,
    type MensagemWhatsApp,
} from "@/middleware/whatsapp"
import { ApiError } from "@/middleware/client"
import { listarPedidos } from "@/middleware/pedidos"
import type { Pedido } from "@/app/type/type"
import ConectarWhatsApp from "@/app/components/whatsapp/conectar"
import ConectarPorQR from "@/app/components/whatsapp/qr"
import Bolha from "@/app/components/whatsapp/bolha"
import Avatar from "@/app/components/whatsapp/avatar"
import CaixaDeProdutos from "@/app/components/whatsapp/produtos"
import {
    FiAlertCircle,
    FiAlertTriangle,
    FiBox,
    FiMessageCircle,
    FiSearch,
    FiSend,
    FiSettings,
    FiShoppingCart,
} from "react-icons/fi"

/**
 * Conversas: o WhatsApp da loja dentro do painel.
 *
 * O cliente escreve do celular dele e o lojista responde daqui, sem trocar de
 * aplicativo no meio do atendimento — que é onde a venda se perde, porque
 * ninguém volta para o sistema depois de abrir o WhatsApp.
 *
 * A tela se atualiza sozinha a cada poucos segundos. É consulta repetida, e
 * não conexão aberta, de propósito: o painel de uma loja tem uma ou duas
 * abas abertas, o custo disso é irrelevante, e a alternativa (WebSocket)
 * traria reconexão, heartbeat e estado que ninguém quer manter para ganhar
 * dois segundos.
 */

/**
 * A varredura de segurança, não a entrega principal.
 *
 * O que traz a mensagem é o WebSocket, na hora em que ela chega do WhatsApp.
 * Esta consulta lenta existe para o caso de o fio cair sem o navegador
 * perceber — acontece com notebook que dormiu e com proxy que corta conexão
 * calada. Meio minuto é raro o bastante para não pesar e curto o bastante
 * para a tela não ficar mentindo por muito tempo.
 */
const INTERVALO_SEGURANCA_MS = 30000

/**
 * Até onde a caixa de escrever cresce, em pixels.
 *
 * Dezesseis linhas de folga: cabe inteira a mensagem de três produtos que a
 * caixa de produtos monta, que é o texto mais longo que sai daqui.
 */
const ALTURA_MAXIMA_DA_CAIXA = 260

export default function Conversas() {

    // Dois caminhos para a mesma caixa de entrada: o aparelho vinculado
    // (o QR) e a Cloud API oficial. A tela só precisa saber se ALGUM deles
    // está de pé — o resto é igual nos dois.
    const [canal, setCanal] = useState<CanalWhatsApp | null>(null)
    const [aparelho, setAparelho] = useState<AparelhoWhatsApp | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    const [conversas, setConversas] = useState<Conversa[]>([])
    const [abertaId, setAbertaId] = useState<number | null>(null)
    const [aberta, setAberta] = useState<Conversa | null>(null)
    const [mensagens, setMensagens] = useState<MensagemWhatsApp[]>([])

    const [texto, setTexto] = useState("")
    const [enviando, setEnviando] = useState(false)
    const [erroEnvio, setErroEnvio] = useState("")

    const [busca, setBusca] = useState("")
    const [ajustando, setAjustando] = useState(false)

    // A caixa de produtos, aberta debaixo do fio. Fechada por padrão: quem
    // abre a conversa vem responder, não vender uma peça específica.
    const [caixaAberta, setCaixaAberta] = useState(false)

    // Para que a caixa foi aberta: mandar preço ou fechar a venda. São os
    // dois destinos da mesma escolha de produtos (ver o componente).
    const [modoCaixa, setModoCaixa] = useState<"mensagem" | "pedido">("mensagem")

    /**
     * Os pedidos da loja, para reconhecer os que são desta conversa.
     *
     * Buscados uma vez, e não a cada conversa aberta: a lista é a mesma para
     * todas elas, e uma busca por clique seria dezenas de chamadas iguais
     * numa tela em que o lojista passa o dia.
     */
    const [pedidos, setPedidos] = useState<Pedido[]>([])

    const fimDoFio = useRef<HTMLDivElement>(null)
    const caixaDeEscrever = useRef<HTMLTextAreaElement>(null)

    /**
     * O último fio já carregado de cada conversa.
     *
     * Serve para voltar a uma conversa e vê-la na hora, em vez de olhar um
     * espaço vazio enquanto o servidor responde. O que está aqui pode estar
     * alguns segundos velho, e é de propósito: a busca continua saindo, e o
     * fio se corrige sozinho quando ela volta. Trocar "vazio por meio
     * segundo" por "quase certo agora" é o que faz a tela parecer rápida.
     *
     * Fica num ref, e não em estado: ninguém redesenha por causa dele.
     */
    const fiosGuardados = useRef(new Map<number, MensagemWhatsApp[]>())

    /* ==========================
       DADOS
    ========================== */

    useEffect(() => {
        let cancelado = false

        async function abrir() {
            try {
                const [canalDados, aparelhoDados] = await Promise.all([
                    consultarCanal(),
                    consultarAparelho(),
                ])

                if (cancelado) return

                setCanal(canalDados)
                setAparelho(aparelhoDados)

            } catch (e) {
                if (!cancelado) setErro(e instanceof Error ? e.message : "Erro ao consultar o WhatsApp da loja")
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        abrir()

        return () => {
            cancelado = true
        }
    }, [])

    const conectado = Boolean(aparelho?.conectado || canal?.conectado)

    useEffect(() => {
        if (!conectado) return

        let cancelado = false

        listarPedidos()
            .then((lista) => {
                if (!cancelado) setPedidos(lista)
            })
            .catch(() => {
                // Sem a lista, o topo apenas não mostra código de pedido —
                // e o botão de gerar continua funcionando, que é o que
                // importa para quem está atendendo agora.
            })

        return () => {
            cancelado = true
        }
    }, [conectado])

    /**
     * O pedido desta conversa: o mais recente feito para este telefone.
     *
     * O mais recente, e não todos, porque a pergunta que o topo responde é
     * "em que pé está o que esta pessoa comprou" — e quem quer o histórico
     * inteiro abre a tela de Pedidos, que é dela.
     */
    const pedidoDaConversa = useMemo(() => {

        if (!aberta) return null

        return (
            pedidos
                .filter((pedido) => mesmoTelefone(pedido.cliente_contato, aberta.telefone))
                .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
        )

    }, [pedidos, aberta])

    const atualizarConversas = useCallback(async () => {
        try {
            setConversas(await listarConversas())
        } catch {
            // Silêncio de propósito: isto roda a cada cinco segundos, e um
            // aviso vermelho piscando por uma falha de rede momentânea seria
            // pior do que a lista ficar alguns segundos velha.
        }
    }, [])

    const atualizarFio = useCallback(async (id: number) => {
        try {
            const dados = await listarMensagens(id)

            // O que veio do servidor é a verdade do fio, e é ele que fica
            // guardado. As provisórias não entram aqui: elas ainda não
            // existem para ninguém além desta tela.
            fiosGuardados.current.set(id, dados.mensagens)

            setAberta(dados.conversa)

            // Mas a mensagem que o lojista acabou de mandar e ainda está a
            // caminho não pode sumir da tela porque a varredura de meio
            // minuto calhou de cair no meio do envio. Ela volta ao fim do
            // fio, de onde sai sozinha quando a resposta chega e a troca
            // pela definitiva.
            setMensagens((atual) => {

                const aCaminho = atual.filter((mensagem) => mensagem.id < 0)

                return aCaminho.length > 0
                    ? [...dados.mensagens, ...aCaminho]
                    : dados.mensagens
            })

        } catch {
            // Mesmo motivo de cima.
        }
    }, [])

    // A batida do relógio: a lista sempre, o fio só quando há um aberto.
    useEffect(() => {
        if (!conectado) return

        // A primeira batida é agora, para a tela não nascer vazia e esperar
        // cinco segundos. As duas funções são async e só mexem em estado
        // depois do await — a regra do lint não consegue seguir isso e vê um
        // setState síncrono que não existe.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- o estado só muda dentro do then, não no corpo do efeito
        atualizarConversas()

        if (abertaId !== null) atualizarFio(abertaId)

        const timer = setInterval(() => {
            atualizarConversas()
            if (abertaId !== null) atualizarFio(abertaId)
        }, INTERVALO_SEGURANCA_MS)

        return () => clearInterval(timer)

    }, [conectado, abertaId, atualizarConversas, atualizarFio])

    // O fio ao vivo. O servidor avisa "mexeu na conversa 12" no instante em
    // que a mensagem chega do WhatsApp, e a tela busca o que mudou.
    //
    // Sempre a lista, porque a ordem e a bolinha de não lidas mudam com
    // qualquer conversa; o fio, só quando o aviso é da conversa aberta —
    // senão uma loja movimentada ficaria recarregando um fio que ninguém
    // está olhando.
    useEffect(() => {
        if (!conectado) return

        return escutarConversas((aviso) => {
            atualizarConversas()

            if (aviso.conversa_id === abertaId) atualizarFio(aviso.conversa_id)
        })

    }, [conectado, abertaId, atualizarConversas, atualizarFio])

    // O fio nasce no fim, como todo aplicativo de conversa: o que interessa
    // é a última mensagem, não a primeira.
    useEffect(() => {
        fimDoFio.current?.scrollIntoView({ block: "end" })
    }, [mensagens.length, abertaId])

    /**
     * A caixa de escrever cresce com o que se escreve, até um teto.
     *
     * Ela nascia com uma linha e ficava com uma linha. Para responder "ok"
     * dava; para conferir os três produtos que a caixa acabou de montar, não:
     * a mensagem tem seis linhas e o lojista via duas, rolando um campo do
     * tamanho de um botão para ler o que estava prestes a mandar. Ninguém
     * revisa o que não consegue ver.
     *
     * O teto existe para o campo não engolir o fio da conversa numa mensagem
     * longa — passando dele, volta a rolar, que aí é o comportamento certo.
     */
    useEffect(() => {

        const campo = caixaDeEscrever.current

        if (!campo) return

        // Zerar antes de medir: sem isso a altura só cresce, porque
        // scrollHeight nunca fica menor do que a altura já aplicada.
        campo.style.height = "auto"
        campo.style.height = `${Math.min(campo.scrollHeight, ALTURA_MAXIMA_DA_CAIXA)}px`

    }, [texto])

    async function abrirConversa(conversa: Conversa) {

        setAbertaId(conversa.id)
        setAberta(conversa)

        // O fio de antes entra na hora, e a busca o corrige logo atrás.
        // Conversa nunca aberta cai no vazio mesmo — aí não há o que mostrar.
        setMensagens(fiosGuardados.current.get(conversa.id) ?? [])

        setErroEnvio("")
        setTexto("")
        setCaixaAberta(false)

        await atualizarFio(conversa.id)

        if (conversa.nao_lidas > 0) {
            try {
                await marcarLida(conversa.id)
                setConversas((atual) =>
                    atual.map((item) => (item.id === conversa.id ? { ...item, nao_lidas: 0 } : item))
                )
            } catch {
                // A bolinha some na próxima atualização de qualquer jeito.
            }
        }
    }

    async function enviar(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        const conteudo = texto.trim()

        if (!conteudo || abertaId === null) return

        const conversaId = abertaId

        setErroEnvio("")
        setEnviando(true)

        // A mensagem entra no fio antes de o servidor responder, e a caixa de
        // escrever esvazia junto. É o que todo aplicativo de conversa faz, e
        // pelo motivo certo: quem acabou de apertar enviar quer ver o que
        // escreveu no lugar dele, não um cursor parado esperando a rede da
        // loja. O id negativo não colide com nenhum id do banco e é trocado
        // pelo de verdade assim que a resposta chega.
        const provisoria: MensagemWhatsApp = {
            id: -Date.now(),
            conversa_id: conversaId,
            direcao: "saida",
            texto: conteudo,
            tipo: "text",
            status: "enfileirada",
            criada_em: new Date().toISOString(),
        }

        setMensagens((atual) => [...atual, provisoria])
        setTexto("")

        try {
            const mensagem = await responder(conversaId, conteudo)

            setMensagens((atual) =>
                atual.map((item) => (item.id === provisoria.id ? mensagem : item))
            )

            await atualizarConversas()

        } catch (e) {
            // O backend grava a mensagem mesmo quando a Meta recusa, então o
            // fio já vai mostrá-la marcada como falhou na próxima atualização.
            // A provisória sai de cena para não ficarem duas cópias da mesma
            // fala; o texto volta para a caixa, que é onde ele serve para
            // alguma coisa — tentar de novo sem redigitar.
            setErroEnvio(e instanceof ApiError ? e.message : "Não foi possível enviar")
            setMensagens((atual) => atual.filter((item) => item.id !== provisoria.id))
            setTexto(conteudo)
            atualizarFio(conversaId)

        } finally {
            setEnviando(false)
        }
    }

    /**
     * O que a caixa de produtos montou entra na mensagem que está sendo
     * escrita, e não por cima dela: o lojista costuma já ter digitado "bom
     * dia, seguem os valores" antes de ir procurar as peças.
     */
    function porProdutosNaMensagem(trecho: string) {

        setTexto((atual) => (atual.trim() ? `${atual.trimEnd()}\n\n${trecho}` : trecho))
        setCaixaAberta(false)

        // O foco volta para onde a pessoa estava, com o cursor no fim — ela
        // ainda pode querer acrescentar uma linha antes de mandar.
        requestAnimationFrame(() => {
            const campo = caixaDeEscrever.current
            if (!campo) return

            campo.focus()
            campo.setSelectionRange(campo.value.length, campo.value.length)
        })
    }

    /* ==========================
       TELA
    ========================== */

    if (carregando) {
        return (
            <main className="mx-auto max-w-6xl px-4 py-10">
                <div className="card p-8 text-center text-sm text-[#5A6469]">
                    Carregando conversas...
                </div>
            </main>
        )
    }

    if (erro) {
        return (
            <main className="mx-auto max-w-6xl px-4 py-10">
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#D4351C]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            </main>
        )
    }

    // Sem nenhum caminho conectado não há o que listar: a tela vira o passo a
    // passo de conectar, que é a única coisa útil que ela pode fazer agora.
    //
    // O QR vem primeiro por ser o caminho de quem está começando: lê com o
    // celular e acabou. A conexão oficial fica abaixo, para quem já tem conta
    // Business ou já cansou de a sessão do QR cair.
    if (!conectado || ajustando) {
        return (
            <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">

                <div>
                    <h1 className="font-display text-2xl text-[#1E2428]">
                        Conectar o WhatsApp da loja
                    </h1>

                    <p className="mt-1 text-sm text-[#5A6469]">
                        O cliente escreve para o número da sua loja e você responde por
                        aqui, sem sair do sistema. Cada loja usa a própria conta —
                        ninguém lê a conversa de ninguém.
                    </p>
                </div>

                <ConectarPorQR
                    aoConectar={async () => {
                        setAparelho(await consultarAparelho())
                        setAjustando(false)
                    }}
                />

                <details className="card p-6 sm:p-7">
                    <summary className="cursor-pointer font-display text-lg text-[#1E2428]">
                        Ou conectar pela API oficial da Meta
                    </summary>

                    <div className="mt-4">
                        <ConectarWhatsApp
                            canal={canal}
                            aoConectar={(novo) => {
                                setCanal(novo)
                                setAjustando(false)
                            }}
                            aoCancelar={undefined}
                        />
                    </div>
                </details>

                {conectado && (
                    <button
                        type="button"
                        onClick={() => setAjustando(false)}
                        className="btn btn-neutro"
                    >
                        Voltar às conversas
                    </button>
                )}

            </main>
        )
    }

    const filtradas = conversas.filter((conversa) => {
        const termo = busca.trim().toLowerCase()

        if (!termo) return true

        return (
            conversa.nome.toLowerCase().includes(termo) ||
            conversa.telefone.includes(termo.replace(/\D/g, ""))
        )
    })

    return (
        // Altura da janela inteira, e não o miolo centrado do resto do painel:
        // conversa é tela de trabalho, e o lojista fica nela o dia todo. Cada
        // linha a menos na lista é um cliente que ele precisa rolar para achar.
        // A largura também vai inteira — as duas colunas crescem com a tela em
        // vez de deixarem faixas vazias dos lados.
        <main className="flex h-screen flex-col bg-[#F0F3F4] px-4 pb-4 pt-5 md:ml-64 md:px-6">

            <div className="flex flex-wrap items-end justify-between gap-3">

                <div>
                    <h1 className="font-display text-2xl text-[#1E2428]">Conversas</h1>

                    <p className="mt-1 text-sm text-[#5A6469]">
                        O WhatsApp da loja
                        {aparelho?.conectado && aparelho.numero
                            ? ` (${aparelho.numero})`
                            : canal?.numero_exibicao
                                ? ` (${canal.numero_exibicao})`
                                : ""}, aqui dentro.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setAjustando(true)}
                    className="btn btn-neutro"
                >
                    <FiSettings className="w-4" aria-hidden />
                    Conexão
                </button>

            </div>

            <div className="card mt-4 grid min-h-0 flex-1 overflow-hidden md:grid-cols-[20rem_1fr] lg:grid-cols-[23rem_1fr]">

                {/* ==========================
                    LISTA
                ========================== */}

                <div className="flex min-h-0 flex-col border-b border-[#E4E9EB] md:border-b-0 md:border-r">

                    <div className="border-b border-[#E4E9EB] p-3">
                        <div className="relative">
                            <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#8C969B]" aria-hidden />

                            <input
                                className="field pl-9"
                                placeholder="Buscar cliente"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">

                        {filtradas.length === 0 && (
                            <div className="p-6 text-center text-sm text-[#5A6469]">
                                {conversas.length === 0 ? (
                                    <>
                                        <p>
                                            Nenhuma conversa ainda. Assim que um cliente escrever
                                            para o número da loja, ela aparece aqui.
                                        </p>

                                        {/* O histórico do celular só é enviado pelo WhatsApp no
                                            momento em que o aparelho é vinculado. Quem conectou e
                                            não viu as conversas antigas precisa saber disso, senão
                                            conclui — com razão — que não funcionou. */}
                                        {aparelho?.conectado && (
                                            <p className="mt-3 text-xs text-[#8C969B]">
                                                As conversas que já estavam no celular só vêm no
                                                momento em que o aparelho é conectado. Se você
                                                conectou antes desta versão, desvincule e leia o QR
                                                de novo em{" "}
                                                <button
                                                    type="button"
                                                    onClick={() => setAjustando(true)}
                                                    className="font-semibold text-[#0086FF] hover:underline"
                                                >
                                                    Conexão
                                                </button>
                                                .
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p>Nenhum cliente com esse nome ou número.</p>
                                )}
                            </div>
                        )}

                        <ul className="divide-y divide-[#F0F3F4]">
                            {filtradas.map((conversa) => (
                                <li key={conversa.id}>
                                    <button
                                        type="button"
                                        onClick={() => abrirConversa(conversa)}
                                        aria-current={conversa.id === abertaId ? "true" : undefined}
                                        className={`relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                                            conversa.id === abertaId
                                                ? "bg-[#E6F3FF]"
                                                : conversa.nao_lidas > 0
                                                    ? "bg-[#F7FBFF] hover:bg-[#F0F3F4]"
                                                    : "hover:bg-[#F7F9FA]"
                                        }`}
                                    >
                                        {/* Barra na borda em vez de fundo inteiro: diz qual
                                            está aberta sem competir com a bolinha de não lidas. */}
                                        {conversa.id === abertaId && (
                                            <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[#0086FF]" />
                                        )}

                                        <Avatar
                                            conversaId={conversa.id}
                                            nome={conversa.nome || conversa.telefone}
                                            temFoto={conversa.tem_foto}
                                        />

                                        <span className="min-w-0 flex-1">
                                            <span
                                                className={`block truncate text-sm text-[#1E2428] ${
                                                    conversa.nao_lidas > 0 ? "font-extrabold" : "font-semibold"
                                                }`}
                                            >
                                                {conversa.nome.trim() || formatarTelefone(conversa.telefone)}
                                            </span>
                                            {/* Só quando há nome: sem ele a linha de
                                                cima JÁ é o telefone, e repeti-lo
                                                embaixo enche a linha sem informar. */}
                                            {conversa.nome.trim() && (
                                                <span className="num block truncate text-xs text-[#8C969B]">
                                                    {formatarTelefone(conversa.telefone)}
                                                </span>
                                            )}
                                        </span>

                                        <span className="flex shrink-0 flex-col items-end gap-1.5">
                                            <span
                                                className={`num text-[0.68rem] ${
                                                    conversa.nao_lidas > 0 ? "font-bold text-[#0086FF]" : "text-[#8C969B]"
                                                }`}
                                            >
                                                {horaDaMensagem(conversa.ultima_mensagem_em)}
                                            </span>

                                            {conversa.nao_lidas > 0 ? (
                                                <span className="num flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0086FF] px-1.5 text-[0.68rem] font-bold text-white">
                                                    {conversa.nao_lidas}
                                                </span>
                                            ) : (
                                                <span className="h-5" aria-hidden />
                                            )}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>

                    </div>

                </div>

                {/* ==========================
                    FIO
                ========================== */}

                <div className="flex min-h-0 min-w-0 flex-col">

                    {aberta === null ? (

                        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
                            <FiMessageCircle className="w-8 text-[#B8C0C4]" aria-hidden />
                            <p className="text-sm text-[#5A6469]">
                                Escolha uma conversa à esquerda.
                            </p>
                        </div>

                    ) : (
                        <>
                            <div className="flex items-center gap-3 border-b border-[#E4E9EB] bg-white px-5 py-3">

                                <Avatar
                                    conversaId={aberta.id}
                                    nome={aberta.nome || aberta.telefone}
                                    temFoto={aberta.tem_foto}
                                    tamanho="h-11 w-11"
                                />

                                <div className="min-w-0 flex-1">

                                    <div className="flex items-center gap-2">

                                        <p className="truncate font-display text-[1.05rem] leading-tight text-[#1E2428]">
                                            {aberta.nome.trim() || formatarTelefone(aberta.telefone)}
                                        </p>

                                        {/* O pedido desta pessoa, ao lado do nome dela.
                                            É a resposta de "o que essa conversa virou":
                                            sem isto, saber se o cliente já comprou exigia
                                            sair daqui, abrir Pedidos e procurar pelo
                                            telefone. Leva ao pedido, e não abre nada por
                                            cima da conversa. */}
                                        {pedidoDaConversa && (
                                            <Link
                                                href="/page/pedidos"
                                                title={`Pedido ${pedidoDaConversa.codigo} · ${pedidoDaConversa.status}`}
                                                className="num inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E6F3FF] px-2.5 py-0.5 text-[0.68rem] font-bold text-[#0075E2] transition-colors hover:bg-[#CFE7FF]"
                                            >
                                                <FiShoppingCart className="w-3" aria-hidden />
                                                {pedidoDaConversa.codigo}
                                            </Link>
                                        )}

                                    </div>

                                    <p className="num truncate text-xs text-[#8C969B]">
                                        {formatarTelefone(aberta.telefone)}
                                    </p>
                                </div>

                                {/* Gerar pedido a partir da conversa: o cliente
                                    fechou pelo WhatsApp, e a venda tem de virar
                                    pedido sem o lojista reescrever o nome e o
                                    telefone que já estão na tela. */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setModoCaixa("pedido")
                                        setCaixaAberta(true)
                                    }}
                                    className="btn btn-secundario hidden shrink-0 sm:inline-flex"
                                >
                                    <FiShoppingCart className="w-4" aria-hidden />
                                    <span>Gerar pedido</span>
                                </button>

                                {/* A janela de 24h como estado permanente do topo, e
                                    não só como aviso na hora de escrever: o lojista
                                    decide o que dizer sabendo se ainda pode falar
                                    livremente. */}
                                <span
                                    className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold sm:inline-flex ${
                                        aberta.janela_aberta
                                            ? "bg-[#E8F5E9] text-[#2E7D32]"
                                            : "bg-[#FFF6E0] text-[#8A6C1B]"
                                    }`}
                                >
                                    <span
                                        aria-hidden
                                        className={`h-1.5 w-1.5 rounded-full ${
                                            aberta.janela_aberta ? "bg-[#2E7D32]" : "bg-[#8A6C1B]"
                                        }`}
                                    />
                                    {aberta.janela_aberta ? "Pode responder" : "Fora das 24h"}
                                </span>

                            </div>

                            <div className="fio-conversa flex-1 overflow-y-auto px-4 py-4">

                                {mensagens.length === 0 && (
                                    <p className="py-8 text-center text-sm text-[#8C969B]">
                                        Nenhuma mensagem nesta conversa ainda.
                                    </p>
                                )}

                                {mensagens.map((mensagem, i) => {

                                    const anterior = mensagens[i - 1]
                                    const seguinte = mensagens[i + 1]

                                    // Divisória de dia: entra quando a mensagem
                                    // cai num dia diferente da anterior — e antes
                                    // da primeira, que sempre abre um dia.
                                    const viraODia =
                                        !anterior || !mesmoDia(anterior.criada_em, mensagem.criada_em)

                                    // Um grupo é uma sequência do mesmo lado dentro
                                    // do mesmo dia: é assim que se fala, em rajadas,
                                    // e desenhar cada mensagem isolada faria a tela
                                    // parecer mais conversada do que a conversa foi.
                                    const abreGrupo =
                                        viraODia || !anterior || anterior.direcao !== mensagem.direcao

                                    const fechaGrupo =
                                        !seguinte ||
                                        seguinte.direcao !== mensagem.direcao ||
                                        !mesmoDia(mensagem.criada_em, seguinte.criada_em)

                                    return (
                                        <div key={mensagem.id}>

                                            {viraODia && (
                                                <div className="my-3 flex justify-center">
                                                    <span className="rounded-full bg-white px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.04em] text-[#5A6469] shadow-sm ring-1 ring-[#E4E9EB]">
                                                        {diaDaMensagem(mensagem.criada_em)}
                                                    </span>
                                                </div>
                                            )}

                                            <Bolha
                                                mensagem={mensagem}
                                                abreGrupo={abreGrupo}
                                                fechaGrupo={fechaGrupo}
                                            />
                                        </div>
                                    )
                                })}

                                <div ref={fimDoFio} />

                            </div>

                            {/* A regra das 24 horas, avisada antes de o lojista
                                escrever — e não depois, no erro do envio. */}
                            {!aberta.janela_aberta && (
                                <div className="flex items-start gap-2 border-t border-[#E4E9EB] bg-[#FFF6E0] px-4 py-2.5 text-xs text-[#8A6C1B]">
                                    <FiAlertTriangle className="mt-0.5 w-3.5 shrink-0" aria-hidden />
                                    <span>
                                        Faz mais de 24 horas que este cliente não escreve. O WhatsApp
                                        só deixa recomeçar a conversa com uma mensagem modelo aprovada
                                        pela Meta — o envio livre vai ser recusado.
                                    </span>
                                </div>
                            )}

                            {erroEnvio && (
                                <div role="alert" className="border-t border-[#E4E9EB] bg-[#FDECEA] px-4 py-2.5 text-xs font-semibold text-[#D4351C]">
                                    {erroEnvio}
                                </div>
                            )}

                            {/* A caixa de produtos abre entre o fio e o campo de
                                escrever, que é o caminho da mão: procurar a peça,
                                marcá-la e continuar escrevendo logo abaixo. */}
                            {caixaAberta && (
                                <CaixaDeProdutos
                                    modo={modoCaixa}
                                    cliente={{
                                        // O pedido precisa de um nome, e nem
                                        // toda conversa tem um: o telefone
                                        // serve de nome quando o contato não
                                        // está salvo, que é o caso comum de
                                        // quem escreve para a loja pela
                                        // primeira vez.
                                        nome: aberta.nome.trim() || formatarTelefone(aberta.telefone),
                                        contato: aberta.telefone,
                                    }}
                                    aoInserir={porProdutosNaMensagem}
                                    aoPedidoCriado={(pedido) => {
                                        // Entra na lista local na hora, para o
                                        // código aparecer ao lado do nome sem
                                        // esperar uma nova busca.
                                        setPedidos((atual) => [pedido, ...atual])
                                    }}
                                    aoFechar={() => setCaixaAberta(false)}
                                />
                            )}

                            <form onSubmit={enviar} className="flex items-end gap-2 border-t border-[#E4E9EB] bg-white p-3">

                                {/* Preço de produto é a pergunta que mais chega por
                                    WhatsApp numa loja, então ela ganha um botão fixo
                                    ao lado de escrever — e não um menu escondido. */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        // Este botão é sempre o de mandar
                                        // preço: quem quer pedido entra pelo
                                        // "Gerar pedido", lá em cima.
                                        setModoCaixa("mensagem")
                                        setCaixaAberta((estaAberta) => !estaAberta)
                                    }}
                                    aria-expanded={caixaAberta}
                                    aria-label="Produtos do estoque"
                                    title="Pôr produtos do estoque na mensagem"
                                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                        caixaAberta
                                            ? "border-[#0086FF] bg-[#E6F3FF] text-[#0075E2]"
                                            : "border-[#D3DADD] bg-white text-[#5A6469] hover:bg-[#F0F3F4]"
                                    }`}
                                >
                                    <FiBox className="w-[1.05rem]" aria-hidden />
                                </button>

                                <textarea
                                    ref={caixaDeEscrever}
                                    rows={1}
                                    value={texto}
                                    onChange={(e) => setTexto(e.target.value)}
                                    onKeyDown={(e) => {
                                        // Enter manda, Shift+Enter quebra linha —
                                        // o mesmo hábito do WhatsApp.
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault()
                                            e.currentTarget.form?.requestSubmit()
                                        }
                                    }}
                                    placeholder="Escreva a resposta"
                                    className="field min-h-11 flex-1 resize-none overflow-y-auto rounded-2xl"
                                />

                                {/* Redondo e só com o ícone: a caixa de escrever é
                                    estreita, e o rótulo "Enviar" roubava dela a
                                    largura justamente onde o texto é digitado. O
                                    nome continua existindo para quem usa leitor de
                                    tela. */}
                                <button
                                    type="submit"
                                    disabled={enviando || !texto.trim()}
                                    aria-label={enviando ? "Enviando" : "Enviar"}
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0086FF] text-white transition-colors hover:bg-[#0071D6] disabled:opacity-40"
                                >
                                    <FiSend className="w-[1.05rem]" aria-hidden />
                                </button>
                            </form>
                        </>
                    )}

                </div>

            </div>

        </main>
    )
}
