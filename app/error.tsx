"use client"

import { FiAlertTriangle, FiRefreshCw, FiHome } from "react-icons/fi"
import Link from "next/link"
import Aviso from "@/app/components/aviso/aviso"

/**
 * O que o lojista vê quando uma tela do painel quebra ao renderizar.
 *
 * Antes desta tela existir, esse caso caía na página de erro crua do Next —
 * fundo branco, texto em inglês, nenhuma saída. Quem estava conferindo
 * estoque via o painel virar outra coisa e não tinha o que fazer além de
 * apertar F5 e torcer.
 *
 * Ela cobre a falha de renderização, e não a de rede: chamada que volta com
 * erro continua sendo tratada dentro de cada tela, que sabe dizer o que
 * exatamente não carregou. Aqui é o último anteparo, para o que ninguém
 * previu.
 *
 * Precisa ser Client Component — é um error boundary do React, e boundary
 * só existe no cliente.
 */
export default function Error({
    error,
    retry,
}: {
    error: Error & { digest?: string }
    // `retry` refaz a busca e re-renderiza o trecho quebrado. Substituiu o
    // antigo `reset`, que só limpava o estado do boundary e por isso
    // repetia o mesmo erro quando a causa estava nos dados.
    retry: () => void
}) {
    return (
        <Aviso
            icone={<FiAlertTriangle className="h-7 w-7" />}
            titulo="Alguma coisa deu errado"
            acoes={
                <>
                    <button type="button" onClick={() => retry()} className="btn btn-primario">
                        <FiRefreshCw className="w-4" aria-hidden />
                        <span>Tentar de novo</span>
                    </button>

                    <Link href="/" className="btn btn-neutro">
                        <FiHome className="w-4" aria-hidden />
                        <span>Ir para o início</span>
                    </Link>
                </>
            }
            rodape={
                // O digest é o que liga esta tela ao registro do servidor.
                // Em produção a mensagem do erro não vem para o navegador
                // (ela pode carregar dado de dentro do sistema), então este
                // código é a única coisa que o lojista tem para nos passar
                // quando pedir ajuda — e a única com que achamos a linha
                // certa no log.
                error.digest ? (
                    <p className="text-xs text-[#8A8A8A]">
                        Código do erro: <span className="num font-bold">{error.digest}</span>
                    </p>
                ) : undefined
            }
        >
            <p>
                A tela não conseguiu carregar. Seus dados estão salvos — nada do que
                você fez até aqui foi perdido.
            </p>
        </Aviso>
    )
}
