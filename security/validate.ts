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

/**
 * Um caminho da própria vitrine — "/promocoes", "/produto/12".
 *
 * A conferência não é só "começa com barra": "//loja-falsa.com" também
 * começa com barra e o navegador a lê como endereço ABSOLUTO de outro site,
 * herdando o protocolo da página. Um banner com esse link mandaria o cliente
 * da loja para fora sem que nada na tela do lojista denunciasse — é a forma
 * clássica de redirecionamento aberto. A barra invertida entra na mesma
 * recusa porque alguns navegadores a tratam como barra.
 */
function ehCaminhoInterno(link: string): boolean {

    if (!link.startsWith("/")) return false

    return !link.startsWith("//") && !link.startsWith("/\\")
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

/** Ficha técnica livre de um produto: pares de nome e valor. */
export type Atributos = Record<string, string>

/** Quantos itens a ficha técnica aceita — o mesmo teto do backend. */
export const LIMITE_ATRIBUTOS = 30

/** Tamanho máximo de cada nome ou valor da ficha — idem backend. */
export const LIMITE_TEXTO_ATRIBUTO = 120

/**
 * Formato do código de endereço: rua, bloco e andar em números, e o lado da
 * prateleira em letra — de "3" a "001.005.01.A". Aqui só se confere a forma;
 * se o endereço existe mesmo e aceita mercadoria, quem sabe é o servidor, que
 * tem o cadastro na frente.
 */
const ENDERECO = /^[0-9]{1,3}(\.[0-9]{1,3}(\.[0-9]{1,2}(\.[ABab])?)?)?$/

export interface NovoProduto {
    nome: string
    descricao: string
    preco: number
    /** Quanto a peça custou para entrar: é o que permite calcular margem. */
    custo?: number
    estoque: number
    categoria: string
    /** O que separa este produto dos irmãos ("P", "220V", "500 g"). */
    variacao: string
    /** Como o eixo da variação se chama ("Tamanho", "Voltagem", "Peso"). */
    variacao_rotulo: string
    atributos: Atributos
    imagem_url: string
    loja_id: number

    /**
     * Código da prateleira onde guardar o que entrar ("001.005.01.A"), como
     * está escrito na etiqueta dela; a forma curta ("1.5") também serve,
     * porque é assim que se digita no celular.
     *
     * Opcional de propósito: em branco, quem escolhe onde guardar é o
     * servidor, que põe as peças junto do que já existe daquele produto ou
     * no trecho mais vazio. Guardar mercadoria não deveria exigir que
     * alguém decida, caixa por caixa, em que prateleira ela cabe.
     */
    endereco: string

    /**
     * Este item NÃO é contado unidade a unidade: ele é feito quando alguém
     * pede (ver dto.CadastroProduto.SemContagem no servidor).
     */
    sem_contagem?: boolean


    /**
     * O código de barras DE FÁBRICA, o que já vem impresso na embalagem.
     *
     * Outra coisa que o código interno do produto: aquele é nosso, sorteado
     * no cadastro e impresso pela própria loja; este é do fabricante e existe
     * no mundo inteiro antes de a mercadoria chegar. É o que o caixa bipa
     * quando a garrafa passa na esteira, sem ninguém ter etiquetado nada.
     *
     * Vazio é o caso comum e não é defeito: mercadoria a granel, peça de
     * fabricação própria e confecção pequena não têm código de fábrica
     * nenhum — essas se vendem pela etiqueta que a loja imprime.
     */
    codigo_barras?: string

    /** O "tem hoje?" de quem não conta estoque. */
    disponivel?: boolean
}

/**
 * Confere a ficha técnica: pares em branco são ignorados (o formulário
 * mostra linhas vazias de propósito), o que passa dos limites é recusado.
 */
export function validarAtributos(atributos: Atributos): string[] {

    const erros: string[] = []
    const preenchidos = Object.entries(atributos).filter(([nome, valor]) => nome.trim() && valor.trim())

    if (preenchidos.length > LIMITE_ATRIBUTOS) {
        erros.push(`A ficha técnica aceita até ${LIMITE_ATRIBUTOS} itens.`)
    }

    const longo = preenchidos.some(
        ([nome, valor]) => nome.trim().length > LIMITE_TEXTO_ATRIBUTO || valor.trim().length > LIMITE_TEXTO_ATRIBUTO
    )

    if (longo) {
        erros.push(`Cada item da ficha técnica deve ter até ${LIMITE_TEXTO_ATRIBUTO} caracteres.`)
    }

    return erros
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

    // Imagem é opcional: loja física vende muita coisa que nunca vai ter
    // foto. Quando vem, precisa ser uma URL de verdade — é ela que a vitrine
    // publica.
    if (produto.imagem_url.trim() && !isValidUrl(produto.imagem_url)) {
        erros.push("A URL da imagem precisa ser válida (http ou https).")
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

    // O endereço é opcional: sem ele o servidor escolhe onde guardar, junto
    // do que já existe do produto ou no trecho mais vazio. Quando vem, quem
    // diz se existe, se aceita mercadoria e se ainda cabe é o backend — aqui
    // só se recusa o que nem parece um código de prateleira.
    if (produto.endereco.trim() && !ENDERECO.test(produto.endereco.trim())) {
        erros.push("O endereço deve ser um código de prateleira, como 001.005.01.A.")
    }


    erros.push(...validarAtributos(produto.atributos))
    erros.push(...validarCodigoDeBarras(produto.codigo_barras))
    return erros
}

export interface VariacaoProduto {
    /** O valor que distingue esta variação: "P", "220V", "500 g". */
    variacao: string
    estoque: number
}

/**
 * Cadastro de um produto em várias variações de uma vez: os campos
 * compartilhados (nome, preço, imagem, ficha técnica) valem para todas, e
 * cada variação tem seu próprio valor + estoque. Espelha
 * entradaCadastroVariacoes no backend.
 */
export interface NovoProdutoVariantes {
    nome: string
    descricao: string
    preco: number
    categoria: string
    /** Nome do eixo das variações: "Tamanho", "Voltagem", "Peso". */
    variacao_rotulo: string
    atributos: Atributos
    imagem_url: string
    loja_id: number

    /** Onde guardar o que entrar; em branco, o servidor escolhe. */
    endereco: string
    variacoes: VariacaoProduto[]

    /**
     * O código de barras DE FÁBRICA, o que já vem impresso na embalagem.
     *
     * Outra coisa que o código interno do produto: aquele é nosso, sorteado
     * no cadastro e impresso pela própria loja; este é do fabricante e existe
     * no mundo inteiro antes de a mercadoria chegar. É o que o caixa bipa
     * quando a garrafa passa na esteira, sem ninguém ter etiquetado nada.
     *
     * Vazio é o caso comum e não é defeito: mercadoria a granel, peça de
     * fabricação própria e confecção pequena não têm código de fábrica
     * nenhum — essas se vendem pela etiqueta que a loja imprime.
     */
    codigo_barras?: string

    /**
     * Este item NÃO é contado unidade a unidade: ele é feito quando alguém
     * pede.
     *
     * É o que separa cadastrar comida de cadastrar mercadoria. Com ele
     * ligado, nada é endereçado na prateleira, nada é reservado no pedido e
     * não há número de estoque a informar — a pizza existe quando o cliente
     * a pede.
     */
    sem_contagem?: boolean
}

/** Retorna a lista de erros encontrados (vazia se o cadastro for válido). */
export function validarProdutoVariantes(produto: NovoProdutoVariantes): string[] {
    const erros: string[] = []

    if (!produto.nome.trim()) {
        erros.push("Informe o nome do produto.")
    }

    if (!produto.categoria.trim()) {
        erros.push("Selecione uma categoria.")
    }

    // Imagem é opcional: loja física vende muita coisa que nunca vai ter
    // foto. Quando vem, precisa ser uma URL de verdade — é ela que a vitrine
    // publica.
    if (produto.imagem_url.trim() && !isValidUrl(produto.imagem_url)) {
        erros.push("A URL da imagem precisa ser válida (http ou https).")
    }

    if (!Number.isFinite(produto.preco) || produto.preco <= 0) {
        erros.push("O preço deve ser maior que zero.")
    }

    if (!Number.isFinite(produto.loja_id) || produto.loja_id <= 0) {
        erros.push("Loja inválida.")
    }

    // O endereço é opcional: sem ele o servidor escolhe onde guardar, junto
    // do que já existe do produto ou no trecho mais vazio. Quando vem, quem
    // diz se existe, se aceita mercadoria e se ainda cabe é o backend — aqui
    // só se recusa o que nem parece um código de prateleira.
    if (produto.endereco.trim() && !ENDERECO.test(produto.endereco.trim())) {
        erros.push("O endereço deve ser um código de prateleira, como 001.005.01.A.")
    }

    if (produto.variacoes.length === 0) {
        erros.push("Informe ao menos uma variação.")
    } else {
        const rotulo = (produto.variacao_rotulo.trim() || "variação").toLowerCase()

        for (const variacao of produto.variacoes) {
            if (!variacao.variacao.trim()) {
                erros.push(`Informe o valor de ${rotulo} de cada variação.`)
                break
            }

            // Item que não se conta não tem estoque a informar: cobrar um
            // número aqui faria o lojista de comida inventar um.
            if (!produto.sem_contagem && (!Number.isFinite(variacao.estoque) || variacao.estoque < 0)) {
                erros.push(`Informe um estoque válido para ${rotulo} ${variacao.variacao}.`)
                break
            }
        }

        const repetido = produto.variacoes.some(
            (v, i) => produto.variacoes.findIndex((outra) => outra.variacao.trim() === v.variacao.trim()) !== i
        )

        if (repetido) {
            erros.push(`Há ${rotulo} repetida na lista.`)
        }
    }

    erros.push(...validarAtributos(produto.atributos))
    erros.push(...validarCodigoDeBarras(produto.codigo_barras))

    return erros
}

/**
 * Dados editáveis de um produto já cadastrado. Sem rua/bloco: a
 * localização vive por unidade (ver Unidade em app/type/type.ts) e se
 * transfere pela tela de Estoque, não pela edição do produto.
 */
export interface ProdutoEditavel {
    nome: string
    descricao: string
    preco: number
    estoque: number
    categoria: string
    variacao: string
    variacao_rotulo: string
    atributos: Atributos
    imagem_url: string
    loja_id: number

    /**
     * Este item NÃO é contado unidade a unidade: ele é feito quando alguém
     * pede (ver dto.CadastroProduto.SemContagem no servidor).
     */
    sem_contagem?: boolean


    /**
     * O código de barras DE FÁBRICA, o que já vem impresso na embalagem.
     *
     * Outra coisa que o código interno do produto: aquele é nosso, sorteado
     * no cadastro e impresso pela própria loja; este é do fabricante e existe
     * no mundo inteiro antes de a mercadoria chegar. É o que o caixa bipa
     * quando a garrafa passa na esteira, sem ninguém ter etiquetado nada.
     *
     * Vazio é o caso comum e não é defeito: mercadoria a granel, peça de
     * fabricação própria e confecção pequena não têm código de fábrica
     * nenhum — essas se vendem pela etiqueta que a loja imprime.
     */
    codigo_barras?: string

    /** O "tem hoje?" de quem não conta estoque. */
    disponivel?: boolean
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

    // Imagem é opcional: loja física vende muita coisa que nunca vai ter
    // foto. Quando vem, precisa ser uma URL de verdade — é ela que a vitrine
    // publica.
    if (produto.imagem_url.trim() && !isValidUrl(produto.imagem_url)) {
        erros.push("A URL da imagem precisa ser válida (http ou https).")
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


    erros.push(...validarAtributos(produto.atributos))
    erros.push(...validarCodigoDeBarras(produto.codigo_barras))
    return erros
}

/**
 * Move uma peça para outro endereço do estoque.
 *
 * O destino é o código da prateleira ("001.005.01.A"), o mesmo que está na
 * etiqueta dela. Antes bastava ser "A" ou "B", o que permitia mandar peça
 * para uma prateleira inexistente; hoje quem confere se o endereço existe,
 * aceita mercadoria, não está bloqueado e ainda cabe é o backend.
 */
export interface NovaTransferencia {
    destino: string
}

/** Retorna a lista de erros encontrados (vazia se a transferência for válida). */
export function validarTransferencia(transferencia: NovaTransferencia): string[] {
    const erros: string[] = []
    const destino = transferencia.destino.trim()

    if (!destino) {
        erros.push("Informe o endereço de destino.")
    } else if (!ENDERECO.test(destino)) {
        erros.push("O destino deve ser um código de prateleira, como 001.005.01.A.")
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

/**
 * Slide do banner do topo da loja. `link` aceita URL completa ou caminho
 * relativo (ex: "/produto/108"); vazio significa slide não clicável.
 */
/** Os dois formatos do banner na vitrine. */
export type FormatoBanner = "imagem" | "texto"

export interface NovoBanner {
    titulo: string
    descricao: string
    imagem_url: string
    valor: number
    valor_antigo: number
    link: string

    /**
     * "imagem" mostra a arte ocupando a faixa inteira; "texto" divide a faixa
     * entre a arte e o texto. Quem escolhe é o lojista, na tela de banners.
     */
    formato: FormatoBanner
    ativo: boolean
    ordem: number
}

/** Retorna a lista de erros encontrados (vazia se o banner for válido). */
export function validarBanner(banner: NovoBanner): string[] {
    const erros: string[] = []

    /* Título só é exigido no banner COM texto. No de só imagem ele não é
       apenas dispensável: é o que não se quer — a arte já vem pronta, e
       escrever por cima dela é estragar o trabalho de quem a desenhou. */
    if (banner.formato !== "imagem" && !banner.titulo.trim()) {
        erros.push("Informe o título do banner.")
    }

    if (!banner.imagem_url.trim() || !isValidUrl(banner.imagem_url)) {
        erros.push("Informe uma URL de imagem válida (http ou https).")
    }

    if (!Number.isFinite(banner.valor) || banner.valor < 0) {
        erros.push("O valor não pode ser negativo.")
    }

    if (!Number.isFinite(banner.valor_antigo) || banner.valor_antigo < 0) {
        erros.push("O valor antigo não pode ser negativo.")
    }

    const link = banner.link.trim()

    if (link && !ehCaminhoInterno(link) && !isValidUrl(link)) {
        erros.push("Informe um link válido (URL completa ou caminho começando com /).")
    }

    return erros
}

/* ==========================================================================
   O código de barras de fábrica
   ========================================================================== */

/**
 * Confere o código de barras que o lojista digitou no cadastro.
 *
 * A regra é a MESMA do servidor (ver produtos.normalizarCodigoDeBarras), e
 * está repetida aqui com um propósito específico: pegar o erro de digitação
 * antes de a tela ser enviada, enquanto o campo ainda está na frente de quem
 * digitou. Quem decide continua sendo o backend — ele normaliza, confere a
 * unicidade na loja e recusa de novo.
 *
 * Três resultados, e o do meio é o que importa:
 *
 *   - VAZIO passa. A maioria dos produtos não tem código de fábrica;
 *   - um número do TAMANHO de um código de barras com o dígito verificador
 *     errado é recusado. Esse caso é quase sempre digitação — treze dígitos
 *     com um trocado —, e guardá-lo seria gravar um código que nenhuma
 *     leitura vai achar. O lojista descobriria isso no caixa, com o cliente
 *     na frente, sem nada ligando o defeito ao que ele digitou semanas antes;
 *   - qualquer outro texto passa. Há loja que usa o campo para o código do
 *     fornecedor ("ABC-1234"), e recusá-lo tiraria uma coluna que funciona
 *     para quem a usa desse jeito.
 */
export function validarCodigoDeBarras(bruto?: string): string[] {

    const limpo = (bruto ?? "").replace(/[\s.-]/g, "")

    if (limpo === "") return []

    if (limpo.length > 14) {
        return ["O código de barras deve ter até 14 caracteres."]
    }

    // Só os quatro tamanhos de GTIN entram na conta do dígito verificador. Um
    // código de fornecedor de oito dígitos que por acaso não feche não é
    // etiqueta errada — é outro tipo de código.
    if (![8, 12, 13, 14].includes(limpo.length) || !/^\d+$/.test(limpo)) {
        return []
    }

    if (!verificadorDoGTINConfere(limpo)) {
        return [
            `O código de barras "${bruto?.trim()}" tem ${limpo.length} dígitos mas o dígito`
            + " verificador não fecha — confira se algum número foi digitado errado.",
        ]
    }

    return []
}

/**
 * A conta do dígito verificador do GS1, para GTIN de 8, 12, 13 ou 14 dígitos.
 *
 * Pesos 3 e 1 alternados, da DIREITA para a esquerda, começando em 3 no dígito
 * imediatamente anterior ao verificador. Escrita da direita é o que torna o
 * tamanho irrelevante: a versão que conta da esquerda precisa de um caso para
 * cada tamanho, e é onde nascem os erros de paridade invertida.
 */
function verificadorDoGTINConfere(digitos: string): boolean {

    const corpo = digitos.slice(0, -1)
    const informado = Number(digitos.slice(-1))

    let soma = 0
    let peso = 3

    for (let i = corpo.length - 1; i >= 0; i--) {
        soma += Number(corpo[i]) * peso
        peso ^= 2
    }

    return (10 - (soma % 10)) % 10 === informado
}
