// O WhatsApp da loja dentro do painel: o canal conectado, as conversas com
// os clientes e as respostas que o lojista escreve daqui.
//
// Tudo passa pelas rotas internas /api/whatsapp/*, como o resto do painel —
// o navegador nunca fala com o backend Go nem com a Meta diretamente.

import { apiFetch } from "./client"

/** Como está a conexão do WhatsApp desta loja. O token nunca vem. */
export interface CanalWhatsApp {
    conectado: boolean
    phone_number_id: string
    waba_id: string
    numero_exibicao: string
    ativo: boolean
}

export interface Conversa {
    id: number
    telefone: string
    nome: string
    ultima_mensagem_em: string
    ultima_entrada_em: string
    nao_lidas: number

    /** Se o cliente tem foto de perfil já baixada (ver urlDaFoto). */
    tem_foto: boolean

    /**
     * Se dá para responder com texto livre agora.
     *
     * A Meta só permite texto livre nas 24 horas seguintes à última mensagem
     * do cliente; passadas elas, só mensagem modelo aprovada. Quem calcula é
     * o servidor, e não esta tela: a regra depende da hora certa, e o relógio
     * do computador do lojista pode estar errado.
     */
    janela_aberta: boolean

    /**
     * De quem é este cliente.
     *
     * Vazio é conversa livre, que qualquer um da equipe pode pegar. Numa loja
     * com cinco pessoas atendendo, a conversa sem dono é a que todos leem e
     * ninguém responde — ou a que três respondem ao mesmo tempo dizendo
     * coisas diferentes.
     */
    responsavel_id?: number | null
    responsavel_nome?: string

    /**
     * Se este cliente é de QUEM está olhando a tela.
     *
     * Quem responde é o servidor, e não uma comparação feita aqui: o painel
     * não guarda em lugar nenhum a identidade de quem entrou, e comparar o
     * `responsavel_nome` com o nome escrito no canto da barra erraria em toda
     * loja com dois Joões. É este campo que separa as abas "Meus" e "Outros".
     */
    meu: boolean

    /** Os ids das etiquetas deste cliente. Vazia, nunca nula. */
    etiquetas: number[]

    /**
     * Quem paga esta conversa, segundo a regra da Meta: quem começa, paga.
     *
     *   "gratuita"  — o cliente escreveu nas últimas 24h. Responder não custa.
     *   "paga"      — a janela fechou. Falar de novo abre uma conversa nova,
     *                 e a Meta cobra pela entrega do modelo aprovado.
     *   "sem_custo" — a loja fala pelo aparelho vinculado (o QR). A Meta não
     *                 cobra por ele, e avisar de uma conta que não existe só
     *                 faria o lojista deixar de responder.
     *
     * Quem decide é o servidor: a regra depende da hora certa, e o relógio do
     * computador do lojista pode estar errado.
     */
    cobranca: "gratuita" | "paga" | "sem_custo"

    /** Quando a janela grátis fecha. Só vem quando ela está aberta e cobra. */
    janela_termina_em?: string | null

    /**
     * Em que pé está o atendimento — os mesmos quatro estados do chat do site:
     * livre (na fila, à vista de todos), atribuido (alguém pegou),
     * em_atendimento (começou) e encerrado (saiu da mesa).
     *
     * Encerrada não é fim: cliente que escreve de novo devolve a conversa à
     * fila, para a equipe inteira.
     */
    situacao: string
    iniciado_em?: string | null
    encerrado_em?: string | null
}

export interface MensagemWhatsApp {
    id: number
    conversa_id: number
    direcao: "entrada" | "saida"

    /** Quem da loja escreveu. Vazio nas mensagens do cliente e nas antigas. */
    ator?: string
    texto: string
    tipo: string
    status: "enfileirada" | "enviada" | "entregue" | "lida" | "falhou" | "recebida"
    erro?: string
    criada_em: string

