import type { Bloco } from "@/app/type/type"

/**
 * As operações sobre a árvore de blocos da home.
 *
 * Ficam num arquivo à parte porque são a única parte do editor que é lógica de
 * verdade — o resto é tela. Aqui elas são funções puras: recebem a árvore,
 * devolvem outra. Nada muda no lugar, e é isso que faz "desfazer" e "salvar o
 * que está na tela" continuarem simples.
 *
 * A árvore tem um nível só de aninhamento (ver Bloco.colunas): a página é uma
 * lista de blocos, e um bloco do tipo "secao" tem colunas com blocos dentro.
 * Nada mais fundo que isso, de propósito.
 */

/** Onde um bloco está — ou vai parar. */
export interface Caminho {
    /** O id da seção que o contém, ou null quando ele está na página. */
    secao: string | null
    /** A coluna dentro da seção. Ignorado quando `secao` é null. */
    coluna: number
    /** A posição dentro da lista. */
    indice: number
}

/** Percorre a árvore inteira aplicando uma mudança a um bloco pelo id. */
export function editarNaArvore(
    blocos: Bloco[],
    id: string,
    mudanca: (bloco: Bloco) => Bloco,
): Bloco[] {
    return blocos.map((bloco) => {

        if (bloco.id === id) return mudanca(bloco)

        if (bloco.colunas) {
            return {
                ...bloco,
                colunas: bloco.colunas.map((coluna) =>
                    coluna.map((filho) => (filho.id === id ? mudanca(filho) : filho)),
                ),
            }
        }

        return bloco
    })
}

/** Tira um bloco de onde ele estiver. Devolve a árvore nova e o que saiu. */
export function removerDaArvore(blocos: Bloco[], id: string): [Bloco[], Bloco | null] {

    let removido: Bloco | null = null

    const restantes = blocos.filter((bloco) => {
        if (bloco.id !== id) return true
        removido = bloco
        return false
    })

    if (removido) return [restantes, removido]

    // Não estava na página: procura nas colunas das seções.
    const novos = restantes.map((bloco) => {

        if (!bloco.colunas) return bloco

        return {
            ...bloco,
            colunas: bloco.colunas.map((coluna) =>
                coluna.filter((filho) => {
                    if (filho.id !== id) return true
                    removido = filho
                    return false
                }),
            ),
        }
    })

    return [novos, removido]
}

/** Põe um bloco num lugar. */
export function inserirNaArvore(blocos: Bloco[], destino: Caminho, bloco: Bloco): Bloco[] {

    if (destino.secao === null) {
        const copia = [...blocos]
        copia.splice(Math.max(0, Math.min(destino.indice, copia.length)), 0, bloco)
        return copia
    }

    return blocos.map((atual) => {

        if (atual.id !== destino.secao || !atual.colunas) return atual

        return {
            ...atual,
            colunas: atual.colunas.map((coluna, indice) => {

                if (indice !== destino.coluna) return coluna

                const copia = [...coluna]
                copia.splice(Math.max(0, Math.min(destino.indice, copia.length)), 0, bloco)
                return copia
            }),
        }
    })
}

/**
 * Move um bloco de onde está para outro lugar.
 *
 * Tirar e pôr, nesta ordem, numa operação só: fazer as duas em separado deixa
 * a árvore num estado em que o bloco não existe em lugar nenhum, e qualquer
 * renderização no meio o faria piscar.
 */
export function moverNaArvore(blocos: Bloco[], id: string, destino: Caminho): Bloco[] {

    const [semEle, bloco] = removerDaArvore(blocos, id)

    if (!bloco) return blocos

    // Seção não entra dentro de seção, e os blocos de página inteira não
    // entram em coluna. A tela já impede de arrastar, mas a regra vive aqui
    // também — é ela que vale quando a tela mudar.
    if (destino.secao !== null && !cabeEmColuna(bloco.tipo)) return blocos

    return inserirNaArvore(semEle, destino, bloco)
}

/** Se este tipo pode morar dentro de uma coluna. */
export function cabeEmColuna(tipo: string): boolean {
    return !["secao", "banner", "atalhos", "grade"].includes(tipo)
}

/**
 * Onde um bloco está agora, para quem só tem o id — a prévia, por exemplo,
 * que mostra o bloco sem saber (nem precisar saber) de que coluna ele é
 * filho. Sem isto, mover ou duplicar a partir da prévia exigiria que ela
 * carregasse a mesma contabilidade de índice que a lista "Estrutura" já
 * carrega, e as duas acabariam divergindo um dia.
 */
export function localizarNaArvore(blocos: Bloco[], id: string): Caminho | null {

    const indicePagina = blocos.findIndex((bloco) => bloco.id === id)

    if (indicePagina !== -1) return { secao: null, coluna: 0, indice: indicePagina }

    for (const bloco of blocos) {
        for (const [coluna, filhos] of (bloco.colunas ?? []).entries()) {

            const indice = filhos.findIndex((filho) => filho.id === id)

            if (indice !== -1) return { secao: bloco.id, coluna, indice }
        }
    }

    return null
}

/**
 * Uma cópia do bloco, com um id novo — e, se ele for uma seção, um id novo
 * para cada filho das colunas também. Sem isto, duplicar uma seção criaria
 * dois blocos com o MESMO id um ao lado do outro, e mexer num moveria os
 * dois juntos (é o id que o React e o resto do editor usam para saber qual é
 * qual).
 */
export function clonarBloco(bloco: Bloco): Bloco {

    const id = `${bloco.tipo}-${Math.random().toString(36).slice(2, 8)}`

    if (!bloco.colunas) return { ...bloco, id }

    return {
        ...bloco,
        id,
        colunas: bloco.colunas.map((coluna) => coluna.map(clonarBloco)),
    }
}

/** Todos os blocos da árvore, achatados — para procurar um por id. */
export function achatar(blocos: Bloco[]): Bloco[] {

    const todos: Bloco[] = []

    for (const bloco of blocos) {

        todos.push(bloco)

        for (const coluna of bloco.colunas ?? []) {
            todos.push(...coluna)
        }
    }

    return todos
}

/** Quantos blocos há na árvore inteira, para o teto do servidor. */
export function contar(blocos: Bloco[]): number {
    return achatar(blocos).length
}
