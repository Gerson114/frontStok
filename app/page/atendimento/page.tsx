"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FiMessageSquare, FiSend } from "react-icons/fi"
import { Pagina, Estado } from "@/app/components/pagina/pagina"
import {
    definirResponsavel,
    listarAtendimentos,
    mensagensDoAtendimento,
    mudarSituacao,
    responderAtendimento,
    avisarQueDigita,
    ATRIBUIDO,
    EM_ATENDIMENTO,
    ENCERRADO,
    LIVRE,
    type Atendimento,
    type MensagemAtendimento,
} from "@/middleware/atendimento"
import { consultarEquipe } from "@/middleware/funcionarios"
import type { Funcionario } from "@/app/type/type"
import { escutarLoja } from "@/middleware/whatsapp"

/**
 * O chat do site, do lado de quem atende.
 *
 * É a outra ponta do balão que o cliente abre na vitrine. Duas colunas: à
 * esquerda quem escreveu, com quem está esperando resposta em cima; à direita
 * o fio da conversa escolhida.
 *
 * Vive ao lado de Conversas (o WhatsApp) e não dentro dela de propósito: são
 * dois canais com regras diferentes — lá existe janela de 24 horas e um número
 * de telefone, aqui existe uma conta na loja e nenhuma janela. Misturá-los na
 * mesma lista faria o atendente descobrir a diferença errando.
 *
 * O fluxo é o de um balcão com fila. O cliente escreve e o fio entra na FILA,
 * que a equipe inteira enxerga. Alguém PEGA — e aí ele some da tela dos
 * outros, porque dois atendentes respondendo ao mesmo cliente é o pior
 * desfecho possível. Quem pegou INICIA quando senta para resolver e ENCERRA
 * quando acaba, e o fio sai da mesa. Se o cliente voltar a escrever, ele
 * reaparece na fila para todos: o assunto pode ser outro, e quem atendeu antes
 * pode nem estar trabalhando hoje.
 *
 * Quem vê o quê é decidido no servidor: o dono enxerga tudo — é ele que
 * precisa saber se alguém está sentado em cima de uma conversa parada há dois
 * dias — e o funcionário enxerga a fila mais o que é dele.
 *
 * O aviso de mensagem nova chega pelo mesmo socket das conversas: o servidor
 * publica "mexeu no atendimento 12", e a tela vai buscar. A varredura de meio
 * minuto continua por baixo, para o caso de o socket estar caído — é a
 * diferença entre uma conversa atrasar e uma conversa se perder.
 */

const VARREDURA = 30000

