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
}

export interface MensagemWhatsApp {
    id: number
    conversa_id: number
    direcao: "entrada" | "saida"
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

export async function listarConversas(): Promise<Conversa[]> {
    const dados = await apiFetch<{ conversas?: Conversa[] }>("/api/whatsapp/conversas")
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
    tipo: string
    conversa_id: number
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
 */
function enderecoDoFluxo(bilhete: string): string | null {

    let base = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080").trim().replace(/\/+$/, "")

    if (!ESQUEMA_DE_SOCKET.test(base)) return null

    if (typeof window !== "undefined" && window.location.protocol === "https:") {
        base = base.replace(/^ws:\/\//i, "wss://")
    }

    return `${base}/ws/whatsapp?bilhete=${encodeURIComponent(bilhete)}`
}

async function pedirBilhete(): Promise<string> {
    const dados = await apiFetch<{ bilhete: string }>("/api/whatsapp/bilhete", { method: "POST" })
    return dados.bilhete
}

/**
 * Mantém o fio ao vivo aberto e chama `aoAviso` a cada novidade.
 *
 * Devolve a função que fecha tudo — chame-a ao sair da tela, senão a conexão
 * sobrevive à navegação e cada volta abre mais uma.
 *
 * A reconexão é escrita aqui porque o WebSocket não a traz de fábrica (ao
 * contrário do EventSource): rede de loja cai, o servidor reinicia, o
 * notebook dorme. A espera cresce a cada tentativa até 30 segundos, para uma
 * queda longa não virar uma tentativa por segundo contra um servidor que já
 * está em apuros.
 */
export function escutarConversas(aoAviso: (aviso: AvisoAoVivo) => void): () => void {

    let fechado = false
    let socket: WebSocket | null = null
    let tentativas = 0
    let agendado: ReturnType<typeof setTimeout> | null = null

    async function conectar() {

        if (fechado) return

        try {
            const bilhete = await pedirBilhete()

            if (fechado) return

            const endereco = enderecoDoFluxo(bilhete)

            // Endereço mal configurado não melhora tentando de novo: em vez
            // de bater no servidor a cada 30 segundos para sempre, para por
            // aqui e a varredura de meio minuto da tela segura as conversas.
            if (endereco === null) {
                fechado = true
                return
            }

            const aberto = new WebSocket(endereco)
            socket = aberto

            aberto.onopen = () => {
                tentativas = 0
            }

            aberto.onmessage = (evento) => {
                try {
                    aoAviso(JSON.parse(evento.data) as AvisoAoVivo)
                } catch {
                    // Aviso ilegível não derruba a conexão: a varredura de
                    // segurança da tela cobre o que se perdeu.
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

    function reagendar() {

        if (fechado || agendado) return

        tentativas += 1

        const espera = Math.min(1000 * 2 ** (tentativas - 1), 30000)

        agendado = setTimeout(() => {
            agendado = null
            conectar()
        }, espera)
    }

    conectar()

    return () => {
        fechado = true

        if (agendado) clearTimeout(agendado)

        socket?.close()
        socket = null
    }
}
