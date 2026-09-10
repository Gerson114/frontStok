"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

/**
 * Os gráficos do painel, desenhados em SVG à mão.
 *
 * Sem biblioteca de gráfico de propósito. As três que se usariam aqui pesam
 * mais do que todo o resto do painel junto e trazem um visual próprio — grade
 * pontilhada, sombra sob a linha, paleta arco-íris — que é justamente a cara
 * de template que este front foi refeito para não ter. O que estas telas
 * pedem é barra, linha e fita: SVG resolve as três, e o resultado usa os
 * mesmos tokens do resto do painel (ver globals.css).
 *
 * As regras que atravessam o arquivo, e que valem para qualquer gráfico novo
 * que entre aqui:
 *
 *   COR SEGUE A ENTIDADE, nunca a posição. A série 1 é sempre a série 1,
 *   mesmo quando um filtro tira as outras da tela — cor que se rearranja faz
 *   o leitor comparar a barra de hoje com a memória da barra de ontem.
 *
 *   UM EIXO SÓ. Duas medidas de escalas diferentes viram dois gráficos, e
 *   nunca dois eixos verticais no mesmo desenho: as duas curvas se cruzam
 *   onde o autor do gráfico escolheu, e não onde os números se encontram.
 *
 *   NADA DEPENDE SÓ DA COR. Toda série tem legenda escrita, e os gráficos em
 *   que a cor é fraca sobre o branco (aqua e amarelo) trazem o número escrito
 *   ou a mesma informação em tabela — que é o que um leitor daltônico, uma
 *   impressão em preto e branco e o modo de alto contraste têm em comum.
 *
 *   A GRADE É RECESSIVA. A linha de referência mede o dado; ela não compete
 *   com ele.
 */

/* ==========================================================================
   Medida
   ========================================================================== */

/**
 * A largura que o gráfico tem de fato, medida do elemento que o contém.
 *
 * Existe porque a alternativa é desenhar num viewBox fixo e deixar o SVG
 * escalar: aí o texto escala junto, e o mesmo gráfico que está legível no
 * monitor fica com rótulo de cinco pixels no celular. Medindo, o desenho se
 * reorganiza e a tipografia continua do tamanho que foi escolhida.
 */
function useLargura<T extends HTMLElement>(): [React.RefObject<T | null>, number] {

    const alvo = useRef<T>(null)
    const [largura, setLargura] = useState(0)

    useEffect(() => {
        const elemento = alvo.current

        if (!elemento) return

        const observador = new ResizeObserver((entradas) => {
            for (const entrada of entradas) {
                setLargura(entrada.contentRect.width)
            }
        })

        observador.observe(elemento)

        return () => observador.disconnect()
    }, [])

    return [alvo, largura]
}

/* ==========================================================================
   Peças comuns
   ========================================================================== */

/** Uma série do gráfico: o nome escrito, a cor, e o total quando ele cabe. */
export interface Serie {
    rotulo: string
    cor: string
    total?: string
}

/**
 * A legenda, sempre presente quando há duas séries ou mais.
 *
 * Uma série sozinha não recebe legenda: o título do cartão já a nomeia, e uma
 * caixinha repetindo aquele nome só ocupa a linha.
 */
export function Legenda({ series }: { series: Serie[] }) {

    if (series.length < 2) return null

    return (
        <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {series.map((serie) => (
                <li key={serie.rotulo} className="flex items-center gap-1.5 text-xs text-[#616161]">

                    <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: serie.cor }}
                        aria-hidden
                    />

                    {serie.rotulo}

                    {serie.total && (
                        <span className="num font-semibold text-[#303030]">{serie.total}</span>
                    )}
                </li>
            ))}
        </ul>
    )
}

