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

    /**
     * Quanto a peça custava SEM promoção, no dia da venda.
     *
     * Gravado na hora porque o desconto não é reconstituível depois:
     * `preco_unitario` já vem promocional, e comparar com o preço de hoje
     * mentiria — o lojista muda preço, e uma venda de março apareceria com um
     * desconto que nunca houve. Zero (ou ausente, nos pedidos antigos) quer
     * dizer "sem desconto registrado", e a tela então não fala em desconto.
     */
    preco_cheio?: number
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

    /**
     * O telefone que o comprador deixou NESTE pedido, só com dígitos.
     *
     * Diferente de `cliente_contato`, que é o contato da conta (quase sempre
     * o e-mail): este é o número para ligar quando o entregador não acha a
     * casa. Vazio nos pedidos anteriores ao campo e nos lançados no balcão.
     */
    telefone?: string
    created_at: string
    updated_at: string

    /**
     * Como está o dinheiro deste pedido.
     *
     * "aprovado" = pago pelo site, com o dinheiro já na conta da loja.
     * "estornado"/"recusado" = passou pelo gateway e não deu certo.
     * Vazio = não passou por gateway nenhum: são os pedidos antigos e os que
     * o próprio lojista lança à mão pelo balcão, que nascem combinados.
     *
     * Pedido esperando pagamento não chega aqui — o servidor o esconde da
     * lista até o provedor confirmar.
     */
    pagamento_status?: string
    pago_em?: string | null

    /** Como o cliente pagou: "pix", "credit_card"… Entra no fechamento. */
    pagamento_metodo?: string

    /**
     * A hora que o cliente marcou para receber, nas lojas de comida que
     * agendam.
     *
     * Ausente quer dizer "para agora" — e não "sem prazo": o prazo da
     * transportadora continua sendo `prazo_dias`, que é outra coisa. Um é a
     * promessa da loja sobre o correio; o outro é a hora que a pessoa
     * escolheu na tela.
     */
    agendado_para?: string | null

    /**
     * Quanto o cliente combinou pagar ADIANTADO. Zero é o caso comum: pagou
     * tudo de uma vez.
     */
    valor_entrada?: number

    /** Quanto já entrou deste pedido, somando as parcelas. */
    valor_pago?: number

    /** Total somado no servidor, igual ao que o cliente viu ao pagar. */
    total?: number

    itens: ItemPedido[]

    /* ---------------------------------------------------------------
       Entrega e rastreio (ver internal/services/frete)
       --------------------------------------------------------------- */

    /** "entrega" ou "retirada". Vazio nos pedidos anteriores à entrega. */
    entrega_tipo?: string

    cep?: string
    logradouro?: string
    numero?: string
    complemento?: string
    bairro?: string
    cidade?: string
    uf?: string

    /** Quanto foi cobrado de frete, congelado no fechamento do pedido. */
    frete?: number
    prazo_dias?: number

    transportadora?: string
    codigo_rastreio?: string

    /**
     * O dia em que a loja se comprometeu a despachar, escolhido ao confirmar
     * o pedido. É esta data que posiciona o pedido no calendário de entregas,
     * e é dela que a previsão de chegada passa a contar.
     */
    envio_previsto_em?: string | null

    /** Quando saiu de fato — preenchido ao informar o rastreio. */
    enviado_em?: string | null

    /**
     * Quando a mercadoria deve chegar, calculada pelo servidor.
     *
     * Antes do despacho é uma estimativa a partir do pagamento; depois dele
     * conta da data em que a mercadoria saiu, que é o que a transportadora
     * promete. Vem calculada, e não gravada, para não haver uma segunda
     * versão desta data para alguém esquecer de atualizar.
     */
    previsao_entrega?: string | null

    /**
     * O último dia em que a loja pode despachar sem quebrar o prazo que ela
     * prometeu. É o teto do seletor de data ao confirmar — marcar depois
     * disso é combinar um atraso no ato de aceitar a venda.
     */
    prazo_limite_envio?: string | null

    /**
     * Onde este pedido cai no calendário, resolvido pelo servidor.
     *
     * Quem vem buscar ocupa o dia em que comprou; quem pediu entrega ocupa o
     * dia do envio. A regra mora no servidor porque duas cópias dela — uma
     * aqui, outra lá — são duas para divergirem.
     */
    dia_na_agenda?: string | null
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
    /**
     * Data da próxima cobrança. NÃO é prova de pagamento: o Stripe avança
     * esse período no momento em que emite a fatura, antes de saber se ela
     * vai ser paga. Para "até quando está pago", use `pago_ate`.
     */
    periodo_fim_em?: string | null
    /** Até quando o acesso está pago — o prazo que sobrevive a um cancelamento. */
    pago_ate?: string | null
    /**
     * A loja está no teste grátis: o painel abre inteiro e ainda não houve
     * cobrança nenhuma. A data em que o teste acaba (e a primeira cobrança
     * acontece) é `periodo_fim_em`.
     */
    em_teste?: boolean
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
     * Falso quando a tela existe mas não abre agora. O item continua no menu,
     * em cinza e com cadeado — some só a tela que um funcionário não tem
     * permissão de ver, e essa nem chega aqui.
     */
    liberado: boolean
    /**
     * Por que não abre: "assinatura_inativa" quando o caminho é regularizar o
     * pagamento, "plano_pro" quando a tela é do plano Pro e esta loja está no
     * base, "so_matriz" quando a tela é da loja principal e o painel está
     * aberto numa filial. Os dois primeiros levam à assinatura; o terceiro,
     * à tela das lojas, que é onde se troca de unidade.
     */
    motivo?: string
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

