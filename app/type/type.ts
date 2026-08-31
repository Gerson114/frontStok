export interface Produto {
    id: number
    codigo: string
    nome: string
    descricao: string
    preco: number
    estoque: number
    categoria: string
    imagem_url: string
    loja_id: number
    preco_promocional?: number | null

    /**
     * Se o produto está na vitrine.
     *
     * O produto nasce no estoque, não no site: quem cadastra está recebendo
     * mercadoria, e nem tudo que entra na loja é para vender pela internet.
     * Publicar é uma segunda decisão, tomada em "Meu site" — lá se escolhe do
     * estoque o que vai para a vitrine, e nunca se cadastra produto novo.
     */
    publicado?: boolean

    /**
     * O que separa este produto dos irmãos do mesmo modelo: "P" numa
     * camiseta, "220V" num ventilador, "500 g" num café. `variacao_rotulo`
     * é como esse eixo se chama ("Tamanho", "Voltagem", "Peso").
     *
     * Vêm vazios em produto sem variação — o caso da maioria fora do
     * vestuário. Substituíram o antigo campo `tamanho`, que só servia a
     * roupa.
     */
    variacao: string
    variacao_rotulo: string

    /**
     * Ficha técnica livre, no vocabulário do ramo da loja:
     * `{ "Tecido": "algodão", "Voltagem": "220V", "Validade": "12/2027" }`.
     */
    atributos?: Atributos
}

/** Ficha técnica de um produto: pares livres de nome e valor. */
export type Atributos = Record<string, string>

/**
 * Sistema de loja única no painel: não existe seletor de loja na interface,
 * e o backend ignora este campo — ele usa sempre a loja do token, para
 * ninguém cadastrar produto em nome de outra.
 */
export const LOJA_ID = 1

/**
 * Peça física individual de um produto, identificada por um código
 * próprio (código do produto + "-" + sequência, ex: "000618-1"). Permite
 * controlar unidade por unidade em vez de só a quantidade em estoque — a
 * localização vive aqui, então peças do mesmo produto podem estar guardadas
 * em endereços diferentes ao mesmo tempo. Endereço vazio significa que a
 * peça ainda não foi guardada em lugar nenhum.
 */
export interface Unidade {
    id: number
    produto_id: number
    /**
     * Ordem de entrada da peça dentro do produto (1, 2, 3...). Não é código
     * de barras: a etiqueta de todas as peças de um produto é a mesma, a do
     * produto. A sequência só distingue uma peça da outra nas telas do
     * painel, onde se transfere ou avaria uma delas.
     */
    sequencia: number

    /**
     * Onde a peça está guardada. O endereço é um lugar cadastrado do estoque
     * (ver a tela de Endereços), com código ("001.005.01.A"), nome escrito
     * ("rua 1, bloco 5, andar 1, lado A") e tipo — prateleira de venda,
     * pulmão, quarentena ou avaria.
     *
     * Os três vêm escritos do servidor de propósito: o painel mostra o que
     * recebe e não sabe montar código de endereço nenhum. Sem endereço
     * definido, `endereco` vem vazio e `endereco_nome` diz "sem lugar
     * definido" — é a peça que chegou e ainda não foi guardada.
     */
    endereco_id?: number | null
    endereco: string
    endereco_nome: string
    endereco_tipo?: string

    vendida: boolean
    vendida_em?: string | null
    avariada: boolean
    avariada_em?: string | null

    /** Reservada para um pedido: existe, mas já tem dono. */
    reservada?: boolean
    pedido_id?: number | null

    /** Voltou de uma venda e espera tratativa, fora do vendável. */
    devolvida?: boolean

    lote?: string
    validade_em?: string | null

    /** Quanto a peça custou para entrar — é o que permite calcular margem. */
    custo_unitario?: number
}

export type StatusPedido = "pendente" | "confirmado" | "enviado" | "entregue" | "cancelado"

export interface ItemPedido {
    id: number
    produto_id: number
    produto_nome: string
    produto_codigo: string
    quantidade: number
    preco_unitario: number
    produto_descricao: string
    produto_categoria: string
    produto_tamanho: string
    produto_tecido: string
    produto_cor: string
    produto_imagem_url: string
}

