import { FiChevronDown } from "react-icons/fi"
import type { ReactNode, SelectHTMLAttributes } from "react"

/**
 * Um campo de escolha que se parece com o resto do painel.
 *
 * O <select> cru traz a aparência do sistema operacional — a fonte, a altura,
 * o raio e a setinha do Windows ou do GNOME —, e nenhuma delas combina com os
 * campos ao lado. Numa tela em que todo o resto foi desenhado, ele é o
 * detalhe que faz a tela inteira parecer inacabada.
 *
 * A classe `.select` tira a aparência nativa; quem devolve a seta é o ícone
 * aqui embaixo, desenhado por cima do campo. Ele é irmão do <select>, e não
 * imagem de fundo, por dois motivos: a CSP do painel fecha `img-src` em
 * 'self', então um data: URI seria bloqueado e o campo ficaria sem nenhuma
 * indicação de que abre; e a regra da casa é que todo ícone vem do
 * react-icons/fi.
 *
 * `pointer-events-none` no ícone é o que mantém o clique chegando ao campo:
 * sem isso, clicar exatamente na seta não abriria a lista.
 */

interface SelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
    children: ReactNode
}

export function Selecao({ children, className = "", ...resto }: SelecaoProps) {

    return (
        <div className="relative">

            <select className={`select ${className}`} {...resto}>
                {children}
            </select>

            <FiChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 w-4 -translate-y-1/2 text-[var(--ink-2)]"
                aria-hidden
            />

        </div>
    )
}
