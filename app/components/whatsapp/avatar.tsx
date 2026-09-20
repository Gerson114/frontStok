"use client"

import { useState } from "react"
import { urlDaFoto } from "@/middleware/whatsapp"

/**
 * As cores de reserva do avatar.
 *
 * Existem porque uma lista de trinta círculos cinza idênticos não ajuda
 * ninguém a reencontrar uma conversa: a cor vira parte de como o lojista
 * reconhece o cliente antes mesmo de ler o nome. São tons suaves de propósito
 * — o que precisa saltar na lista é a bolinha de não lidas, não o avatar.
 *
 * Cada par é fundo + texto já escolhido para ter contraste sobre ele.
 */
const CORES = [
    { fundo: "var(--azul-suave)", texto: "#0058A8" },
    { fundo: "var(--verde-suave)", texto: "var(--verde)" },
    { fundo: "#FFF3E0", texto: "#B26A00" },
    { fundo: "#F3E5F5", texto: "#7B1FA2" },
    { fundo: "#E0F7FA", texto: "#00707C" },
    { fundo: "var(--vermelho-fundo)", texto: "#C1351C" },
    { fundo: "#EDE7F6", texto: "#4A3C9E" },
    { fundo: "#F1F8E9", texto: "#557B18" },
]

/**
 * Sempre a mesma cor para o mesmo cliente.
 *
 * Derivada do nome, e não sorteada nem tirada do id: assim ela não muda
 * quando a lista se reordena, que é o tempo todo — a conversa mais recente
 * sobe a cada mensagem que chega.
 */
function corDe(nome: string) {

    let soma = 0

    for (let i = 0; i < nome.length; i++) {
        soma = (soma + nome.charCodeAt(i) * (i + 1)) % 4096
    }

    return CORES[soma % CORES.length]
}

/**
 * A foto do cliente, com a inicial do nome como reserva.
 *
 * Muita gente não tem foto, e quem tem pode tê-la escondido de quem não é
 * contato — então a reserva não é caso de erro, é o caso comum. Se a imagem
 * falhar em carregar (a foto trocou e o arquivo saiu), cai na inicial em vez
 * de deixar um quadrado quebrado na lista.
 */
export default function Avatar({
    conversaId,
    nome,
    temFoto,
    tamanho = "h-10 w-10",
}: {
    conversaId: number
    nome: string
    temFoto: boolean
    tamanho?: string
}) {

    const [falhou, setFalhou] = useState(false)

    const limpo = nome.trim()
    const inicial = (limpo.charAt(0) || "?").toUpperCase()

    if (!temFoto || falhou) {

        const cor = corDe(limpo || String(conversaId))

        return (
            <span
                aria-hidden
                style={{ backgroundColor: cor.fundo, color: cor.texto }}
                className={`flex ${tamanho} shrink-0 select-none items-center justify-center rounded-full text-sm font-bold`}
            >
                {inicial}
            </span>
        )
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element -- vem da nossa rota autenticada, não de um CDN
        <img
            src={urlDaFoto(conversaId)}
            alt=""
            // Carrega quando a linha chega perto da tela, e não todas de uma
            // vez ao montar a lista.
            //
            // Uma loja com noventa conversas disparava noventa buscas de foto
            // no mesmo instante — para mostrar as treze que cabem na tela. O
            // servidor via aquilo pelo que é, uma rajada, e respondia 429:
            // navegar para Conversas e voltar bastava para o painel inteiro
            // travar em "Muitas requisições".
            loading="lazy"
            // Decodifica fora da thread da tela: com dezenas de fotos, é o
            // que impede a lista de engasgar enquanto rola.
            decoding="async"
            onError={() => setFalhou(true)}
            className={`${tamanho} shrink-0 rounded-full bg-[var(--fundo)] object-cover`}
        />
    )
}