/**
 * Pedido feito por um cliente da loja (compra online), separado de uma
 * venda direta no caixa (ver Unidade.vendida) — não baixa estoque
 * automaticamente, só reserva a intenção de compra até a loja confirmar.
 */
export interface Pedido {
    id: number
    codigo: string
    status: StatusPedido
    cliente_id: number
    cliente_nome: string
    cliente_contato: string
    created_at: string
    updated_at: string
    itens: ItemPedido[]
}

/**
 * Slide do banner do topo da loja (frontp), configurado manualmente pelo
 * lojista — texto, imagem e valor livres, não precisam vir de um produto
 * cadastrado. `link` aceita tanto uma URL completa quanto um caminho
 * relativo (ex: "/produto/108"); vazio significa slide não clicável.
 */
export interface Banner {
    id: number
    titulo: string
    descricao: string
    imagem_url: string
    valor: number
    valor_antigo: number
    link: string
    ativo: boolean
    ordem: number
    created_at: string
    updated_at: string
}
/**
 * Estado da assinatura mensal que libera o painel do lojista. Vem de
 * GET /api/assinatura e reflete o que o backend recebeu do Stripe por
 * webhook — o front apenas exibe, nunca decide.
 *
 * `liberada` já é a resposta pronta ("esta loja pode usar o painel agora?"),
 * calculada no backend: leva em conta o status, o período já pago ainda em
 * aberto e a tolerância aberta por uma falha de cobrança. Prefira esse campo
 * a reimplementar a regra aqui.
 *
 * `cobranca_ativa` é falso quando o servidor está rodando sem Stripe
 * configurado (desenvolvimento); nesse caso o painel abre para todos.
 */
export interface Assinatura {
    cobranca_ativa: boolean
    liberada: boolean
    status: string
    /** Plano contratado. Ver PLANOS para o nome e o preço de cada um. */
    plano: Plano
    /**
     * "Esta loja pode usar a vitrine agora?" — já calculado pelo backend:
     * assinatura em dia E plano que inclui o site. Prefira este campo a
     * combinar `liberada` com `plano` por conta própria.
     */
    site_liberado: boolean
    periodo_fim_em?: string | null
    tolerancia_ate?: string | null
    /**
     * O menu do painel já resolvido para esta loja. Só vem o que o plano
     * contratado inclui — quem está no plano de estoque não recebe "Pedidos"
     * nem "Banners", e por isso eles não aparecem no menu lateral.
     */
    menu?: ItemMenu[]
}

/**
 * Uma tela do painel, do jeito que o backend a descreve para esta loja (ver
 * internal/services/assinatura/recursos.go).
 *
 * O menu inteiro — quais telas existem, em que seção, em que ordem — é
 * resposta do servidor. O front só desenha o que vem: regra de plano escrita
 * aqui seria regra que qualquer um edita no navegador, e que um dia
 * discorda do que a API realmente libera.
 */
export interface ItemMenu {
    chave: string
    nome: string
    /** Caminho da tela no painel, ex.: "/page/estoque". */
    rota: string
    /** Grupo do menu lateral: "Catálogo", "Vendas", "Conta". */
    secao: string
    /**
     * Chave da tela sob a qual esta aparece, aberta em acordeão. Vazio nas
     * telas de primeiro nível. "Banners" chega assim, dentro de "Minha loja".
     */
    pai?: string
    /**
     * Falso quando a tela existe no plano da loja mas está suspensa — hoje,
     * só por assinatura atrasada. O que o plano não inclui nem chega aqui.
     */
    liberado: boolean
    /** "assinatura_inativa" quando o caminho é regularizar o pagamento. */
    motivo?: string
}

/**
 * O que acontece se a loja trocar de plano, calculado pelo backend a partir
 * do próprio Stripe — antes de trocar.
 *
 * `titulo`, `aviso` e `rotulo_confirmar` já vêm escritos: a caixa de
 * confirmação mostra o texto que veio, sem montar frase de cobrança aqui.
 * Frase de valor escrita no front é frase que um dia discorda da fatura.
 */