function horaDe(iso: string): string {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function quandoDe(iso: string): string {

    const data = new Date(iso)
    const hoje = new Date()

    const mesmoDia = data.toDateString() === hoje.toDateString()

    return mesmoDia
        ? horaDe(iso)
        : data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

export default function AtendimentoPage() {

    const [fios, setFios] = useState<Atendimento[]>([])
    const [escolhido, setEscolhido] = useState<number | null>(null)
    const [mensagens, setMensagens] = useState<MensagemAtendimento[]>([])
    const [texto, setTexto] = useState("")
    const [carregando, setCarregando] = useState(true)
    const [enviando, setEnviando] = useState(false)
    const [erro, setErro] = useState("")

    // O cliente está escrevendo agora? Vem na mesma consulta que a tela já
    // faz sozinha; o backend guarda o aviso em memória por três segundos (ver
    // services/atendimento/digitando.go).
    const [clienteDigitando, setClienteDigitando] = useState(false)

    const fim = useRef<HTMLDivElement | null>(null)
    const ultimoID = useRef(0)

    // Quando avisamos pela última vez que o ATENDENTE está digitando. Um aviso
    // a cada dois segundos, não um por tecla.
    const ultimoAviso = useRef(0)

    /**
     * A equipe, para o dono poder passar um cliente para alguém.
     *
     * Vem vazia para quem não é dono — a rota de funcionários exige dono, e a
     * recusa dela é a própria resposta: quem não pode transferir não vê o
     * seletor. A tela oferece o que o servidor permite, em vez de desenhar um
     * botão que vai levar 403.
     */
    const [equipe, setEquipe] = useState<Funcionario[]>([])

    // A mesa mostra o que está em aberto; as encerradas são histórico, e
    // vêm do servidor só quando alguém pede.
    const [verEncerradas, setVerEncerradas] = useState(false)

    const carregarLista = useCallback(async () => {
        try {
            setFios(await listarAtendimentos(verEncerradas))
            setErro("")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível carregar os atendimentos.")
        }
    }, [verEncerradas])

    const juntar = useCallback((novas: MensagemAtendimento[]) => {

        if (novas.length === 0) return

        setMensagens((atuais) => {
            // Por id, e não por ordem de chegada: a resposta do envio e a da
            // atualização podem trazer a mesma mensagem duas vezes.
            const vistas = new Set(atuais.map((mensagem) => mensagem.id))
            return [...atuais, ...novas.filter((mensagem) => !vistas.has(mensagem.id))]
        })

        ultimoID.current = Math.max(ultimoID.current, ...novas.map((mensagem) => mensagem.id))
    }, [])

    const carregarFio = useCallback(async (id: number, incremental: boolean) => {

        try {
            const resposta = await mensagensDoAtendimento(id, incremental ? ultimoID.current : 0)

            if (!incremental) {
                setMensagens([])
                ultimoID.current = 0
            }

            juntar(resposta.mensagens)
            setClienteDigitando(resposta.digitando)

        } catch (e) {
            if (!incremental) {
                setErro(e instanceof Error ? e.message : "Não foi possível abrir a conversa.")
            }
        }
    }, [juntar])

    useEffect(() => {

        let vivo = true

        async function buscarEquipe() {
            try {
                const dados = await consultarEquipe()
                if (vivo) setEquipe(dados.funcionarios.filter((pessoa) => pessoa.ativo))
            } catch {
                // Não é dono: segue sem o seletor de transferência.
            }
        }

        void buscarEquipe()

        return () => {
            vivo = false
        }
    }, [])

    // A lista, na entrada e de meio em meio minuto.
    useEffect(() => {

        let vivo = true

        // A primeira carga vive dentro do efeito: chamar direto a função de
        // fora faria o estado mudar no corpo do efeito e disparar uma
        // renderização em cascata.
        async function abrir() {
            await carregarLista()
            if (vivo) setCarregando(false)
        }

        void abrir()

        const relogio = setInterval(() => {
            void carregarLista()
        }, VARREDURA)

        return () => {
            vivo = false
            clearInterval(relogio)
        }
    }, [carregarLista])

    // O fio escolhido.
    useEffect(() => {

        if (escolhido === null) return

        let vivo = true

        async function abrirFio(id: number) {
            await carregarFio(id, false)

            // Abrir é ler: o servidor zera a bolinha, e a lista é relida
            // para a contagem sumir da tela também.
            if (vivo) await carregarLista()
        }

        void abrirFio(escolhido)

        return () => {
            vivo = false
        }
    }, [escolhido, carregarFio, carregarLista])

    // O aviso ao vivo. Mesmo socket das conversas de WhatsApp — o tipo é que
    // diz de qual assunto o aviso é, e o que não for deste é ignorado.
    useEffect(() => {

        const fechar = escutarLoja((aviso) => {

            if (aviso.tipo !== "atendimento") return

            void carregarLista()

            if (aviso.conversa_id === escolhido) {
                void carregarFio(aviso.conversa_id, true)
            }
        })

        return fechar
    }, [escolhido, carregarFio, carregarLista])

    useEffect(() => {
        fim.current?.scrollIntoView({ behavior: "smooth" })
    }, [mensagens])

    /**
     * Assume, larga ou passa o cliente.
     *
     * A recusa do servidor chega como mensagem pronta ("este cliente já está
     * sendo atendido por Helena") e é ela que a tela mostra: quem conhece a
     * regra é quem a aplica.
     */
    async function mudarResponsavel(opcoes: { funcionarioId?: number; liberar?: boolean }) {

        if (escolhido === null) return

        try {
            await definirResponsavel(escolhido, opcoes)
            await carregarLista()
            setErro("")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível mudar o responsável.")
        }
    }

    /**
     * Pega um cliente da fila: põe no seu nome e abre a conversa.
     *
     * Os dois num gesto só porque é um gesto só na cabeça de quem atende —
     * pegar para depois procurar a conversa na lista seria trabalho inventado.
     */
    async function pegar(id: number) {

        try {
            await definirResponsavel(id, {})
            setEscolhido(id)
            await carregarLista()
            setErro("")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível pegar a conversa.")
        }
    }

    /** Começa ou termina o atendimento do fio aberto. */
    async function moverSituacao(acao: "iniciar" | "encerrar") {

        if (escolhido === null) return

        try {
            await mudarSituacao(escolhido, acao)
            await carregarLista()
            setErro("")

            // Encerrar tira o fio da mesa: continuar com ele aberto na tela
            // seria oferecer um campo de resposta para uma conversa que
            // acabou.
            if (acao === "encerrar" && !verEncerradas) setEscolhido(null)

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível mudar a situação.")
        }
    }

    async function enviar(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault()

        const conteudo = texto.trim()

        if (!conteudo || escolhido === null || enviando) return

        setEnviando(true)

        try {
            juntar([await responderAtendimento(escolhido, conteudo)])
            setTexto("")
            void carregarLista()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível enviar a mensagem.")
        } finally {
            setEnviando(false)
        }
    }

    const aberto = fios.find((fio) => fio.id === escolhido) ?? null

    // A fila é o que ninguém pegou; a mesa é o resto do que o servidor mandou
    // — que para o funcionário é só o dele, e para o dono é o da equipe
    // inteira. A separação é feita aqui porque é desenho de tela: o filtro de
    // quem pode ver o quê já veio aplicado do servidor.
    const fila = fios.filter((fio) => fio.situacao === LIVRE)
    const naMesa = fios.filter((fio) => fio.situacao !== LIVRE)

    return (
        <Pagina
            titulo="Chat do site"
            descricao="O que os clientes perguntam de dentro da sua vitrine. Quem ninguém pegou fica na fila, à vista de toda a equipe."
            acoes={
                <button
                    type="button"
                    onClick={() => {
                        setVerEncerradas((atual) => !atual)
                        setEscolhido(null)
                    }}
                    className="btn btn-neutro"
                >
                    {verEncerradas ? "Ver os abertos" : "Ver encerrados"}
                </button>
            }
        >

            {erro && (
                <div role="alert" className="rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]">
                    {erro}
                </div>
            )}

            {carregando ? (
                <div className="card p-8 text-center text-sm text-[#616161]">
                    Carregando os atendimentos...
                </div>
            ) : fios.length === 0 ? (
                <Estado
                    Icone={FiMessageSquare}
                    titulo={verEncerradas ? "Nenhuma conversa encerrada" : "Ninguém na fila"}
                    texto={
                        verEncerradas
                            ? "Conversa encerrada continua guardada aqui. Se o cliente escrever de novo, ela volta sozinha para a fila."
                            : "O botão de conversa aparece em todas as páginas da sua vitrine. Quando um cliente escrever por lá, a conversa entra na fila — e quem estiver livre pega."
                    }
                />
            ) : (
                <div className="card grid min-h-[32rem] grid-cols-1 overflow-hidden lg:grid-cols-[20rem_minmax(0,1fr)]">

                    {/* QUEM ESCREVEU

                        Em dois blocos: a FILA, que é de todo mundo, e a MESA,
                        que é o que já tem dono. Separados porque a pergunta é
                        diferente — na fila se pergunta "tem alguém esperando?",
                        na mesa, "o que eu tenho para terminar?". */}
                    <div className="border-b border-[#E1E1E1] lg:max-h-[36rem] lg:overflow-y-auto lg:border-b-0 lg:border-r">

                        {fila.length > 0 && (
                            <p className="sticky top-0 z-10 border-b border-[#EBEBEB] bg-[#FFF1E3] px-4 py-2 text-[0.7rem] font-bold uppercase tracking-[0.06em] text-[#5E4200]">
                                Na fila · {fila.length}
                            </p>
                        )}

                        <ul className="divide-y divide-[#EBEBEB]">
                        {fila.map((fio) => (
                            <li key={fio.id}>
                                <button
                                    type="button"
                                    onClick={() => setEscolhido(fio.id)}
                                    className={`w-full px-4 py-3 text-left transition-colors ${
                                        fio.id === escolhido ? "bg-[#EAF4FF]" : "hover:bg-[#F7F7F7]"
                                    }`}
                                >
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="min-w-0 truncate text-sm font-semibold text-[#303030]">
                                            {fio.cliente_nome || "Cliente"}
                                        </span>

                                        <span className="num shrink-0 text-[0.7rem] text-[#8A8A8A]">
                                            {quandoDe(fio.ultima_mensagem_em)}
                                        </span>
                                    </div>

                                    <div className="mt-1 flex items-center justify-between gap-2">
                                        <span className="min-w-0 truncate text-xs text-[#616161]">
                                            {fio.ultimo_autor === "loja" ? "Você: " : ""}
                                            {fio.ultima_fala || "—"}
                                        </span>

                                        {fio.nao_lidas > 0 && (
                                            <span className="num shrink-0 rounded-full bg-[#005BD3] px-1.5 py-0.5 text-[0.65rem] font-bold text-white">
                                                {fio.nao_lidas}
                                            </span>
                                        )}
                                    </div>

                                </button>

                                {/* Pegar é o gesto da fila: tira o cliente de
                                    todo mundo, põe no seu nome e abre a
                                    conversa. Fica na própria linha para não
                                    exigir abrir para depois decidir. */}
                                <div className="flex justify-end px-4 pb-3">
                                    <button
                                        type="button"
                                        onClick={() => pegar(fio.id)}
                                        className="btn btn-primario px-3 py-1.5 text-xs"
                                    >
                                        pegar conversa
                                    </button>
                                </div>
                            </li>
                        ))}
                        </ul>

                        {naMesa.length > 0 && (
                            <p className="sticky top-0 z-10 border-y border-[#EBEBEB] bg-[#F7F7F7] px-4 py-2 text-[0.7rem] font-bold uppercase tracking-[0.06em] text-[#616161]">
                                Em atendimento · {naMesa.length}
                            </p>
                        )}

                        <ul className="divide-y divide-[#EBEBEB]">
                        {naMesa.map((fio) => (
                            <li key={fio.id}>
                                <button
                                    type="button"
                                    onClick={() => setEscolhido(fio.id)}
                                    className={`w-full px-4 py-3 text-left transition-colors ${
                                        fio.id === escolhido ? "bg-[#EAF4FF]" : "hover:bg-[#F7F7F7]"
                                    }`}
                                >
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="min-w-0 truncate text-sm font-semibold text-[#303030]">
                                            {fio.cliente_nome || "Cliente"}
                                        </span>

                                        <span className="num shrink-0 text-[0.7rem] text-[#8A8A8A]">
                                            {quandoDe(fio.ultima_mensagem_em)}
                                        </span>
                                    </div>

                                    <div className="mt-1 flex items-center justify-between gap-2">
                                        <span className="min-w-0 truncate text-xs text-[#616161]">
                                            {fio.ultimo_autor === "loja" ? "Você: " : ""}
                                            {fio.ultima_fala || "—"}
                                        </span>

                                        {fio.nao_lidas > 0 && (
                                            <span className="num shrink-0 rounded-full bg-[#005BD3] px-1.5 py-0.5 text-[0.65rem] font-bold text-white">
                                                {fio.nao_lidas}
                                            </span>
                                        )}
                                    </div>

                                    <p className="mt-1 flex items-center gap-1.5 text-[0.7rem] text-[#616161]">
                                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                                            fio.situacao === EM_ATENDIMENTO
                                                ? "bg-[#0C5132]"
                                                : fio.situacao === ENCERRADO
                                                    ? "bg-[#B5B5B5]"
                                                    : "bg-[#C7920A]"
                                        }`} aria-hidden />
                                        {fio.situacao === ENCERRADO
                                            ? "Encerrado"
                                            : fio.situacao === EM_ATENDIMENTO
                                                ? "Em atendimento"
                                                : "Pegou, não iniciou"}
                                        {fio.responsavel_nome ? ` · ${fio.responsavel_nome}` : ""}
                                    </p>
                                </button>
                            </li>
                        ))}
                        </ul>

                    </div>

                    {/* O FIO */}
                    <div className="flex min-h-[24rem] flex-col lg:max-h-[36rem]">

                        {aberto === null ? (
                            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-[#8A8A8A]">
                                Escolha uma conversa à esquerda.
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#E1E1E1] bg-[#F7F7F7] px-5 py-3">

                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-[#303030]">
                                            {aberto.cliente_nome || "Cliente"}
                                        </p>
                                        <p className="text-xs text-[#8A8A8A]">{aberto.cliente_contato}</p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">

                                        {/* Um passo de cada vez, e sempre o
                                            próximo: na fila só se pega; pego,
                                            só se inicia; iniciado, só se
                                            encerra. Três botões ao mesmo tempo
                                            fariam a pessoa escolher o que não
                                            há o que escolher. */}
                                        {aberto.situacao === LIVRE && (
                                            <button
                                                type="button"
                                                onClick={() => pegar(aberto.id)}
                                                className="btn btn-primario px-3 py-1.5 text-xs"
                                            >
                                                pegar conversa
                                            </button>
                                        )}

                                        {aberto.situacao === ATRIBUIDO && (
                                            <button
                                                type="button"
                                                onClick={() => moverSituacao("iniciar")}
                                                className="btn btn-primario px-3 py-1.5 text-xs"
                                            >
                                                iniciar atendimento
                                            </button>
                                        )}

                                        {aberto.situacao === EM_ATENDIMENTO && (
                                            <button
                                                type="button"
                                                onClick={() => moverSituacao("encerrar")}
                                                className="btn btn-secundario px-3 py-1.5 text-xs"
                                            >
                                                encerrar conversa
                                            </button>
                                        )}

                                        {aberto.situacao === ENCERRADO && (
                                            <>
                                                <span className="text-xs text-[#616161]">
                                                    Encerrado
                                                    {aberto.encerrado_em ? ` em ${quandoDe(aberto.encerrado_em)}` : ""}
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={() => moverSituacao("iniciar")}
                                                    className="btn btn-neutro px-3 py-1.5 text-xs"
                                                >
                                                    reabrir
                                                </button>
                                            </>
                                        )}

                                        {aberto.responsavel_nome && aberto.situacao !== ENCERRADO && (
                                            <>
                                                <span className="text-xs text-[#616161]">
                                                    com{" "}
                                                    <span className="font-semibold text-[#303030]">
                                                        {aberto.responsavel_nome}
                                                    </span>
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={() => mudarResponsavel({ liberar: true })}
                                                    className="text-xs text-[#616161] underline underline-offset-2 hover:text-[#303030]"
                                                >
                                                    devolver à fila
                                                </button>
                                            </>
                                        )}

                                        {/* Só o dono recebe a equipe (ver acima), e
                                            só ele pode passar um cliente adiante. */}
                                        {equipe.length > 0 && (
                                            <>
                                                <label className="sr-only" htmlFor="passar-para">
                                                    Passar para
                                                </label>

                                                <select
                                                    id="passar-para"
                                                    value=""
                                                    onChange={(e) => {
                                                        const escolha = Number(e.target.value)
                                                        if (escolha > 0) void mudarResponsavel({ funcionarioId: escolha })
                                                    }}
                                                    className="field cursor-pointer py-1.5 text-xs"
                                                >
                                                    <option value="">Passar para...</option>
                                                    {equipe.map((pessoa) => (
                                                        <option key={pessoa.id} value={pessoa.id}>
                                                            {pessoa.nome}
                                                        </option>
                                                    ))}
                                                </select>
                                            </>
                                        )}

                                    </div>

                                </div>

                                <div className="flex-1 space-y-2.5 overflow-y-auto px-5 py-4">

                                    {mensagens.map((mensagem) => {

                                        const daLoja = mensagem.autor === "loja"

                                        return (
                                            <div
                                                key={mensagem.id}
                                                className={`flex ${daLoja ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                                        daLoja
                                                            ? "bg-[#005BD3] text-white"
                                                            : "bg-[#F1F1F1] text-[#303030]"
                                                    }`}
                                                >
                                                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                                                        {mensagem.texto}
                                                    </p>

                                                    <p
                                                        className={`num mt-1 text-[0.65rem] ${
                                                            daLoja ? "text-white/70" : "text-[#8A8A8A]"
                                                        }`}
                                                    >
                                                        {/* Quem escreveu, do lado da loja: numa
                                                            equipe, "a loja disse" não basta —
                                                            foi alguém que disse. */}
                                                        {daLoja && mensagem.ator ? `${mensagem.ator} · ` : ""}
                                                        {horaDe(mensagem.criada_em)}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {/* As bolinhas nascem onde a resposta do
                                        cliente vai aparecer — é ali que o olho
                                        do atendente já está. */}
                                    {clienteDigitando ? (
                                        <div className="flex justify-start">
                                            <div className="rounded-lg bg-[#F1F1F1] px-3.5 py-3 text-[#616161]">
                                                <span className="digitando">
                                                    <span /><span /><span />
                                                </span>
                                                <span className="sr-only">O cliente está digitando</span>
                                            </div>
                                        </div>
                                    ) : null}

                                    <div ref={fim} />
                                </div>

                                <form onSubmit={enviar} className="flex items-end gap-2 border-t border-[#E1E1E1] p-3">
                                    <label className="sr-only" htmlFor="resposta">
                                        Sua resposta
                                    </label>

                                    <textarea
                                        id="resposta"
                                        value={texto}
                                        onChange={(e) => {
                                            setTexto(e.target.value)

                                            // Um aviso a cada dois segundos, e
                                            // só com texto de verdade: apagar o
                                            // que se escreveu não é escrever.
                                            const agora = Date.now()

                                            if (e.target.value.trim() && escolhido && agora - ultimoAviso.current >= 2000) {
                                                ultimoAviso.current = agora
                                                avisarQueDigita(escolhido)
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            // Enter envia, Shift+Enter quebra linha.
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault()
                                                e.currentTarget.form?.requestSubmit()
                                            }
                                        }}
                                        rows={1}
                                        maxLength={2000}
                                        placeholder="Escreva sua resposta"
                                        className="field max-h-32 min-h-[2.75rem] flex-1 resize-none py-2.5"
                                    />

                                    <button
                                        type="submit"
                                        disabled={enviando || !texto.trim()}
                                        className="btn btn-primario px-4 py-2.5 disabled:opacity-50"
                                    >
                                        <FiSend className="w-4" aria-hidden />
                                    </button>
                                </form>
                            </>
                        )}

                    </div>

                </div>
            )}

        </Pagina>
    )
}
