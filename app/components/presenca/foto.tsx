"use client"

import { useRef, useState } from "react"
import { FiCamera, FiImage, FiTrash2 } from "react-icons/fi"

import { removerMinhaFoto, trocarMinhaFoto } from "@/middleware/eu"

/**
 * O botão de trocar a própria foto de perfil.
 *
 * Duas entradas, e não uma: "Tirar foto" abre a câmera e "Escolher imagem" abre
 * os arquivos. São dois `<input type="file">` — a diferença entre eles é o
 * atributo `capture`, que num celular faz o sistema abrir a câmera direto em
 * vez do seletor.
 *
 * Por que dois botões em vez de um: com um só, o celular mostra um menu do
 * sistema e o computador abre o seletor — e aí "tirar foto" some do caminho de
 * quem está no balcão com o celular na mão, que é justamente quem tem a foto
 * para tirar. No computador o botão de câmera usa a webcam quando existe, e
 * cai no seletor quando não existe, que é o comportamento do próprio
 * navegador.
 *
 * Esta é a única tela que troca foto, e ela troca só a de quem está logado: o
 * servidor não tem rota que receba id (ver internal/services/funcionario/foto.go).
 */
export function TrocarFoto({
    foto,
    nome,
    aoTrocar,
}: {
    /** O endereço da foto atual, ou vazio para a inicial do nome. */
    foto: string

    /** Usado na inicial de reserva e no texto alternativo. */
    nome: string

    /** Chamado com o endereço novo (ou vazio, ao remover). */
    aoTrocar: (endereco: string) => void
}) {

    const daCamera = useRef<HTMLInputElement>(null)
    const dosArquivos = useRef<HTMLInputElement>(null)

    const [enviando, setEnviando] = useState(false)
    const [erro, setErro] = useState("")

    async function enviar(evento: React.ChangeEvent<HTMLInputElement>) {

        const imagem = evento.target.files?.[0]

        // Limpa o campo ANTES de enviar: sem isto, escolher o mesmo arquivo
        // duas vezes seguidas — o que acontece quando a primeira tentativa
        // falha — não dispara o evento, e a tela parece travada.
        evento.target.value = ""

        if (!imagem) return

        setEnviando(true)
        setErro("")

        try {
            aoTrocar(await trocarMinhaFoto(imagem))
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível enviar a foto.")
        } finally {
            setEnviando(false)
        }
    }

    async function remover() {

        setEnviando(true)
        setErro("")

        try {
            await removerMinhaFoto()
            aoTrocar("")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível remover a foto.")
        } finally {
            setEnviando(false)
        }
    }

    return (
        <div className="flex items-center gap-4">

            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--azul)] text-lg font-bold text-white">
                {foto ? (
                    // <img> e não next/image: o endereço vem do servidor e pode
                    // apontar para o domínio do bucket, que muda de instalação
                    // para instalação. O next/image exigiria declarar esse
                    // domínio no build, e aí trocar de bucket passaria a pedir
                    // uma imagem nova do painel.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={foto} alt={`Foto de ${nome}`} className="h-full w-full object-cover" />
                ) : (
                    (nome.trim()[0] ?? "?").toUpperCase()
                )}
            </span>

            <div className="min-w-0 flex-1">

                <div className="flex flex-wrap gap-2">

                    <button
                        type="button"
                        onClick={() => daCamera.current?.click()}
                        disabled={enviando}
                        className="btn-secundario inline-flex items-center gap-1.5 text-sm disabled:opacity-60"
                    >
                        <FiCamera className="w-4" aria-hidden />
                        Tirar foto
                    </button>

                    <button
                        type="button"
                        onClick={() => dosArquivos.current?.click()}
                        disabled={enviando}
                        className="btn-secundario inline-flex items-center gap-1.5 text-sm disabled:opacity-60"
                    >
                        <FiImage className="w-4" aria-hidden />
                        Escolher imagem
                    </button>

                    {foto !== "" && (
                        <button
                            type="button"
                            onClick={remover}
                            disabled={enviando}
                            className="btn-secundario inline-flex items-center gap-1.5 text-sm text-[var(--vermelho)] disabled:opacity-60"
                        >
                            <FiTrash2 className="w-4" aria-hidden />
                            Remover
                        </button>
                    )}
                </div>

                {enviando && (
                    <p className="mt-1.5 text-xs text-[var(--ink-3)]">Enviando…</p>
                )}

                {erro !== "" && (
                    <p className="mt-1.5 text-xs text-[var(--vermelho)]">{erro}</p>
                )}
            </div>

            {/* Escondidos: quem aparece são os dois botões acima. Um input de
                arquivo cru não se estiliza de forma confiável entre
                navegadores, e o padrão é disparar o clique dele a partir de um
                botão de verdade. */}
            <input
                ref={daCamera}
                type="file"
                accept="image/*"
                capture="user"
                onChange={enviar}
                className="hidden"
            />

            <input
                ref={dosArquivos}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={enviar}
                className="hidden"
            />
        </div>
    )
}