/** Preço da assinatura, como o backend o lê do provedor de cobrança. */
export interface PrecoPlano {
    centavos: number
    moeda: string
    /** "month" ou "year", conforme cadastrado no Stripe. */
    intervalo: string
}

/**
 * O plano Pro, quando este servidor o tem configurado: o que ele acrescenta
 * ao base e quanto custa.
 *
 * Ausente quer dizer que o Pro não está à venda aqui — e aí a tela mostra um
 * plano só, em vez de anunciar o que o checkout não conseguiria cobrar.
 */
export interface OfertaPro {
    preco?: PrecoPlano
    /** O que o Pro acrescenta ao base, e não a lista inteira do sistema. */
    recursos: string[]
    /** Quantas lojas o Pro abre na mesma conta. */
    lojas: number
}

/**
 * O que está à venda, do jeito que o backend descreve: nome, texto, o que
 * inclui e quanto custa vêm todos de lá — o preço, em particular, é lido do
 * provedor de cobrança a cada consulta, para a tela nunca mostrar um valor
 * diferente do que a fatura vai cobrar.
 *
 * `recursos` é o que o plano BASE entrega. O que o Pro acrescenta vem em
 * `pro`, separado, porque é assim que a tela os mostra: um ao lado do outro,
 * com a diferença à vista.
 */
export interface Oferta {
    nome: string
    descricao: string
    recursos: string[]
    preco?: PrecoPlano
    pro?: OfertaPro
    /**
     * Dias de teste grátis antes da primeira cobrança, decididos pelo
     * servidor. Zero (ou ausente) quer dizer que este servidor cobra na
     * entrada — a tela então não promete teste nenhum.
     */
    teste_dias?: number
    /** O cartão é pedido já na entrada do teste? */
    teste_pede_cartao?: boolean
}

/**
 * Resposta do primeiro passo do cadastro. `proximo_passo` é o que decide a
 * tela seguinte: "pagar" quando há cobrança configurada (a conta só nasce
 * depois do pagamento) ou "login" quando o servidor roda sem cobrança e a
 * conta foi criada na hora.
 */
export interface InicioCadastro {
    /**
     * "confirmar" quando o servidor enviou um código de 6 dígitos e espera
     * ele de volta; "pagar" quando não há confirmação a fazer; "login"
     * quando o servidor roda sem cobrança e a conta já foi criada.
     */
    proximo_passo: "confirmar" | "pagar" | "login"
    email: string
    cobranca_ativa: boolean
    oferta?: Oferta

    /**
     * A frase que o servidor mandou para a tela ("enviamos um código de 6
     * dígitos para ..."). Vem de lá para o texto ser um só — o mesmo que o
     * log e o suporte veem.
     */
    mensagem?: string
}

/** Resposta da volta do pagamento: a conta já existe e a sessão está aberta. */
export interface CadastroConcluido {
    email: string
}

/**
 * Identidade pública da loja do lojista logado. `vitrine_liberada` já vem
 * respondido pelo backend: depende de o endereço estar escolhido E de a
 * assinatura estar em dia.
 */
/**
 * Um bloco da home da vitrine.
 *
 * O editor monta uma LISTA disto — dado, nunca marcação. Quem desenha é o
 * código da vitrine; o lojista escolhe, ordena e configura. É o que faz este
 * editor não ser uma porta de injeção de código na página que o comprador
 * abre (ver services/paginas no backend, que valida tudo antes de gravar).
 */
/**
 * Um cartão da faixa de selos ("compra segura", "acompanhe seu pedido").
 *
 * O ícone é uma CHAVE de uma lista fechada ("cadeado", "caixa"), e não um
 * endereço de imagem: quem a traduz em desenho é a vitrine, com os ícones que
 * ela já tem. É a mesma regra do resto do editor — o que se guarda é dado, e o
 * desenho continua sendo nosso.
 *
 * Título e texto aceitam etiquetas entre chaves, trocadas pela vitrine pelo
 * dado real da loja: `{pagamentos}`, `{telefone}`, `{whatsapp}`, `{endereco}`,
 * `{horario}`, `{loja}`.
 */
export interface Cartao {
    icone?: string
    titulo?: string
    texto?: string
    link?: string
    /** "pequeno" | "medio" | "grande" — o destaque deste cartão na faixa. */
    tamanho?: string
}

export interface Bloco {
    /** Identifica o bloco dentro da página, para o editor saber o que arrastou. */
    id: string
    tipo: string

    titulo?: string
    texto?: string

    /** Prateleira: de onde vêm os produtos e quantos. */
    fonte?: string
    categoria?: string
    quantidade?: number

    /** Aparência, sempre em opções fechadas — nunca CSS livre. */
    alinhamento?: string
    tom?: string
    altura?: string

    imagem_url?: string
    alt?: string

    link?: string
    botao_texto?: string

    /** Só do tipo "cartoes": os selos da faixa, na ordem em que aparecem. */
    cartoes?: Cartao[]

    /**
     * Só do tipo "secao": as colunas, cada uma com os blocos dela.
     *
     * Uma lista de listas, e não uma árvore livre — um nível só de
     * aninhamento. É escolha, não limitação técnica: árvore sem fundo é o que
     * faz um editor de páginas virar um lugar onde se perde o bloco dentro do
     * bloco dentro do bloco.
     */
    colunas?: Bloco[][]
    fundo?: string
    largura?: string
}

