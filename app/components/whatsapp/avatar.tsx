"use client"

import { useState } from "react"
import { urlDaFoto } from "@/middleware/whatsapp"

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
    tamanho = "h-9 w-9",
}: {
    conversaId: number
    nome: string
    temFoto: boolean
    tamanho?: string
}) {

    const [falhou, setFalhou] = useState(false)

    const inicial = (nome.trim().charAt(0) || "?").toUpperCase()

    if (!temFoto || falhou) {
        return (
            <span className={`flex ${tamanho} shrink-0 items-center justify-center rounded-full bg-[#F0F3F4] text-sm font-bold text-[#5A6469]`}>
                {inicial}
            </span>
        )
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element -- vem da nossa rota autenticada, não de um CDN
        <img
            src={urlDaFoto(conversaId)}
            alt=""
            onError={() => setFalhou(true)}
            className={`${tamanho} shrink-0 rounded-full bg-[#F0F3F4] object-cover`}
        />
    )
}
