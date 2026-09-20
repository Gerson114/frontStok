import type { SVGProps } from "react"

/**
 * A marca do Chonnostech.
 *
 * O símbolo é um C de massa com um ponto cheio no centro do vazio: as duas
 * letras que abrem o nome, o C e o o, em uma forma só. O C é um anel grosso
 * cortado à direita em corte reto, no raio — não é a letra de uma fonte, é
 * geometria de grade, e é por isso que ele não parece um "C" digitado dentro
 * de um quadrado azul. O miolo é o registro que o sistema guarda, e o C é o
 * sistema fechando em volta dele.
 *
 * O caminho até aqui importa porque poupa refazê-lo. A marca anterior era um
 * catavento de quatro tiras, e ela era boa — mas nasceu do nome "Trama", de
 * tecelagem, e com o nome novo virou um ícone de blocos sem razão de ser.
 * Foram desenhadas e descartadas: o C feito de três tiras do catavento (lê
 * como peça de Tetris quebrada, o vão da direita não fecha a forma), o C
 * quadrado em anel (o vão some no tamanho pequeno e o desenho vira monitor) e
 * o C liso sem miolo (funciona, mas é a letra da fonte — nada nele é seu).
 * O miolo é o que separa esta marca de qualquer outra que comece com C, e ele
 * é redondo e não quadrado por escolha: o ponto repete a curva do anel, e o
 * quadrado brigava com ela no tamanho grande.
 *
 * As referências continuam sendo marca de infraestrutura, não de aplicativo:
 * grade fixa, forma cheia, nenhum gradiente, nenhuma sombra, nenhuma seta
 * para cima. Seta de crescimento e degradê roxo são o que faz marca de SaaS
 * parecer gerada, e é justamente o que não se usa aqui.
 *
 * A boca do C abre 64°, entre 328° e 32°. Menos que isso e o anel fecha: a
 * 16px o vão some e sobra uma rosca. Muito mais e o C se desmancha em duas
 * vírgulas. O miolo tem 6,8 de diâmetro nas 32 unidades do quadro — a 16px
 * isso dá 3,4px de massa, que é o mínimo que ainda se enxerga sem virar
 * sujeira.
 *
 * Como o símbolo anterior, este é de preenchimento e usa `currentColor`: azul
 * sobre branco no painel, branco sobre azul no bloco da marca, sem duas
 * versões do arquivo para manter sincronizadas.
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
            {/* O anel, cortado à direita. As pontas são cortes retos no raio,
                não pontas arredondadas de traço: é o que dá o ar de forma
                desenhada em vez de letra de fonte. */}
            <path d="M27.70 23.31A13.8 13.8 0 1 1 27.70 8.69L23.29 11.44A8.6 8.6 0 1 0 23.29 20.56Z" />
            {/* O miolo: o o do nome, e o registro que o sistema guarda. */}
            <circle cx="16" cy="16" r="3.4" />
        </svg>
    )
}

/**
 * O símbolo dentro do quadrado azul, do jeito que a marca aparece na barra
 * lateral e no topo público. Fora daqui, use o Simbolo solto.
 */
export function Marca({ className = "h-9 w-9" }: { className?: string }) {
    return (
        <span className={`flex shrink-0 items-center justify-center rounded-lg bg-[var(--azul)] text-white ${className}`}>
            <Simbolo className="w-[68%]" />
        </span>
    )
}