export interface Loja {
    nome_loja: string
    slug: string
    vitrine_liberada: boolean

    /* ---------------------------------------------------------------
       Como o cliente fala com a loja, e onde ela fica

       Publicado na vitrine: no rodapé e na tela do pedido. Vazio quando o
       lojista não preencheu — e aí simplesmente não aparece lá.
       --------------------------------------------------------------- */

    /** Só dígitos, com DDD. É o que vira link de conversa na vitrine. */
    whatsapp?: string
    telefone?: string
    endereco?: string
    horario?: string

    /**
     * Onde a loja fica no mapa, para a vitrine oferecer a unidade mais perto
     * de quem está olhando.
     *
     * Preenchido à mão pelo lojista, e não adivinhado do endereço escrito:
     * deduzir coordenada de texto livre exige um serviço externo, e um
     * alfinete errado manda o cliente para outra cidade — o que é pior do que
     * não oferecer a loja mais próxima. Loja sem o par não entra na ordenação
     * por distância; ela continua na lista, no fim.
     */
    latitude?: number | null
    longitude?: number | null
}

/* ==========================================================================
   A equipe da loja
   ========================================================================== */

/** Quem trabalha na loja e entra no painel sem ser o dono. */
export interface Funcionario {
    id: number
    nome: string
    email: string
    ativo: boolean

    /**
     * Gerente da filial: a conta que administra ESTA loja, um degrau abaixo
     * do dono. Ela cadastra e afasta gente e ajusta o que cada um abre, mas
     * não alcança as lojas da rede, a assinatura, a conta que recebe o
     * dinheiro nem o layout do site — que é da matriz.
     *
     * Só o dono promove e rebaixa: um gerente que criasse outro gerente
     * fabricaria um par para fazer o que ele mesmo não pode.
     */
    gerente: boolean

    /**
     * Quanto esta pessoa recebe sobre o que vende, em por cento.
     *
     * Zero quer dizer "não recebe comissão", que é o caso da maior parte de
     * uma loja — o conferente do estoque não vende. Só o dono muda este
     * número: o gerente admite gente e ajusta o que ela abre, mas quanto ela
     * ganha é de quem paga.
     */
    comissao_percentual: number

    /** As chaves das telas que esta pessoa pode abrir (as mesmas do menu). */
    recursos: string[]
}

/**
 * Uma tela que o dono pode conceder.
 *
 * É o mesmo catálogo que monta o menu — daí `secao` e `pai` virem junto: a
 * lista de caixas para marcar é desenhada agrupada como o menu, e não como
 * vinte e três opções soltas em que ninguém acha nada.
 */
export interface PermissaoConcedivel {
    chave: string
    nome: string
    secao: string
    pai?: string
}

/* ==========================================================================
   Início — os números do negócio
   ========================================================================== */

/** O dinheiro de uma janela de tempo (o dia de hoje, ou o mês corrente). */
export interface PeriodoDoPainel {
    /** Quantas peças saíram — a unidade real, já que o controle é peça a peça. */
    pecas: number

    faturamento: number

    /** O que essas peças custaram para entrar, somado da entrada de mercadoria. */
    custo: number

    /** Faturamento menos custo, em dinheiro. */
    margem: number

    /**
     * Falso quando alguma peça do período saiu sem custo gravado.
     *
     * Não invalida a margem, mas muda o que ela quer dizer: sem o custo de
     * parte das peças, ela sai maior do que é. A tela avisa em vez de deixar
     * o lojista decidir em cima de um número que ele supõe exato.
     */
    custo_conhecido: boolean

    /**
     * O MESMO intervalo do período anterior — hoje até esta hora contra
     * ontem até a mesma hora; este mês até hoje contra o mês passado até o
     * mesmo dia.
     *
     * O intervalo igual é o que torna a comparação honesta: treze dias
     * contra um mês inteiro faria toda loja parecer em queda até o dia 28.
     */
    faturamento_anterior: number
    pecas_anterior: number
}

/** O que está parado esperando alguém agir. */
export interface AtencaoDoPainel {
    pedidos_aguardando_pagamento: number
    pedidos_em_andamento: number
    pecas_sem_endereco: number
    pecas_avariadas: number
    tarefas_abertas: number
    devolucoes_abertas: number

    /** Passou do prazo prometido e ainda não chegou ao cliente. */
    pedidos_atrasados: number

    /** Mensagens de cliente sem resposta: WhatsApp e chat da vitrine somados. */
    clientes_esperando: number

    /**
     * Devolução que a loja aceitou e cujo dinheiro ainda não voltou.
     *
     * É a pendência mais cara da lista: dívida com nome e endereço. Acontece
     * quando o provedor de pagamento não estorna por API — alguém precisa
     * devolver no painel dele.
     */
    devolucoes_a_pagar: number
    valor_a_pagar: number
}

/** Uma linha do "o que mais sai". */
export interface ProdutoVendido {
    produto_id: number
    nome: string
    pecas: number
    faturamento: number
}

/** Por onde a mercadoria saiu: o balcão e os pedidos são fluxos diferentes. */
export interface CanalDoPainel {
    pecas: number
    faturamento: number
}

/** O fechamento do dia. */
export interface CaixaDoPainel {
    /** O que SAIU hoje, por porta. */
    balcao: CanalDoPainel
    pedidos: CanalDoPainel