    /**
     * Arquivo que veio junto (foto, áudio, vídeo, documento).
     *
     * O nome do arquivo no servidor nunca chega aqui: pede-se pelo id da
     * mensagem, e é o backend que decide se esta loja pode vê-lo.
     */
    tem_midia?: boolean
    midia_mime?: string
    midia_tamanho?: number
    midia_nome?: string
}

/** Onde buscar o arquivo de uma mensagem. */
export function urlDaMidia(mensagemId: number): string {
    return `/api/whatsapp/midia/${mensagemId}`
}

/** Onde buscar a foto de perfil do cliente de uma conversa. */
export function urlDaFoto(conversaId: number): string {
    return `/api/whatsapp/conversas/${conversaId}/foto`
}

/** A família do arquivo, para a tela saber como mostrá-lo. */
export function familiaDaMidia(mime?: string): "imagem" | "audio" | "video" | "arquivo" {

    const tipo = (mime ?? "").toLowerCase()

    // SVG de fora: o backend o serve como anexo justamente porque ele
    // executa script, e mostrá-lo numa tag de imagem aqui desfaria isso.
    if (tipo.startsWith("image/") && tipo !== "image/svg+xml") return "imagem"
    if (tipo.startsWith("audio/")) return "audio"
    if (tipo.startsWith("video/")) return "video"

    return "arquivo"
}

/** "1,4 MB" — o tamanho como se lê. */
export function tamanhoLegivel(bytes?: number): string {

    if (!bytes || bytes <= 0) return ""

    const unidades = ["B", "KB", "MB", "GB"]

    let valor = bytes
    let unidade = 0

    while (valor >= 1024 && unidade < unidades.length - 1) {
        valor /= 1024
        unidade += 1
    }

    return `${valor.toFixed(valor < 10 && unidade > 0 ? 1 : 0).replace(".", ",")} ${unidades[unidade]}`
}

export async function consultarCanal(): Promise<CanalWhatsApp> {
    const dados = await apiFetch<{ canal: CanalWhatsApp }>("/api/whatsapp/canal")
    return dados.canal
}

export async function salvarCanal(canal: {
    phone_number_id: string
    waba_id: string
    numero_exibicao: string
    token: string
}): Promise<CanalWhatsApp> {
    const dados = await apiFetch<{ canal: CanalWhatsApp }>("/api/whatsapp/canal", {
        method: "PUT",
        body: canal,
    })
    return dados.canal
}

export async function desconectarCanal(): Promise<void> {
    await apiFetch<{ mensagem: string }>("/api/whatsapp/canal", { method: "DELETE" })
}

/**
 * A lista que esta pessoa pode ver.
 *
 * Quem filtra é o servidor: o dono recebe tudo, e o funcionário recebe a fila
 * mais o que é dele. Com `encerradas`, vêm as que já saíram da mesa.
 */
export async function listarConversas(encerradas = false): Promise<Conversa[]> {
    const dados = await apiFetch<{ conversas?: Conversa[] }>(
        encerradas ? "/api/whatsapp/conversas?encerrados=1" : "/api/whatsapp/conversas",
    )
    return Array.isArray(dados.conversas) ? dados.conversas : []
}

export async function listarMensagens(conversaId: number): Promise<{
    conversa: Conversa
    mensagens: MensagemWhatsApp[]
}> {
    const dados = await apiFetch<{ conversa: Conversa; mensagens?: MensagemWhatsApp[] }>(
        `/api/whatsapp/conversas/${conversaId}/mensagens`
    )

    return {
        conversa: dados.conversa,
        mensagens: Array.isArray(dados.mensagens) ? dados.mensagens : [],
    }
}

export async function responder(conversaId: number, texto: string): Promise<MensagemWhatsApp> {
    const dados = await apiFetch<{ mensagem: MensagemWhatsApp }>(
        `/api/whatsapp/conversas/${conversaId}/mensagens`,
        { method: "POST", body: { texto } }
    )
    return dados.mensagem
}

export async function marcarLida(conversaId: number): Promise<void> {
    await apiFetch<{ mensagem: string }>(`/api/whatsapp/conversas/${conversaId}/lida`, {
        method: "POST",
    })
}

