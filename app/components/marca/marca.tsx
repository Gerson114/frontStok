import type { SVGProps } from "react"

/**
 * A marca do Arara.
 *
 * O símbolo é uma arara de roupas vista de frente, e é também um A: as duas
 * pernas da letra são os pés da arara, e a travessa é a barra onde as peças
 * ficam penduradas — ela passa das pernas dos dois lados, como passa numa
 * arara de verdade, e é isso que separa a marca de um A qualquer.
 *
 * Houve um gancho de cabide no alto. Saiu: em 16px, na aba do navegador, a
 * curva fechava e virava um borrão colado no vértice. Detalhe que só existe
 * no tamanho grande é detalhe que estraga o pequeno.
 *
 * O desenho é de traço, sem preenchimento, e usa `currentColor`: azul sobre
 * branco no painel, branco sobre azul no bloco da marca, sem duas versões do
 * arquivo para manter sincronizadas.
 */
export function Simbolo({ className = "w-6", ...resto }: SVGProps<SVGSVGElement> & { className?: string }) {
    return (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={className}
            {...resto}
        >
            {/* as pernas da arara, que são o A */}
            <path d="M7.5 27 16 6.5 24.5 27" />

            {/* a barra, que sobra dos dois lados */}
            <path d="M3.5 20h25" />
        </svg>
    )
}

/**
 * O símbolo dentro do quadrado azul, do jeito que a marca aparece na barra
 * lateral e no topo público. Fora daqui, use o Simbolo solto.
 */
export function Marca({ className = "h-9 w-9" }: { className?: string }) {
    return (
        <span className={`flex shrink-0 items-center justify-center rounded-lg bg-[#005BD3] text-white ${className}`}>
            <Simbolo className="w-[68%]" />
        </span>
    )
}
