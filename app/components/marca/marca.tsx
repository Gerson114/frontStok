import type { SVGProps } from "react"

/**
 * A marca do TramaSistem.
 *
 * O símbolo é um ponto de cesto visto de cima: quatro tiras iguais, cada uma
 * enfiada por baixo da seguinte, girando em torno de um vazio quadrado no
 * meio. É o desenho do entrelaçado de palha e do azulejo de trama — tecelagem
 * real, não metáfora de software. O giro é o que dá o sentido: nenhuma tira
 * se sustenta sozinha, cada uma prende a próxima, e o vazio do centro é o
 * registro que a trama segura. Estoque, vitrine, venda e conversa são as
 * quatro tiras.
 *
 * O caminho até aqui importa porque poupa refazê-lo. A primeira tentativa foi
 * a trama literal — quatro fios de traço, dois na horizontal e dois na
 * vertical, com falha no cruzamento para mostrar quem passa por baixo.
 * Renderizada, virou cerquilha: linha reta ortogonal lê como "#" antes de ler
 * como tecido, e a falha de 2px que mostraria o entrelaçamento some no
 * tamanho pequeno. Também foram desenhadas e descartadas a versão a 45° (vira
 * floco de neve), a trança de dois fios (vira rabisco) e o T de tiras (vira
 * martelo). O que sobrou funciona por ser MASSA e não linha: forma cheia
 * aguenta 16px, quatro fios finos não aguentam.
 *
 * As referências são de marca tecelã e de produto de infraestrutura, não de
 * aplicativo: o entrelaçado de cestaria e a disciplina geométrica das marcas
 * de sistema — grade fixa, uma forma só repetida, nenhum gradiente, nenhuma
 * sombra, nenhuma seta para cima. Seta de crescimento e degradê roxo são o
 * que faz marca de SaaS parecer gerada, e é justamente o que não se usa aqui.
 *
 * A geometria é uma tira só, girada 90° quatro vezes — não há quatro desenhos
 * para manter iguais. A folga de 2 unidades entre a ponta de uma tira e o
 * corpo da seguinte é o que mostra que ela passa por baixo; menos que isso
 * some na tela, mais que isso solta as tiras e o quadrado se desmancha em
 * quatro blocos avulsos.
 *
 * Ao contrário do símbolo anterior, este é de preenchimento, e usa
 * `currentColor`: azul sobre branco no painel, branco sobre azul no bloco da
 * marca, sem duas versões do arquivo para manter sincronizadas.
 */
export function Simbolo({ className = "w-6", ...resto }: SVGProps<SVGSVGElement> & { className?: string }) {
    return (
        <svg
            viewBox="0 0 32 32"
            fill="currentColor"
            aria-hidden
            className={className}
            {...resto}
        >
            {/* A mesma tira, quatro vezes, girando em torno do centro. A ponta
                de cada uma para antes da tira seguinte: é essa folga que se lê
                como "passa por baixo". */}
            <rect x="3.5" y="3.5" width="14" height="9" rx="2.25" />
            <rect x="3.5" y="3.5" width="14" height="9" rx="2.25" transform="rotate(90 16 16)" />
            <rect x="3.5" y="3.5" width="14" height="9" rx="2.25" transform="rotate(180 16 16)" />
            <rect x="3.5" y="3.5" width="14" height="9" rx="2.25" transform="rotate(270 16 16)" />
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
