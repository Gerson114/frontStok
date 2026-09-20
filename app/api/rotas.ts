// O catálogo dos endereços do backend.
//
// Todo caminho que o painel pede ao servidor Go está aqui, e só aqui. Antes
// eles viviam soltos, escritos à mão dentro de cada uma das 44 rotas de
// app/api — e caminho escrito à mão é caminho que ninguém consegue conferir:
// não havia lugar nenhum onde se pudesse ler a lista do que este front
// consome, e um erro de digitação só aparecia quando alguém abrisse a tela.
//
// São funções, e não texto solto, porque quase todas levam um id: função
// obriga o TypeScript a cobrar o argumento, o que transforma um endereço
// montado errado num erro de compilação em vez de um 404 em produção.
//
// Aqui ficam CAMINHOS, nunca URLs completas. Quem cola o endereço do servidor
// é o `url()` de backend.ts, que é o único lugar que lê API_URL do ambiente —
// o endereço é configuração e muda entre máquinas; o caminho é o contrato da
// API e é o mesmo em todo lugar.

/* ==========================================================================
   Público — sem sessão
   ========================================================================== */

export const publico = {
    login: () => "/public/login",
    cadastro: () => "/public/cadastro",

    /** Os seis dígitos que provam que o e-mail do cadastro é de quem o digitou. */
    cadastroConfirmar: () => "/public/cadastro/confirmar",
    cadastroReenviar: () => "/public/cadastro/reenviar",
    oferta: () => "/public/oferta",

    /** Catálogo da vitrine, com busca opcional por nome. */
    produtos: (nome?: string) =>
        nome ? `/public/produtos?nome=${encodeURIComponent(nome)}` : "/public/produtos",

    assinaturaCheckout: () => "/public/assinatura/checkout",
    assinaturaSessao: () => "/public/assinatura/sessao",

    /**
     * Esqueci minha senha: pedir o código e trocar a senha com ele.
     *
     * As duas rotas atendem dono E funcionário — é o mesmo formulário de
     * entrada do painel, e quem esqueceu a senha não deveria precisar saber
     * em qual das duas tabelas a conta dele mora.
     */
    senhaRecuperar: () => "/public/senha/recuperar",
    senhaRedefinir: () => "/public/senha/redefinir",
}

/* ==========================================================================
   Conta e assinatura
   ========================================================================== */

/* ==========================================================================
   Início — os números do negócio
   ========================================================================== */

export const painel = {
    inicio: () => "/private/inicio",

    /**
     * As vendas ao longo do tempo, na régua pedida ("dia", "mes" ou "ano").
     *
     * É a mesma informação da tela de início noutra escala, e por isso não é
     * do dono: quem trabalha na loja vê os números dela.
     */
    vendas: (granularidade: string) =>
        `/private/painel/vendas?granularidade=${encodeURIComponent(granularidade)}`,

    /**
     * O que a equipe fez com as conversas nos últimos `dias`: quem pegou da
     * fila, quem passou cliente para quem, quem encerrou. Só o dono.
     */
    atendimento: (dias: number) => `/private/painel/atendimento?dias=${dias}`,

    /**
     * Os três painéis por assunto, cada um com a sua tela.
     *
     * A régua (dia, mês, ano) é o único parâmetro dos três, e é a mesma da
     * série de vendas — assim as quatro telas se leem lado a lado sem
     * ninguém refazer conta de cabeça.
     */
    produtos: (periodo: string) => `/private/painel/produtos?periodo=${encodeURIComponent(periodo)}`,
    equipe: (periodo: string) => `/private/painel/equipe?periodo=${encodeURIComponent(periodo)}`,
    entregas: (periodo: string) => `/private/painel/entregas?periodo=${encodeURIComponent(periodo)}`,

    /**
     * O que chegou e ninguém viu: pedido novo, WhatsApp e chat do site.
     *
     * Alimenta a bolinha da barra superior, e é barata de propósito — três
     * COUNT indexados, pedidos a cada aviso do canal ao vivo.
     */
    notificacoes: () => "/private/notificacoes",
}

export const conta = {
    logout: () => "/private/logout",

    assinatura: () => "/private/assinatura",
    oferta: () => "/private/assinatura/oferta",
    checkout: () => "/private/assinatura/checkout",
    portal: () => "/private/assinatura/portal",

    /** Trocar o plano de quem já assina — base para Pro, ou de volta. */
    plano: () => "/private/assinatura/plano",

    loja: () => "/private/loja",
    tema: () => "/private/loja/tema",

    /** Quanto a loja cobra para entregar, e para onde. */
    frete: () => "/private/frete",
}

/* ==========================================================================
   A equipe da loja
   ========================================================================== */

