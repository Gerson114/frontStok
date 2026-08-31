"use client"

import { FiPlus, FiX } from "react-icons/fi"
import type { Atributos } from "@/security/validate"

/**
 * Campos que descrevem um produto de qualquer ramo.
 *
 * A loja não vende só roupa: vende ventilador (110V/220V), café (250 g/1 kg),
 * tinta (fosca/acetinada). Por isso o formulário não pergunta "tamanho",
 * "tecido" e "cor" — pergunta como se chama o eixo que divide o produto e
 * deixa o lojista descrever o resto com as palavras do ramo dele.
 */

/** Eixos de variação mais comuns, oferecidos como atalho. */
const ROTULOS_SUGERIDOS = [
    "Tamanho",
    "Voltagem",
    "Peso",
    "Volume",
    "Cor",
    "Sabor",
    "Numeração",
    "Modelo",
]

/**
 * Valores prontos por eixo: marcar cinco tamanhos com um clique é o que a
 * tela de roupa fazia, e perder isso seria piorar para quem já usa. Vale
 * para os eixos de lista curta e conhecida; nos outros o lojista digita.
 */
const VALORES_SUGERIDOS: Record<string, string[]> = {
    tamanho: ["PP", "P", "M", "G", "GG", "XG"],
    voltagem: ["110V", "220V", "Bivolt"],
    numeração: ["36", "38", "40", "42", "44"],
    numeracao: ["36", "38", "40", "42", "44"],
}

/** Nomes de ficha técnica comuns, para o lojista não começar do zero. */
const ATRIBUTOS_SUGERIDOS = [
    "Marca",
    "Material",
    "Cor",
    "Peso",
    "Dimensões",
    "Garantia",
    "Validade",
    "Fabricante",
    "Origem",
]

export interface LinhaVariacao {
    variacao: string
    estoque: string
}

interface VariacoesProps {
    rotulo: string
    aoMudarRotulo: (rotulo: string) => void
    linhas: LinhaVariacao[]
    aoMudarLinhas: (linhas: LinhaVariacao[]) => void
}

/**
 * Editor das variações de um produto. Cada linha vira um produto próprio no
 * backend, com código e estoque próprios — é assim que "Camiseta P" e
 * "Camiseta M" são contadas e vendidas separadamente.
 */
