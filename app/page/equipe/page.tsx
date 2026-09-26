"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
    FiAlertCircle,
    FiArrowLeft,
    FiCheck,
    FiChevronDown,
    FiClock,
    FiHash,
    FiLock,
    FiMessageSquare,
    FiPlus,
    FiSend,
    FiCheckSquare,
    FiCornerUpLeft,
    FiGrid,
    FiSettings,
    FiLogOut,
    FiSlash,
    FiUserPlus,
    FiUsers,
    FiVideo,
    FiX,
} from "react-icons/fi"
import {
    avisarQueDigito,
    consultarEquipeChat,
    criarGrupo,
    entrarNaEquipe,
    escreverNaSala,
    lerSala,
    marcarSalaLida,
    porNoGrupo,
    sairDaEquipe,
    sairDoGrupo,
} from "@/middleware/equipe"
import { escutarLoja } from "@/middleware/whatsapp"
import { useVarredura } from "@/middleware/aoVivo"
import { useTravarRolagem } from "@/app/components/pagina/travarRolagem"
import { useVoltar } from "@/app/components/pagina/voltar"
import { Bolinha, usePresenca } from "@/app/components/presenca/presenca"
import { TrocarFoto } from "@/app/components/presenca/foto"
import CodigoDaEquipe from "@/app/components/equipe/codigo"
import AcessosDaConversa from "@/app/components/equipe/acessos"
import TarefasDaEquipe from "@/app/components/equipe/tarefas"
import MuralDaEquipe from "@/app/components/equipe/mural"
import type {
    EstadoDaEquipe,
    FalaDaEquipe,
    MembroDaEquipe,
    SalaDaEquipe,
} from "@/app/type/type"

/**
 * A conversa interna da equipe.
 *
 * O que ela resolve: a loja com cinco pessoas já conversava — no WhatsApp
 * pessoal de cada uma. Ali o recado sobre a peça na prateleira errada mora no
 * celular de quem escreveu, some quando a pessoa sai e mistura-se com o grupo
 * da família. Aqui a conversa é da loja, e continua existindo quando a equipe
 * muda.
 *
 * A tela ocupa a janela inteira e traz o PRÓPRIO menu à esquerda, no lugar do
 * menu do painel (ver app/components/header/header.tsx, que o esconde aqui).
 * Não é enfeite: ali a navegação é outra. Quem está conversando escolhe com
 * quem falar, não em qual tela do estoque entrar, e dois menus empilhados na
 * mesma borda fariam a pessoa procurar a conversa dentro da lista de pedidos.
 * A barra escura de cima continua, com a marca e o caminho de volta — sem ela
 * a conversa viraria um beco.
 *
 * A porta tem duas trancas, e nenhuma abre sozinha:
 *
 *	O CÓDIGO da loja prova que alguém de dentro o passou adiante. Prova só
 *	isso: código é lido por cima do ombro, fotografado e esquecido num papel
 *	do balcão.
 *
 *	O DONO confirma que a pessoa é da empresa. É o passo que decide.
 *
 * Por isso a tela tem quatro caras — o cadeado, a sala de espera, a recusa e
 * a conversa — em vez de duas. Quem pediu e está aguardando precisa ver que
 * está aguardando; vendo o mesmo cadeado de quem nunca digitou nada, ficaria
 * digitando o código de novo achando que errou.
 */