/* ==========================================================================
   As lojas do dono
   ========================================================================== */

/**
 * Abrir, renomear, fechar e trocar a loja que o painel está mostrando.
 *
 * Nenhum caminho aqui leva o id do dono: quem o preenche é a sessão, no
 * servidor. E nenhuma loja é alcançada por id sem `dono_id` no mesmo WHERE lá
 * — o filtro por dono é a única coisa entre um lojista e o estoque da rede
 * vizinha.
 */
export const lojas = {
    rede: () => "/private/lojas",
    uma: (id: string | number) => `/private/lojas/${id}`,

    /** Passa a mostrar esta loja no painel. Grava o cookie no servidor. */
    trocar: (id: string | number) => `/private/lojas/${id}/abrir`,
}

/**
 * A venda no balcão.
 *
 * `item` resolve o código lido — e devolve o preço COM a promoção aplicada,
 * que é o que a venda vai cobrar. A consulta do estoque (`/bipar`) devolve o
 * de tabela: uma tela de venda que mostrasse um e cobrasse outro estaria
 * mentindo para o vendedor na frente do cliente.
 */
export const balcao = {
    item: (codigo: string) => `/private/balcao/item?codigo=${encodeURIComponent(codigo)}`,
    vender: () => "/private/balcao/vender",
}

/**
 * O que o cliente escolhe junto do produto: borda, ponto da carne, tamanho.
 *
 * Os grupos são da LOJA e ligados aos produtos que os usam — uma pizzaria com
 * vinte pizzas monta as seis bordas uma vez, e mudar o preço da borda é uma
 * edição, não vinte.
 */
export const adicionais = {
    catalogo: () => "/private/adicionais",
    grupos: () => "/private/adicionais/grupos",
    umGrupo: (id: string | number) => `/private/adicionais/grupos/${id}`,
    opcoes: () => "/private/adicionais/opcoes",
    umaOpcao: (id: string | number) => `/private/adicionais/opcoes/${id}`,

    /** Quais perguntas ESTE produto faz. Manda a lista inteira e substitui. */
    doProduto: (id: string | number) => `/private/produto/${id}/adicionais`,
}

export const funcionarios = {
    lista: () => "/private/funcionarios",
    um: (id: string | number) => `/private/funcionarios/${id}`,
    senha: (id: string | number) => `/private/funcionarios/${id}/senha`,

    /**
     * O código único da loja, o que a equipe digita para entrar na conversa
     * interna. Só o dono abre — é a única rota que devolve o código aberto.
     */
}

/**
 * A comissão do mês de quem vende por percentual.
 *
 * O mês vai na consulta como "2026-09"; sem ele o backend responde o mês
 * PASSADO, que é o que se fecha. Fechar e reabrir são POST porque mudam o
 * estado do mês — e reabrir não estorna dinheiro nenhum, só devolve o mês à
 * conta.
 */
export const comissoes = {
    doMes: (mes?: string) => (mes ? `/private/comissoes?mes=${encodeURIComponent(mes)}` : "/private/comissoes"),
    fechar: (mes: string) => `/private/comissoes/fechar?mes=${encodeURIComponent(mes)}`,
    reabrir: (mes: string) => `/private/comissoes/reabrir?mes=${encodeURIComponent(mes)}`,
}

/* ==========================================================================
   A conversa interna da equipe
   ========================================================================== */

/**
 * O chat entre quem trabalha na loja.
 *
 * Nenhum destes caminhos leva o id da loja nem o de quem está falando: quem
 * decide as duas coisas é a sessão, no servidor. A sala vai como "geral" ou
 * como o crachá do colega — nunca o nome da sala montado pelo navegador, que
 * seria deixá-lo escolher de quem é a conversa.
 */