export function CamposDeVariacao({ rotulo, aoMudarRotulo, linhas, aoMudarLinhas }: VariacoesProps) {

    const sugestoes = VALORES_SUGERIDOS[rotulo.trim().toLowerCase()] ?? []

    function mudar(indice: number, campo: keyof LinhaVariacao, valor: string) {
        aoMudarLinhas(linhas.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)))
    }

    function acrescentar(valor = "") {
        if (valor && linhas.some((linha) => linha.variacao.trim() === valor)) return

        aoMudarLinhas([...linhas, { variacao: valor, estoque: "" }])
    }

    function remover(indice: number) {
        aoMudarLinhas(linhas.filter((_, i) => i !== indice))
    }

    return (
        <div className="space-y-4">

            <div className="space-y-1.5">
                <label className="rotulo" htmlFor="variacao-rotulo">
                    O que divide este produto?
                </label>

                <input
                    id="variacao-rotulo"
                    type="text"
                    list="rotulos-sugeridos"
                    value={rotulo}
                    onChange={(e) => aoMudarRotulo(e.target.value)}
                    placeholder="Ex: Tamanho, Voltagem, Peso"
                    className="field"
                />

                <datalist id="rotulos-sugeridos">
                    {ROTULOS_SUGERIDOS.map((item) => (
                        <option key={item} value={item} />
                    ))}
                </datalist>

                <p className="text-xs text-[#5A6469]">
                    Cada variação vira um produto separado, com seu próprio estoque e código
                    de barras. Produto que não se divide em nada leva uma variação só.
                </p>
            </div>

            {sugestoes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {sugestoes.map((valor) => {

                        const jaTem = linhas.some((linha) => linha.variacao.trim() === valor)

                        return (
                            <button
                                key={valor}
                                type="button"
                                onClick={() => acrescentar(valor)}
                                disabled={jaTem}
                                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                                    jaTem
                                        ? "border-[#E4E9EB] text-[#B8C0C4]"
                                        : "border-[#D3DADD] text-[#1E2428] hover:border-[#0086FF] hover:text-[#0086FF]"
                                }`}
                            >
                                {valor}
                            </button>
                        )
                    })}
                </div>
            )}

            <div className="space-y-2">
                {linhas.map((linha, indice) => (
                    <div key={indice} className="flex items-center gap-2">

                        <input
                            type="text"
                            value={linha.variacao}
                            onChange={(e) => mudar(indice, "variacao", e.target.value)}
                            placeholder={rotulo.trim() || "Variação"}
                            aria-label={`${rotulo.trim() || "Variação"} ${indice + 1}`}
                            className="field flex-1"
                        />

                        <input
                            type="number"
                            min="0"
                            value={linha.estoque}
                            onChange={(e) => mudar(indice, "estoque", e.target.value)}
                            placeholder="Estoque"
                            aria-label={`Estoque da variação ${indice + 1}`}
                            className="field num w-28"
                        />

                        <button
                            type="button"
                            onClick={() => remover(indice)}
                            aria-label={`Remover variação ${indice + 1}`}
                            className="shrink-0 rounded-lg p-2.5 text-[#8C969B] transition-colors hover:bg-[#FDECEA] hover:text-[#D4351C]"
                        >
                            <FiX className="w-4" aria-hidden />
                        </button>

                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={() => acrescentar()}
                className="btn btn-neutro flex items-center gap-2 text-sm"
            >
                <FiPlus className="w-4" aria-hidden />
                Adicionar variação
            </button>

        </div>
    )
}

export interface LinhaFicha {
    nome: string
    valor: string
}

interface FichaProps {
    linhas: LinhaFicha[]
    aoMudar: (linhas: LinhaFicha[]) => void
}

/**
 * Editor da ficha técnica: pares livres de nome e valor. É o que substitui
 * as caixas fixas de "tecido" e "cor" — uma adega precisa de "Safra", uma
 * papelaria de "Gramatura", e nenhuma das duas de tecido.
 */
export function CamposDeFicha({ linhas, aoMudar }: FichaProps) {

    function mudar(indice: number, campo: keyof LinhaFicha, valor: string) {
        aoMudar(linhas.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)))
    }

    return (
        <div className="space-y-3">

            <div className="space-y-2">
                {linhas.map((linha, indice) => (
                    <div key={indice} className="flex items-center gap-2">

                        <input
                            type="text"
                            list="atributos-sugeridos"
                            value={linha.nome}
                            onChange={(e) => mudar(indice, "nome", e.target.value)}
                            placeholder="Ex: Material"
                            aria-label={`Nome do item ${indice + 1} da ficha técnica`}
                            className="field flex-1"
                        />

                        <input
                            type="text"
                            value={linha.valor}
                            onChange={(e) => mudar(indice, "valor", e.target.value)}
                            placeholder="Ex: 100% algodão"
                            aria-label={`Valor do item ${indice + 1} da ficha técnica`}
                            className="field flex-1"
                        />

                        <button
                            type="button"
                            onClick={() => aoMudar(linhas.filter((_, i) => i !== indice))}
                            aria-label={`Remover item ${indice + 1} da ficha técnica`}
                            className="shrink-0 rounded-lg p-2.5 text-[#8C969B] transition-colors hover:bg-[#FDECEA] hover:text-[#D4351C]"
                        >
                            <FiX className="w-4" aria-hidden />
                        </button>

                    </div>
                ))}
            </div>

            <datalist id="atributos-sugeridos">
                {ATRIBUTOS_SUGERIDOS.map((item) => (
                    <option key={item} value={item} />
                ))}
            </datalist>

            <button
                type="button"
                onClick={() => aoMudar([...linhas, { nome: "", valor: "" }])}
                className="btn btn-neutro flex items-center gap-2 text-sm"
            >
                <FiPlus className="w-4" aria-hidden />
                Adicionar item
            </button>

        </div>
    )
}

/** Converte as linhas do formulário no mapa que a API espera. */
export function fichaParaAtributos(linhas: LinhaFicha[]): Atributos {

    const atributos: Atributos = {}

    for (const { nome, valor } of linhas) {
        if (nome.trim() && valor.trim()) {
            atributos[nome.trim()] = valor.trim()
        }
    }

    return atributos
}

/** Caminho de volta: o que veio da API vira linhas editáveis. */
export function atributosParaFicha(atributos?: Atributos): LinhaFicha[] {

    if (!atributos) return []

    return Object.entries(atributos)
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
        .map(([nome, valor]) => ({ nome, valor }))
}

/** A ficha técnica como o lojista e o cliente a leem. */
export function FichaTecnica({ atributos, className }: { atributos?: Atributos; className?: string }) {

    const linhas = atributosParaFicha(atributos)

    if (linhas.length === 0) return null

    return (
        <dl className={className ?? "space-y-1 text-sm"}>
            {linhas.map(({ nome, valor }) => (
                <div key={nome} className="flex gap-2">
                    <dt className="shrink-0 text-[#5A6469]">{nome}:</dt>
                    <dd className="min-w-0 font-medium text-[#1E2428]">{valor}</dd>
                </div>
            ))}
        </dl>
    )
}

/**
 * Como uma variação se lê numa linha: "Tamanho P", "Voltagem 220V". Devolve
 * vazio quando o produto não tem variação, para a tela não mostrar rótulo
 * solto.
 */
export function descreverVariacao(rotulo?: string, valor?: string): string {

    if (!valor?.trim()) return ""

    return `${rotulo?.trim() || "Variação"} ${valor.trim()}`
}