/**
 * O telefone como se lê: "+55 11 90000-0000".
 *
 * A Meta entrega em E.164 sem o "+" ("5511900000000"), que é o formato certo
 * para guardar e o errado para mostrar. Número que não casa com o formato
 * brasileiro volta como veio — a loja pode ter cliente de fora, e inventar
 * uma formatação errada é pior do que não formatar.
 */
export function formatarTelefone(bruto: string): string {

    const digitos = bruto.replace(/\D/g, "")

    const brasileiro = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digitos)

    if (!brasileiro) return bruto

    const [, ddd, comeco, fim] = brasileiro

    return `+55 ${ddd} ${comeco}-${fim}`
}

/**
 * Os dígitos de um telefone, no formato em que dois números podem ser
 * comparados.
 *
 * O mesmo cliente chega escrito de jeitos diferentes conforme a porta: o
 * WhatsApp entrega "5581999998888", e o lojista que lançou um pedido pelo
 * painel digitou "(81) 99999-8888". São o mesmo telefone, e sem tirar a
 * pontuação e o código do país eles nunca se encontram.
 *
 * O "55" só cai quando sobra número depois dele (mais de 11 dígitos): um
 * telefone que legitimamente comece com 55 no DDD não pode ser mutilado.
 */
export function digitosDoTelefone(bruto: string): string {

    const digitos = (bruto ?? "").replace(/\D/g, "")

    return digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos
}

/** Se dois telefones escritos de formas diferentes são o mesmo. */
export function mesmoTelefone(um: string, outro: string): boolean {

    const a = digitosDoTelefone(um)
    const b = digitosDoTelefone(outro)

    // Vazio nunca casa com vazio: pedido sem contato não é "o pedido desta
    // conversa" — é um pedido sem contato, e mostrá-lo aqui seria inventar um
    // vínculo que ninguém criou.
    return a !== "" && a === b
}

/** A hora da mensagem, curta — "14:32" hoje, "12/03 14:32" antes disso. */
export function horaDaMensagem(iso: string): string {

    const quando = new Date(iso)

    if (Number.isNaN(quando.getTime())) return ""

    const hoje = new Date()

    const mesmoDia =
        quando.getDate() === hoje.getDate() &&
        quando.getMonth() === hoje.getMonth() &&
        quando.getFullYear() === hoje.getFullYear()

    const hora = quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

    if (mesmoDia) return hora

    return `${quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`
}

/**
 * Só a hora — "14:32".
 *
 * É o que vai DENTRO da bolha. Diferente de horaDaMensagem, que também traz o
 * dia: no fio existe uma divisória de data acima de cada bloco, e repetir
 * "29/08" em cada bolha logo abaixo de um rótulo que já diz "29 de agosto" é
 * dizer duas vezes a mesma coisa no mesmo palmo de tela.
 */
export function horaExata(iso: string): string {

    const quando = new Date(iso)

    if (Number.isNaN(quando.getTime())) return ""

    return quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

/** Se duas mensagens caíram no mesmo dia — para saber onde entra a divisória. */
export function mesmoDia(umISO: string, outroISO: string): boolean {

    const um = new Date(umISO)
    const outro = new Date(outroISO)

    if (Number.isNaN(um.getTime()) || Number.isNaN(outro.getTime())) return true

    return (
        um.getDate() === outro.getDate() &&
        um.getMonth() === outro.getMonth() &&
        um.getFullYear() === outro.getFullYear()
    )
}

/**
 * O dia por extenso, como se fala: "Hoje", "Ontem", "12 de março".
 *
 * É o rótulo da divisória entre os dias do fio. Data cheia em toda divisória
 * faria o leitor calcular que "31/08" era ontem — a tela já sabe disso.
 */
export function diaDaMensagem(iso: string): string {

    const quando = new Date(iso)

    if (Number.isNaN(quando.getTime())) return ""

    const hoje = new Date()

    const ontem = new Date(hoje)
    ontem.setDate(hoje.getDate() - 1)

    if (mesmoDia(iso, hoje.toISOString())) return "Hoje"
    if (mesmoDia(iso, ontem.toISOString())) return "Ontem"

    // Ano só quando não é o corrente: em conversa de loja, quase tudo é
    // recente, e "12 de março de 2026" é ruído em cima do que já se sabe.
    const mostrarAno = quando.getFullYear() !== hoje.getFullYear()

    return quando.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        ...(mostrarAno ? { year: "numeric" } : {}),
    })
}