export const equipe = {
    estado: () => "/private/equipe",
    entrar: () => "/private/equipe/entrar",
    sair: () => "/private/equipe/sair",

    mensagens: (sala: string, desde?: number) => {
        const query = new URLSearchParams({ sala })

        if (desde) query.set("desde", String(desde))

        return `/private/equipe/mensagens?${query.toString()}`
    },

    escrever: () => "/private/equipe/mensagens",
    lida: () => "/private/equipe/lida",

    /** "Está digitando…". Não grava nada: sai pelo canal ao vivo. */
    digitando: () => "/private/equipe/digitando",

    /**
     * O código que destrava a conversa — a única rota que o devolve aberto.
     *
     * Não é do dono por natureza: ele pode delegá-la a uma pessoa da equipe.
     * Quem decide é o backend, pela permissão "equipe-codigo".
     */
    codigo: () => "/private/equipe/codigo",

    /**
     * Quem pediu para entrar, e a decisão sobre cada um. Só o dono, e sem
     * delegação: passar o código é dar o convite; dizer quem é da empresa é
     * abrir a porta.
     */
    acessos: () => "/private/equipe/acessos",

    /**
     * O que a equipe pede uma à outra: com prazo, prioridade e destinatário.
     *
     * Nada a ver com `estoque.tarefas`, que é a fila de corredor do WMS —
     * trabalho gerado pelo sistema, amarrado a produto e endereço.
     */
    tarefas: () => "/private/equipe/tarefas",
    tarefa: (id: string | number) => `/private/equipe/tarefas/${id}`,

    /** O mural da loja: os recados que ficam à vista, com a posição de cada um. */
    notas: (muralID?: number) =>
        muralID ? `/private/equipe/notas?mural=${muralID}` : "/private/equipe/notas",

    /** Chamar gente para um mural, e sair do mural de outro. */
    membrosDoMural: (id: string | number, cracha?: string) =>
        cracha
            ? `/private/equipe/murais/${id}/membros?cracha=${encodeURIComponent(cracha)}`
            : `/private/equipe/murais/${id}/membros`,
    nota: (id: string | number) => `/private/equipe/notas/${id}`,

    /** Os grupos: a sala do meio do caminho, entre a loja toda e dois em dois. */
    grupos: () => "/private/equipe/grupos",
    membrosDoGrupo: (id: string | number) => `/private/equipe/grupos/${id}/membros`,
    sairDoGrupo: (id: string | number, cracha?: string) =>
        cracha
            ? `/private/equipe/grupos/${id}/membros?cracha=${encodeURIComponent(cracha)}`
            : `/private/equipe/grupos/${id}/membros`,
}

/* ==========================================================================
   Catálogo de produtos
   ========================================================================== */

export const produtos = {
    cadastrar: () => "/private/cadastrarProduto",
    cadastrarVariantes: () => "/private/cadastrarProdutoVariantes",

    // Importação por planilha: a primeira só confere e não grava nada.
    conferirPlanilha: () => "/private/produtos/importar/conferir",
    importarPlanilha: () => "/private/produtos/importar",

    consultar: () => "/private/consulta",

    porId: (id: string) => `/private/produto/${id}`,
    unidades: (id: string) => `/private/produto/${id}/unidades`,
    vitrine: (id: string) => `/private/produto/${id}/vitrine`,
    picking: (id: string) => `/private/produto/${id}/picking`,

    promocao: () => "/private/promocao",
    promocaoDoProduto: (produtoId: string) => `/private/promocao/${produtoId}`,

    banners: () => "/private/banners",
    banner: (id: string) => `/private/banners/${id}`,
}

/* ==========================================================================
   Peças, entrada e estoque
   ========================================================================== */

export const estoque = {
    unidades: () => "/private/unidades",
    unidade: (id: string) => `/private/unidades/${id}`,
    avariar: (id: string) => `/private/unidades/${id}/avariar`,
    restaurar: (id: string) => `/private/unidades/${id}/restaurar`,
    transferir: (id: string) => `/private/unidades/${id}/transferir`,
    historico: (id: string) => `/private/unidades/${id}/historico`,

    /** Resolve o código lido pelo leitor de código de barras. */
    bipar: (codigo: string) => `/private/bipar?codigo=${encodeURIComponent(codigo)}`,

    entradas: () => "/private/entradas",
    etiquetasDaEntrada: (id: string) => `/private/entradas/${id}/etiquetas`,

    fornecedores: () => "/private/fornecedores",
    enderecos: (caminho = "") => `/private/enderecos${caminho}`,
    devolucoes: (caminho = "") => `/private/devolucoes${caminho}`,

    conferencia: () => "/private/conferencia",
    conferencias: () => "/private/conferencias",

    curvaABC: () => "/private/estoque/curva-abc",
    inventario: () => "/private/estoque/inventario",
    reposicao: () => "/private/estoque/reposicao",

    ondas: (consulta = "") => `/private/estoque/ondas${consulta}`,
    onda: (id: string) => `/private/estoque/ondas/${id}`,
    cancelarOnda: (id: string) => `/private/estoque/ondas/${id}/cancelar`,

    tarefas: (consulta = "") => `/private/estoque/tarefas${consulta}`,
    assumirTarefa: (id: string) => `/private/estoque/tarefas/${id}/assumir`,
    concluirTarefa: (id: string) => `/private/estoque/tarefas/${id}/concluir`,
    cancelarTarefa: (id: string) => `/private/estoque/tarefas/${id}/cancelar`,
}

/* ==========================================================================
   Pedidos
   ========================================================================== */

