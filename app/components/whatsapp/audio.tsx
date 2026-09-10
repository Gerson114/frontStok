"use client"

import { useEffect, useRef, useState } from "react"
import { FiPause, FiPlay } from "react-icons/fi"

/**
 * O tocador de uma nota de voz.
 *
 * Escrito no lugar do <audio controls> do navegador por duas razões. A
 * primeira é que aquele controle tem cara de navegador, não de conversa: cada
 * um desenha o seu, e nenhum combina com a bolha. A segunda é o tamanho — ele
 * ocupa uma faixa larga e cinza dentro de uma bolha azul, e numa lista de
 * mensagens isso vira uma barra atravessada a cada áudio.
 *
 * Aqui é só o que a nota de voz precisa: tocar, pausar, ver onde está e
 * quanto falta. Arrastar funciona porque o servidor responde a Range (ver
 * servirArquivo no backend); sem isso, a barra andaria e o som voltaria ao
 * início.
 */
export default function Audio({ src, minha }: { src: string; minha: boolean }) {

    const toca = useRef<HTMLAudioElement>(null)

    const [tocando, setTocando] = useState(false)
    const [posicao, setPosicao] = useState(0)
    const [duracao, setDuracao] = useState(0)

    // A duração só existe depois que o navegador lê o cabeçalho do arquivo, e
    // nota de voz em ogg às vezes chega com duração infinita até terminar de
    // carregar — daí conferir se é finita antes de mostrar.
    useEffect(() => {
        const el = toca.current

        if (!el) return

        const aoCarregar = () => setDuracao(Number.isFinite(el.duration) ? el.duration : 0)
        const aoAndar = () => setPosicao(el.currentTime)
        const aoAcabar = () => { setTocando(false); setPosicao(0) }

        el.addEventListener("loadedmetadata", aoCarregar)
        el.addEventListener("durationchange", aoCarregar)
        el.addEventListener("timeupdate", aoAndar)
        el.addEventListener("ended", aoAcabar)
        el.addEventListener("pause", () => setTocando(false))
        el.addEventListener("play", () => setTocando(true))

        return () => {
            el.removeEventListener("loadedmetadata", aoCarregar)
            el.removeEventListener("durationchange", aoCarregar)
            el.removeEventListener("timeupdate", aoAndar)
            el.removeEventListener("ended", aoAcabar)
        }
    }, [])

    function alternar() {
        const el = toca.current

        if (!el) return

        if (el.paused) {
            el.play().catch(() => setTocando(false))
        } else {
            el.pause()
        }
    }

    function irPara(segundo: number) {
        const el = toca.current

        if (el) {
            el.currentTime = segundo
            setPosicao(segundo)
        }
    }

    const total = duracao || 0
    const restante = total > 0 ? Math.max(0, total - posicao) : 0

    return (
        <div className="flex w-60 max-w-full items-center gap-2.5">

            <audio ref={toca} src={src} preload="metadata" className="hidden" />

            <button
                type="button"
                onClick={alternar}
                aria-label={tocando ? "Pausar" : "Tocar"}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                    minha
                        ? "bg-white/20 text-white hover:bg-white/30"
                        : "bg-[#005BD3] text-white hover:bg-[#00369B]"
                }`}
            >
                {tocando
                    ? <FiPause className="w-4" aria-hidden />
                    : <FiPlay className="ml-0.5 w-4" aria-hidden />}
            </button>

            <div className="min-w-0 flex-1">
                <input
                    type="range"
                    min={0}
                    max={total || 1}
                    step={0.1}
                    value={posicao}
                    onChange={(e) => irPara(Number(e.target.value))}
                    aria-label="Posição do áudio"
                    className={`h-1 w-full cursor-pointer appearance-none rounded-full ${
                        minha ? "audio-linha-clara" : "audio-linha-escura"
                    }`}
                    style={{
                        // O preenchido à esquerda do cursor: é o que dá a
                        // leitura de "quanto já passou" sem um segundo elemento.
                        background: `linear-gradient(to right, ${
                            minha ? "#ffffff" : "#005BD3"
                        } ${total ? (posicao / total) * 100 : 0}%, ${
                            minha ? "rgba(255,255,255,0.3)" : "#E1E1E1"
                        } ${total ? (posicao / total) * 100 : 0}%)`,
                    }}
                />

                <span
                    className={`num mt-1 block text-[0.68rem] ${
                        minha ? "text-white/75" : "text-[#8A8A8A]"
                    }`}
                >
                    {total > 0 ? relogio(tocando || posicao > 0 ? restante : total) : "--:--"}
                </span>
            </div>
        </div>
    )
}

/** Segundos como "1:07". */
function relogio(segundos: number): string {

    if (!Number.isFinite(segundos) || segundos < 0) return "0:00"

    const inteiros = Math.floor(segundos)
    const minutos = Math.floor(inteiros / 60)

    return `${minutos}:${String(inteiros % 60).padStart(2, "0")}`
}