    /**
     * O balcão aberto por forma de pagamento — o que se confere contra a
     * gaveta e contra o extrato da maquininha no fim do expediente.
     *
     * Só o balcão: o dinheiro do pedido é do pedido, e ele tem o próprio
     * registro de como foi pago. Peça vendida antes desta coluna existir cai
     * em "Outro", e por isso a soma dos meios pode não bater com o total do
     * balcão num dia antigo.
     */
    /**
     * Opcional na leitura de propósito: um servidor mais antigo que esta tela
     * não manda o campo, e uma loja que ainda não vendeu no balcão já mandou
     * `null` — os dois derrubavam a tela inteira num `.length`. Quem lê usa
     * `?? []`.
     */
    balcao_por_meio?: MeioNoCaixa[] | null

    /**
     * O que ENTROU hoje: pedidos cujo pagamento foi confirmado hoje. É outra
     * pergunta que a de cima — a mercadoria pode sair num dia e o dinheiro
     * entrar noutro —, e é esta que fecha com o extrato.
     */
    pedidos_pagos: number
    valor_recebido: number
    ticket_medio_do_dia: number
}

/** O que uma pessoa da equipe fez. Só o dono recebe esta lista. */
export interface PessoaDoPainel {
    id: number
    nome: string

    pecas_no_mes: number
    faturamento_no_mes: number
    pecas_hoje: number
    faturamento_hoje: number

    /** Pedidos no nome dela neste mês. */
    pedidos: number

    /** Atendimento: chat do site e WhatsApp somados. */
    conversas: number
    mensagens: number

    /** Clientes sob a responsabilidade dela agora. */
    clientes_ativos: number
}

export interface ResumoDoPainel {
    dia: PeriodoDoPainel
    mes: PeriodoDoPainel
    caixa: CaixaDoPainel
    atencao: AtencaoDoPainel
    mais_saem: ProdutoVendido[]

    /**
     * O desempenho de cada pessoa. Vem vazio para quem não é dono: o número
     * de todo mundo na tela de todo mundo é constrangimento, não gestão.
     */
    equipe?: PessoaDoPainel[]
    sou_dono: boolean
}

/** Uma loja do dono, como ele a vê na lista. */
export interface LojaDaRede {
    id: number
    nome: string
    slug?: string
    ativa: boolean

    /** A que abre por padrão e a que sobra se o plano cair para o base. */
    principal: boolean

    /** A que o painel está mostrando agora. */
    aberta: boolean

    /**
     * Quem trabalha nesta unidade: o gerente primeiro, depois o resto.
     *
     * Vem na lista da rede porque "quem responde por esta loja, e quem está
     * nela?" é pergunta de dono, e a tela de Funcionários só responde pela
     * unidade ABERTA — montar esse retrato por lá seria abrir uma loja de cada
     * vez. Quem está afastado vem junto, marcado: uma filial com três pessoas
     * e duas sem acesso é justamente o que o dono precisa enxergar.
     */
    equipe?: PessoaDaLoja[]

    criada_em: string
}

/** Alguém da equipe de uma loja, como o dono a vê na lista da rede. */
export interface PessoaDaLoja {
    nome: string
    email: string
    gerente: boolean
    ativo: boolean
}

/** As lojas do dono, com o que o plano dele comporta. */
export interface RedeDeLojas {
    lojas: LojaDaRede[]

    /** Quantas lojas o plano contratado abre. */
    limite: number

    /** Se ainda cabe abrir outra. Contam só as ativas — loja fechada não ocupa vaga. */
    pode_abrir: boolean
}

/** O que chegou e ninguém viu, para a bolinha da barra superior. */
export interface Notificacoes {
    /** Pedidos que chegaram e ninguém tocou ainda. */
    pedidos: number

    /** Mensagens de cliente não lidas, pelas duas portas. */
    whatsapp: number
    site: number

    /**
     * A conversa interna da equipe.
     *
     * Vem nesta mesma resposta, e não numa chamada própria: eram duas
     * requisições a cada troca de tela e a cada aviso do canal ao vivo, e a
     * loja inteira sai por um IP só. Fica de FORA do total — o sino é o
     * negócio batendo à porta, a conversa interna tem bolinha ao lado.
     */
    equipe: number

    total: number
}

/* ==========================================================================
   A conversa interna da equipe
   ========================================================================== */

/**
 * Uma pessoa da equipe dentro da conversa.
 *
 * O `cracha` é a identidade que a tela usa: o par (id, dono) escrito, porque
 * dono e funcionário vivem em tabelas diferentes no servidor e podem ter o
 * mesmo número. É ele que a tela devolve ao pedir uma conversa reservada —
 * nunca o nome da sala, que quem monta é o servidor.
 */
export interface MembroDaEquipe {
    id: number
    dono: boolean
    nome: string
    cracha: string

    /**
     * Se o dono já confirmou a entrada desta pessoa na conversa.
     *
     * A lista vem INTEIRA, com cada um marcado, em vez de já filtrada: quem
     * não entrou não pode receber mensagem nem tarefa, mas sumir da lista sem
     * dizer por quê faz o dono concluir que o sistema quebrou — quando a
     * verdade é "passe o código a ele".
     */
    na_conversa: boolean
}

/** A cor do papel no mural. */
export type CorDaNota = "amarela" | "verde" | "azul" | "rosa" | "cinza"

/** Um recado pendurado num mural. */
export interface NotaDaEquipe {
    id: number
    mural_id: number
    texto: string
    cor: CorDaNota