/** A caixa que segue o cursor. */
function Dica({ x, y, largura, children }: {
    x: number
    y: number
    largura: number
    children: React.ReactNode
}) {

    // Vira de lado perto da borda direita para não sair do cartão. O limite é
    // a metade da caixa, que é o quanto ela avança para cada lado.
    const meia = 90
    const esquerda = Math.min(Math.max(x, meia), Math.max(largura - meia, meia))

    return (
        <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-[#E1E1E1] bg-white px-2.5 py-1.5 text-xs shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
            style={{ left: esquerda, top: y - 8, minWidth: 120 }}
            role="tooltip"
        >
            {children}
        </div>
    )
}

/** Uma linha da caixa que segue o cursor. */
function LinhaDaDica({ cor, rotulo, valor }: { cor?: string; rotulo: string; valor: string }) {
    return (
        <p className="flex items-center justify-between gap-3 whitespace-nowrap">

            <span className="flex items-center gap-1.5 text-[#616161]">
                {cor && (
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: cor }} aria-hidden />
                )}
                {rotulo}
            </span>

            <span className="num font-semibold text-[#303030]">{valor}</span>
        </p>
    )
}

/** Nada para desenhar. Dito em texto, e não com um gráfico vazio. */
function Vazio({ children }: { children: React.ReactNode }) {
    return (
        <p className="rounded-lg border border-dashed border-[#E1E1E1] px-4 py-8 text-center text-sm text-[#8A8A8A]">
            {children}
        </p>
    )
}

/* ==========================================================================
   Barras verticais empilhadas — o tempo no eixo horizontal
   ========================================================================== */

/** Uma coluna do gráfico de barras. */
export interface Coluna {
    rotulo: string

    /** Uma parte por série, na ordem das séries. */
    partes: number[]

    /** O que a caixa do cursor mostra. Uma linha por item. */
    detalhe: { rotulo: string; valor: string; cor?: string }[]
}

/**
 * Barras verticais empilhadas: quanto, ao longo do tempo, dividido por onde.
 *
 * Empilhada e não agrupada porque as partes somam o mesmo total — balcão mais
 * pedido é o faturamento do dia —, e é o total que se compara entre dias. Duas
 * barras lado a lado por dia responderiam a outra pergunta, e dobrariam a
 * largura de cada janela.
 */