export default function ConversaDaEquipe() {

    const parametros = useSearchParams()

    /* Para onde a seta de voltar leva: a tela anterior, e Início só como
       reserva de quem abriu o endereço direto. */
    const voltar = useVoltar("/page/inicio")

    const [estado, setEstado] = useState<EstadoDaEquipe | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")

    const [codigo, setCodigo] = useState("")
    const [entrando, setEntrando] = useState(false)

    const [sala, setSala] = useState("geral")
    const [falas, setFalas] = useState<FalaDaEquipe[]>([])
    const [texto, setTexto] = useState("")
    const [enviando, setEnviando] = useState(false)

    // A mensagem que está sendo respondida, se houver. Some ao enviar e ao
    // trocar de sala — uma citação que sobrevivesse à troca colaria o recado
    // de uma conversa na outra.
    const [respondendo, setRespondendo] = useState<FalaDaEquipe | null>(null)

    const [criandoGrupo, setCriandoGrupo] = useState(false)

    // "conversa" ou "config". As configurações da conversa — o código e quem
    // entra — moram DENTRO da conversa, e não na tela de Funcionários, por
    // dois motivos: são assunto da conversa, e o dono pode delegar o código a
    // um funcionário, que não abre aquela tela. Dois lugares para a mesma
    // coisa seria a duplicata de sempre.
    const [vendo, setVendo] = useState<"conversa" | "tarefas" | "mural" | "config">("conversa")

    // Sair pergunta antes porque não se desfaz sozinho: voltar custa o código
    // outra vez E a confirmação do dono. Um aviso depois do clique não teria
    // serventia nenhuma.
    const [saindo, setSaindo] = useState(false)
    const [chamando, setChamando] = useState(parametros.get("chamada") === "1")

    // Quem está escrevendo nesta sala agora. O nome some sozinho quando os
    // avisos param de chegar — quem desiste no meio da frase e fecha a aba não
    // deixa as bolinhas acesas para sempre.
    const [digitando, setDigitando] = useState("")

    const fim = useRef<HTMLDivElement>(null)
    const apagarBolinhas = useRef<ReturnType<typeof setTimeout> | null>(null)
    const ultimoAviso = useRef(0)

    /* ------------------------------------------------------------------ */

    const recarregarEstado = useCallback(async () => {
        try {
            setEstado(await consultarEquipeChat())
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível abrir a conversa.")
        }
    }, [])

    const recarregarSala = useCallback(async (qual: string) => {
        try {
            const mensagens = await lerSala(qual)

            setFalas(mensagens)

            // Marcar lida com o id da última que chegou, e não "até agora":
            // se alguém escrever entre a leitura e a marcação, essa fala
            // ficaria contada como lida sem ninguém a ter visto.
            const ultima = mensagens[mensagens.length - 1]

            if (ultima) await marcarSalaLida(qual, ultima.id)

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível ler a conversa.")
        }
    }, [])

    // A primeira carga.
    useEffect(() => {

        let cancelado = false

        async function abrir() {
            try {
                const dados = await consultarEquipeChat()

                if (!cancelado) setEstado(dados)

                if (!cancelado && dados.destravado) await recarregarSala("geral")

            } catch (e) {
                if (!cancelado) {
                    setErro(e instanceof Error ? e.message : "Não foi possível abrir a conversa.")
                }
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        abrir()

        return () => {
            cancelado = true
        }
    }, [recarregarSala])

    // O canal ao vivo da loja. Fica ligado mesmo na sala de espera: é por ele
    // que a tela de quem está aguardando troca sozinha no instante em que o
    // dono confirma, sem ninguém recarregar a página.
    //
    // O aviso não diz QUAL sala mexeu — de propósito, porque ele chega a
    // todas as abas da loja e o nome de uma conversa reservada entregaria a
    // quem não participa dela que ela existe. A tela pergunta de novo o que
    // já tem direito de ver.
    useEffect(() => {

        if (carregando) return

        // Uma rajada de avisos vira UMA rodada de recarga. Numa conversa
        // movimentada, dez mensagens chegando juntas viravam vinte
        // requisições (estado + sala) para desenhar o mesmo resultado.
        let agendado: ReturnType<typeof setTimeout> | null = null

        function recarregarDepois() {

            if (agendado) return

            agendado = setTimeout(() => {
                agendado = null
                recarregarEstado()

                if (estado?.destravado) recarregarSala(sala)
            }, 700)
        }

        const fechar = escutarLoja((aviso) => {

            // As bolinhas: o token é o que diz se o aviso é DESTA sala. Quem
            // não participa dela recebe um token que não casa com nada — foi
            // para isso que ele é opaco.
            if (aviso.tipo === "equipe-digitando") {

                const aberta = (estado?.salas ?? []).find((s) => s.chave === sala)

                if (!aberta || aviso.sala_token !== aberta.token) return
                if (!aviso.quem || aviso.quem === estado?.eu.nome) return

                setDigitando(aviso.quem)

                if (apagarBolinhas.current) clearTimeout(apagarBolinhas.current)

                // Um pouco mais que o intervalo entre dois avisos: assim as
                // bolinhas atravessam a pausa entre duas palavras e somem
                // sozinhas quando a pessoa para de verdade.
                apagarBolinhas.current = setTimeout(() => setDigitando(""), 5000)

                return
            }

            if (aviso.tipo !== "equipe") return

            recarregarDepois()
        })

        return () => {
            if (agendado) clearTimeout(agendado)

            fechar()
        }
    }, [carregando, estado?.destravado, estado?.salas, estado?.eu.nome, sala, recarregarEstado, recarregarSala])

    // A varredura de segurança: cobre o aviso que se perdeu numa queda de
    // rede. É ela que faz a confirmação do dono chegar mesmo com o socket
    // caído, em vez de deixar a pessoa esperando numa tela que parou.
    //
    // O intervalo é decidido pelo estado do fio (ver useVarredura): meio
    // minuto quando ele está de pé, porque aí quem entrega é ele; cinco
    // segundos quando caiu, porque aí esta consulta é a única entrega que
    // sobra — e o número dela vira o tempo que a pessoa espera depois de
    // mandar a mensagem.
    useVarredura(() => {
        recarregarEstado()

        if (estado?.destravado) recarregarSala(sala)
    }, !carregando)

    // Quem está com o painel aberto agora. Vem por aviso, não por relógio: o
    // servidor publica quando alguém entra ou sai, e é só aí que a lista é
    // pedida de novo (ver usePresenca).
    const online = usePresenca()

    const [mexendoNaFoto, setMexendoNaFoto] = useState(false)

    // A lista de salas (MenuDoChat) é uma coluna fixa no desktop; no celular
    // ela some de vista para dar a tela inteira à conversa. Sem uma gaveta
    // que a traga de volta, quem está no celular nunca escolhe outra sala,
    // nunca cria um grupo, nunca vê quem está online — a tela inteira do
    // painel do celular ficaria presa na primeira conversa que abriu.
    const [salaMenuAberta, setSalaMenuAberta] = useState(false)

    // A minha foto sai da minha linha no elenco, e não de uma consulta à
    // parte: o servidor já manda a foto de cada membro, e eu sou um deles.
    // Uma segunda fonte para o mesmo dado seria uma a mais para ficar
    // desatualizada.
    const minhaFoto = (estado?.membros ?? []).find((m) => m.cracha === estado?.eu.cracha)?.foto ?? ""

    // A conversa nasce no fim, como toda conversa.
    useEffect(() => {
        fim.current?.scrollIntoView({ block: "end" })
    }, [falas])

    /* ------------------------------------------------------------------ */

    async function pedirEntrada(evento: React.FormEvent) {

        evento.preventDefault()

        setEntrando(true)
        setErro("")

        try {
            await entrarNaEquipe(codigo)

            setCodigo("")

            const dados = await consultarEquipeChat()

            setEstado(dados)

            if (dados.destravado) await recarregarSala("geral")

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível pedir a entrada.")
        } finally {
            setEntrando(false)
        }
    }

    async function sair() {

        try {
            await sairDaEquipe()

            setSaindo(false)
            setFalas([])
            setSala("geral")
            setVendo("conversa")
            await recarregarEstado()

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível sair da conversa.")
        }
    }

    async function abrirSala(qual: string) {

        if (qual === sala) return

        setSala(qual)
        setFalas([])
        setChamando(false)
        setVendo("conversa")
        setDigitando("")
        setRespondendo(null)

        await recarregarSala(qual)
        await recarregarEstado()
    }

    async function enviar(evento: React.FormEvent) {

        evento.preventDefault()

        const escrito = texto.trim()

        if (!escrito || enviando) return

        setEnviando(true)
        setErro("")

        try {
            const fala = await escreverNaSala(sala, escrito, respondendo?.id)

            setTexto("")
            setRespondendo(null)
            setFalas((atuais) => [...atuais, fala])

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível enviar a mensagem.")
        } finally {
            setEnviando(false)
        }
    }

    async function abrirGrupo(nome: string, membros: string[]) {

        setErro("")

        try {
            const nova = await criarGrupo(nome, membros)

            setCriandoGrupo(false)
            await recarregarEstado()
            await abrirSala(nova)

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível criar o grupo.")
        }
    }

    /* ------------------------------------------------------------------ */

    if (carregando) {
        return (
            <Vestibulo>
                <p className="card p-8 text-center text-sm text-[var(--ink-2)]">
                    Abrindo a conversa…
                </p>
            </Vestibulo>
        )
    }

    if (!estado?.destravado) {
        return (
            <Vestibulo>
                <Porta
                    estado={estado}
                    codigo={codigo}
                    aoDigitar={setCodigo}
                    aoEnviar={pedirEntrada}
                    entrando={entrando}
                    erro={erro}
                />
            </Vestibulo>
        )
    }

    const salas = estado.salas ?? []
    const membros = estado.membros ?? []
    const aberta = salas.find((s) => s.chave === sala)
    const grupoAberto = aberta?.tipo === "grupo" ? Number(aberta.chave.slice(1)) : 0

    return (
        <>
            <MenuDoChat
                salas={salas}
                sala={sala}
                aoAbrir={(chave) => {
                    abrirSala(chave)
                    setSalaMenuAberta(false)
                }}
                aoCriarGrupo={() => {
                    setCriandoGrupo(true)
                    setSalaMenuAberta(false)
                }}
                aoSair={() => {
                    setSaindo(true)
                    setSalaMenuAberta(false)
                }}
                eu={estado.eu}
                online={online}
                minhaFoto={minhaFoto}
                aoTrocarFoto={() => {
                    setMexendoNaFoto(true)
                    setSalaMenuAberta(false)
                }}
                membros={membros}
                menuAberto={salaMenuAberta}
                aoFecharMenu={() => setSalaMenuAberta(false)}
            />

            <main className="flex h-[calc(100dvh-3.5rem)] flex-col bg-[var(--fundo)] px-4 pb-4 pt-4 md:ml-[19.5rem] md:px-6">


                {/* A faixa do celular: sem a coluna de salas ao lado (ela só
                    aparece a partir de md), esta é a única maneira de voltar
                    ao painel ou trocar de conversa — sem ela, a tela do
                    celular ficaria presa na sala em que abriu. */}
                <div className="mb-3 flex items-center gap-2 md:hidden">

                    {/* Volta para a tela ANTERIOR, não para uma tela fixa:
                        quem entrou na conversa vindo de Pedidos espera
                        Pedidos de volta (ver components/pagina/voltar.tsx).
                        Início é só a reserva de quem abriu o endereço
                        direto e não tem para onde voltar. */}
                    <button
                        type="button"
                        onClick={voltar}
                        aria-label="Voltar"
                        className="btn btn-neutro shrink-0 p-2.5"
                    >
                        <FiArrowLeft className="w-4" aria-hidden />
                    </button>

                    <button
                        type="button"
                        onClick={() => setSalaMenuAberta(true)}
                        aria-haspopup="menu"
                        aria-expanded={salaMenuAberta}
                        className="field flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                        <IconeDaSala tipo={aberta?.tipo} />

                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ink)]">
                            {aberta?.nome ?? "Escolher conversa"}
                        </span>

                        <FiChevronDown className="w-4 shrink-0 text-[var(--ink-3)]" aria-hidden />
                    </button>
                </div>

                {erro && (
                    <div role="alert" className="mb-3 flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]">
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </div>
                )}

                {/* ==========================================================
                    AS ABAS DA EQUIPE

                    O nome da sala aberta, e debaixo dele as quatro coisas que
                    se faz nesta tela. É o arranjo dos aplicativos de equipe
                    (a referência aqui é o Microsoft Teams), e ele resolve um
                    problema que o anterior tinha: Tarefas e Mural moravam na
                    barra da esquerda, no meio dos CANAIS — então "mural"
                    parecia mais um canal, e a barra misturava dois tipos de
                    coisa (onde eu falo, e o que eu faço).

                    A sala continua escolhida à esquerda; o que se faz com ela
                    se escolhe aqui em cima.
                ========================================================== */}
                <div className="mb-3 flex flex-wrap items-center gap-x-1 border-b border-[var(--linha)]">

                    {/* No celular o nome da sala já está na faixa acima
                        (o botão que abre a gaveta de salas) — repeti-lo
                        aqui era gastar a mesma linha estreita duas vezes
                        para dizer a mesma coisa. */}
                    <span className="mr-3 hidden items-center gap-2 py-2 font-display text-base text-[var(--ink)] md:flex">
                        <IconeDaSala tipo={aberta?.tipo} />
                        {aberta?.nome ?? "Conversa"}
                    </span>

                    {ABAS_DA_EQUIPE.map(({ chave, nome, Icone }) => {

                        // Configurações só existe para quem tem o que
                        // configurar: sem código nem admissão, a aba levaria a
                        // uma tela em branco.
                        if (chave === "config" && !((estado.pode_codigo ?? false) || (estado.pode_admitir ?? false))) {
                            return null
                        }

                        const ativa = vendo === chave

                        return (
                            <button
                                key={chave}
                                type="button"
                                onClick={() => setVendo(chave)}
                                aria-current={ativa ? "page" : undefined}
                                className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-2.5 text-sm font-semibold transition-colors sm:gap-2 sm:px-3 ${
                                    ativa
                                        ? "border-[var(--azul)] text-[var(--azul)]"
                                        : "border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]"
                                }`}
                            >
                                <Icone className="w-4 shrink-0" aria-hidden />
                                {nome}
                            </button>
                        )
                    })}
                </div>

                {vendo === "mural" ? (
                    <div className="anim-tela flex min-h-0 flex-1 flex-col">
                        <MuralDaEquipe eu={estado.eu} equipe={membros} />
                    </div>
                ) : vendo === "tarefas" ? (
                    <div className="anim-tela min-h-0 flex-1 overflow-y-auto">
                        <TarefasDaEquipe membros={membros} eu={estado.eu} />
                    </div>
                ) : vendo === "config" ? (
                    <div className="anim-tela min-h-0 flex-1 space-y-4 overflow-y-auto">

                        {/* Só quem pode ver cada coisa recebe cada coisa — e
                            quem decide isso é o servidor, nas duas pontas:
                            aqui para não oferecer um botão que a API recusaria,
                            e lá para que esconder o botão não seja a proteção. */}
                        {estado.pode_codigo && <CodigoDaEquipe />}
                        {estado.pode_admitir && <AcessosDaConversa />}
                    </div>
                ) : (

                <div className="anim-tela card flex min-h-0 flex-1 flex-col overflow-hidden">

                    {/* Sem o nome da sala aqui: ele já está na barra de
                        abas, logo acima, e repeti-lo gastava uma faixa
                        inteira de altura para dizer de novo o que a linha de
                        cima acabou de dizer. Fica só o que se FAZ na sala. */}
                    <header className="flex flex-wrap items-center gap-2 border-b border-[var(--linha-suave)] px-5 py-2.5">

                        <div className="ml-auto flex items-center gap-2">

                            {/* Chamar é dizer com QUEM, e por isso o botão mora
                                aqui, dentro da conversa aberta — e não na barra
                                de cima, onde ele abriria uma chamada com
                                ninguém. */}
                            <button
                                type="button"
                                onClick={() => setChamando((v) => !v)}
                                aria-pressed={chamando}
                                className="btn btn-neutro px-3 py-1.5 text-xs"
                            >
                                <FiVideo className="w-4" aria-hidden />
                                <span>Chamar</span>
                            </button>

                            {grupoAberto > 0 && (
                                <GerirGrupo
                                    grupoID={grupoAberto}
                                    podeMexer={aberta?.meu ?? false}
                                    membros={membros}
                                    eu={estado.eu}
                                    aoMudar={async () => {
                                        await recarregarEstado()
                                        await recarregarSala(sala)
                                    }}
                                    aoSair={async () => {
                                        await sairDoGrupo(grupoAberto)
                                        setSala("geral")
                                        setFalas([])
                                        await recarregarEstado()
                                        await recarregarSala("geral")
                                    }}
                                />
                            )}
                        </div>
                    </header>

                    {chamando && <AvisoDaChamada aoFechar={() => setChamando(false)} />}

                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[var(--superficie-2)] px-5 py-4">

                        {falas.length === 0 && (
                            <p className="py-10 text-center text-sm text-[var(--ink-3)]">
                                Nada dito por aqui ainda.
                            </p>
                        )}

                        {falas.map((fala) => (
                            <Bolha
                                key={fala.id}
                                fala={fala}
                                minha={fala.cracha === estado.eu.cracha}
                                comVarias={aberta?.tipo !== "pessoa"}
                                aoResponder={() => setRespondendo(fala)}
                            />
                        ))}

                        {digitando && <Digitando quem={digitando} />}

                        <div ref={fim} />
                    </div>

                    {respondendo && (
                        <div className="anim-surgir flex items-start gap-2 border-t border-[var(--linha-suave)] bg-[var(--superficie-2)] px-4 py-2">

                            <span className="mt-0.5 h-full w-0.5 shrink-0 self-stretch rounded-full bg-[var(--azul)]" aria-hidden />

                            <span className="min-w-0 flex-1">
                                <span className="block text-xs font-semibold text-[var(--azul)]">
                                    Respondendo {respondendo.autor}
                                </span>
                                <span className="block truncate text-xs text-[var(--ink-2)]">
                                    {respondendo.texto}
                                </span>
                            </span>

                            <button
                                type="button"
                                onClick={() => setRespondendo(null)}
                                aria-label="Cancelar resposta"
                                className="rounded-lg p-1 text-[var(--ink-2)] transition-colors hover:bg-[var(--linha-suave)]"
                            >
                                <FiX className="w-4" aria-hidden />
                            </button>
                        </div>
                    )}

                    <form onSubmit={enviar} className="flex items-end gap-2 border-t border-[var(--linha-suave)] px-4 py-3">

                        <label htmlFor="fala" className="sr-only">Escreva para a equipe</label>

                        <textarea
                            id="fala"
                            value={texto}
                            onChange={(e) => {
                                setTexto(e.target.value)

                                // Um aviso a cada três segundos e meio, e não
                                // a cada tecla: quem digita rápido dispararia
                                // dezenas de requisições por frase para
                                // entregar a mesma informação uma vez. Três e
                                // meio e não dois porque a loja inteira sai
                                // por um IP só, e cada pessoa escrevendo
                                // gastava trinta chamadas por minuto do limite
                                // compartilhado.
                                const agora = Date.now()

                                if (e.target.value !== "" && agora - ultimoAviso.current > 3500) {
                                    ultimoAviso.current = agora

                                    // Sem await e sem tratar erro: se o aviso
                                    // falhar, o pior caso é a outra ponta não
                                    // ver as bolinhas — não vale segurar o que
                                    // a pessoa está escrevendo por causa disso.
                                    avisarQueDigito(sala).catch(() => {})
                                }
                            }}
                            onKeyDown={(e) => {
                                // Enter envia, Shift+Enter quebra linha: é o que
                                // a mão da equipe já sabe fazer de todo outro
                                // chat que ela usa.
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault()
                                    enviar(e)
                                }
                            }}
                            rows={1}
                            maxLength={2000}
                            placeholder={`Escrever em ${aberta?.nome ?? "conversa"}…`}
                            className="field max-h-32 min-h-[2.5rem] flex-1 resize-y"
                        />

                        <button
                            type="submit"
                            disabled={enviando || texto.trim() === ""}
                            className="btn btn-primario"
                        >
                            <FiSend className="w-4" aria-hidden />
                            <span>Enviar</span>
                        </button>
                    </form>
                </div>
                )}
            </main>

            {saindo && (
                <Painel titulo="Sair da conversa da empresa" aoFechar={() => setSaindo(false)}>

                    <p className="text-sm text-[var(--ink-2)]">
                        Você sai do canal da loja e de todos os grupos de que participa. As
                        mensagens que você escreveu ficam onde estão — a conversa é da loja.
                    </p>

                    <p className="mt-3 rounded-lg bg-[var(--amarelo-fundo)] px-3 py-2 text-sm text-[var(--amarelo)]">
                        Para voltar, você precisa digitar o código da loja de novo <strong>e</strong>{" "}
                        o dono precisa confirmar a sua entrada outra vez.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">

                        <button type="button" onClick={sair} className="btn btn-primario">
                            <FiLogOut className="w-4" aria-hidden />
                            <span>Sair mesmo assim</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setSaindo(false)}
                            className="btn btn-neutro"
                        >
                            Cancelar
                        </button>
                    </div>
                </Painel>
            )}

            {criandoGrupo && (
                <NovoGrupo
                    membros={membros.filter((m) => m.cracha !== estado.eu.cracha && m.na_conversa)}
                    aoCriar={abrirGrupo}
                    aoFechar={() => setCriandoGrupo(false)}
                />
            )}

            {mexendoNaFoto && (
                <Painel titulo="Minha foto" aoFechar={() => setMexendoNaFoto(false)}>
                    <TrocarFoto
                        foto={minhaFoto}
                        nome={estado.eu.nome}

                        // Recarrega o estado inteiro em vez de encaixar a foto
                        // nova na minha linha aqui: o servidor também avisa as
                        // outras telas da loja, e reler é o que mantém uma
                        // fonte só para o mesmo dado.
                        aoTrocar={() => {
                            void recarregarEstado()
                        }}
                    />

                    <p className="mt-3 text-xs text-[var(--ink-3)]">
                        A foto aparece para quem trabalha com você, na conversa da
                        equipe e na tela de Funcionários.
                    </p>
                </Painel>
            )}
        </>
    )
}

/* ==========================================================================
   O menu do chat
   ========================================================================== */

/**
 * O menu da esquerda, no lugar do menu do painel.
 *
 * A ordem não é alfabética nem por atividade: primeiro o canal da loja, depois
 * os grupos, depois as pessoas. Os grupos vêm antes porque foram criados de
 * propósito e é neles que o assunto de trabalho corre; a conversa com cada
 * colega existe sempre, e existir sempre é o que a faz ser a parte de baixo.
 */
function MenuDoChat({
    salas, sala, aoAbrir, aoCriarGrupo, aoSair, eu, online, minhaFoto, aoTrocarFoto, membros, menuAberto, aoFecharMenu,
}: {
    salas: SalaDaEquipe[]
    sala: string
    aoAbrir: (chave: string) => void
    aoCriarGrupo: () => void
    aoSair: () => void
    eu: MembroDaEquipe

    /** Os crachás de quem está com o painel aberto agora (ver usePresenca). */
    online: Set<string>

    /** O endereço da minha foto, ou vazio para a inicial do nome. */
    minhaFoto: string

    /** Abre o painel de trocar a própria foto. */
    aoTrocarFoto: () => void

    /** O elenco da loja, de onde sai o rosto de cada linha de pessoa. */
    membros: MembroDaEquipe[]

    /** A gaveta de salas do celular está aberta (ver o botão na faixa da tela). */
    menuAberto: boolean

    /** Fecha a gaveta — no X, no clique fora, ou ao escolher uma sala. */
    aoFecharMenu: () => void
}) {

    const voltar = useVoltar("/page/inicio")

    // Lista de salas aberta segura a rolagem do fio atrás dela.
    useTravarRolagem(menuAberto)

    const geral = salas.filter((s) => s.tipo === "geral")
    const grupos = salas.filter((s) => s.tipo === "grupo")
    const pessoas = salas.filter((s) => s.tipo === "pessoa")

    // O mesmo conteúdo serve a coluna fixa do desktop e a gaveta do celular
    // — as duas sempre mostram a mesma lista de salas, com o mesmo rodapé de
    // conta. Uma segunda cópia deste JSX era o par se desencontrando: uma
    // sala nova aparecendo numa lista e não na outra.
    const conteudo = (
        <>
            <div className="border-b border-[var(--linha)] px-3 py-2.5">
                <button
                    type="button"
                    onClick={voltar}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.8125rem] font-semibold text-[var(--ink-2)] transition-colors hover:bg-[var(--superficie)] hover:text-[var(--ink)]"
                >
                    <FiArrowLeft className="w-4 shrink-0" aria-hidden />
                    Voltar
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3">

                {geral.map((linha) => (
                    <ItemDoMenu key={linha.chave} linha={linha} ativa={linha.chave === sala} aoAbrir={aoAbrir} />
                ))}

                {/* As tarefas ficam no topo, junto do canal da loja, e não
                    no rodapé com as configurações: é coisa de todo dia, e o
                    que se abre todo dia não pode morar onde só se vai quando
                    algo dá errado. */}
                {/* Tarefas, Mural e Configurações saíram desta barra.
                    Eles são o que se FAZ com a equipe, e estavam no meio dos
                    CANAIS, que são onde se FALA — "Mural" parecia mais um
                    canal, e a barra misturava dois tipos de coisa. Agora são
                    abas no topo do conteúdo (ver ABAS_DA_EQUIPE). */}

                <div className="mt-5 flex items-center justify-between px-2">
                    <h2 className="text-[0.6875rem] font-semibold text-[var(--ink-3)]">
                        Grupos
                    </h2>

                    <button
                        type="button"
                        onClick={aoCriarGrupo}
                        aria-label="Criar grupo"
                        className="rounded-md p-1 text-[var(--ink-2)] transition-colors hover:bg-[var(--superficie)] hover:text-[var(--ink)]"
                    >
                        <FiPlus className="w-4" aria-hidden />
                    </button>
                </div>

                <div className="mt-1 space-y-0.5">
                    {grupos.length === 0 ? (
                        <p className="px-2 py-1.5 text-xs text-[var(--ink-3)]">
                            Nenhum grupo ainda.
                        </p>
                    ) : grupos.map((linha, indice) => (
                        <ItemDoMenu
                            key={linha.chave}
                            linha={linha}
                            ativa={linha.chave === sala}
                            aoAbrir={aoAbrir}
                            ordem={indice}
                        />
                    ))}
                </div>

                <h2 className="mt-5 px-2 text-[0.6875rem] font-semibold text-[var(--ink-3)]">
                    Pessoas
                </h2>

                <div className="mt-1 space-y-0.5">
                    {pessoas.length === 0 ? (
                        <p className="px-2 py-1.5 text-xs text-[var(--ink-3)]">
                            Você é o único confirmado na conversa até agora.
                        </p>
                    ) : pessoas.map((linha, indice) => (
                        <ItemDoMenu
                            key={linha.chave}
                            linha={linha}
                            ativa={linha.chave === sala}
                            aoAbrir={aoAbrir}
                            ordem={indice}

                            // Numa sala de pessoa a chave É o crachá do colega
                            // (ver SalaDaEquipe.chave), então a comparação é
                            // direta, sem precisar procurar a pessoa na lista
                            // de membros.
                            online={online.has(linha.chave)}

                            // A foto mora no elenco, não na sala: a lista da
                            // esquerda é de SALAS, e uma sala não tem rosto —
                            // quem tem é a pessoa do outro lado dela.
                            foto={membros.find((m) => m.cracha === linha.chave)?.foto ?? ""}
                        />
                    ))}
                </div>
            </nav>

            <div className="border-t border-[var(--linha)] px-3 py-2.5">

                {/* O próprio rosto é o botão de trocá-lo — é onde a pessoa
                    procura, porque é onde ela se vê. Um item "Minha foto"
                    numa tela de configurações estaria certo e ninguém acharia. */}
                <button
                    type="button"
                    onClick={aoTrocarFoto}
                    title="Trocar a minha foto"
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--superficie)]"
                >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--azul)] text-[0.625rem] font-bold text-white">
                        {minhaFoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={minhaFoto} alt="" className="h-full w-full object-cover" />
                        ) : (
                            (eu.nome.trim()[0] ?? "?").toUpperCase()
                        )}
                    </span>

                    <span className="min-w-0 flex-1 truncate text-xs text-[var(--ink-3)]">
                        {eu.nome}
                    </span>
                </button>

                {/* O dono não sai: ele é a única conta capaz de readmitir
                    quem saiu, e uma porta que fecha por dentro sem maçaneta é
                    o jeito de ficar do lado de fora do próprio sistema. O
                    servidor recusa de todo jeito — isto aqui é só para o botão
                    não existir.

                    Em vermelho e no rodapé, longe do resto: é a única ação
                    desta tela que não se desfaz sozinha. */}
                {!eu.dono && (
                    <button
                        type="button"
                        onClick={aoSair}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[0.8125rem] font-semibold text-[var(--vermelho)] transition-colors hover:bg-[var(--vermelho-fundo)]"
                    >
                        <FiLogOut className="w-4 shrink-0" aria-hidden />
                        Sair da conversa
                    </button>
                )}
            </div>
        </>
    )

    return (
        <>
            <aside
                // --topo-visivel: quanto da barra superior ainda está à vista
                // (ver header.tsx). A barra rola junto com a página, e esta
                // coluna sobe na mesma medida em que ela sai — sem isso,
                // sobraria uma faixa vazia acima do menu depois de rolar.
                style={{
                    top: "var(--topo-visivel, 3.5rem)",
                    height: "calc(100dvh - var(--topo-visivel, 3.5rem))",
                }}
                // left-[4.5rem]: encosta no trilho de atalhos do painel (ver
                // header.tsx), que continua de pé mesmo dentro da conversa —
                // esta coluna toma só o lugar do acordeão, não o trilho
                // inteiro.
                className="fixed left-[4.5rem] z-30 hidden w-[var(--painel-menu)] flex-col border-r border-[var(--linha)] bg-[var(--fundo)] md:flex print:hidden"
            >
                {conteudo}
            </aside>

            {/* A lista de salas no celular: coluna PRESA À TELA, do mesmo
                molde do menu do painel (ver header.tsx). Ela fica parada
                enquanto se procura a sala, e o fio da conversa continua
                atrás — fechar devolve exatamente onde se estava. Começa
                onde a barra superior termina, e a barra rola: daí a
                variável `--topo-visivel`, que o header mantém. */}
            {menuAberto && (
                <div
                    style={{ top: "var(--topo-visivel, 3.5rem)" }}
                    className="fixed inset-x-0 bottom-0 z-40 md:hidden print:hidden"
                >
                    <div className="anim-surgir absolute inset-0 bg-black/40" onClick={aoFecharMenu} />

                    <nav className="anim-gaveta absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col border-r border-[var(--linha)] bg-[var(--fundo)] shadow-[0_4px_12px_rgba(0,0,0,0.12)]">

                        <div className="flex items-center justify-between border-b border-[var(--linha)] px-3 py-2.5">
                            <span className="text-sm font-semibold text-[var(--ink)]">Conversas</span>

                            <button
                                type="button"
                                onClick={aoFecharMenu}
                                aria-label="Fechar"
                                className="rounded-lg p-2 text-[var(--ink-2)] transition-colors hover:bg-[var(--superficie)]"
                            >
                                <FiX className="w-4" aria-hidden />
                            </button>
                        </div>

                        {conteudo}
                    </nav>
                </div>
            )}
        </>
    )
}

/**
 * As quatro coisas que se faz na tela de equipe.
 *
 * Ficam num catálogo, e não escritas na mão no meio do JSX, porque a ordem
 * delas é uma decisão: conversa primeiro (é o que abre por padrão e o que se
 * usa o dia inteiro), tarefas e mural depois — os dois nascem de uma conversa
 * —, e configurações por último, que é o que se mexe uma vez.
 */
const ABAS_DA_EQUIPE = [
    { chave: "conversa", nome: "Conversa", Icone: FiMessageSquare },
    { chave: "tarefas", nome: "Tarefas", Icone: FiCheckSquare },
    { chave: "mural", nome: "Mural", Icone: FiGrid },
    { chave: "config", nome: "Configurações", Icone: FiSettings },
] as const

function IconeDaSala({ tipo }: { tipo?: string }) {

    if (tipo === "geral") return <FiUsers className="w-4 shrink-0 text-[var(--ink-3)]" aria-hidden />
    if (tipo === "grupo") return <FiHash className="w-4 shrink-0 text-[var(--ink-3)]" aria-hidden />

    return <FiMessageSquare className="w-4 shrink-0 text-[var(--ink-3)]" aria-hidden />
}

/** Uma linha do menu do chat. */
function ItemDoMenu({ linha, ativa, aoAbrir, ordem = 0, online = false, foto = "" }: {
    linha: SalaDaEquipe
    ativa: boolean
    aoAbrir: (chave: string) => void

    /**
     * A pessoa desta linha está com o painel aberto agora.
     *
     * Só faz sentido nas salas de tipo "pessoa", onde a chave da sala É o
     * crachá do colega. Num grupo ou no canal geral não há uma pessoa de quem
     * falar, e quem chama já não passa nada — o padrão false cobre isso sem
     * precisar de condicional em cada ponto de uso.
     */
    online?: boolean

    /**
     * O rosto da pessoa desta linha, quando ela tem um.
     *
     * Como `online`, só faz sentido nas salas de tipo "pessoa" — grupo e canal
     * geral continuam com o ícone deles.
     */
    foto?: string

    /**
     * A posição na lista, que vira o atraso da entrada.
     *
     * A cascata é curta e tem teto: 30ms por item até o quinto. Sem teto, uma
     * equipe de vinte pessoas teria a última linha entrando meio segundo
     * depois da primeira — e aí a lista não está aparecendo, está desfilando.
     */
    ordem?: number
}) {
    return (
        <button
            type="button"
            onClick={() => aoAbrir(linha.chave)}
            aria-current={ativa ? "page" : undefined}
            style={{ animationDelay: `${Math.min(ordem, 5) * 30}ms` }}
            className={`anim-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.8125rem] transition-colors ${
                ativa
                    ? "bg-[var(--superficie)] font-semibold text-[var(--ink)] shadow-[0_1px_0_rgba(0,0,0,0.05)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--superficie)]/70 hover:text-[var(--ink)]"
            }`}
        >
            {/* A âncora da bolinha: ela é posicionada em relação a este span,
                e não ao botão inteiro, senão cairia no canto da linha em vez
                de no canto do rosto.

                Com foto, o rosto substitui o ícone — numa conversa, saber com
                quem se fala é o próprio ícone. Sem foto, fica o ícone de
                sempre, e não uma inicial: aqui a linha já mostra o nome
                inteiro ao lado, então uma letra repetiria o que está escrito. */}
            <span className="relative flex shrink-0 items-center">
                {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={foto}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                    />
                ) : (
                    <IconeDaSala tipo={linha.tipo} />
                )}

                <Bolinha online={online} titulo={`${linha.nome} está no painel agora`} />
            </span>

            <span className="min-w-0 flex-1 truncate">{linha.nome}</span>

            {linha.nao_lidas > 0 && (
                <span className="num shrink-0 rounded-full bg-[var(--azul)] px-1.5 py-0.5 text-[0.625rem] font-bold text-white">
                    {linha.nao_lidas > 99 ? "99+" : linha.nao_lidas}
                </span>
            )}
        </button>
    )
}

/* ==========================================================================
   A porta
   ========================================================================== */

/** A moldura de quem ainda não entrou — sem menu de chat, que ainda não há. */
function Vestibulo({ children }: { children: React.ReactNode }) {

    const voltar = useVoltar("/page/inicio")

    return (
        <main className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[var(--fundo)] px-4 pb-4 pt-6 md:px-6">

            <div className="mx-auto w-full max-w-md">

                <button
                    type="button"
                    onClick={voltar}
                    className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-2)] hover:text-[var(--ink)]"
                >
                    <FiArrowLeft className="w-4" aria-hidden />
                    Voltar
                </button>

                {children}
            </div>
        </main>
    )
}

/**
 * As três caras de quem está do lado de fora: sem código na loja, esperando a
 * confirmação do dono, e recusado.
 *
 * Cada uma diz o que fazer em seguida. Um cadeado só para os três casos
 * deixaria quem já pediu digitando o código de novo achando que errou.
 */
function Porta({ estado, codigo, aoDigitar, aoEnviar, entrando, erro }: {
    estado: EstadoDaEquipe | null
    codigo: string
    aoDigitar: (valor: string) => void
    aoEnviar: (evento: React.FormEvent) => void
    entrando: boolean
    erro: string
}) {

    if (estado?.sem_codigo) {
        return (
            <Cartao Icone={FiLock} titulo="Esta loja ainda não tem código">
                O código da conversa é gerado na conta do dono da loja, na tela de Funcionários.
                Unidade a ele para abri-la — o código aparece lá, e é ele quem passa para a equipe.
            </Cartao>
        )
    }

    if (estado?.situacao === "pendente") {
        return (
            <Cartao Icone={FiClock} titulo="Esperando o dono confirmar">
                O código estava certo. Falta o dono da loja confirmar que você é da empresa — é
                o passo que impede um código que vazou de virar uma pessoa a mais na conversa.
                Esta tela abre sozinha assim que ele confirmar; não precisa recarregar.
            </Cartao>
        )
    }

    if (estado?.situacao === "recusado") {
        return (
            <Cartao Icone={FiSlash} titulo="Entrada não autorizada">
                O dono da loja não liberou o seu acesso à conversa da equipe. Se isso não estava
                certo, fale com ele — ele consegue reverter na tela de Funcionários.
            </Cartao>
        )
    }

    return (
        <div className="anim-tela card p-7">

            <FiLock className="w-6 text-[var(--ink-3)]" aria-hidden />

            <h1 className="mt-3 font-display text-lg text-[var(--ink)]">
                Digite o código da loja
            </h1>

            <p className="mt-1.5 text-sm text-[var(--ink-2)]">
                Estar logado não basta. O código é o do dono da loja, e digitá-lo abre um
                pedido de entrada — é ele quem confirma que você é da empresa.
            </p>

            <form onSubmit={aoEnviar} className="mt-5">

                <label htmlFor="codigo" className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">
                    Código da loja
                </label>

                <input
                    id="codigo"
                    value={codigo}
                    onChange={(e) => aoDigitar(e.target.value)}
                    placeholder="XXXX-XXXX-XXXX"
                    autoComplete="off"
                    spellCheck={false}
                    className="field num w-full uppercase tracking-[0.12em]"
                />

                {erro && (
                    <p role="alert" className="mt-2.5 flex items-start gap-2 text-sm font-semibold text-[var(--vermelho)]">
                        <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                        <span>{erro}</span>
                    </p>
                )}

                <button
                    type="submit"
                    disabled={entrando || codigo.trim() === ""}
                    className="btn btn-primario mt-4 w-full justify-center"
                >
                    {entrando ? "Conferindo…" : "Pedir entrada"}
                </button>
            </form>
        </div>
    )
}

function Cartao({ Icone, titulo, children }: {
    Icone: typeof FiLock
    titulo: string
    children: React.ReactNode
}) {
    return (
        <div className="anim-tela card p-7">
            <Icone className="w-6 text-[var(--ink-3)]" aria-hidden />
            <h1 className="mt-3 font-display text-lg text-[var(--ink)]">{titulo}</h1>
            <p className="mt-1.5 text-sm text-[var(--ink-2)]">{children}</p>
        </div>
    )
}

/* ==========================================================================
   Grupos
   ========================================================================== */

/** O formulário de grupo novo: um nome e quem entra junto. */
function NovoGrupo({ membros, aoCriar, aoFechar }: {
    membros: MembroDaEquipe[]
    aoCriar: (nome: string, membros: string[]) => Promise<void>
    aoFechar: () => void
}) {

    const [nome, setNome] = useState("")
    const [marcados, setMarcados] = useState<string[]>([])
    const [salvando, setSalvando] = useState(false)

    async function salvar(evento: React.FormEvent) {

        evento.preventDefault()

        if (nome.trim() === "" || salvando) return

        setSalvando(true)

        await aoCriar(nome.trim(), marcados)

        setSalvando(false)
    }

    return (
        <Painel titulo="Novo grupo" aoFechar={aoFechar}>
            <form onSubmit={salvar}>

                <label htmlFor="nome-do-grupo" className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">
                    Nome do grupo
                </label>

                <input
                    id="nome-do-grupo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    maxLength={60}
                    placeholder="Inventário de setembro"
                    className="field w-full"
                />

                <p className="mb-2 mt-5 text-sm font-semibold text-[var(--ink)]">
                    Quem entra
                </p>

                {/* Só quem o dono já confirmou aparece: pôr num grupo alguém
                    que ainda não foi admitido seria abrir por dentro a porta
                    que o dono não abriu. Quem cria entra sozinho. */}
                {membros.length === 0 ? (
                    <p className="text-sm text-[var(--ink-3)]">
                        Ninguém mais foi confirmado na conversa ainda. O grupo nasce só com você
                        e você pode acrescentar gente depois.
                    </p>
                ) : (
                    <ul className="max-h-56 space-y-1 overflow-y-auto">
                        {membros.map((membro) => (
                            <li key={membro.cracha}>
                                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--superficie-2)]">
                                    <input
                                        type="checkbox"
                                        checked={marcados.includes(membro.cracha)}
                                        onChange={() => setMarcados((atuais) =>
                                            atuais.includes(membro.cracha)
                                                ? atuais.filter((c) => c !== membro.cracha)
                                                : [...atuais, membro.cracha]
                                        )}
                                    />
                                    {membro.nome}
                                </label>
                            </li>
                        ))}
                    </ul>
                )}

                <button
                    type="submit"
                    disabled={salvando || nome.trim() === ""}
                    className="btn btn-primario mt-5 w-full justify-center"
                >
                    {salvando ? "Criando…" : "Criar grupo"}
                </button>
            </form>
        </Painel>
    )
}

/** Acrescentar gente ao grupo aberto, ou sair dele. */
function GerirGrupo({ grupoID, podeMexer, membros, eu, aoMudar, aoSair }: {
    grupoID: number
    podeMexer: boolean
    membros: MembroDaEquipe[]
    eu: MembroDaEquipe
    aoMudar: () => Promise<void>
    aoSair: () => Promise<void>
}) {

    const [aberto, setAberto] = useState(false)
    const [marcados, setMarcados] = useState<string[]>([])
    const [salvando, setSalvando] = useState(false)

    async function acrescentar() {

        if (marcados.length === 0 || salvando) return

        setSalvando(true)

        try {
            await porNoGrupo(grupoID, marcados)
            setMarcados([])
            setAberto(false)
            await aoMudar()
        } finally {
            setSalvando(false)
        }
    }

    return (
        <>
            {podeMexer && (
                <button
                    type="button"
                    onClick={() => setAberto(true)}
                    className="btn btn-neutro px-3 py-1.5 text-xs"
                >
                    <FiUserPlus className="w-4" aria-hidden />
                    <span>Adicionar</span>
                </button>
            )}

            <button
                type="button"
                onClick={aoSair}
                className="btn btn-neutro px-3 py-1.5 text-xs"
            >
                <FiX className="w-4" aria-hidden />
                <span>Sair do grupo</span>
            </button>

            {aberto && (
                <Painel titulo="Adicionar ao grupo" aoFechar={() => setAberto(false)}>

                    <ul className="max-h-72 space-y-1 overflow-y-auto">
                        {membros
                            .filter((membro) => membro.cracha !== eu.cracha && membro.na_conversa)
                            .map((membro) => (
                                <li key={membro.cracha}>
                                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--superficie-2)]">
                                        <input
                                            type="checkbox"
                                            checked={marcados.includes(membro.cracha)}
                                            onChange={() => setMarcados((atuais) =>
                                                atuais.includes(membro.cracha)
                                                    ? atuais.filter((c) => c !== membro.cracha)
                                                    : [...atuais, membro.cracha]
                                            )}
                                        />
                                        {membro.nome}
                                    </label>
                                </li>
                            ))}
                    </ul>

                    {/* Quem já está no grupo é ignorado pelo servidor em vez de
                        virar erro: clicar duas vezes em adicionar é engano,
                        não falha. */}
                    <button
                        type="button"
                        onClick={acrescentar}
                        disabled={salvando || marcados.length === 0}
                        className="btn btn-primario mt-5 w-full justify-center"
                    >
                        <FiCheck className="w-4" aria-hidden />
                        <span>{salvando ? "Adicionando…" : "Adicionar"}</span>
                    </button>
                </Painel>
            )}
        </>
    )
}

/** A caixa que abre por cima da conversa. */
function Painel({ titulo, children, aoFechar }: {
    titulo: string
    children: React.ReactNode
    aoFechar: () => void
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

            <div className="anim-surgir absolute inset-0 bg-black/40" onClick={aoFechar} />

            {/* max-h + rolagem: com o teclado do Android aberto sobra menos
                de metade da tela, e um formulário mais alto que isso ficava
                com o botão de confirmar cortado fora da janela. */}
            <div className="anim-tela relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--linha)] bg-[var(--superficie)] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.12)] sm:p-6">

                <div className="mb-4 flex items-start justify-between gap-4">
                    <h2 className="font-display text-lg text-[var(--ink)]">{titulo}</h2>

                    <button
                        type="button"
                        onClick={aoFechar}
                        aria-label="Fechar"
                        className="rounded-lg p-1 text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)]"
                    >
                        <FiX className="w-4" aria-hidden />
                    </button>
                </div>

                {children}
            </div>
        </div>
    )
}

/* ==========================================================================
   Chamada
   ========================================================================== */

/**
 * A chamada de vídeo ainda não está ligada.
 *
 * O botão existe e diz a verdade, em vez de tocar e ficar preto. Uma chamada
 * de verdade não é um botão: precisa de um servidor no meio do caminho — TURN
 * para as conexões que os roteadores bloqueiam (uma em cada cinco, na média),
 * e um SFU para a chamada de três pessoas ou mais. Enquanto essa peça não
 * existir, prometer a chamada seria pior do que não a ter.
 */
function AvisoDaChamada({ aoFechar }: { aoFechar: () => void }) {
    return (
        <div className="flex items-start gap-3 border-b border-[var(--linha-suave)] bg-[var(--amarelo-fundo)] px-5 py-3">

            <FiVideo className="mt-0.5 w-4 shrink-0 text-[var(--amarelo)]" aria-hidden />

            <p className="flex-1 text-sm text-[var(--amarelo)]">
                <span className="font-semibold">A chamada de vídeo ainda não está ligada.</span>{" "}
                Ela precisa de um servidor de mídia próprio para funcionar fora do Wi-Fi da loja
                e para reunir mais de duas pessoas. O chat de texto e os grupos já funcionam.
            </p>

            <button
                type="button"
                onClick={aoFechar}
                aria-label="Fechar aviso"
                className="rounded-lg p-1 text-[var(--amarelo)] transition-colors hover:bg-black/5"
            >
                <FiX className="w-4" aria-hidden />
            </button>
        </div>
    )
}

/* ==========================================================================
   Falas
   ========================================================================== */

function Bolha({ fala, minha, comVarias, aoResponder }: {
    fala: FalaDaEquipe
    minha: boolean

    /**
     * Se a sala tem mais de duas pessoas — o canal geral e os grupos.
     *
     * É o que decide se o nome do autor aparece. Numa conversa de dois, o nome
     * em cada bolha é ruído: só existem duas possibilidades e a posição da
     * bolha já diz qual é. Em grupo, sem o nome não dá para saber quem falou.
     */
    comVarias: boolean

    aoResponder: () => void
}) {
    return (
        <div className={`anim-mensagem group flex items-center gap-1.5 ${minha ? "justify-end" : "justify-start"}`}>

            {/* O botão de responder aparece no lado de fora da bolha, ao passar
                o mouse. Fora e não dentro para não empurrar o texto nem mudar a
                altura da linha quando aparece. */}
            {minha && <BotaoResponder aoResponder={aoResponder} />}

            <div
                className={`max-w-[min(34rem,80%)] rounded-xl px-3.5 py-2 ${
                    minha
                        ? "bg-[var(--azul)] text-white"
                        : "border border-[var(--linha)] bg-[var(--superficie)] text-[var(--ink)]"
                }`}
            >
                {/* O nome, colorido por pessoa como no WhatsApp: a cor é o que
                    deixa varrer um grupo movimentado sem ler nome por nome. Ela
                    sai do crachá, então é sempre a mesma para a mesma pessoa —
                    e nunca some junto com a cor, porque o nome está escrito ao
                    lado. */}
                {!minha && comVarias && (
                    <p className="text-xs font-semibold" style={{ color: corDoAutor(fala.cracha) }}>
                        {fala.autor}
                    </p>
                )}

                {fala.responde_a && (
                    <span
                        className={`mb-1 block rounded-md border-l-2 px-2 py-1 ${
                            minha
                                ? "border-white/50 bg-[var(--superficie)]/10"
                                : "border-[var(--azul)] bg-[var(--superficie-2)]"
                        }`}
                    >
                        <span className={`block text-[0.6875rem] font-semibold ${minha ? "text-white/80" : "text-[var(--azul)]"}`}>
                            {fala.responde_autor}
                        </span>
                        <span className={`block truncate text-xs ${minha ? "text-white/70" : "text-[var(--ink-2)]"}`}>
                            {fala.responde_texto}
                        </span>
                    </span>
                )}

                <p className="whitespace-pre-wrap break-words text-sm">{fala.texto}</p>

                <p className={`num mt-0.5 text-[0.6875rem] ${minha ? "text-white/60" : "text-[var(--ink-3)]"}`}>
                    {hora(fala.criada_em)}
                </p>
            </div>

            {!minha && <BotaoResponder aoResponder={aoResponder} />}
        </div>
    )
}

/**
 * O botão de responder.
 *
 * Só aparece ao passar o mouse — mas continua alcançável pelo teclado
 * (`focus-within` no grupo), porque um botão que só existe sob o cursor não
 * existe para quem navega com Tab.
 */
function BotaoResponder({ aoResponder }: { aoResponder: () => void }) {
    return (
        <button
            type="button"
            onClick={aoResponder}
            aria-label="Responder esta mensagem"
            title="Responder"
            className="shrink-0 rounded-lg p-1.5 text-[var(--ink-3)] opacity-0 transition-opacity hover:bg-[var(--linha-suave)] hover:text-[var(--ink)] focus:opacity-100 group-hover:opacity-100"
        >
            <FiCornerUpLeft className="w-4" aria-hidden />
        </button>
    )
}

/**
 * A cor do nome de quem falou, derivada do crachá.
 *
 * Estável por definição: a mesma pessoa tem sempre a mesma cor, em qualquer
 * sala e depois de qualquer recarga. Deriva do texto, e não da posição na
 * lista — cor por posição mudaria de dono conforme quem entrasse no grupo.
 *
 * Os tons vêm da paleta de séries do painel (ver globals.css), que já passou
 * nas separações de daltonismo. E a cor nunca carrega sozinha a informação:
 * o nome está escrito ao lado dela.
 */
function corDoAutor(cracha: string): string {

    let soma = 0

    for (let i = 0; i < cracha.length; i++) {
        soma = (soma * 31 + cracha.charCodeAt(i)) % 997
    }

    return CORES_DE_AUTOR[soma % CORES_DE_AUTOR.length]
}

const CORES_DE_AUTOR = [
    "var(--serie-1)",
    "var(--serie-2)",
    "var(--serie-6)",
    "var(--serie-3)",
    "var(--serie-5)",
    "var(--serie-4)",
]

/**
 * "Fulano está digitando…".
 *
 * Fica no fim da conversa, onde a próxima mensagem vai aparecer — é o lugar
 * para onde o olho já está indo, e é o que faz o sinal antecipar a fala em vez
 * de competir com ela.
 *
 * As três bolinhas são defasadas (ver .bolinha-digitando em globals.css) para
 * o movimento correr da esquerda para a direita. Piscando juntas, três pontos
 * viram um alarme; em onda, viram alguém no meio de uma frase.
 */
function Digitando({ quem }: { quem: string }) {
    return (
        <div className="anim-surgir flex justify-start" aria-live="polite">

            <div className="flex items-center gap-2 rounded-xl border border-[var(--linha)] bg-[var(--superficie)] px-3.5 py-2.5">

                <span className="flex items-end gap-1" aria-hidden>
                    <span className="bolinha-digitando h-1.5 w-1.5 rounded-full bg-[var(--ink-3)]" />
                    <span className="bolinha-digitando h-1.5 w-1.5 rounded-full bg-[var(--ink-3)]" />
                    <span className="bolinha-digitando h-1.5 w-1.5 rounded-full bg-[var(--ink-3)]" />
                </span>

                <span className="text-xs text-[var(--ink-2)]">
                    {quem} está digitando
                </span>
            </div>
        </div>
    )
}

/** A hora da fala, no fuso de quem lê. */
function hora(quando: string): string {

    const data = new Date(quando)

    if (Number.isNaN(data.getTime())) return ""

    return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}