    /**
     * Onde o papel está no quadro, em pixels absolutos.
     *
     * Absolutos e não em porcentagem: em porcentagem a nota muda de vizinha
     * conforme a largura da janela de quem olha, e o agrupamento que alguém
     * fez com a mão se desfaz na tela do colega.
     */
    x: number
    y: number

    /** A ordem de empilhamento. Quem pega uma nota a traz para a frente. */
    z: number

    criada_por_id: number
    criada_por_dono: boolean
    criada_por: string
    cracha: string
    criada_em: string
}

/** Uma linha do seletor de murais. */
export interface QuadroDaEquipe {
    id: number
    nome: string

    /** O quadro da própria pessoa — o que ela não pode abandonar. */
    proprio: boolean

    /** Se ela manda neste quadro: chamar gente, tirar gente. */
    meu: boolean

    dono_nome: string
}

/** Quem participa de um quadro. */
export interface MembroDoQuadro {
    pessoa_id: number
    dono: boolean
    nome: string
    entrou_em: string
}

/** O quadro aberto, os quadros a que a pessoa tem acesso, e o tamanho. */
export interface Mural {
    notas: NotaDaEquipe[]
    murais: QuadroDaEquipe[]
    aberto: QuadroDaEquipe
    membros: MembroDoQuadro[]
    largura: number
    altura: number
}

/** A urgência de uma tarefa, na ordem em que aperta. */
export type PrioridadeDaTarefa = "baixa" | "normal" | "alta" | "urgente"

/**
 * A vida de uma tarefa.
 *
 * Cancelada é diferente de concluída de propósito: "não vamos mais fazer" e
 * "está feito" são desfechos distintos, e somá-los apagaria a pergunta do fim
 * do mês — quanto do que foi pedido foi feito.
 */
export type SituacaoDaTarefa = "aberta" | "em_andamento" | "concluida" | "cancelada"

/** Uma coisa que alguém da equipe pediu a alguém. */
export interface TarefaDaEquipe {
    id: number
    situacao: SituacaoDaTarefa
    titulo: string
    descricao?: string
    prioridade: PrioridadeDaTarefa

    criada_por_id: number
    criada_por_dono: boolean
    criada_por: string

    para_id: number
    para_dono: boolean
    para: string

    /** Datas em "2026-09-30", sem hora: prazo de tarefa é um DIA. */
    comeca_em?: string
    termina_em?: string
    concluida_em?: string

    criada_em: string
}

/** Um grupo da equipe. */
export interface GrupoDaEquipe {
    id: number
    nome: string
    criado_por_id: number
    criado_por_dono: boolean
    criado_por: string
    criado_em: string
}

/** Uma linha da lista de conversas. */
export interface SalaDaEquipe {
    /** "geral", o crachá do colega, ou "g<id>" de um grupo. */
    chave: string

    nome: string

    /** "geral", "pessoa" ou "grupo" — decidido pelo servidor, não pelo formato da chave. */
    tipo: "geral" | "pessoa" | "grupo"

    geral: boolean

    /** Só nos grupos: quem pode mexer em quem está dentro. */
    meu?: boolean

    /**
     * O nome desta sala numa forma que não diz nada a quem não participa dela.
     *
     * O aviso de "está digitando" viaja pelo canal da loja inteira e carrega
     * este token em vez do nome da sala — assim ninguém de fora descobre que
     * uma conversa reservada existe. A tela casa o token com o da sala aberta.
     */
    token: string

    nao_lidas: number

    /** A última fala, cortada, para a lista dizer do que se trata. */
    previa?: string
    falado_em?: string
}

/** Uma fala dentro de uma sala. */
export interface FalaDaEquipe {
    id: number
    autor_id: number
    autor: string
    autor_dono: boolean
    cracha: string
    texto: string
    criada_em: string

    /**
     * A citação, quando esta fala responde outra.
     *
     * Vem montada do servidor — autor e um pedaço do texto — para a tela
     * desenhar a citação mesmo quando a original está fora do trecho
     * carregado, que é o caso sempre que alguém responde uma coisa dita ontem.
     */
    responde_a?: number
    responde_autor?: string
    responde_texto?: string
}

/**
 * O estado da conversa antes de abrir qualquer sala.
 *
 * Trancado, o servidor devolve só `destravado: false` e quem é você — nem a
 * lista de colegas, nem prévia nenhuma. É de propósito: quem não passou pelo
 * código não recebe nem os nomes de quem trabalha na loja.
 */
/**
 * O pé em que está a entrada de uma pessoa na conversa.
 *
 * Vazio é quem nunca digitou o código. "pendente" é quem acertou e espera o
 * dono confirmar — acertar o código abre um pedido, não a porta.
 */
export type SituacaoDoAcesso = "" | "pendente" | "aprovado" | "recusado"

/** Uma linha da lista de quem pediu para entrar, como o dono a vê. */
export interface PedidoDeAcesso {
    cracha: string
    nome: string
    dono: boolean

    /** Vazia quer dizer que a pessoa trabalha aqui e ainda não digitou o código. */
    situacao: SituacaoDoAcesso

    /** Nulo em quem nunca pediu. */
    pedido_em?: string
    decidido_em?: string
}

export interface EstadoDaEquipe {
    destravado: boolean
    situacao?: SituacaoDoAcesso