export function BarrasEmpilhadas({ colunas, series, formatar, altura = 220, rotuloDoEixo }: {
    colunas: Coluna[]
    series: Serie[]
    formatar: (valor: number) => string
    altura?: number
    rotuloDoEixo?: (rotulo: string) => string
}) {

    const [caixa, largura] = useLargura<HTMLDivElement>()
    const [sobre, setSobre] = useState<number | null>(null)

    const margem = { topo: 8, direita: 4, base: 26, esquerda: 52 }

    const teto = useMemo(() => {
        const maior = Math.max(0, ...colunas.map((c) => c.partes.reduce((a, b) => a + b, 0)))
        return escalaBonita(maior)
    }, [colunas])

    const areaLargura = Math.max(largura - margem.esquerda - margem.direita, 0)
    const areaAltura = altura - margem.topo - margem.base

    const passo = colunas.length > 0 ? areaLargura / colunas.length : 0

    // Barra fina, com folga entre as colunas. Barra larga transforma o
    // gráfico numa parede de cor e some com a leitura do intervalo.
    const espessura = Math.max(Math.min(passo * 0.6, 28), 2)

    const marcas = useMemo(() => marcasDoEixo(teto), [teto])

    const posicao = useCallback((valor: number) => {
        if (teto <= 0) return areaAltura
        return areaAltura - (valor / teto) * areaAltura
    }, [teto, areaAltura])

    if (colunas.length === 0) {
        return <Vazio>Nada vendido no período.</Vazio>
    }

    return (
        <div>
            <Legenda series={series} />

            <div ref={caixa} className="relative">

                {largura > 0 && (
                    <svg
                        width={largura}
                        height={altura}
                        role="img"
                        aria-label={`Gráfico de barras com ${colunas.length} colunas`}
                        onMouseLeave={() => setSobre(null)}
                    >
                        <g transform={`translate(${margem.esquerda},${margem.topo})`}>

                            {/* A grade, e o valor de cada linha dela. */}
                            {marcas.map((marca) => (
                                <g key={marca}>
                                    <line
                                        x1={0}
                                        x2={areaLargura}
                                        y1={posicao(marca)}
                                        y2={posicao(marca)}
                                        stroke="var(--grade)"
                                        strokeWidth={1}
                                    />
                                    <text
                                        x={-8}
                                        y={posicao(marca)}
                                        textAnchor="end"
                                        dominantBaseline="middle"
                                        className="fill-[#8A8A8A]"
                                        style={{ fontSize: 10 }}
                                    >
                                        {formatar(marca)}
                                    </text>
                                </g>
                            ))}

                            {colunas.map((coluna, indice) => {

                                const centro = passo * indice + passo / 2
                                let base = areaAltura

                                return (
                                    <g key={coluna.rotulo}>

                                        {/* A faixa de captura é a coluna inteira, e não a
                                            barra: alvo do tamanho do dado obrigaria a
                                            acertar 6 pixels de largura num dia parado. */}
                                        <rect
                                            x={passo * indice}
                                            y={0}
                                            width={passo}
                                            height={areaAltura}
                                            fill={indice === sobre ? "rgba(0,0,0,0.03)" : "transparent"}
                                            onMouseEnter={() => setSobre(indice)}
                                        />

                                        {coluna.partes.map((valor, parte) => {

                                            if (valor <= 0) return null

                                            const alto = (valor / (teto || 1)) * areaAltura

                                            // Dois pixels de fundo entre as fatias: sem a
                                            // fresta, duas cores encostadas viram uma
                                            // terceira na borda.
                                            const desenhado = Math.max(alto - 2, 1)

                                            base -= alto

                                            return (
                                                <rect
                                                    key={series[parte]?.rotulo ?? parte}
                                                    x={centro - espessura / 2}
                                                    y={base}
                                                    width={espessura}
                                                    height={desenhado}
                                                    rx={3}
                                                    fill={series[parte]?.cor ?? "var(--serie-1)"}
                                                    pointerEvents="none"
                                                />
                                            )
                                        })}
                                    </g>
                                )
                            })}

                            {/* A base: a única linha do desenho que não é dado. */}
                            <line
                                x1={0}
                                x2={areaLargura}
                                y1={areaAltura}
                                y2={areaAltura}
                                stroke="var(--eixo)"
                                strokeWidth={1}
                            />

                            {/* Um rótulo a cada N colunas: escritos todos, eles se
                                sobrepõem e nenhum se lê. */}
                            {colunas.map((coluna, indice) => {

                                const cada = Math.ceil(colunas.length / Math.max(Math.floor(areaLargura / 64), 1))

                                if (indice % cada !== 0 && indice !== colunas.length - 1) return null

                                return (
                                    <text
                                        key={coluna.rotulo}
                                        x={passo * indice + passo / 2}
                                        y={areaAltura + 16}
                                        textAnchor="middle"
                                        className="fill-[#8A8A8A]"
                                        style={{ fontSize: 10 }}
                                    >
                                        {rotuloDoEixo ? rotuloDoEixo(coluna.rotulo) : coluna.rotulo}
                                    </text>
                                )
                            })}
                        </g>
                    </svg>
                )}

                {sobre !== null && colunas[sobre] && (
                    <Dica
                        x={margem.esquerda + passo * sobre + passo / 2}
                        y={margem.topo + posicao(colunas[sobre].partes.reduce((a, b) => a + b, 0))}
                        largura={largura}
                    >
                        <p className="mb-1 font-semibold text-[#303030]">
                            {rotuloDoEixo ? rotuloDoEixo(colunas[sobre].rotulo) : colunas[sobre].rotulo}
                        </p>

                        {colunas[sobre].detalhe.map((linha) => (
                            <LinhaDaDica key={linha.rotulo} {...linha} />
                        ))}
                    </Dica>
                )}
            </div>
        </div>
    )
}

/* ==========================================================================
   Linhas — mais de uma série ao longo do tempo
   ========================================================================== */

/**
 * Linhas ao longo do tempo, com cruzeta e caixa no ponto mais próximo.
 *
 * Linha e não barra porque aqui a pergunta é a forma da curva — "as
 * encerradas acompanham as assumidas?" —, e quatro séries de barras no mesmo
 * dia viram uma cerca.
 */