/* ==========================================================================
   Aparelho vinculado — o QR de "Aparelhos conectados"
   ========================================================================== */

/**
 * Como está o pareamento por QR desta loja.
 *
 * É o caminho que usa o WhatsApp comum do lojista, sem conta Business e sem
 * custo por conversa. Em troca, é protocolo não oficial: o número pode ser
 * banido pela Meta e a sessão cai de tempos em tempos, exigindo ler o QR de
 * novo. A tela diz isso ao lojista antes de ele conectar.
 */
export interface AparelhoWhatsApp {
    /** "desligado" | "esperando_leitura" | "conectado" | "erro" */
    estado: string
    conectado: boolean
    /** O QR de agora, já como imagem (data URI). Vazio fora do pareamento. */
    qr?: string
    numero: string
    erro: string
}

export async function consultarAparelho(): Promise<AparelhoWhatsApp> {
    const dados = await apiFetch<{ aparelho: AparelhoWhatsApp }>("/api/whatsapp/aparelho")
    return dados.aparelho
}

export async function gerarQR(): Promise<void> {
    await apiFetch<{ estado: string }>("/api/whatsapp/aparelho/parear", { method: "POST" })
}

export async function desvincularAparelho(): Promise<void> {
    await apiFetch<{ mensagem: string }>("/api/whatsapp/aparelho", { method: "DELETE" })
}

/**
 * Decide de quem é esta conversa.
 *
 * Sem argumentos, quem chama assume para si. `liberar` devolve a conversa à
 * fila. `funcionarioId` passa o cliente para outra pessoa — e isso o servidor
 * só aceita do dono da loja, porque tirar cliente da mão de outro atendente é
 * decisão de quem manda.
 */
/** Começa ou termina o atendimento desta conversa. */
export async function mudarSituacaoDaConversa(
    id: number,
    acao: "iniciar" | "encerrar",
): Promise<void> {
    await apiFetch(`/api/whatsapp/conversas/${id}/situacao`, {
        method: "POST",
        body: { acao },
    })
}

export async function definirResponsavelDaConversa(
    id: number,
    opcoes: { funcionarioId?: number; liberar?: boolean } = {},
): Promise<void> {
    await apiFetch(`/api/whatsapp/conversas/${id}/responsavel`, {
        method: "POST",
        body: {
            funcionario_id: opcoes.funcionarioId ?? null,
            liberar: opcoes.liberar ?? false,
        },
    })
}

/* ==========================================================================
   Entrega ao vivo
   ========================================================================== */

/**
 * Aviso que chega pelo WebSocket. É aviso, não conteúdo: diz que mexeu na
 * conversa, e quem busca a mensagem continua sendo a rota REST de sempre.
 *
 * Assim existe um formato só de resposta para manter, e a tela nunca monta o
 * fio fora de ordem por causa de um aviso que chegou na frente do outro.
 */
export interface AvisoAoVivo {
    /**
     * De que assunto é este aviso: "mensagem" e "conversa" (WhatsApp),
     * "atendimento" (chat do site) ou "pedido".
     *
     * É POR AQUI que os assuntos não se atrapalham. O socket é um só por
     * loja — abrir um por tela dobraria as conexões de cada painel aberto
     * para entregar a mesma coisa por canos diferentes —, então cada tela lê
     * o tipo primeiro e IGNORA o que não for dela. Uma tela que reagisse a
     * tudo recarregaria a lista de pedidos a cada mensagem de WhatsApp.
     */
    tipo: string

    /** Só nos avisos de conversa (WhatsApp e chat do site). */
    conversa_id?: number