export const pedidos = {
    /** Quem levou o pedido e com que código. */
    rastreio: (id: string | number) => `/private/pedidos/${id}/rastreio`,

    /** Os pedidos a caminho, pela data em que devem chegar. */
    entregas: (mes: string) => `/private/entregas?mes=${encodeURIComponent(mes)}`,

    lista: () => "/private/pedidos",

    /** Os que estão presos esperando o pagamento cair. */
    listaAguardando: () => "/private/pedidos?pagamento=aguardando",

    /** Pergunta ao provedor se aquele pedido foi pago, em vez de esperar. */
    verificarPagamento: (id: string) => `/private/pedidos/${id}/verificar-pagamento`,

    /** A loja declarando que recebeu por fora — Pix direto, dinheiro, maquininha. */
    pagamentoManual: (id: string) => `/private/pedidos/${id}/pagamento-manual`,
    criar: () => "/pedidos",
    conferir: () => "/pedidos/conferir",
    etiquetas: () => "/private/pedidos/etiquetas",
    separacao: (id: string) => `/private/pedidos/${id}/separacao`,
    status: (id: string) => `/private/pedidos/${id}/status`,

    /** O dia em que o pedido sai da loja — o que o põe na agenda. */
    envio: (id: string) => `/private/pedidos/${id}/envio`,
}

/* ==========================================================================
   Clientes — quem compra na loja
   ========================================================================== */

export const paginaDaLoja = {
    /** O desenho da home da vitrine, montado em blocos. */
    home: () => "/private/loja/pagina",

    /** O topo e o rodapé, que aparecem em toda página da loja. */
    moldura: () => "/private/loja/moldura",
}

export const clientes = {
    lista: () => "/private/clientes",
    historico: (id: string) => `/private/clientes/${id}`,

    // LGPD: o que a loja precisa para atender um pedido do titular — entregar
    // uma cópia dos dados (art. 18, II) e eliminá-los (art. 18, VI).
    dados: (id: string) => `/private/clientes/${id}/dados`,
    anonimizar: (id: string) => `/private/clientes/${id}/anonimizar`,
}

/* ==========================================================================
   Atendimento — o chat do site
   ========================================================================== */

export const atendimentos = {
    lista: (encerrados = false) =>
        encerrados ? "/private/atendimentos?encerrados=1" : "/private/atendimentos",
    responsavel: (id: string) => `/private/atendimentos/${id}/responsavel`,
    situacao: (id: string) => `/private/atendimentos/${id}/situacao`,

    /** O aviso de "está digitando" (ver services/atendimento/digitando.go). */
    digitando: (id: string) => `/private/atendimentos/${id}/digitando`,
    mensagens: (id: string, desde?: string) =>
        `/private/atendimentos/${id}/mensagens${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`,
}

/* ==========================================================================
   WhatsApp
   ========================================================================== */

// Sem o "/private" na frente: quem chama estas é o repassar() de
// app/api/whatsapp/proxy.ts, que já o acrescenta.
/* ==========================================================================
   Pagamento — a conta da loja no provedor
   ========================================================================== */

export const pagamento = {
    /** Uma cobrança de R$ 1,00 para ver se a conta da loja consegue cobrar. */
    testar: () => "/private/pagamento/testar",

    /** Situação da conexão. O access token NUNCA volta daqui, nem mascarado. */
    conta: () => "/private/pagamento",
}

export const whatsapp = {
    canal: () => "/whatsapp/canal",
    bilhete: () => "/whatsapp/bilhete",
    aparelho: () => "/whatsapp/aparelho",
    parear: () => "/whatsapp/aparelho/parear",

    conversas: (encerrados = false) =>
        encerrados ? "/whatsapp/conversas?encerrados=1" : "/whatsapp/conversas",
    mensagens: (id: string) => `/whatsapp/conversas/${id}/mensagens`,
    lida: (id: string) => `/whatsapp/conversas/${id}/lida`,
    responsavel: (id: string) => `/whatsapp/conversas/${id}/responsavel`,
    situacao: (id: string) => `/whatsapp/conversas/${id}/situacao`,
    foto: (id: string) => `/whatsapp/conversas/${id}/foto`,
    midia: (id: string) => `/whatsapp/midia/${id}`,

    /* O CRM: a etiqueta que classifica o cliente e a nota que a equipe lê e
       ele não. O catálogo de etiquetas é da LOJA e fica fora de /conversas —
       ele existe antes de haver cliente marcado com alguma. */
    etiquetas: () => "/whatsapp/etiquetas",
    etiqueta: (id: string) => `/whatsapp/etiquetas/${id}`,
    etiquetasDaConversa: (id: string) => `/whatsapp/conversas/${id}/etiquetas`,
    notas: (id: string) => `/whatsapp/conversas/${id}/notas`,
    nota: (id: string, nota: string) => `/whatsapp/conversas/${id}/notas/${nota}`,
}
