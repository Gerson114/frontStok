/**
 * O som de "chegou coisa nova": pedido e mensagem, cada um com o seu.
 *
 * É preferência de QUEM ESTÁ NAQUELE NAVEGADOR, não da loja — o balcão pode
 * querer ouvir todo pedido novo, e o dono, numa reunião, pode querer
 * silêncio na mesma hora, no mesmo login. Por isso mora no `localStorage`
 * deste navegador, e não em `ConfiguracaoDaLoja` (ver middleware/configuracao):
 * aquilo é salvo no servidor e vale para qualquer tela que abrir a loja,
 * isto vale só para esta máquina.
 *
 * O som é sintetizado, não é um arquivo. A CSP do painel fecha o que carrega
 * de fora, e embutir um .mp3 como base64 só para dois bipes seria peso morto
 * no bundle por um som que dá para desenhar com duas linhas de osciladores.
 */

type TipoDeAviso = "pedido" | "mensagem"

const CHAVE: Record<TipoDeAviso, string> = {
    pedido: "chonnostech:som:pedido",
    mensagem: "chonnostech:som:mensagem",
}

/** Sem preferência salva ainda, o som vem ligado — é para isso que existe. */
export function somLigado(tipo: TipoDeAviso): boolean {
    if (typeof window === "undefined") return true

    const valor = window.localStorage.getItem(CHAVE[tipo])
    return valor === null ? true : valor === "1"
}

/*
 * Quem lê a chave (a tela de Configurações) precisa saber quando ela muda,
 * e `localStorage` não avisa a própria aba que escreveu — só as OUTRAS.
 * Este é o mecanismo mínimo para `useSyncExternalStore` funcionar aqui: sem
 * ele, virar a chave escrevia no disco mas a tela continuava mostrando o
 * estado antigo até a próxima navegação.
 */
type Ouvinte = () => void
const ouvintes = new Set<Ouvinte>()

export function assinarSom(ouvinte: Ouvinte): () => void {
    ouvintes.add(ouvinte)
    return () => ouvintes.delete(ouvinte)
}

export function salvarSomLigado(tipo: TipoDeAviso, ligado: boolean) {
    if (typeof window === "undefined") return

    window.localStorage.setItem(CHAVE[tipo], ligado ? "1" : "0")

    for (const ouvinte of ouvintes) ouvinte()
}

// Um só contexto de áudio por aba. Criar um a cada aviso soma latência e,
// em navegador que limita quantos ficam abertos ao mesmo tempo, esgota a
// cota depois de algumas dezenas de pedidos num dia de movimento.
let contexto: AudioContext | null = null

function contextoDeAudio(): AudioContext | null {

    if (typeof window === "undefined") return null

    const Construtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!Construtor) return null

    if (!contexto) contexto = new Construtor()

    // Todo navegador começa o contexto suspenso até um gesto do usuário.
    // Como o aviso chega pelo socket, sem clique nenhum no meio, o primeiro
    // som do dia só toca se algum clique ANTERIOR já tiver destravado o
    // contexto — o resume aqui é para não deixá-lo suspenso para sempre
    // depois desse primeiro gesto.
    if (contexto.state === "suspended") contexto.resume().catch(() => {})

    return contexto
}

/** Uma nota: sobe, sustenta um instante, desce — sem estalo no começo nem no fim. */
function nota(audio: AudioContext, frequencia: number, comecaEm: number, duracao: number) {

    const oscilador = audio.createOscillator()
    const ganho = audio.createGain()

    oscilador.type = "sine"
    oscilador.frequency.value = frequencia

    const inicio = audio.currentTime + comecaEm

    ganho.gain.setValueAtTime(0, inicio)
    ganho.gain.linearRampToValueAtTime(0.22, inicio + 0.02)
    ganho.gain.linearRampToValueAtTime(0, inicio + duracao)

    oscilador.connect(ganho)
    ganho.connect(audio.destination)

    oscilador.start(inicio)
    oscilador.stop(inicio + duracao + 0.02)
}

/**
 * Toca o som DESTE tipo, se a preferência estiver ligada.
 *
 * Pedido sobe (duas notas, a segunda mais aguda) porque é a notícia boa do
 * dia — venda entrando. Mensagem é uma nota só, mais curta e mais grave: é
 * frequente, e um som que chama tanto quanto o do pedido treinaria o ouvido
 * a ignorar os dois.
 */
export function tocarSom(tipo: TipoDeAviso) {

    if (!somLigado(tipo)) return

    const audio = contextoDeAudio()

    if (!audio) return

    if (tipo === "pedido") {
        nota(audio, 880, 0, 0.12)
        nota(audio, 1174, 0.1, 0.18)
    } else {
        nota(audio, 660, 0, 0.16)
    }
}