export function Linhas({ rotulos, series, valores, formatar, altura = 200, rotuloDoEixo }: {
    rotulos: string[]
    series: Serie[]
    /** Uma lista de valores por série, na ordem dos rótulos. */
    valores: number[][]
    formatar: (valor: number) => string
    altura?: number
    rotuloDoEixo?: (rotulo: string) => string
}) {

    const [caixa, largura] = useLargura<HTMLDivElement>()
    const [sobre, setSobre] = useState<number | null>(null)

    const margem = { topo: 8, direita: 8, base: 26, esquerda: 40 }

    const teto = useMemo(
        () => escalaBonita(Math.max(0, ...valores.flat())),
        [valores]
    )

    const areaLargura = Math.max(largura - margem.esquerda - margem.direita, 0)
    const areaAltura = altura - margem.topo - margem.base

    const marcas = useMemo(() => marcasDoEixo(teto), [teto])

    const x = useCallback((indice: number) => {
        if (rotulos.length <= 1) return areaLargura / 2
        return (indice / (rotulos.length - 1)) * areaLargura
    }, [rotulos.length, areaLargura])

    const y = useCallback((valor: number) => {
        if (teto <= 0) return areaAltura
        return areaAltura - (valor / teto) * areaAltura
    }, [teto, areaAltura])

    const apontar = useCallback((evento: React.MouseEvent<SVGSVGElement>) => {

        const retangulo = evento.currentTarget.getBoundingClientRect()
        const dentro = evento.clientX - retangulo.left - margem.esquerda

        if (rotulos.length === 0) return

        const passo = rotulos.length > 1 ? areaLargura / (rotulos.length - 1) : areaLargura
        const indice = Math.round(dentro / (passo || 1))

        setSobre(Math.min(Math.max(indice, 0), rotulos.length - 1))
    }, [areaLargura, margem.esquerda, rotulos.length])

    if (rotulos.length === 0) {
        return <Vazio>Nenhum movimento registrado no período.</Vazio>
    }

    return (
        <div>
            <Legenda series={series} />

            <div ref={caixa} className="relative">

                {largura > 0 && (
                    <svg
                        width={largura}
                        height={altura}
                        role="img"
                        aria-label={`Gráfico de linhas com ${series.length} séries`}
                        onMouseMove={apontar}
                        onMouseLeave={() => setSobre(null)}
                    >
                        <g transform={`translate(${margem.esquerda},${margem.topo})`}>

                            {marcas.map((marca) => (
                                <g key={marca}>
                                    <line
                                        x1={0}
                                        x2={areaLargura}
                                        y1={y(marca)}
                                        y2={y(marca)}
                                        stroke="var(--grade)"
                                        strokeWidth={1}
                                    />
                                    <text
                                        x={-8}
                                        y={y(marca)}
                                        textAnchor="end"
                                        dominantBaseline="middle"
                                        className="fill-[#8A8A8A]"
                                        style={{ fontSize: 10 }}
                                    >
                                        {formatar(marca)}
                                    </text>
                                </g>
                            ))}

                            {sobre !== null && (
                                <line
                                    x1={x(sobre)}
                                    x2={x(sobre)}
                                    y1={0}
                                    y2={areaAltura}
                                    stroke="var(--eixo)"
                                    strokeWidth={1}
                                />
                            )}

                            {series.map((serie, indice) => (
                                <path
                                    key={serie.rotulo}
                                    d={caminho(valores[indice] ?? [], x, y)}
                                    fill="none"
                                    stroke={serie.cor}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            ))}

                            {/* O ponto só aparece onde o cursor está: um marcador em
                                cada dia de trinta dias é confete. O anel branco em
                                volta é o que separa dois pontos que caíram no mesmo
                                lugar. */}
                            {sobre !== null && series.map((serie, indice) => {

                                const valor = valores[indice]?.[sobre]

                                if (valor === undefined) return null

                                return (
                                    <circle
                                        key={serie.rotulo}
                                        cx={x(sobre)}
                                        cy={y(valor)}
                                        r={4}
                                        fill={serie.cor}
                                        stroke="var(--superficie)"
                                        strokeWidth={2}
                                    />
                                )
                            })}

                            <line
                                x1={0}
                                x2={areaLargura}
                                y1={areaAltura}
                                y2={areaAltura}
                                stroke="var(--eixo)"
                                strokeWidth={1}
                            />

                            {rotulos.map((rotulo, indice) => {

                                const cada = Math.ceil(rotulos.length / Math.max(Math.floor(areaLargura / 64), 1))

                                if (indice % cada !== 0 && indice !== rotulos.length - 1) return null

                                return (
                                    <text
                                        key={rotulo}
                                        x={x(indice)}
                                        y={areaAltura + 16}
                                        textAnchor={indice === 0 ? "start" : indice === rotulos.length - 1 ? "end" : "middle"}
                                        className="fill-[#8A8A8A]"
                                        style={{ fontSize: 10 }}
                                    >
                                        {rotuloDoEixo ? rotuloDoEixo(rotulo) : rotulo}
                                    </text>
                                )
                            })}
                        </g>
                    </svg>
                )}

                {sobre !== null && (
                    <Dica x={margem.esquerda + x(sobre)} y={margem.topo} largura={largura}>

                        <p className="mb-1 font-semibold text-[#303030]">
                            {rotuloDoEixo ? rotuloDoEixo(rotulos[sobre]) : rotulos[sobre]}
                        </p>

                        {series.map((serie, indice) => (
                            <LinhaDaDica
                                key={serie.rotulo}
                                cor={serie.cor}
                                rotulo={serie.rotulo}
                                valor={String(valores[indice]?.[sobre] ?? 0)}
                            />
                        ))}
                    </Dica>
                )}
            </div>
        </div>
    )
}