    /**
     * O que esta pessoa pode fazer além de conversar, decidido pelo servidor.
     *
     * `pode_codigo` é ver e trocar o código — o poder de dar acesso, que o
     * dono pode delegar a uma pessoa da equipe. `pode_admitir` é dizer quem é
     * da empresa, que é só do dono e não se delega.
     */
    pode_codigo?: boolean
    pode_admitir?: boolean

    /**
     * O dono ainda não gerou o código desta loja — ele nasce só na conta
     * dele, quando abre a tela de Funcionários.
     *
     * A tela usa isto para não oferecer um campo que não tem resposta certa:
     * sem o aviso, a pessoa digitaria palpites até gastar o limite de
     * tentativas por causa de uma configuração que falta.
     */
    sem_codigo?: boolean
    eu: MembroDaEquipe
    membros?: MembroDaEquipe[]
    salas?: SalaDaEquipe[]
}

/** O código único da loja, como o dono o vê. */
export interface CodigoDaLoja {
    codigo: string
    trocado_em: string
    aviso?: string
}

/* ==========================================================================
   Gráficos do painel
   ========================================================================== */

/** A régua do gráfico de vendas. */
export type GranularidadeDeVendas = "dia" | "mes" | "ano"

/** Uma janela da série de vendas: um dia, um mês ou um ano. */
export interface PontoDeVenda {
    /**
     * A janela em texto: "2026-09-09", "2026-09" ou "2026".
     *
     * Vem pronta do servidor, e a tela não a reconstrói a partir de uma data
     * ISO: quem sabe em que fuso a venda foi gravada é quem a gravou, e
     * deixar o navegador converter empurraria a venda das 22h para o dia
     * seguinte em metade dos computadores.
     */
    rotulo: string

    pecas: number
    faturamento: number
    custo: number
    margem: number

    /** O mesmo faturamento separado pelas duas portas de saída. */
    balcao: number
    pedidos: number
}

export interface SerieDeVendas {
    granularidade: GranularidadeDeVendas
    pontos: PontoDeVenda[]

    /** Os totais da série, somados pelo servidor. */
    pecas: number
    faturamento: number
    margem: number
}

/** O que uma pessoa fez com as conversas no período. */
export interface PessoaDoFluxo {
    id: number
    nome: string

    /** Pegou da fila por conta própria. */
    assumiu: number

    /** Ganhou de outra pessoa. */
    recebeu: number

    /** Passou adiante, e devolveu à fila. */
    passou: number
    liberou: number

    iniciou: number
    encerrou: number

    /** Quantas conversas estão na mão dela agora. */
    em_aberto: number
}

/** Uma seta do fluxo: quantas conversas saíram de alguém para outra pessoa. */
export interface PassagemDeAtendimento {
    de_id: number
    de: string
    para_id: number
    para: string
    total: number
}

/** Em que pé estão as conversas agora, somando as duas portas. */
export interface FilaDeAtendimento {
    livres: number
    atribuidos: number
    em_atendimento: number
    encerrados: number
}

/** O movimento de um dia. */
export interface DiaDoFluxo {
    dia: string
    assumidas: number
    passadas: number
    encerradas: number
    reabertas: number
}

export interface FluxoDeAtendimento {
    dias: number

    /**
     * Desde quando existe rastro nesta loja. Ausente enquanto nada foi
     * gravado — a tela avisa em vez de deixar o dono achar que a equipe não
     * fez nada.
     */
    desde?: string

    pessoas: PessoaDoFluxo[]
    passagens: PassagemDeAtendimento[]
    fila: FilaDeAtendimento
    linha_do_dia: DiaDoFluxo[]
}

/* ==========================================================================
   Frete e entrega
   ========================================================================== */

/** A decisão da loja sobre entrega. */
export interface ConfigFrete {
    /**
     * Desligado é a loja que não entrega: a vitrine para de pedir endereço e
     * o pedido nasce como retirada. É o estado inicial de propósito — ligar
     * antes de a tabela existir faria toda venda sair com frete zero.
     */
    ativo: boolean

    retirada_na_loja: boolean

    /** Zero desliga a isenção; não quer dizer "tudo grátis". */
    frete_gratis_acima: number
}

/** Uma linha da tabela: quanto custa entregar num estado, e em quantos dias. */
export interface RegraFrete {
    uf: string
    valor: number
    prazo_dias: number
}

/* ==========================================================================
   Os três painéis por assunto (ver services/painel no backend)

   A régua é a mesma dos gráficos de venda — dia, mês ou ano —, e por isso o
   tipo dela é reaproveitado: quatro telas com a mesma régua se leem lado a
   lado sem ninguém refazer conta de cabeça.
   ========================================================================== */

/** Uma janela da régua no painel da mercadoria. */
export interface PontoDeMercadoria {
    rotulo: string
    pecas_entraram: number
    pecas_sairam: number

    /** O dinheiro dos dois lados: o que a loja pagou e o que ela recebeu. */
    custo: number
    receita: number
}

export interface LinhaDeProduto {
    produto_id: number
    nome: string
    codigo: string
    pecas: number
    valor: number
}

export interface LinhaDeFornecedor {
    nome: string
    pecas: number
    custo: number
}

export interface LinhaParada {
    produto_id: number
    nome: string
    codigo: string
    pecas: number
    dias_paradas: number
}

export interface PainelDaMercadoria {
    granularidade: GranularidadeDeVendas
    serie: PontoDeMercadoria[]

    resumo: {
        pecas_entraram: number
        pecas_sairam: number
        custo_entrada: number
        receita_saida: number

        /** O que está na loja agora — não depende da régua escolhida. */
        em_estoque: number
        reservadas: number
        avariadas: number
        devolvidas: number
        custo_parado: number
    }

