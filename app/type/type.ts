export interface Produto {
    id: number
    codigo: string
    nome: string
    preco: number
    estoque: number
    categoria: string
    tamanho: string
    tecido: string
    cor: string
    imagem_url: string
    loja_id: number
    preco_promocional?: number | null
}

/**
 * Peça física individual de um produto, identificada por um código
 * próprio (código do produto + "-" + sequência, ex: "000618-1"). Permite
 * controlar unidade por unidade em vez de só a quantidade em estoque — a
 * localização (rua/bloco) vive aqui, então peças do mesmo produto podem
 * estar guardadas em locais diferentes ao mesmo tempo. Rua=0/bloco=""
 * significa que a peça ainda não tem local definido.
 */
export interface Unidade {
    id: number
    produto_id: number
    codigo: string
    sequencia: number
    rua: number
    bloco: string
    vendida: boolean
    vendida_em?: string | null
    avariada: boolean
    avariada_em?: string | null
}