    /** Só nos avisos de pedido. */
    pedido_id?: number

    /**
     * Só no aviso de "está digitando" da conversa da equipe: a sala em forma
     * opaca (ver SalaDaEquipe.token) e o nome de quem está escrevendo.
     */
    sala_token?: string
    quem?: string

    /** Nos avisos de pedido: "novo" ou "pago". */
    evento?: string
}

const ESQUEMA_DE_SOCKET = /^wss?:\/\//i

/**
 * De onde sai o endereço do socket. O backend não é a origem do painel.
 *
 * O bilhete viaja na própria URL — o navegador não deixa mandar cabeçalho ao
 * abrir um WebSocket, então não há outro lugar para pô-lo. Isso torna o
 * esquema da conexão parte da segurança e não da configuração: em ws:// o
 * bilhete e todas as conversas dos clientes atravessam a rede em texto puro,
 * legíveis por qualquer um no mesmo Wi-Fi da loja. Por isso, num painel
 * servido por HTTPS a conexão sobe para wss:// mesmo que a variável tenha
 * ficado como ws:// — que é também o que o navegador exige, já que ele
 * recusa socket em texto puro a partir de página segura.
 *
 * Devolve null quando NEXT_PUBLIC_WS_URL não é um endereço de socket. É
 * variável de ambiente: pode chegar em branco, com http:// no lugar de ws://
 * ou com um endereço colado errado, e um desses viraria uma conexão para
 * onde ninguém quis.
 *
 * A variável é a RAIZ do servidor, e o caminho do socket é acrescentado aqui.
 * Quem a preenche copiando o endereço completo — "wss://api.exemplo.com.br/ws/whatsapp"
 * — produziria "/ws/whatsapp/ws/whatsapp", que é um 404 do qual o WebSocket
 * não consegue reclamar: a tela apenas nunca recebe aviso nenhum e volta a
 * depender do recarregamento manual. Por isso o caminho que vier na variável
 * é descartado, em vez de concatenado.
 */
const CAMINHO_DO_FLUXO = "/ws/whatsapp"