    mais_sairam: LinhaDeProduto[]
    mais_entraram: LinhaDeProduto[]
    fornecedores: LinhaDeFornecedor[]
    paradas: LinhaParada[]
}

/** Uma pessoa no painel da equipe, com o que ela fez na janela. */
export interface PessoaNoPainel {
    id: number
    nome: string
    email?: string
    gerente: boolean
    ativo: boolean

    /** Quem aparece nas somas sem estar no cadastro: o dono, ou quem saiu. */
    dono: boolean

    desde_em?: string

    pecas_vendidas: number
    faturamento: number
    pedidos_assumidos: number
    conversas_atendidas: number
    tarefas_concluidas: number

    /** Quantas telas do painel esta pessoa pode abrir. */
    telas: number
}

export interface PainelDaEquipe {
    granularidade: GranularidadeDeVendas

    resumo: {
        pessoas: number
        ativos: number
        gerentes: number
        pecas_vendidas: number
        faturamento: number

        /** Peças que saíram sem nome gravado: venda do site, baixa automática. */
        sem_dono: number
    }

    pessoas: PessoaNoPainel[]
}

/** Uma janela da régua no painel da expedição. */
export interface PontoDeEntrega {
    rotulo: string
    retiradas: number
    entregas: number
}

export interface LinhaDeTransportadora {
    nome: string
    pedidos: number
    frete: number
}

export interface LinhaDeDestino {
    uf: string
    cidade: string
    pedidos: number
    frete: number
}

export interface PainelDasEntregas {
    granularidade: GranularidadeDeVendas
    serie: PontoDeEntrega[]

    resumo: {
        retiradas: number
        entregas: number
        frete_cobrado: number

        /** Só conta pedido entregue: o que está a caminho não tem desfecho. */
        no_prazo: number
        atrasados: number

        /** Horas entre o pagamento e o despacho — o tempo que é da loja. */
        horas_ate_despachar: number

        /** A fila de agora, fora da régua de tempo. */
        a_embalar: number
        a_caminho: number
        a_retirar: number
    }

    transportadoras: LinhaDeTransportadora[]
    destinos: LinhaDeDestino[]
}

/* ==========================================================================
   As regras que cada loja ajusta para si (ver services/configuracao)

   Tudo o que está aqui já era decidido — só que escrito à mão no código,
   igual para todas as lojas. O que mudou é que agora há onde mudar.
   ========================================================================== */

export interface ConfiguracaoDaLoja {
    /** Onde o DIA desta loja começa, no nome IANA. Vazio é "o do servidor". */
    fuso: string

    /** Quanto tempo o pedido segura as peças esperando o pagamento. */
    minutos_para_pagar: number

    /** Janela para o comprador avisar que a mercadoria chegou danificada. */
    dias_para_avisar_avaria: number

    /** O que conta como atraso num pedido sem prazo combinado. */
    dias_sem_prazo_prometido: number

    /** A partir de quando uma peça vendável entra na lista do que está parado. */
    dias_para_considerar_parado: number

    /** Liga o recado que o servidor manda no WhatsApp quando alguém pede devolução. */
    avisar_devolucao_no_whatsapp: boolean

    /**
     * Oferece, no checkout, combinar o pagamento com a loja em vez de pagar
     * na hora. O pedido nasce "combinando" — aparece no painel e não conta
     * como venda até alguém confirmar que o dinheiro caiu.
     */
    pagar_pelo_whatsapp: boolean

    /** Quanto tempo o pedido combinado segura as peças antes de ser desfeito. */
    horas_para_combinar: number

    /* ----------------------------------------------------------------------
       O RAMO DA LOJA

       Quem vende comida não vende como quem vende mercadoria: o prato é feito
       depois do pedido, o cliente quer saber a que horas fica pronto, e há um
       valor abaixo do qual não compensa sair para entregar.
       ---------------------------------------------------------------------- */

    /** "produtos" (o padrão) ou "comida". */
    ramo: RamoDaLoja

    /** Quando o pedido de comida sai: "na_hora", "agendado" ou "os_dois". */
    atendimento: AtendimentoDaLoja

    /** Quanto a cozinha leva. É a promessa que a vitrine mostra a quem pede para agora. */
    minutos_de_preparo: number

    /** O quanto antes o cliente precisa agendar. */
    minutos_de_antecedencia: number

    /** Até quantos dias à frente o cliente pode marcar. */
    dias_para_agendar: number

    /** Abaixo disto a loja não fecha pedido pelo site. Zero é "sem mínimo". */
    pedido_minimo: number

    /**
     * Oferece, no checkout, pagar uma parte agora e o resto na entrega.
     *
     * Desligado por padrão: metade do dinheiro ficando para depois é uma
     * decisão de risco da loja, não uma facilidade a ser ligada por nós.
     */
    aceita_entrada: boolean

    /** Quanto o cliente paga adiantado, em por cento. Cinquenta é o costume. */
    percentual_da_entrada: number

    atualizado_em?: string
}

export type RamoDaLoja = "produtos" | "comida"
export type AtendimentoDaLoja = "na_hora" | "agendado" | "os_dois"

/** Uma opção fechada oferecida pelo servidor, com a explicação junto. */
export interface OpcaoDoRamo {
    valor: string
    nome: string
    explicacao: string
}

export interface LimiteDeCampo {
    minimo: number
    maximo: number
}