/* ==========================================================================
   Barras horizontais por pessoa
   ========================================================================== */

/** Uma linha do gráfico por pessoa. */
export interface LinhaDePessoa {
    nome: string
    partes: number[]

    /** O que vai escrito na ponta da barra. */
    marca: string
}

/**
 * Barras horizontais empilhadas, uma por pessoa.
 *
 * Horizontal porque o rótulo é um nome: na vertical, "Maria Aparecida" só
 * cabe deitada de lado, e nome escrito na diagonal é o tique de planilha.
 *
 * O número vai escrito na ponta de cada barra, e não só na legenda: duas das
 * cores da paleta ficam abaixo de 3:1 de contraste com o branco, e a régua
 * deste gráfico não pode depender de distinguir aqua de amarelo.
 */
export function BarrasPorPessoa({ linhas, series }: {
    linhas: LinhaDePessoa[]
    series: Serie[]
}) {

    const teto = Math.max(1, ...linhas.map((linha) => linha.partes.reduce((a, b) => a + b, 0)))

    if (linhas.length === 0) {
        return <Vazio>Ninguém mexeu em conversa no período.</Vazio>
    }

    return (
        <div>
            <Legenda series={series} />

            <ul className="space-y-2.5">
                {linhas.map((linha) => {

                    const total = linha.partes.reduce((a, b) => a + b, 0)

                    return (
                        <li key={linha.nome} className="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-3">

                            <span className="truncate text-sm text-[#303030]" title={linha.nome}>
                                {linha.nome}
                            </span>

                            <span className="flex h-3 items-stretch gap-0.5" aria-hidden>
                                {linha.partes.map((valor, indice) => (
                                    valor > 0 ? (
                                        <span
                                            key={series[indice]?.rotulo ?? indice}
                                            className="rounded-sm first:rounded-l-md last:rounded-r-md"
                                            style={{
                                                background: series[indice]?.cor ?? "var(--serie-1)",
                                                width: `${(valor / teto) * 100}%`,
                                            }}
                                        />
                                    ) : null
                                ))}

                                {total === 0 && (
                                    <span className="w-full rounded-md bg-[#F1F1F1]" />
                                )}
                            </span>

                            <span className="num w-16 text-right text-xs text-[#616161]">
                                {linha.marca}
                            </span>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

/* ==========================================================================
   A fila agora — uma barra só, repartida
   ========================================================================== */

/**
 * Uma barra repartida pelos estados do atendimento.
 *
 * É a fotografia de agora, e por isso é uma barra e não uma série: não há
 * tempo no eixo. A rosca que se usaria aqui obrigaria a comparar ângulos, que
 * é o que ninguém sabe fazer de olho — em barra, comparar comprimento é
 * imediato.
 */
export function BarraDeEstados({ partes }: {
    partes: { rotulo: string; valor: number; cor: string }[]
}) {

    const total = partes.reduce((soma, parte) => soma + parte.valor, 0)

    if (total === 0) {
        return <Vazio>Nenhuma conversa aberta agora.</Vazio>
    }

    return (
        <div>
            <span className="mb-3 flex h-4 items-stretch gap-0.5" aria-hidden>
                {partes.map((parte) => (
                    parte.valor > 0 ? (
                        <span
                            key={parte.rotulo}
                            className="rounded-sm first:rounded-l-md last:rounded-r-md"
                            style={{ background: parte.cor, width: `${(parte.valor / total) * 100}%` }}
                        />
                    ) : null
                ))}
            </span>

            <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
                {partes.map((parte) => (
                    <li key={parte.rotulo} className="flex items-center gap-1.5 text-xs text-[#616161]">

                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ background: parte.cor }}
                            aria-hidden
                        />

                        {parte.rotulo}
                        <span className="num font-semibold text-[#303030]">{parte.valor}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

/* ==========================================================================
   Fluxo — quem passou para quem
   ========================================================================== */

/** Uma seta do fluxo. */
export interface Fita {
    de: string
    para: string
    total: number
}

/**
 * Quem passou cliente para quem, em fitas de largura proporcional.
 *
 * Duas colunas de nomes e uma fita entre elas, e não uma matriz de células: a
 * pergunta que o dono faz é direcional — "para onde vai o cliente difícil?" —,
 * e a fita mostra a direção sem precisar de legenda. A mesma informação está
 * na tabela abaixo do gráfico, que é o que serve a quem não distingue as cores
 * e a quem imprime a tela.
 *
 * A cor é a de quem PASSA, e é a mesma em todas as fitas que saem da mesma
 * pessoa: é o que deixa ver de olho que três das quatro fitas saem da mesma
 * mão.
 */
export function Fluxo({ fitas, cores }: { fitas: Fita[]; cores: string[] }) {

    const [caixa, largura] = useLargura<HTMLDivElement>()
    const [sobre, setSobre] = useState<number | null>(null)

    const { origens, destinos, altura, faixas } = useMemo(() => montarFluxo(fitas), [fitas])

    if (fitas.length === 0) {
        return <Vazio>Nenhum cliente passou de mão no período.</Vazio>
    }

    const colunaEsquerda = 8
    const colunaDireita = Math.max(largura - 8, 120)
    const meio = largura / 2

    return (
        <div ref={caixa} className="relative">

            {largura > 0 && (
                <svg
                    width={largura}
                    height={altura}
                    role="img"
                    aria-label="Fluxo de transferências entre a equipe"
                    onMouseLeave={() => setSobre(null)}
                >
                    {/* As fitas primeiro, para os nomes ficarem legíveis por cima. */}
                    {faixas.map((faixa, indice) => {

                        const corDaOrigem = cores[origens.indexOf(faixa.de) % cores.length]
                        const y1 = faixa.saida
                        const y2 = faixa.chegada

                        return (
                            <path
                                key={`${faixa.de}->${faixa.para}`}
                                d={`M ${colunaEsquerda + 88} ${y1}
                                    C ${meio} ${y1}, ${meio} ${y2}, ${colunaDireita - 88} ${y2}`}
                                fill="none"
                                stroke={corDaOrigem}
                                strokeWidth={faixa.espessura}
                                strokeOpacity={sobre === null || sobre === indice ? 0.55 : 0.15}
                                strokeLinecap="round"
                                onMouseEnter={() => setSobre(indice)}
                            />
                        )
                    })}

                    {origens.map((nome, indice) => (
                        <text
                            key={`de-${nome}`}
                            x={colunaEsquerda}
                            y={alturaDaPessoa(origens, indice)}
                            dominantBaseline="middle"
                            className="fill-[#303030]"
                            style={{ fontSize: 12 }}
                        >
                            {encurtar(nome)}
                        </text>
                    ))}

                    {destinos.map((nome, indice) => (
                        <text
                            key={`para-${nome}`}
                            x={colunaDireita}
                            y={alturaDaPessoa(destinos, indice)}
                            textAnchor="end"
                            dominantBaseline="middle"
                            className="fill-[#303030]"
                            style={{ fontSize: 12 }}
                        >
                            {encurtar(nome)}
                        </text>
                    ))}
                </svg>
            )}

            {sobre !== null && faixas[sobre] && (
                <Dica x={meio} y={faixas[sobre].saida} largura={largura}>
                    <LinhaDaDica
                        rotulo={`${faixas[sobre].de} → ${faixas[sobre].para}`}
                        valor={`${faixas[sobre].total}`}
                    />
                </Dica>
            )}

            <p className="mt-1 flex justify-between text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                <span>Passou</span>
                <span>Recebeu</span>
            </p>
        </div>
    )
}

/** Onde cada nome fica na coluna dele. */
function alturaDaPessoa(pessoas: string[], indice: number): number {
    return 20 + indice * 34
}

/** As duas colunas e as fitas entre elas, já posicionadas. */
function montarFluxo(fitas: Fita[]) {

    const origens: string[] = []
    const destinos: string[] = []

    for (const fita of fitas) {
        if (!origens.includes(fita.de)) origens.push(fita.de)
        if (!destinos.includes(fita.para)) destinos.push(fita.para)
    }

    const maior = Math.max(1, ...fitas.map((fita) => fita.total))

    const faixas = fitas.map((fita) => ({
        de: fita.de,
        para: fita.para,
        total: fita.total,
        saida: alturaDaPessoa(origens, origens.indexOf(fita.de)),
        chegada: alturaDaPessoa(destinos, destinos.indexOf(fita.para)),

        // Mínimo de dois pixels: uma transferência única tem de ficar
        // visível, senão a fita mais fina do gráfico é uma que não existe.
        espessura: Math.max((fita.total / maior) * 16, 2),
    }))

    const linhas = Math.max(origens.length, destinos.length)

    return { origens, destinos, faixas, altura: Math.max(alturaDaPessoa([], linhas) + 4, 60) }
}

/** Só o primeiro nome quando o inteiro não caberia na coluna. */
function encurtar(nome: string): string {

    if (nome.length <= 14) return nome

    const primeiro = nome.split(" ")[0]

    return primeiro.length <= 14 ? primeiro : `${primeiro.slice(0, 13)}…`
}

/* ==========================================================================
   Escala
   ========================================================================== */

/**
 * O teto do eixo, arredondado para um número que se lê.
 *
 * Sem isto o eixo termina em "R$ 4.837,00" e as linhas da grade caem em
 * frações — e a régua do gráfico deixa de servir para estimar de olho, que é
 * a única coisa que uma grade faz.
 */
function escalaBonita(maior: number): number {

    if (maior <= 0) return 0

    const ordem = 10 ** Math.floor(Math.log10(maior))
    const normalizado = maior / ordem

    const passo = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10

    return passo * ordem
}

/** Quatro linhas de grade, contando o zero. */
function marcasDoEixo(teto: number): number[] {

    if (teto <= 0) return [0]

    return [0, teto / 4, teto / 2, (teto * 3) / 4, teto]
}

/** O caminho da linha, pulando o que não existe. */
function caminho(
    valores: number[],
    x: (indice: number) => number,
    y: (valor: number) => number
): string {
    return valores
        .map((valor, indice) => `${indice === 0 ? "M" : "L"} ${x(indice)} ${y(valor)}`)
        .join(" ")
}
