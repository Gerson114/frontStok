// Preço no padrão do e-commerce brasileiro (referência: Magalu): o valor
// cheio em peso alto e os centavos em corpo menor. É o detalhe que faz a
// vitrine parecer uma loja de verdade em vez de uma tabela de dados.

const FORMATADOR = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})

/** Formata um valor como moeda completa (ex: "R$ 189,90"). */
export function formatarMoeda(valor: number): string {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    })
}

/** Separa reais e centavos já formatados no padrão pt-BR. */
function partes(valor: number): { reais: string; centavos: string } {
    const [reais, centavos] = FORMATADOR.format(Number(valor || 0)).split(",")
    return { reais, centavos }
}

interface PrecoProps {
    valor: number
    /** Preço cheio, exibido riscado ao lado quando há promoção. */
    valorAntigo?: number | null
    /** Classes extras — use para definir o tamanho (ex: "text-2xl"). */
    className?: string
}

export default function Preco({ valor, valorAntigo, className = "" }: PrecoProps) {
    const { reais, centavos } = partes(valor)

    return (
        <span className="inline-flex flex-wrap items-baseline gap-x-2">
            {valorAntigo ? (
                <span className="preco-antigo text-sm">{formatarMoeda(valorAntigo)}</span>
            ) : null}

            <span className={`preco ${className}`}>
                R$ {reais}
                <span className="preco-centavos">,{centavos}</span>
            </span>
        </span>
    )
}

interface DescontoProps {
    /** Preço original. */
    de: number
    /** Preço com promoção. */
    para: number
}

/**
 * Selo de variação de preço. Desconto aparece em verde (padrão do Magalu);
 * reajuste para cima aparece em âmbar, já que aqui a promoção também pode
 * ser um aumento.
 */
export function Desconto({ de, para }: DescontoProps) {
    if (!de || !Number.isFinite(de) || !Number.isFinite(para)) return null

    const percentual = Math.round(((para - de) / de) * 100)

    if (percentual === 0) return null

    const aumento = percentual > 0

    return (
        <span className={`tag ${aumento ? "tag-warning" : "tag-success"}`}>
            {aumento ? `+${percentual}%` : `${Math.abs(percentual)}% OFF`}
        </span>
    )
}
