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
    definirResponsavelDaConversa,
    mudarSituacaoDaConversa,
    consultarAparelho,
    escutarLoja,
    diaDaMensagem,
    mesmoDia,
    mesmoTelefone,
    faltaDaJanela,
    listarEtiquetas,
    criarEtiqueta,
    apagarEtiqueta,
    marcarEtiquetas,
    listarNotas,
    criarNota,
    apagarNota,
    CORES_DA_ETIQUETA,
    TINTA_DA_ETIQUETA,
    type AparelhoWhatsApp,
    type CanalWhatsApp,
    type Conversa,
    type CorDaEtiqueta,
    type Etiqueta,
    type MensagemWhatsApp,
    type NotaDaConversa,
} from "@/middleware/whatsapp"
import { ApiError } from "@/middleware/client"
import { listarPedidos } from "@/middleware/pedidos"
import type { Funcionario, Pedido } from "@/app/type/type"
import ConectarWhatsApp from "@/app/components/whatsapp/conectar"
import ConectarPorQR from "@/app/components/whatsapp/qr"
import Bolha from "@/app/components/whatsapp/bolha"
import Avatar from "@/app/components/whatsapp/avatar"
import CaixaDeProdutos from "@/app/components/whatsapp/produtos"
import { consultarEquipe } from "@/middleware/funcionarios"
import { Pagina } from "@/app/components/pagina/pagina"
import {
    FiAlertCircle,
    FiAlertTriangle,
    FiBox,
    FiCheckCircle,
    FiMessageCircle,
    FiPlus,
    FiSearch,
    FiSend,
    FiSettings,
    FiShoppingCart,
    FiTrash2,
    FiX,
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

    /**
     * A equipe, para o dono poder passar um cliente para alguém.
     *
     * Chega vazia para quem não é dono: a rota de funcionários exige dono, e a
     * recusa dela é a própria resposta — quem não pode transferir não vê o
     * seletor.
     */
    const [equipe, setEquipe] = useState<Funcionario[]>([])

    /* ----------------------------------------------------------------
       A MESA DE ATENDIMENTO — referência: o Atendimento do helenaCRM.

       Três abas para o que está aberto, e uma pasta para o que já foi:

         Novos      ninguém pegou ainda. É a fila, e é de todo mundo.
         Meus       o que eu peguei.
         Outros     o que um colega pegou. Fica à vista de propósito —
                    é onde se consulta o histórico e se assume a conversa
                    de quem saiu para o almoço.
         Concluídos o histórico. Vem do servidor só quando alguém pede,
                    porque são todas as conversas que a loja já teve.

       A aba é estado local e não vai para o endereço: diferente de
       Configurações, aqui ninguém manda o link de uma aba para ninguém —
       a mesa é de quem está sentado nela.
       ---------------------------------------------------------------- */
    const [aba, setAba] = useState<"novos" | "meus" | "outros" | "concluidos">("novos")

    // Encerradas são histórico e vêm do servidor só quando alguém pede.
    const verEncerradas = aba === "concluidos"

    // Os filtros da lista, do helenaCRM: a ordem, o "só não lidas" e a
    // etiqueta. A etiqueta é o filtro que faz o catálogo valer a pena — sem
    // ele, marcar cliente é enfeite.
    const [ordem, setOrdem] = useState<"recentes" | "antigos">("recentes")
    const [soNaoLidas, setSoNaoLidas] = useState(false)
    const [filtroEtiqueta, setFiltroEtiqueta] = useState(0)

    /* ----------------------------------------------------------------
       O CRM: ETIQUETAS E NOTAS

       O catálogo é da loja e vem uma vez; as notas são de cada cliente e
       vêm quando a conversa abre. As duas coisas moram na ficha da direita.
       ---------------------------------------------------------------- */
    const [etiquetasDaLoja, setEtiquetasDaLoja] = useState<Etiqueta[]>([])
    const [escolhendoEtiqueta, setEscolhendoEtiqueta] = useState(false)
    const [nomeDaNova, setNomeDaNova] = useState("")
    const [corDaNova, setCorDaNova] = useState<CorDaEtiqueta>("azul")

    const [notas, setNotas] = useState<NotaDaConversa[]>([])
    const [notaNova, setNotaNova] = useState("")
    const [salvandoNota, setSalvandoNota] = useState(false)
    const [erroCrm, setErroCrm] = useState("")

    // O catálogo vem uma vez: ele muda quando alguém cria uma etiqueta, e
    // quem cria já acrescenta a nova à lista sem pedir tudo de novo.
    useEffect(() => {

        let vivo = true

        async function buscarEtiquetas() {
            try {
                const lista = await listarEtiquetas()
                if (vivo) setEtiquetasDaLoja(lista)
            } catch {
                // Silêncio: sem catálogo a ficha mostra só o botão de criar,
                // e um aviso vermelho no topo das conversas por causa disso
                // seria desproporcional.
            }
        }

        void buscarEtiquetas()

        return () => {
            vivo = false
        }
    }, [])

    /* Quem é dono recebe a equipe; quem não é recebe 403.
     *
     * O que responde "sou dono" é a consulta TER DADO CERTO, e não a lista
     * ter gente dentro. A diferença aparece na loja de uma pessoa só: ali o
     * dono recebe uma lista vazia, e medir pelo tamanho dela o fazia passar
     * por atendente no próprio painel — sem o botão de apagar etiqueta do
     * catálogo, que é dele. A rota exige dono, então chegar até aqui já é a
     * resposta. */
    const [ehDono, setEhDono] = useState(false)

    useEffect(() => {

        let vivo = true

        async function buscarEquipe() {
            try {
                const dados = await consultarEquipe()

                if (vivo) {
                    setEquipe(dados.funcionarios.filter((pessoa) => pessoa.ativo))
                    setEhDono(true)
                }
            } catch {
                // Não é dono.
            }
        }

        void buscarEquipe()

        return () => {
            vivo = false
        }
    }, [])
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
            .then((resposta) => {
                if (!cancelado) setPedidos(resposta.pedidos)
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

    /**
     * Tudo o que esta pessoa já comprou, do mais novo para o mais velho.
     *
     * É o que a coluna da direita mostra, e é o que separa esta tela de um
     * aplicativo de mensagem: quem atende responde diferente a quem comprou
     * seis vezes e a quem está escrevendo pela primeira vez.
     */
    const pedidosDoCliente = useMemo(() => {

        if (!aberta) return []

        return pedidos
            .filter((pedido) => mesmoTelefone(pedido.cliente_contato, aberta.telefone))
            .sort((a, b) => b.created_at.localeCompare(a.created_at))

    }, [pedidos, aberta])

    const atualizarConversas = useCallback(async () => {
        try {
            setConversas(await listarConversas(verEncerradas))
        } catch {
            // Silêncio de propósito: isto roda a cada cinco segundos, e um
            // aviso vermelho piscando por uma falha de rede momentânea seria
            // pior do que a lista ficar alguns segundos velha.
        }
    }, [verEncerradas])

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

        return escutarLoja((aviso) => {
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

        // A ficha da direita é de outro cliente até as notas dele chegarem —
        // e ler a nota do cliente errado é pior do que não ler nenhuma.
        setNotas([])
        setNotaNova("")
        setErroCrm("")
        setEscolhendoEtiqueta(false)

        void listarNotas(conversa.id)
            .then((lista) => {
                // Só se a conversa ainda for esta: numa lista clicada rápido,
                // a resposta da anterior chega depois da atual.
                setAbertaId((atual) => {
                    if (atual === conversa.id) setNotas(lista)
                    return atual
                })
            })
            .catch(() => {
                // Silêncio: a ficha mostra "nenhuma nota", que é o que a
                // pessoa vai fazer a respeito de qualquer jeito.
            })

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

    /**
     * Assume, larga ou passa o cliente.
     *
     * A recusa vem pronta do servidor ("este cliente já está sendo atendido
     * por Helena; peça ao dono da loja para transferir") e é ela que a tela
     * mostra: quem conhece a regra é quem a aplica.
     */
    async function mudarResponsavel(opcoes: { funcionarioId?: number; liberar?: boolean }) {

        if (abertaId === null) return

        try {
            await definirResponsavelDaConversa(abertaId, opcoes)

            // As duas: a lista, que mostra de quem é cada conversa, e o fio
            // aberto, cujo cabeçalho acabou de mudar de dono.
            await Promise.all([atualizarConversas(), atualizarFio(abertaId)])
            setErroEnvio("")
        } catch (erro) {
            setErroEnvio(erro instanceof ApiError ? erro.message : "Não foi possível mudar o responsável.")
        }
    }

    /**
     * Pega a conversa da fila E começa o atendimento, num clique.
     *
     * Eram dois passos: "pegar conversa" e depois "iniciar". Viraram um
     * porque ninguém pega um cliente da fila para deixá-lo esperando — quem
     * clica já está indo responder, e o passo do meio só servia para a
     * conversa ficar num estado que não é nem fila nem atendimento.
     *
     * O estado "atribuído" continua existindo no servidor, e é por isso que
     * o botão dele continua abaixo: o dono ainda pode empurrar um cliente
     * para alguém, e aí quem recebeu é que inicia.
     */
    async function iniciarAtendimento() {

        if (abertaId === null) return

        try {
            await definirResponsavelDaConversa(abertaId, {})
            await mudarSituacaoDaConversa(abertaId, "iniciar")
            await Promise.all([atualizarConversas(), atualizarFio(abertaId)])
            setErroEnvio("")
            setAba("meus")
        } catch (erro) {
            setErroEnvio(erro instanceof ApiError ? erro.message : "Não foi possível iniciar o atendimento.")
        }
    }

    /** Começa ou termina o atendimento da conversa aberta. */
    async function moverSituacao(acao: "iniciar" | "encerrar") {

        if (abertaId === null) return

        try {
            await mudarSituacaoDaConversa(abertaId, acao)
            await Promise.all([atualizarConversas(), atualizarFio(abertaId)])
            setErroEnvio("")
        } catch (erro) {
            setErroEnvio(erro instanceof ApiError ? erro.message : "Não foi possível mudar a situação.")
        }
    }

    /* ----------------------------------------------------------------
       AS AÇÕES DO CRM
       ---------------------------------------------------------------- */

    /** Marca ou desmarca uma etiqueta neste cliente. */
    async function alternarEtiqueta(etiquetaID: number) {

        if (!aberta) return

        const atuais = aberta.etiquetas ?? []

        const proximas = atuais.includes(etiquetaID)
            ? atuais.filter((umID) => umID !== etiquetaID)
            : [...atuais, etiquetaID]

        // Pinta antes de o servidor responder: marcar etiqueta é o tipo de
        // clique que se dá três vezes seguidas, e esperar a ida e a volta a
        // cada uma faria a ficha piscar.
        setAberta({ ...aberta, etiquetas: proximas })
        setErroCrm("")

        try {
            const gravadas = await marcarEtiquetas(aberta.id, proximas)
            setAberta((atual) => (atual && atual.id === aberta.id ? { ...atual, etiquetas: gravadas } : atual))
            await atualizarConversas()
        } catch (erro) {
            setAberta((atual) => (atual && atual.id === aberta.id ? { ...atual, etiquetas: atuais } : atual))
            setErroCrm(erro instanceof ApiError ? erro.message : "Não foi possível gravar a etiqueta.")
        }
    }

    /** Cria uma etiqueta no catálogo e já a marca neste cliente. */
    async function criarEMarcar(e: React.FormEvent<HTMLFormElement>) {

        e.preventDefault()

        const nome = nomeDaNova.trim()

        if (!nome || !aberta) return

        try {
            const nova = await criarEtiqueta(nome, corDaNova)

            setEtiquetasDaLoja((atual) => [...atual, nova].sort((a, b) => a.nome.localeCompare(b.nome)))
            setNomeDaNova("")

            await alternarEtiqueta(nova.id)
        } catch (erro) {
            setErroCrm(erro instanceof ApiError ? erro.message : "Não foi possível criar a etiqueta.")
        }
    }

    /** Tira a etiqueta do catálogo da loja, e de todos os clientes. */
    async function removerDoCatalogo(etiquetaID: number) {

        setErroCrm("")

        try {
            await apagarEtiqueta(etiquetaID)

            setEtiquetasDaLoja((atual) => atual.filter((uma) => uma.id !== etiquetaID))
            setAberta((atual) =>
                atual ? { ...atual, etiquetas: (atual.etiquetas ?? []).filter((umID) => umID !== etiquetaID) } : atual,
            )

            if (filtroEtiqueta === etiquetaID) setFiltroEtiqueta(0)

            await atualizarConversas()
        } catch (erro) {
            setErroCrm(erro instanceof ApiError ? erro.message : "Não foi possível apagar a etiqueta.")
        }
    }

    async function salvarNota(e: React.FormEvent<HTMLFormElement>) {

        e.preventDefault()

        const texto = notaNova.trim()

        if (!texto || !aberta) return

        setSalvandoNota(true)
        setErroCrm("")

        try {
            const nota = await criarNota(aberta.id, texto)
            setNotas((atual) => [nota, ...atual])
            setNotaNova("")
        } catch (erro) {
            setErroCrm(erro instanceof ApiError ? erro.message : "Não foi possível gravar a nota.")
        } finally {
            setSalvandoNota(false)
        }
    }

    async function removerNota(notaID: number) {

        if (!aberta) return

        setErroCrm("")

        try {
            await apagarNota(aberta.id, notaID)
            setNotas((atual) => atual.filter((uma) => uma.id !== notaID))
        } catch (erro) {
            setErroCrm(erro instanceof ApiError ? erro.message : "Não foi possível apagar a nota.")
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
            <Pagina titulo="Conversas">
                <div className="card p-8 text-center text-sm text-[var(--ink-2)]">
                    Carregando conversas...
                </div>
            </Pagina>
        )
    }

    if (erro) {
        return (
            <Pagina titulo="Conversas">
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[var(--vermelho-fundo)] px-4 py-3 text-sm font-semibold text-[var(--vermelho)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            </Pagina>
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
            <Pagina
                titulo="Conectar o WhatsApp da loja"
                descricao="O cliente escreve para o número da sua loja e você responde por aqui, sem sair do sistema. Cada loja usa a própria conta — ninguém lê a conversa de ninguém."
            >

                <ConectarPorQR
                    aoConectar={async () => {
                        setAparelho(await consultarAparelho())
                        setAjustando(false)
                    }}
                />

                <details className="card p-6 sm:p-7">
                    <summary className="cursor-pointer font-display text-lg text-[var(--ink)]">
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

            </Pagina>
        )
    }

    /* De que aba é esta conversa.
     *
     * Quando a aba é "Concluídos" a pergunta não se faz: o servidor já
     * devolveu só as encerradas, e uma encerrada não tem fila nem dono que
     * importe. */
    function daAba(conversa: Conversa): boolean {

        if (aba === "concluidos") return true
        if (aba === "novos") return !conversa.responsavel_id
        if (aba === "meus") return conversa.meu

        return Boolean(conversa.responsavel_id) && !conversa.meu
    }

    function achaNaBusca(conversa: Conversa): boolean {

        const termo = busca.trim().toLowerCase()

        if (!termo) return true

        return (
            conversa.nome.toLowerCase().includes(termo) ||
            conversa.telefone.includes(termo.replace(/\D/g, ""))
        )
    }

    /* Quantas esperam em cada aba.
     *
     * Só das abertas: "Concluídos" não ganha número porque a lista dele nem
     * está carregada — contar o que não se tem é inventar. */
    const quantas = {
        novos: conversas.filter((c) => !c.responsavel_id).length,
        meus: conversas.filter((c) => c.meu).length,
        outros: conversas.filter((c) => Boolean(c.responsavel_id) && !c.meu).length,
    }

    /* ----------------------------------------------------------------
       QUEM PODE ESCREVER

       Só fala quem iniciou o atendimento. Antes, responder uma conversa da
       fila era assumi-la sozinho: quem escrevesse virava o responsável. Era
       conveniente e estava errado numa mesa com mais de uma pessoa — dois
       atendentes abrem o mesmo cliente da fila, os dois respondem, e ele
       recebe duas respostas diferentes de gente que não sabia uma da outra.

       Esta trava é a da TELA. A de verdade está no servidor, que recusa o
       envio com 409 (ver Responder, em services/whatsapp/conversas.go) — o
       que impede a aba esquecida aberta desde ontem de mandar mensagem numa
       conversa que já mudou de mão.

       `meu === false` e não `!meu` de propósito: num servidor antigo o campo
       não vem, e aí a tela trava só o que é inequívoco (não iniciado e
       concluído) em vez de trancar tudo.
       ---------------------------------------------------------------- */
    /**
     * Quem paga esta conversa.
     *
     * Vem do servidor, que é quem tem a hora certa. O cálculo local é a
     * reserva para o caso de a resposta ainda não trazer o campo — e ele
     * chega ao mesmo veredito com o que a tela já sabe, em vez de mostrar
     * "cobrado" quando na verdade é grátis. Errar para o lado de assustar
     * com uma conta que não existe é o pior dos dois erros: o lojista deixa
     * de responder o cliente.
     */
    function cobrancaDa(conversa: Conversa): "gratuita" | "paga" | "sem_custo" {

        if (conversa.cobranca) return conversa.cobranca
        if (aparelho?.conectado) return "sem_custo"

        return conversa.janela_aberta ? "gratuita" : "paga"
    }

    const souDono = ehDono

    const travado: "nao_iniciado" | "encerrado" | "de_outro" | null =
        aberta === null
            ? null
            : aberta.situacao === "encerrado"
                ? "encerrado"
                : aberta.situacao !== "em_atendimento"
                    ? "nao_iniciado"
                    : aberta.meu === false && !souDono
                        ? "de_outro"
                        : null

    const filtradas = conversas
        .filter(daAba)
        .filter(achaNaBusca)
        .filter((conversa) => !soNaoLidas || conversa.nao_lidas > 0)
        .filter((conversa) => filtroEtiqueta === 0 || (conversa.etiquetas ?? []).includes(filtroEtiqueta))
        // O servidor já devolve da mais recente para a mais antiga; "mais
        // antigos primeiro" é a mesma lista ao contrário, e serve a quem
        // atende por ordem de chegada em vez de por quem falou por último.
        .slice()
        .sort((a, b) =>
            ordem === "antigos"
                ? a.ultima_mensagem_em.localeCompare(b.ultima_mensagem_em)
                : b.ultima_mensagem_em.localeCompare(a.ultima_mensagem_em),
        )

    return (
        // Altura da janela inteira, e não o miolo centrado do resto do painel:
        // conversa é tela de trabalho, e o lojista fica nela o dia todo. Cada
        // linha a menos na lista é um cliente que ele precisa rolar para achar.
        // A largura também vai inteira — as duas colunas crescem com a tela em
        // vez de deixarem faixas vazias dos lados.
        <main className="com-menu flex h-[calc(100dvh-3.5rem)] flex-col bg-[var(--fundo)] px-4 pb-4 pt-5 md:px-6">

            <div className="flex flex-wrap items-end justify-between gap-3">

                <div>
                    <h1 className="font-display text-2xl text-[var(--ink)]">Conversas</h1>

                    <p className="mt-1 text-sm text-[var(--ink-2)]">
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

            {/* Três colunas, a anatomia do Atendimento do helenaCRM: a lista
                de conversas, o fio aberto e os dados de quem está do outro
                lado. A terceira só entra em tela larga — abaixo disso ela
                comeria a largura do fio, que é onde o trabalho acontece, e o
                que ela mostra (pedidos do cliente) já está resumido na
                etiqueta ao lado do nome, no topo do fio. */}
            <div className="card mt-4 grid min-h-0 flex-1 overflow-hidden md:grid-cols-[20rem_1fr] lg:grid-cols-[22rem_1fr] xl:grid-cols-[22rem_1fr_19rem]">

                {/* ==========================
                    LISTA
                ========================== */}

                <div className="flex min-h-0 flex-col border-b border-[var(--linha-suave)] md:border-b-0 md:border-r">

                    <div className="border-b border-[var(--linha-suave)] p-3">
                        <div className="relative">
                            <FiSearch className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[var(--ink-3)]" aria-hidden />

                            <input
                                className="field pl-9"
                                placeholder="Buscar cliente"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                            />
                        </div>

                    </div>

                    {/* ----------------------------------------------------
                        AS ABAS

                        Fila, minhas, dos colegas e o histórico. A contagem
                        fica na aba e não numa legenda ao lado: o número
                        existe para decidir QUAL aba abrir, então tem de
                        estar na coisa que se clica.
                        ---------------------------------------------------- */}
                    <div
                        role="tablist"
                        aria-label="Situação do atendimento"
                        className="flex border-b border-[var(--linha-suave)] px-1"
                    >
                        {([
                            { id: "novos", nome: "Novos", conta: quantas.novos },
                            { id: "meus", nome: "Meus", conta: quantas.meus },
                            { id: "outros", nome: "Outros", conta: quantas.outros },
                            { id: "concluidos", nome: "Concluídos", conta: 0 },
                        ] as const).map((uma) => {

                            const nesta = aba === uma.id

                            return (
                                <button
                                    key={uma.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={nesta}
                                    onClick={() => {
                                        setAba(uma.id)
                                        setAbertaId(null)
                                        setAberta(null)
                                    }}
                                    className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-1 py-2.5 text-xs transition-colors ${
                                        nesta
                                            ? "border-[var(--azul)] font-bold text-[var(--azul)]"
                                            : "border-transparent font-medium text-[var(--ink-2)] hover:text-[var(--ink)]"
                                    }`}
                                >
                                    {uma.nome}

                                    {uma.conta > 0 && (
                                        <span
                                            className={`num rounded-full px-1.5 text-[0.625rem] font-bold leading-[1.05rem] ${
                                                nesta ? "bg-[var(--azul)] text-white" : "bg-[var(--linha)] text-[var(--ink-2)]"
                                            }`}
                                        >
                                            {uma.conta}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* ----------------------------------------------------
                        OS FILTROS

                        Dois, e não os seis do helenaCRM: canal, etiqueta,
                        usuário e equipe pressupõem várias caixas de entrada,
                        etiquetas cadastradas e equipes montadas — nada disso
                        existe aqui ainda, e filtro que só tem uma opção é
                        um controle que ocupa espaço para não fazer nada.
                        ---------------------------------------------------- */}
                    <div className="flex items-center gap-2 border-b border-[var(--linha-suave)] px-3 py-2">

                        <label className="sr-only" htmlFor="ordem-da-lista">Ordem</label>

                        <select
                            id="ordem-da-lista"
                            value={ordem}
                            onChange={(e) => setOrdem(e.target.value as "recentes" | "antigos")}
                            className="field cursor-pointer py-1 text-[0.6875rem]"
                        >
                            <option value="recentes">Últimas interações</option>
                            <option value="antigos">Mais antigos primeiro</option>
                        </select>

                        {/* Só aparece quando há o que filtrar: um seletor com
                            uma opção só é um controle que ocupa espaço para não
                            fazer nada. */}
                        {etiquetasDaLoja.length > 0 && (
                            <>
                                <label className="sr-only" htmlFor="filtro-etiqueta">Etiqueta</label>

                                <select
                                    id="filtro-etiqueta"
                                    value={filtroEtiqueta}
                                    onChange={(e) => setFiltroEtiqueta(Number(e.target.value))}
                                    className="field cursor-pointer py-1 text-[0.6875rem]"
                                >
                                    <option value={0}>Todas as etiquetas</option>
                                    {etiquetasDaLoja.map((uma) => (
                                        <option key={uma.id} value={uma.id}>
                                            {uma.nome}
                                        </option>
                                    ))}
                                </select>
                            </>
                        )}

                        <button
                            type="button"
                            aria-pressed={soNaoLidas}
                            onClick={() => setSoNaoLidas((atual) => !atual)}
                            className={`ml-auto shrink-0 border px-2 py-1 text-[0.6875rem] font-semibold transition-colors ${
                                soNaoLidas
                                    ? "border-[var(--azul)] bg-[var(--azul-suave)] text-[var(--azul)]"
                                    : "border-[var(--linha)] text-[var(--ink-2)] hover:bg-[var(--fundo)]"
                            }`}
                        >
                            Não lidas
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">

                        {filtradas.length === 0 && (
                            <div className="p-6 text-center text-sm text-[var(--ink-2)]">
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
                                            <p className="mt-3 text-xs text-[var(--ink-3)]">
                                                As conversas que já estavam no celular só vêm no
                                                momento em que o aparelho é conectado. Se você
                                                conectou antes desta versão, desvincule e leia o QR
                                                de novo em{" "}
                                                <button
                                                    type="button"
                                                    onClick={() => setAjustando(true)}
                                                    className="font-semibold text-[var(--azul)] hover:underline"
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

                        <ul className="divide-y divide-[var(--fundo)]">
                            {filtradas.map((conversa) => (
                                <li key={conversa.id}>
                                    <button
                                        type="button"
                                        onClick={() => abrirConversa(conversa)}
                                        aria-current={conversa.id === abertaId ? "true" : undefined}
                                        className={`relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                                            conversa.id === abertaId
                                                ? "bg-[var(--azul-suave)]"
                                                : conversa.nao_lidas > 0
                                                    ? "bg-[var(--azul-suave)] hover:bg-[var(--fundo)]"
                                                    : "hover:bg-[var(--superficie-2)]"
                                        }`}
                                    >
                                        {/* Barra na borda em vez de fundo inteiro: diz qual
                                            está aberta sem competir com a bolinha de não lidas. */}
                                        {conversa.id === abertaId && (
                                            <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--azul)]" />
                                        )}

                                        <Avatar
                                            conversaId={conversa.id}
                                            nome={conversa.nome || conversa.telefone}
                                            temFoto={conversa.tem_foto}
                                        />

                                        <span className="min-w-0 flex-1">
                                            <span
                                                className={`block truncate text-sm text-[var(--ink)] ${
                                                    conversa.nao_lidas > 0 ? "font-extrabold" : "font-semibold"
                                                }`}
                                            >
                                                {conversa.nome.trim() || formatarTelefone(conversa.telefone)}
                                            </span>
                                            {/* Só quando há nome: sem ele a linha de
                                                cima JÁ é o telefone, e repeti-lo
                                                embaixo enche a linha sem informar. */}
                                            {conversa.nome.trim() && (
                                                <span className="num block truncate text-xs text-[var(--ink-3)]">
                                                    {formatarTelefone(conversa.telefone)}
                                                </span>
                                            )}

                                            {/* Na fila é o que ninguém pegou —
                                                e o que qualquer um pode pegar
                                                sem passar por cima de ninguém.
                                                O nome de quem está atendendo
                                                aparece porque o dono enxerga a
                                                equipe inteira aqui. */}
                                            <span className="mt-0.5 block truncate text-[0.68rem]">
                                                {conversa.situacao === "livre" ? (
                                                    <span className="font-semibold text-[var(--amarelo)]">Na fila</span>
                                                ) : conversa.situacao === "encerrado" ? (
                                                    <span className="text-[var(--ink-3)]">Encerrada</span>
                                                ) : (
                                                    <span className="text-[var(--ink-2)]">
                                                        {conversa.situacao === "em_atendimento" ? "Atendendo" : "Pegou"}
                                                        {conversa.responsavel_nome ? ` · ${conversa.responsavel_nome}` : ""}
                                                    </span>
                                                )}
                                            </span>
                                        </span>

                                        <span className="flex shrink-0 flex-col items-end gap-1.5">
                                            <span
                                                className={`num text-[0.68rem] ${
                                                    conversa.nao_lidas > 0 ? "font-bold text-[var(--azul)]" : "text-[var(--ink-3)]"
                                                }`}
                                            >
                                                {horaDaMensagem(conversa.ultima_mensagem_em)}
                                            </span>

                                            {conversa.nao_lidas > 0 ? (
                                                <span className="num flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--azul)] px-1.5 text-[0.68rem] font-bold text-white">
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
                            <FiMessageCircle className="w-8 text-[var(--ink-4)]" aria-hidden />
                            <p className="text-sm text-[var(--ink-2)]">
                                Escolha uma conversa à esquerda.
                            </p>
                        </div>

                    ) : (
                        <>
                            <div className="flex items-center gap-3 border-b border-[var(--linha-suave)] bg-[var(--superficie)] px-5 py-3">

                                <Avatar
                                    conversaId={aberta.id}
                                    nome={aberta.nome || aberta.telefone}
                                    temFoto={aberta.tem_foto}
                                    tamanho="h-11 w-11"
                                />

                                <div className="min-w-0 flex-1">

                                    <div className="flex items-center gap-2">

                                        <p className="truncate font-display text-[1.05rem] leading-tight text-[var(--ink)]">
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
                                                className="num inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--azul-suave)] px-2.5 py-0.5 text-[0.68rem] font-bold text-[var(--azul-escuro)] transition-colors hover:bg-[#CDE3FF]"
                                            >
                                                <FiShoppingCart className="w-3" aria-hidden />
                                                {pedidoDaConversa.codigo}
                                            </Link>
                                        )}

                                    </div>

                                    <p className="num truncate text-xs text-[var(--ink-3)]">
                                        {formatarTelefone(aberta.telefone)}
                                        {aberta.responsavel_nome ? (
                                            <span className="text-[var(--ink-2)]">
                                                {" · atendendo: "}
                                                <span className="font-semibold">{aberta.responsavel_nome}</span>
                                            </span>
                                        ) : null}
                                    </p>
                                </div>

                                {/* De quem é este cliente.
                                    Numa equipe, conversa sem dono é a que todos
                                    leem e ninguém responde — ou a que três
                                    respondem ao mesmo tempo dizendo coisas
                                    diferentes. Tirar cliente da mão de outro é
                                    decisão do dono, e é o servidor que recusa. */}
                                <div className="hidden shrink-0 items-center gap-2 sm:flex">

                                    {/* Um passo de cada vez, e sempre o
                                        próximo: na fila se inicia; iniciada,
                                        se transfere ou se conclui. */}
                                    {aberta.situacao === "livre" && (
                                        <button
                                            type="button"
                                            onClick={() => iniciarAtendimento()}
                                            className="btn btn-primario px-3 py-1.5 text-xs"
                                        >
                                            <FiMessageCircle className="w-3.5" aria-hidden />
                                            Iniciar
                                        </button>
                                    )}

                                    {aberta.situacao === "atribuido" && (
                                        <button
                                            type="button"
                                            onClick={() => moverSituacao("iniciar")}
                                            className="btn btn-primario px-3 py-1.5 text-xs"
                                        >
                                            <FiMessageCircle className="w-3.5" aria-hidden />
                                            Iniciar
                                        </button>
                                    )}

                                    {aberta.situacao === "em_atendimento" && (
                                        <button
                                            type="button"
                                            onClick={() => moverSituacao("encerrar")}
                                            className="btn btn-neutro px-3 py-1.5 text-xs"
                                        >
                                            <FiCheckCircle className="w-3.5" aria-hidden />
                                            Concluir
                                        </button>
                                    )}

                                    {aberta.situacao === "encerrado" && (
                                        <button
                                            type="button"
                                            onClick={() => moverSituacao("iniciar")}
                                            className="btn btn-neutro px-3 py-1.5 text-xs"
                                        >
                                            Reabrir
                                        </button>
                                    )}

                                    {aberta.responsavel_nome && aberta.situacao !== "encerrado" && (
                                        <button
                                            type="button"
                                            onClick={() => mudarResponsavel({ liberar: true })}
                                            className="text-xs text-[var(--ink-2)] underline underline-offset-2 hover:text-[var(--ink)]"
                                        >
                                            devolver à fila
                                        </button>
                                    )}

                                    {equipe.length > 0 && (
                                        <>
                                            <label className="sr-only" htmlFor="passar-conversa">
                                                Transferir para
                                            </label>

                                            <select
                                                id="passar-conversa"
                                                value=""
                                                onChange={(e) => {
                                                    const escolha = Number(e.target.value)
                                                    if (escolha > 0) void mudarResponsavel({ funcionarioId: escolha })
                                                }}
                                                className="field cursor-pointer py-1.5 text-xs"
                                            >
                                                <option value="">Transferir para…</option>
                                                {equipe.map((pessoa) => (
                                                    <option key={pessoa.id} value={pessoa.id}>
                                                        {pessoa.nome}
                                                    </option>
                                                ))}
                                            </select>
                                        </>
                                    )}

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

                                {/* QUEM PAGA, no topo e não escondido num relatório.

                                    Dizia "Pode responder" / "Fora das 24h", que é a
                                    regra e não a consequência. A consequência é a
                                    que muda o que a pessoa faz: "respondo agora ou
                                    amanhã" é outra pergunta quando amanhã custa
                                    dinheiro. O relógio ao lado é o que transforma o
                                    aviso em decisão — grátis por mais 3h12 é uma
                                    informação sobre a qual dá para agir.

                                    Pelo aparelho vinculado não há cobrança nenhuma,
                                    e a etiqueta some: falar de conta onde não há
                                    conta faria o lojista deixar de responder. */}
                                {cobrancaDa(aberta) !== "sem_custo" && (
                                    <span
                                        title={
                                            cobrancaDa(aberta) === "gratuita"
                                                ? "O cliente escreveu primeiro, então esta conversa não é cobrada pela Meta."
                                                : "A janela grátis fechou. Falar de novo abre uma conversa nova, e a Meta cobra por ela."
                                        }
                                        className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold sm:inline-flex ${
                                            cobrancaDa(aberta) === "gratuita"
                                                ? "bg-[var(--verde-suave)] text-[var(--verde)]"
                                                : "bg-[var(--amarelo-fundo)] text-[var(--amarelo)]"
                                        }`}
                                    >
                                        <span
                                            aria-hidden
                                            className={`h-1.5 w-1.5 rounded-full ${
                                                cobrancaDa(aberta) === "gratuita" ? "bg-[var(--verde)]" : "bg-[var(--amarelo)]"
                                            }`}
                                        />

                                        {cobrancaDa(aberta) === "gratuita" ? (
                                            <>
                                                Grátis
                                                {faltaDaJanela(aberta.janela_termina_em) &&
                                                    ` por ${faltaDaJanela(aberta.janela_termina_em)}`}
                                            </>
                                        ) : (
                                            "Falar agora é cobrado"
                                        )}
                                    </span>
                                )}

                            </div>

                            <div className="fio-conversa flex-1 overflow-y-auto px-4 py-4">

                                {mensagens.length === 0 && (
                                    <p className="py-8 text-center text-sm text-[var(--ink-3)]">
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
                                                    <span className="rounded-full bg-[var(--superficie)] px-3 py-1 text-[0.68rem] font-bold text-[var(--ink-2)] shadow-sm ring-1 ring-[var(--linha-suave)]">
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

                            {/* O custo avisado ANTES de escrever, e não depois no
                                erro do envio. */}
                            {!aberta.janela_aberta && (
                                <div className="flex items-start gap-2 border-t border-[var(--linha-suave)] bg-[var(--amarelo-fundo)] px-4 py-2.5 text-xs text-[var(--amarelo)]">
                                    <FiAlertTriangle className="mt-0.5 w-3.5 shrink-0" aria-hidden />

                                    {cobrancaDa(aberta) === "paga" ? (
                                        <span>
                                            <strong className="font-bold">Começar esta conversa é cobrado.</strong>{" "}
                                            Faz mais de 24 horas que este cliente não escreve, então quem
                                            recomeça é você — e a Meta cobra pela entrega. Só sai com
                                            mensagem modelo aprovada; o envio livre vai ser recusado.
                                            Se ele escrever primeiro, as 24 horas seguintes não custam nada.
                                        </span>
                                    ) : (
                                        <span>
                                            Faz mais de 24 horas que este cliente não escreve. O WhatsApp
                                            só deixa recomeçar a conversa com uma mensagem modelo aprovada
                                            pela Meta — o envio livre vai ser recusado.
                                        </span>
                                    )}
                                </div>
                            )}

                            {erroEnvio && (
                                <div role="alert" className="border-t border-[var(--linha-suave)] bg-[var(--vermelho-fundo)] px-4 py-2.5 text-xs font-semibold text-[var(--vermelho)]">
                                    {erroEnvio}
                                </div>
                            )}

                            {/* A caixa de produtos abre entre o fio e o campo de
                                escrever, que é o caminho da mão: procurar a unidade,
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

                            {/* No lugar da caixa de escrever, o que falta fazer
                                para poder escrever. Caixa desabilitada sem dizer
                                por quê é a pior das três opções: quem clica nela
                                conclui que o sistema travou. */}
                            {travado !== null ? (

                                <div className="flex flex-wrap items-center justify-center gap-3 border-t border-[var(--linha-suave)] bg-[var(--superficie-2)] px-4 py-4 text-center">

                                    {travado === "de_outro" ? (
                                        <p className="text-xs text-[var(--ink-2)]">
                                            <span className="font-semibold text-[var(--ink)]">
                                                {aberta.responsavel_nome}
                                            </span>{" "}
                                            está atendendo este cliente. Você pode ler a conversa,
                                            mas quem responde é quem iniciou.
                                        </p>
                                    ) : travado === "encerrado" ? (
                                        <>
                                            <p className="text-xs text-[var(--ink-2)]">
                                                Este atendimento foi concluído.
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() => moverSituacao("iniciar")}
                                                className="btn btn-neutro"
                                            >
                                                Reabrir
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-xs text-[var(--ink-2)]">
                                                Inicie o atendimento para responder este cliente.
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    aberta.situacao === "livre"
                                                        ? iniciarAtendimento()
                                                        : moverSituacao("iniciar")
                                                }
                                                className="btn btn-primario"
                                            >
                                                <FiMessageCircle className="w-4" aria-hidden />
                                                Iniciar atendimento
                                            </button>
                                        </>
                                    )}

                                </div>

                            ) : (

                            <form onSubmit={enviar} className="flex items-end gap-2 border-t border-[var(--linha-suave)] bg-[var(--superficie)] p-3">

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
                                            ? "border-[var(--azul)] bg-[var(--azul-suave)] text-[var(--azul-escuro)]"
                                            : "border-[var(--linha)] bg-[var(--superficie)] text-[var(--ink-2)] hover:bg-[var(--fundo)]"
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
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--azul)] text-white transition-colors hover:bg-[var(--azul-escuro)] disabled:opacity-40"
                                >
                                    <FiSend className="w-[1.05rem]" aria-hidden />
                                </button>
                            </form>

                            )}
                        </>
                    )}

                </div>

                {/* ==========================
                    DADOS DO CONTATO
                ========================== */}

                <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-[var(--linha-suave)] bg-[var(--superficie-2)] xl:flex">

                    {aberta === null ? (
                        <p className="p-6 text-center text-xs text-[var(--ink-3)]">
                            Os dados do cliente aparecem aqui quando você abrir uma conversa.
                        </p>
                    ) : (
                        <>
                            <div className="flex flex-col items-center gap-2 border-b border-[var(--linha-suave)] px-5 py-6 text-center">
                                <Avatar
                                    conversaId={aberta.id}
                                    nome={aberta.nome || aberta.telefone}
                                    temFoto={aberta.tem_foto}
                                    tamanho="h-16 w-16"
                                />

                                <p className="font-display mt-1 text-sm text-[var(--ink)]">
                                    {aberta.nome.trim() || formatarTelefone(aberta.telefone)}
                                </p>

                                <a
                                    href={`https://wa.me/${aberta.telefone.replace(/\D/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="num text-xs text-[var(--azul)] hover:underline"
                                >
                                    {formatarTelefone(aberta.telefone)}
                                </a>
                            </div>

                            <Bloco titulo="Atendimento">
                                <Dado nome="Situação">
                                    {aberta.situacao === "livre"
                                        ? "Na fila"
                                        : aberta.situacao === "atribuido"
                                            ? "Atribuído"
                                            : aberta.situacao === "em_atendimento"
                                                ? "Em andamento"
                                                : "Concluído"}
                                </Dado>

                                <Dado nome="Responsável">
                                    {aberta.responsavel_nome || "ninguém ainda"}
                                </Dado>

                                <Dado nome="Canal">
                                    {aparelho?.conectado ? "WhatsApp (aparelho)" : "WhatsApp"}
                                </Dado>

                                {/* A janela de 24h da Meta é a regra que decide se
                                    ainda dá para escrever texto livre. Ela já está
                                    no topo do fio; aqui ela aparece escrita, porque
                                    quem está lendo a ficha do cliente está decidindo
                                    o que fazer com ele — e "não dá mais para falar"
                                    muda essa decisão. */}
                                <Dado nome="Resposta livre">
                                    {aberta.janela_aberta ? "liberada" : "fora da janela de 24h"}
                                </Dado>

                                {/* Quem paga, escrito com todas as letras na ficha.
                                    No topo do fio cabe uma etiqueta de três palavras;
                                    aqui cabe a frase que explica por quê. */}
                                <Dado nome="Cobrança">
                                    {cobrancaDa(aberta) === "sem_custo"
                                        ? "não se aplica"
                                        : cobrancaDa(aberta) === "gratuita"
                                            ? `grátis${
                                                faltaDaJanela(aberta.janela_termina_em)
                                                    ? ` por ${faltaDaJanela(aberta.janela_termina_em)}`
                                                    : ""
                                            }`
                                            : "você paga para recomeçar"}
                                </Dado>
                            </Bloco>

                            {/* ----------------------------------------------
                                ETIQUETAS

                                Logo abaixo do nome, e não no fim da ficha: é a
                                primeira coisa que se quer saber sobre um cliente
                                que já passou por aqui, e a única que a lista da
                                esquerda consegue filtrar.
                                ---------------------------------------------- */}
                            <Bloco titulo="Etiquetas">

                                <div className="flex flex-wrap items-center gap-1.5">

                                    {(aberta.etiquetas ?? []).map((umID) => {

                                        const etiqueta = etiquetasDaLoja.find((uma) => uma.id === umID)

                                        if (!etiqueta) return null

                                        const tinta = TINTA_DA_ETIQUETA[etiqueta.cor] ?? TINTA_DA_ETIQUETA.cinza

                                        return (
                                            <button
                                                key={umID}
                                                type="button"
                                                onClick={() => alternarEtiqueta(umID)}
                                                title={`Tirar "${etiqueta.nome}" deste cliente`}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.6875rem] font-semibold transition-opacity hover:opacity-70"
                                                style={{ background: tinta.fundo, color: tinta.texto }}
                                            >
                                                {etiqueta.nome}
                                                <FiX className="w-3" aria-hidden />
                                            </button>
                                        )
                                    })}

                                    <button
                                        type="button"
                                        onClick={() => setEscolhendoEtiqueta((atual) => !atual)}
                                        className="inline-flex items-center gap-1 border border-dashed border-[var(--ink-4)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--ink-2)] transition-colors hover:border-[var(--azul)] hover:text-[var(--azul)]"
                                    >
                                        <FiPlus className="w-3" aria-hidden />
                                        Etiqueta
                                    </button>
                                </div>

                                {escolhendoEtiqueta && (
                                    <div className="mt-3 border border-[var(--linha)] bg-[var(--superficie)] p-2">

                                        {etiquetasDaLoja.length > 0 && (
                                            <ul className="mb-2 max-h-40 space-y-0.5 overflow-y-auto">
                                                {etiquetasDaLoja.map((uma) => {

                                                    const marcada = (aberta.etiquetas ?? []).includes(uma.id)
                                                    const tinta = TINTA_DA_ETIQUETA[uma.cor] ?? TINTA_DA_ETIQUETA.cinza

                                                    return (
                                                        <li key={uma.id} className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => alternarEtiqueta(uma.id)}
                                                                className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-left transition-colors hover:bg-[var(--superficie-2)]"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={marcada}
                                                                    readOnly
                                                                    tabIndex={-1}
                                                                    className="h-3.5 w-3.5 shrink-0 accent-[var(--azul)]"
                                                                />

                                                                <span
                                                                    className="truncate px-1.5 py-0.5 text-[0.6875rem] font-semibold"
                                                                    style={{ background: tinta.fundo, color: tinta.texto }}
                                                                >
                                                                    {uma.nome}
                                                                </span>
                                                            </button>

                                                            {/* Apagar do CATÁLOGO, e não deste cliente:
                                                                some da loja inteira, de todos os
                                                                clientes, sem volta. Por isso é do
                                                                dono — quem responde por meses de
                                                                organização apagados num clique não
                                                                é o atendente que passava por ali.
                                                                Quem recusa de verdade é o servidor;
                                                                aqui o botão só não aparece, para o
                                                                atendente não clicar num 403. */}
                                                            {souDono && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removerDoCatalogo(uma.id)}
                                                                title={`Apagar "${uma.nome}" da loja inteira`}
                                                                aria-label={`Apagar a etiqueta ${uma.nome} da loja inteira`}
                                                                className="shrink-0 p-1 text-[var(--ink-4)] transition-colors hover:text-[var(--vermelho)]"
                                                            >
                                                                <FiTrash2 className="w-3.5" aria-hidden />
                                                            </button>
                                                            )}
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        )}

                                        <form onSubmit={criarEMarcar} className="flex items-center gap-1.5 border-t border-[var(--linha-suave)] pt-2">

                                            <label className="sr-only" htmlFor="cor-da-etiqueta">Cor</label>

                                            <select
                                                id="cor-da-etiqueta"
                                                value={corDaNova}
                                                onChange={(e) => setCorDaNova(e.target.value as CorDaEtiqueta)}
                                                className="field w-20 cursor-pointer py-1 text-[0.6875rem]"
                                            >
                                                {CORES_DA_ETIQUETA.map((cor) => (
                                                    <option key={cor} value={cor}>
                                                        {cor}
                                                    </option>
                                                ))}
                                            </select>

                                            <input
                                                value={nomeDaNova}
                                                onChange={(e) => setNomeDaNova(e.target.value)}
                                                maxLength={40}
                                                placeholder="Nova etiqueta"
                                                className="field min-w-0 flex-1 py-1 text-[0.6875rem]"
                                            />

                                            <button
                                                type="submit"
                                                disabled={!nomeDaNova.trim()}
                                                className="btn btn-primario shrink-0 px-2 py-1 text-[0.6875rem]"
                                            >
                                                Criar
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </Bloco>

                            {/* ----------------------------------------------
                                NOTAS INTERNAS

                                Nunca saem para o WhatsApp — é o ponto inteiro
                                delas, e por isso está escrito na tela: quem não
                                tem certeza disso não escreve nada aqui.
                                ---------------------------------------------- */}
                            <Bloco titulo="Notas internas">

                                {/* Anotar é agir na conversa, e age quem iniciou —
                                    a mesma porta de responder. LER continua livre:
                                    o histórico é justamente o que o próximo
                                    atendente precisa antes de começar, e escondê-lo
                                    aqui esvaziaria a ficha na única hora em que ela
                                    serve. */}
                                {travado !== null ? (

                                    <p className="mb-3 border border-dashed border-[var(--linha)] px-2.5 py-2 text-[0.6875rem] leading-relaxed text-[var(--ink-3)]">
                                        {travado === "de_outro"
                                            ? `Quem anota é quem atende. Este cliente é de ${aberta.responsavel_nome}.`
                                            : travado === "encerrado"
                                                ? "Atendimento concluído. Reabra para anotar."
                                                : "Inicie o atendimento para anotar sobre este cliente."}
                                    </p>

                                ) : (

                                <form onSubmit={salvarNota} className="mb-3">
                                    <textarea
                                        rows={2}
                                        value={notaNova}
                                        onChange={(e) => setNotaNova(e.target.value)}
                                        maxLength={1000}
                                        placeholder="O que a equipe precisa saber sobre este cliente"
                                        className="field resize-none text-xs"
                                    />

                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                        <span className="text-[0.625rem] text-[var(--ink-3)]">
                                            O cliente não vê.
                                        </span>

                                        <button
                                            type="submit"
                                            disabled={salvandoNota || !notaNova.trim()}
                                            className="btn btn-neutro px-2 py-1 text-[0.6875rem]"
                                        >
                                            {salvandoNota ? "Salvando…" : "Salvar nota"}
                                        </button>
                                    </div>
                                </form>

                                )}

                                {notas.length === 0 ? (
                                    <p className="text-xs text-[var(--ink-3)]">Nenhuma nota ainda.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {notas.map((nota) => (
                                            <li key={nota.id} className="group border-l-2 border-[#FFD79D] bg-[var(--superficie)] px-2.5 py-2">

                                                <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--ink)]">
                                                    {nota.texto}
                                                </p>

                                                <div className="mt-1 flex items-center justify-between gap-2">
                                                    <span className="truncate text-[0.625rem] text-[var(--ink-3)]">
                                                        {nota.autor_nome || "alguém da equipe"} · {horaDaMensagem(nota.criada_em)}
                                                    </span>

                                                    <button
                                                        type="button"
                                                        onClick={() => removerNota(nota.id)}
                                                        aria-label="Apagar esta nota"
                                                        className="shrink-0 p-0.5 text-[var(--ink-4)] opacity-0 transition-opacity hover:text-[var(--vermelho)] focus:opacity-100 group-hover:opacity-100"
                                                    >
                                                        <FiTrash2 className="w-3" aria-hidden />
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Bloco>

                            {erroCrm && (
                                <div role="alert" className="border-b border-[var(--linha-suave)] bg-[var(--vermelho-fundo)] px-5 py-2.5 text-xs font-semibold text-[var(--vermelho)]">
                                    {erroCrm}
                                </div>
                            )}

                            <Bloco titulo={`Pedidos (${pedidosDoCliente.length})`}>

                                {pedidosDoCliente.length === 0 ? (
                                    <p className="py-1 text-xs text-[var(--ink-3)]">
                                        Este cliente ainda não comprou.
                                    </p>
                                ) : (
                                    <ul className="-mx-1 space-y-0.5">
                                        {pedidosDoCliente.slice(0, 8).map((pedido) => (
                                            <li key={pedido.id}>
                                                <Link
                                                    href="/page/pedidos"
                                                    className="flex items-center justify-between gap-2 px-1 py-1.5 transition-colors hover:bg-[var(--linha-suave)]"
                                                >
                                                    <span className="min-w-0">
                                                        <span className="num block text-xs font-semibold text-[var(--ink)]">
                                                            {pedido.codigo}
                                                        </span>
                                                        <span className="block truncate text-[0.6875rem] text-[var(--ink-3)]">
                                                            {pedido.status}
                                                        </span>
                                                    </span>

                                                    <span className="num shrink-0 text-xs font-semibold text-[var(--ink)]">
                                                        {(pedido.total ?? 0).toLocaleString("pt-BR", {
                                                            style: "currency",
                                                            currency: "BRL",
                                                        })}
                                                    </span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Bloco>
                        </>
                    )}

                </aside>

            </div>

        </main>
    )
}

/** Um bloco da ficha do contato: título pequeno e o conteúdo embaixo. */
function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <div className="border-b border-[var(--linha-suave)] px-5 py-4 last:border-b-0">
            <p className="mb-2 text-[0.625rem] font-bold text-[var(--ink-3)]">
                {titulo}
            </p>
            {children}
        </div>
    )
}

/** Uma linha da ficha: o nome do campo à esquerda, o valor à direita. */
function Dado({ nome, children }: { nome: string; children: React.ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-1">
            <span className="shrink-0 text-xs text-[var(--ink-2)]">{nome}</span>
            <span className="truncate text-right text-xs font-semibold text-[var(--ink)]">
                {children}
            </span>
        </div>
    )
}