export interface RespostaDaConfiguracao {
    configuracao: ConfiguracaoDaLoja

    /** Os limites de cada campo, para a tela mostrá-los ao lado em vez de só recusar. */
    limites: Record<string, LimiteDeCampo>

    /** Os fusos que a loja pode escolher. */
    fusos: { valor: string; nome: string }[]

    /** Produtos ou comida, com a explicação de cada um. */
    ramos: OpcaoDoRamo[]

    /** Na hora, agendado ou os dois. */
    atendimentos: OpcaoDoRamo[]
}

/* ==========================================================================
   A comissão do mês
   ========================================================================== */

/** Uma pessoa no fechamento do mês. */
export interface LinhaDeComissao {
    funcionario_id?: number
    nome: string

    /** Quem saiu da loja continua aparecendo: a venda dela aconteceu. */
    cadastrada: boolean
    ativo: boolean

    pecas: number
    base: number
    percentual: number
    valor: number
}

/**
 * O mês inteiro, como o backend o entrega.
 *
 * `fechado` muda o sentido de tudo o que está aqui: enquanto for falso, os
 * números se movem a cada devolução e a cada mudança de percentual; depois de
 * fechado, eles são o que foi pago e não mudam mais.
 */
export interface FechamentoDeComissao {
    mes: string

    fechado: boolean
    fechada_em?: string
    fechada_por?: string

    linhas: LinhaDeComissao[]

    base: number
    valor: number

    /** O que saiu sem nome gravado, e por isso não é comissão de ninguém. */
    sem_dono: number
    sem_dono_valor: number
}

/* ==========================================================================
   Como o dinheiro entra
   ========================================================================== */

/**
 * As formas de pagamento que a LOJA declara — no balcão, e na confirmação à
 * mão de um pedido pago por fora.
 *
 * Lista fechada, e a mesma do servidor (ver dto.MeiosDePagamento): isto vira
 * relatório de faturamento, e texto livre produziria "pix", "PIX" e "pics" —
 * três linhas para a mesma coisa num caixa que precisa fechar.
 */
export type MeioDePagamento = "pix" | "dinheiro" | "maquininha" | "transferencia" | "outro"

/** Como cada meio se escreve para gente ler, na ordem em que se oferece. */
export const MEIOS_DE_PAGAMENTO: { chave: MeioDePagamento; nome: string }[] = [
    { chave: "pix", nome: "Pix" },
    { chave: "dinheiro", nome: "Dinheiro" },
    { chave: "maquininha", nome: "Maquininha" },
    { chave: "transferencia", nome: "Transferência" },
    { chave: "outro", nome: "Outro" },
]

/** Quanto entrou hoje por uma forma de pagamento no balcão. */
export interface MeioNoCaixa {
    chave: MeioDePagamento
    nome: string
    pecas: number
    faturamento: number
}

/* ==========================================================================
   A venda no balcão
   ========================================================================== */

/** O que o balcão descobre ao bipar um código. */
export interface ItemDoBalcao {
    produto_id: number
    nome: string
    codigo: string
    categoria?: string

    /**
     * `preco` é o que o cliente PAGA — já com a promoção aplicada.
     * `preco_de_tabela` vem junto só para a tela mostrar o de antes riscado.
     */
    preco: number
    preco_de_tabela: number
    em_promocao: boolean

    disponiveis: number
}

/** Uma linha da venda concluída. */
export interface ItemVendidoNoBalcao {
    produto_id: number
    nome: string
    codigo: string

    quantidade: number
    preco_unitario: number
    subtotal: number
    em_promocao: boolean
}

/** A venda concluída, do jeito que se confere em voz alta com o cliente. */
export interface VendaDoBalcao {
    itens: ItemVendidoNoBalcao[]
    pecas: number
    total: number

    meio: MeioDePagamento
    meio_nome: string

    vendida_em: string
    vendida_por: string
}

/* ==========================================================================
   Os adicionais: o que o cliente escolhe junto do produto
   ========================================================================== */

/**
 * Uma opção: "Catupiry +R$ 8", "Ao ponto", "Sem cebola".
 *
 * `ativa` desligada tira a opção da vitrine sem apagá-la — é o que se faz
 * quando acaba o catupiry às oito da noite, e volta amanhã num clique.
 */
export interface OpcaoDeAdicional {
    id: number
    grupo_id: number
    nome: string

    /** Quanto esta opção SOMA ao produto. Zero é o caso comum. */
    preco: number

    ativa: boolean
    ordem: number
}

/**
 * Um grupo é uma pergunta: "Borda", "Ponto da carne", "Bebida".
 *
 * `minimo` e `maximo` dizem tudo o que ele é, sem um campo "obrigatório"
 * separado: mínimo 1 é obrigatório, máximo 1 é escolha única, máximo maior é
 * múltipla. Dois jeitos de dizer a mesma coisa divergem.
 */
export interface GrupoDeAdicional {
    id: number
    nome: string
    minimo: number
    maximo: number
    ordem: number
    opcoes?: OpcaoDeAdicional[]
}

/** A ligação entre um grupo e um produto que faz aquela pergunta. */
export interface LigacaoDeAdicional {
    produto_id: number
    grupo_id: number
}

export interface CatalogoDeAdicionais {
    grupos: GrupoDeAdicional[]
    ligacoes: LigacaoDeAdicional[]
    limites: {
        grupos_por_loja: number
        opcoes_por_grupo: number
        grupos_por_produto: number
        observacao_do_item: number
    }
}