function enderecoDoFluxo(bilhete: string): string | null {

    let base = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080").trim().replace(/\/+$/, "")

    if (!ESQUEMA_DE_SOCKET.test(base)) return null

    if (typeof window !== "undefined" && window.location.protocol === "https:") {
        base = base.replace(/^ws:\/\//i, "wss://")
    }

    let raiz: URL

    try {
        raiz = new URL(base)
    } catch {
        return null
    }

    if (raiz.pathname !== "/" && raiz.pathname !== "") {
        console.warn(
            `NEXT_PUBLIC_WS_URL traz um caminho (${raiz.pathname}) que foi descartado: a variável é a raiz do servidor, e ${CAMINHO_DO_FLUXO} é acrescentado pelo painel.`,
        )
    }

    return `${raiz.protocol}//${raiz.host}${CAMINHO_DO_FLUXO}?bilhete=${encodeURIComponent(bilhete)}`
}

async function pedirBilhete(): Promise<string> {
    const dados = await apiFetch<{ bilhete: string }>("/api/whatsapp/bilhete", { method: "POST" })
    return dados.bilhete
}

/**
 * Inscreve `aoAviso` no fio ao vivo da loja e devolve a função que o retira.
 *
 * É o canal da LOJA inteira, não só das conversas: por ele passam as
 * mensagens do WhatsApp, as do chat do site, os pedidos novos e a conversa
 * interna da equipe. Quem recebe filtra pelo `tipo` (ver AvisoAoVivo) — foi
 * para isso que o campo existe.
 *
 * A conexão é UMA por aba, compartilhada por todos os inscritos (ver o bloco
 * logo abaixo). Chame a função devolvida ao sair da tela: o fio só se fecha
 * quando o último ouvinte sai, e sem isso ele sobrevive à navegação.
 */
export function escutarLoja(aoAviso: (aviso: AvisoAoVivo) => void): () => void {

    ouvintes.add(aoAviso)

    // A primeira inscrição abre o fio; as seguintes pegam carona. Trocar de
    // tela dentro do painel também passa por aqui, então um fechamento que
    // acontecesse antes da inscrição seguinte derrubaria e reabriria o socket
    // a cada navegação — ver o desligamento adiado lá embaixo.
    if (encerrando) {
        clearTimeout(encerrando)
        encerrando = null
    }

    if (!socket && !agendado) conectar()

    return () => {

        ouvintes.delete(aoAviso)

        if (ouvintes.size > 0) return

        // Ninguém mais ouvindo — mas talvez a próxima tela se inscreva no
        // próximo instante. Esperar um pouco antes de desligar é o que
        // transforma "sair de Conversas e entrar em Pedidos" numa conexão
        // contínua em vez de um fecha-e-abre com pedido de bilhete no meio.
        encerrando = setTimeout(desligar, 5000)
    }
}

/* --------------------------------------------------------------------------
   O fio, um por aba

   Antes cada tela abria o seu. Com a barra superior contando as mensagens não
   lidas da equipe, a tela de conversas e a de funcionários ouvindo ao mesmo
   tempo, isso virou três e às vezes quatro sockets por aba entregando
   exatamente os mesmos avisos — cada um com o seu bilhete, a sua reconexão e
   o seu peso do lado do servidor.

   O canal é da LOJA e sempre foi (ver internal/services/whatsapp/fluxo.go, que
   publica para todos os ouvintes dela). Quem separa os assuntos é o campo
   `tipo` do aviso, lido por cada ouvinte. Então basta um fio, e cada tela se
   inscreve nele.
   -------------------------------------------------------------------------- */

const ouvintes = new Set<(aviso: AvisoAoVivo) => void>()

let socket: WebSocket | null = null
let tentativas = 0
let agendado: ReturnType<typeof setTimeout> | null = null
let encerrando: ReturnType<typeof setTimeout> | null = null

/** Desiste de vez: endereço mal configurado não melhora tentando de novo. */
let desistiu = false

/**
 * O fio está aberto E entregando?
 *
 * Existe para a varredura de segurança de cada tela saber em que mundo ela
 * está. As duas situações pedem ritmos opostos: com o fio de pé a mensagem
 * chega empurrada em menos de um segundo, e perguntar de novo é desperdício;
 * com o fio caído a varredura é a ÚNICA entrega que sobra, e meio minuto é
 * uma eternidade no meio de um atendimento.
 *
 * `readyState === OPEN` e não `socket !== null`: entre o `new WebSocket` e o
 * `onopen` existe o estado CONNECTING, e uma conexão que nunca completa —
 * endereço errado, servidor fora — fica ali sem nunca abrir. Tratar isso como
 * "de pé" devolveria justamente o caso que este teste existe para pegar.
 */
export function fioAberto(): boolean {
    return socket !== null && socket.readyState === WebSocket.OPEN
}

async function conectar() {

    if (desistiu || socket || ouvintes.size === 0) return

    try {
        const bilhete = await pedirBilhete()

        // Todo mundo saiu enquanto o bilhete vinha: não adianta abrir.
        if (ouvintes.size === 0) return

        const endereco = enderecoDoFluxo(bilhete)

        // Endereço mal configurado não melhora tentando de novo: em vez de
        // bater no servidor a cada 30 segundos para sempre, para por aqui e a
        // varredura de meio minuto de cada tela segura o que falta.
        if (endereco === null) {
            desistiu = true
            console.error(
                `Tempo real desligado: NEXT_PUBLIC_WS_URL (${process.env.NEXT_PUBLIC_WS_URL ?? "não definida"}) não é um endereço de WebSocket. O painel só vai se atualizar na varredura de 30 segundos.`,
            )
            return
        }

        const aberto = new WebSocket(endereco)
        socket = aberto

        aberto.onopen = () => {
            tentativas = 0
        }

        aberto.onmessage = (evento) => {

            let aviso: AvisoAoVivo

            try {
                aviso = JSON.parse(evento.data) as AvisoAoVivo
            } catch {
                // Aviso ilegível não derruba a conexão: a varredura de
                // segurança de cada tela cobre o que se perdeu.
                return
            }

            // Uma cópia da lista antes de entregar: um ouvinte que se
            // desinscreva ao receber o aviso — o que acontece quando ele
            // navega para outra tela — mudaria o conjunto no meio do laço.
            for (const ouvinte of [...ouvintes]) {
                try {
                    ouvinte(aviso)
                } catch {
                    // Uma tela que quebre ao tratar o aviso não pode impedir
                    // as outras de receberem o mesmo aviso.
                }
            }
        }

        aberto.onclose = () => {
            if (socket === aberto) socket = null
            reagendar()
        }

        // O erro sempre vem seguido de close, que é quem reagenda.
        aberto.onerror = () => aberto.close()

    } catch {
        reagendar()
    }
}

/**
 * A reconexão é escrita aqui porque o WebSocket não a traz de fábrica (ao
 * contrário do EventSource): rede de loja cai, o servidor reinicia, o notebook
 * dorme. A espera cresce a cada tentativa até 30 segundos, para uma queda
 * longa não virar uma tentativa por segundo contra um servidor que já está em
 * apuros.
 */

/**
 * Depois de quantas quedas seguidas o painel reclama no console.
 *
 * Existe por causa do modo de falha mais caro que este canal tem: uma
 * NEXT_PUBLIC_WS_URL sintaticamente correta e apontando para um servidor que
 * não existe — o endereço de exemplo que ninguém trocou. Não há erro de
 * digitação para o código recusar, então ele reconecta para sempre, em
 * silêncio, e a única pista que sobra é o lojista dizendo que precisa
 * recarregar a tela para ver o pedido. Cinco quedas seguidas nunca acontecem
 * numa queda de rede comum, que volta na primeira ou na segunda.
 */
const QUEDAS_ATE_RECLAMAR = 5

function reagendar() {

    if (desistiu || agendado || ouvintes.size === 0) return

    tentativas += 1

    if (tentativas === QUEDAS_ATE_RECLAMAR) {
        console.error(
            `Tempo real fora do ar: ${QUEDAS_ATE_RECLAMAR} tentativas seguidas de abrir o WebSocket falharam. Confira NEXT_PUBLIC_WS_URL (${process.env.NEXT_PUBLIC_WS_URL ?? "não definida"}) e se a API responde nesse endereço. Enquanto isso o painel depende da varredura de 30 segundos.`,
        )
    }

    const espera = Math.min(1000 * 2 ** (tentativas - 1), 30000)

    agendado = setTimeout(() => {
        agendado = null
        conectar()
    }, espera)
}

function desligar() {

    encerrando = null

    // Alguém se inscreveu enquanto o desligamento estava agendado.
    if (ouvintes.size > 0) return

    if (agendado) {
        clearTimeout(agendado)
        agendado = null
    }

    socket?.close()
    socket = null
    tentativas = 0
}

/* ==========================================================================
   O CRM: ETIQUETAS E NOTAS

   A etiqueta classifica o cliente e vira filtro na lista; a nota é o recado
   que a equipe lê e o cliente não. As duas penduram na conversa, que já é o
   contato — ela é única por (loja, telefone).
   ========================================================================== */

/** Uma etiqueta do catálogo da loja. */
export interface Etiqueta {
    id: number
    nome: string
    cor: CorDaEtiqueta
}

/**
 * As cores possíveis.
 *
 * Lista fechada, e não "#RRGGBB" livre: hexadecimal solto deixa escolher
 * amarelo claro sobre branco, e a etiqueta some. Quem traduz o nome para o
 * par de cores que tem contraste é a tela.
 */
export type CorDaEtiqueta = "cinza" | "azul" | "verde" | "amarela" | "vermelha" | "roxa"

export const CORES_DA_ETIQUETA: CorDaEtiqueta[] = [
    "cinza",
    "azul",
    "verde",
    "amarela",
    "vermelha",
    "roxa",
]

/** O par (fundo, texto) de cada cor, com contraste conferido sobre branco. */
export const TINTA_DA_ETIQUETA: Record<CorDaEtiqueta, { fundo: string; texto: string }> = {
    cinza: { fundo: "#EBEBEB", texto: "#616161" },
    azul: { fundo: "#EAF4FF", texto: "#00369B" },
    verde: { fundo: "#EAFBF1", texto: "#0C5132" },
    amarela: { fundo: "#FFF1E3", texto: "#5E4200" },
    vermelha: { fundo: "#FEE9E8", texto: "#8E1F0B" },
    roxa: { fundo: "#F0EDFB", texto: "#4A3AA7" },
}

/** Uma nota interna da equipe sobre o cliente. */
export interface NotaDaConversa {
    id: number
    autor_nome: string
    texto: string
    criada_em: string
}

export async function listarEtiquetas(): Promise<Etiqueta[]> {
    const dados = await apiFetch<{ etiquetas?: Etiqueta[] }>("/api/whatsapp/etiquetas")
    return Array.isArray(dados.etiquetas) ? dados.etiquetas : []
}

export async function criarEtiqueta(nome: string, cor: CorDaEtiqueta): Promise<Etiqueta> {
    const dados = await apiFetch<{ etiqueta: Etiqueta }>("/api/whatsapp/etiquetas", {
        method: "POST",
        body: { nome, cor },
    })
    return dados.etiqueta
}

export async function apagarEtiqueta(id: number): Promise<void> {
    await apiFetch(`/api/whatsapp/etiquetas/${id}`, { method: "DELETE" })
}

/**
 * Troca as etiquetas de um cliente pelas que vieram.
 *
 * A lista inteira de uma vez, e não "adicione esta" / "tire aquela": marcar e
 * desmarcar caixinhas gera uma rajada de pedidos que chegam fora de ordem, e
 * o resultado final passaria a depender de qual chegou por último.
 */
export async function marcarEtiquetas(conversaId: number, etiquetas: number[]): Promise<number[]> {
    const dados = await apiFetch<{ etiquetas?: number[] }>(
        `/api/whatsapp/conversas/${conversaId}/etiquetas`,
        { method: "PUT", body: { etiquetas } },
    )
    return Array.isArray(dados.etiquetas) ? dados.etiquetas : []
}

export async function listarNotas(conversaId: number): Promise<NotaDaConversa[]> {
    const dados = await apiFetch<{ notas?: NotaDaConversa[] }>(
        `/api/whatsapp/conversas/${conversaId}/notas`,
    )
    return Array.isArray(dados.notas) ? dados.notas : []
}

export async function criarNota(conversaId: number, texto: string): Promise<NotaDaConversa> {
    const dados = await apiFetch<{ nota: NotaDaConversa }>(
        `/api/whatsapp/conversas/${conversaId}/notas`,
        { method: "POST", body: { texto } },
    )
    return dados.nota
}

export async function apagarNota(conversaId: number, notaId: number): Promise<void> {
    await apiFetch(`/api/whatsapp/conversas/${conversaId}/notas/${notaId}`, { method: "DELETE" })
}

/**
 * Quanto falta da janela grátis, em palavras curtas ("3h12", "48min").
 *
 * Curto de propósito: isto vive dentro de uma etiqueta ao lado do nome do
 * cliente, e "3 horas e 12 minutos" empurraria o resto da linha para fora.
 * Devolve vazio quando não há relógio correndo — o que a tela usa para não
 * desenhar nada em vez de desenhar um traço.
 */
export function faltaDaJanela(terminaEm?: string | null): string {

    if (!terminaEm) return ""

    const restam = new Date(terminaEm).getTime() - Date.now()

    if (!Number.isFinite(restam) || restam <= 0) return ""

    const minutos = Math.floor(restam / 60000)

    if (minutos < 60) return `${minutos}min`

    const horas = Math.floor(minutos / 60)

    return `${horas}h${String(minutos % 60).padStart(2, "0")}`
}
