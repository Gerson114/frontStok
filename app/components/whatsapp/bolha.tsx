"use client"

import {
    familiaDaMidia,
    horaDaMensagem,
    tamanhoLegivel,
    urlDaMidia,
    type MensagemWhatsApp,
} from "@/middleware/whatsapp"
import { FiAlertTriangle, FiCheck, FiClock, FiDownload, FiFile } from "react-icons/fi"

/**
 * Uma mensagem no fio.
 *
 * Foto e vídeo abrem na própria bolha, áudio ganha o tocador do navegador, e
 * o que não é nenhum dos três desce como anexo. Quem decide o que pode abrir
 * na tela é o servidor, por lista fechada de tipos — aqui só se escolhe o
 * desenho. Repetir a decisão nos dois lados é como um deles fica permissivo.
 *
 * Enquanto o arquivo não terminou de baixar, a bolha mostra o rótulo que veio
 * no texto ("[imagem]"). É a mesma mensagem, só que ainda sem o anexo — some
 * sozinha quando o download acaba e o servidor avisa.
 */
export default function Bolha({ mensagem }: { mensagem: MensagemWhatsApp }) {

    const minha = mensagem.direcao === "saida"
    const familia = familiaDaMidia(mensagem.midia_mime)
    const endereco = urlDaMidia(mensagem.id)

    // O texto de uma mídia é o rótulo ou a legenda. Com o arquivo na tela, o
    // rótulo sozinho vira ruído; a legenda continua valendo.
    const rotuloSozinho = /^\[[^\]]+\]$/.test(mensagem.texto.trim())
    const mostrarTexto = !mensagem.tem_midia || !rotuloSozinho

    return (
        <div className={`flex ${minha ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[80%] overflow-hidden rounded-xl text-sm ${
                    minha ? "bg-[#0086FF] text-white" : "bg-white text-[#1E2428] shadow-sm"
                }`}
            >

                {mensagem.tem_midia && familia === "imagem" && (
                    <a href={endereco} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element -- vem da nossa rota autenticada, não de um CDN */}
                        <img
                            src={endereco}
                            alt={mensagem.texto || "Imagem enviada pelo cliente"}
                            className="max-h-80 w-full object-cover"
                        />
                    </a>
                )}

                {mensagem.tem_midia && familia === "video" && (
                    <video src={endereco} controls className="max-h-80 w-full" />
                )}

                <div className="px-3.5 py-2">

                    {mensagem.tem_midia && familia === "audio" && (
                        <audio src={endereco} controls className="mb-1 w-64 max-w-full" />
                    )}

                    {mensagem.tem_midia && familia === "arquivo" && (
                        <a
                            href={endereco}
                            download
                            className={`mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
                                minha ? "bg-white/15 hover:bg-white/25" : "bg-[#F0F3F4] hover:bg-[#E4E9EB]"
                            }`}
                        >
                            <FiFile className="w-5 shrink-0" aria-hidden />

                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold">
                                    {mensagem.midia_nome || "Arquivo"}
                                </span>
                                {mensagem.midia_tamanho ? (
                                    <span className={`block text-xs ${minha ? "text-white/75" : "text-[#8C969B]"}`}>
                                        {tamanhoLegivel(mensagem.midia_tamanho)}
                                    </span>
                                ) : null}
                            </span>

                            <FiDownload className="w-4 shrink-0" aria-hidden />
                        </a>
                    )}

                    {mostrarTexto && (
                        <p className="whitespace-pre-wrap break-words">{mensagem.texto}</p>
                    )}

                    <p
                        className={`mt-1 flex items-center justify-end gap-1 text-[0.68rem] ${
                            minha ? "text-white/75" : "text-[#8C969B]"
                        }`}
                    >
                        <span className="num">{horaDaMensagem(mensagem.criada_em)}</span>

                        {minha && (
                            mensagem.status === "falhou"
                                ? <FiAlertTriangle className="w-3" aria-label="não enviada" />
                                : mensagem.status === "enfileirada"
                                    ? <FiClock className="w-3" aria-label="enviando" />
                                    : <FiCheck className="w-3" aria-label={mensagem.status} />
                        )}
                    </p>

                    {mensagem.status === "falhou" && mensagem.erro && (
                        <p className="mt-1 rounded bg-[#FDECEA] px-2 py-1 text-[0.7rem] font-semibold text-[#D4351C]">
                            {mensagem.erro}
                        </p>
                    )}

                </div>

            </div>
        </div>
    )
}
