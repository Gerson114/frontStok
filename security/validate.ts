// Validações de entrada do usuário no front-end.
//
// As mesmas regras (nome/imagem obrigatórios, preço > 0, estoque >= 0,
// URL http/https) são reforçadas de novo no backend
// (internal/handlers/cadastroProduto/roupas e lib/security/validate) —
// nunca confie apenas na validação do cliente.

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export function isValidEmail(email: string): boolean {
    return email.length > 0 && email.length <= 254 && EMAIL_RE.test(email)
}

export function isValidPassword(password: string): boolean {
    return password.length >= 8 && password.length <= 72
}

/** Aceita apenas URLs absolutas http/https (evita esquemas como "javascript:"). */
export function isValidUrl(raw: string): boolean {
    try {
        const url = new URL(raw)
        return url.protocol === "http:" || url.protocol === "https:"
    } catch {
        return false
    }
}

export interface NovoProduto {
    nome: string
    preco: number
    estoque: number
    categoria: string
    tamanho: string
    tecido: string
    cor: string
    imagem_url: string
    loja_id: number
    rua: number
    bloco: string
}

/** Retorna a lista de erros encontrados (vazia se o produto for válido). */
export function validarProduto(produto: NovoProduto): string[] {
    const erros: string[] = []

    if (!produto.nome.trim()) {
        erros.push("Informe o nome do produto.")
    }

    if (!produto.categoria.trim()) {
        erros.push("Selecione uma categoria.")
    }

    if (!produto.imagem_url.trim() || !isValidUrl(produto.imagem_url)) {
        erros.push("Informe uma URL de imagem válida (http ou https).")
    }

    if (!Number.isFinite(produto.preco) || produto.preco <= 0) {
        erros.push("O preço deve ser maior que zero.")
    }

    if (!Number.isFinite(produto.estoque) || produto.estoque < 0) {
        erros.push("O estoque não pode ser negativo.")
    }

    if (!Number.isFinite(produto.loja_id) || produto.loja_id <= 0) {
        erros.push("Loja inválida.")
    }

    if (!Number.isFinite(produto.rua) || produto.rua <= 0) {
        erros.push("Informe uma rua válida.")
    }

    if (produto.bloco !== "A" && produto.bloco !== "B") {
        erros.push("Selecione o bloco (A ou B).")
    }

    return erros
}

/**
 * Dados editáveis de um produto já cadastrado. Sem rua/bloco: a
 * localização vive por unidade (ver Unidade em app/type/type.ts) e se
 * transfere pela tela de Estoque, não pela edição do produto.
 */
export interface ProdutoEditavel {
    nome: string
    preco: number
    estoque: number
    categoria: string
    tamanho: string
    tecido: string
    cor: string
    imagem_url: string
    loja_id: number
}

/** Retorna a lista de erros encontrados (vazia se o produto for válido). */
export function validarProdutoEditavel(produto: ProdutoEditavel): string[] {
    const erros: string[] = []

    if (!produto.nome.trim()) {
        erros.push("Informe o nome do produto.")
    }

    if (!produto.categoria.trim()) {
        erros.push("Selecione uma categoria.")
    }

    if (!produto.imagem_url.trim() || !isValidUrl(produto.imagem_url)) {
        erros.push("Informe uma URL de imagem válida (http ou https).")
    }

    if (!Number.isFinite(produto.preco) || produto.preco <= 0) {
        erros.push("O preço deve ser maior que zero.")
    }

    if (!Number.isFinite(produto.estoque) || produto.estoque < 0) {
        erros.push("O estoque não pode ser negativo.")
    }

    if (!Number.isFinite(produto.loja_id) || produto.loja_id <= 0) {
        erros.push("Loja inválida.")
    }

    return erros
}

/** Move uma unidade específica pro local de destino informado. */
export interface NovaTransferencia {
    rua_destino: number
    bloco_destino: string
}

/** Retorna a lista de erros encontrados (vazia se a transferência for válida). */
export function validarTransferencia(transferencia: NovaTransferencia): string[] {
    const erros: string[] = []

    if (!Number.isFinite(transferencia.rua_destino) || transferencia.rua_destino <= 0) {
        erros.push("Informe uma rua de destino válida.")
    }

    if (transferencia.bloco_destino !== "A" && transferencia.bloco_destino !== "B") {
        erros.push("Selecione o bloco de destino (A ou B).")
    }

    return erros
}

export interface NovaPromocao {
    produto_id: number
    preco_promocional: number
}

/**
 * Retorna a lista de erros encontrados (vazia se a promoção for válida).
 * O preço promocional pode ser menor (desconto) ou maior (reajuste) que o
 * preço original — só precisa ser um valor positivo.
 */
export function validarPromocao(promocao: NovaPromocao): string[] {
    const erros: string[] = []

    if (!Number.isFinite(promocao.produto_id) || promocao.produto_id <= 0) {
        erros.push("Produto inválido.")
    }

    if (!Number.isFinite(promocao.preco_promocional) || promocao.preco_promocional <= 0) {
        erros.push("O preço promocional deve ser maior que zero.")
    }

    return erros
}