export interface PreviaTroca {
    plano_atual: Plano
    plano_atual_nome: string
    plano: Plano
    plano_nome: string
    /** "subida", "descida" ou "lateral". */
    sentido: string
    /** Vai passar no cartão agora? `valor_agora` é quanto, em centavos. */
    cobra_agora: boolean
    valor_agora: number
    /** Crédito, em centavos, de quem desce de plano no meio do mês pago. */
    credito: number
    proximo_valor: number
    proxima_cobranca_em?: string | null
    moeda: string
    /** Preço cheio do plano de destino, lido do Stripe. */
    mensalidade?: PrecoPlano
    em_teste: boolean
    /** Verdadeiro quando o Stripe não respondeu e o valor é aproximado. */
    estimado: boolean
    ganha_telas?: string[]
    perde_telas?: string[]
    titulo: string
    aviso: string
    rotulo_confirmar: string
}

/**
 * Uma etiqueta de papel: uma peça do pedido, numerada dentro dele ("1/3").
 *
 * `codigo` é o do produto — o mesmo da etiqueta que está na peça, na
 * prateleira. O valor é o do pedido, não o preço de hoje: a etiqueta é o
 * retrato de uma venda que já aconteceu.
 */
export interface VolumeEtiqueta {
    indice: number
    total: number
    codigo: string
    nome: string
    tamanho: string
    cor: string
    valor: number
}

/**
 * Um pedido confirmado pronto para virar papel colado no pacote, já dividido
 * nas etiquetas que gera — uma por peça.
 *
 * Vem do backend com as somas feitas (`pecas`, `total`) e com os volumes
 * numerados: a tela e a impressão mostram o mesmo número porque nenhuma das
 * duas soma nada.
 */
export interface Etiqueta {
    pedido_id: number
    codigo: string
    cliente_nome: string
    cliente_contato: string
    volumes: VolumeEtiqueta[]
    pecas: number
    total: number
    /** dd/mm/aaaa, já formatado pelo backend. */
    criado_em: string
}

/**
 * Os planos oferecidos. O texto é o mesmo do backend (ver
 * internal/services/assinatura/planos.go) e viaja até o Stripe, então não
 * pode ser traduzido nem "arrumado" aqui.
 *
 * "gratis" é a porta de entrada: mesmas telas do plano de estoque, com um
 * teto de peças cadastradas.
 */
export type Plano = "gratis" | "estoque" | "site"

/** Preço de um plano, como o backend o lê do próprio Stripe. */
export interface PrecoPlano {
    centavos: number
    moeda: string
    /** "month" ou "year", conforme cadastrado no Stripe. */
    intervalo: string
}

/**
 * Um plano à venda, do jeito que o backend o descreve. Nome, texto, o que
 * inclui e quanto custa vêm todos de lá — o preço, em particular, é lido do
 * Stripe a cada consulta, para a tela nunca mostrar um valor diferente do
 * que a fatura vai cobrar.
 */
export interface PlanoOferta {
    chave: Plano
    nome: string
    descricao: string
    recursos: string[]
    preco?: PrecoPlano
    /** Dias de teste grátis, quando quem está vendo tem direito a eles. */
    teste_dias?: number
    /** Verdadeiro no plano que a loja já assina. */
    atual?: boolean
}

/**
 * Resposta do primeiro passo do cadastro. `proximo_passo` é o que decide a
 * tela seguinte: "escolher_plano" quando há cobrança configurada (a conta só
 * nasce depois do pagamento) ou "login" quando o servidor roda sem Stripe e
 * a conta foi criada na hora.
 */
export interface InicioCadastro {
    proximo_passo: "escolher_plano" | "login"
    email: string
    cobranca_ativa: boolean
    teste_dias?: number
    planos?: PlanoOferta[]
}

/** Resposta da volta do pagamento: a conta já existe e a sessão está aberta. */
export interface CadastroConcluido {
    email: string
    plano: Plano
}

/**
 * Identidade pública da loja do lojista logado. `vitrine_liberada` já vem
 * respondido pelo backend: depende de o endereço estar escolhido E de o
 * plano incluir o site.
 */
export interface Loja {
    nome_loja: string
    slug: string
    vitrine_liberada: boolean
}
