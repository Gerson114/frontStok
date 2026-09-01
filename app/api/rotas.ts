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
    planos: () => "/public/planos",

    /** Catálogo da vitrine, com busca opcional por nome. */
    produtos: (nome?: string) =>
        nome ? `/public/produtos?nome=${encodeURIComponent(nome)}` : "/public/produtos",

    assinaturaCheckout: () => "/public/assinatura/checkout",
    assinaturaSessao: () => "/public/assinatura/sessao",
}

/* ==========================================================================
   Conta e assinatura
   ========================================================================== */

export const conta = {
    logout: () => "/private/logout",

    assinatura: () => "/private/assinatura",
    planos: () => "/private/assinatura/planos",
    checkout: () => "/private/assinatura/checkout",
    trocarPlano: () => "/private/assinatura/plano",
    portal: () => "/private/assinatura/portal",

    loja: () => "/private/loja",
    tema: () => "/private/loja/tema",
}

/* ==========================================================================
   Catálogo de produtos
   ========================================================================== */

export const produtos = {
    cadastrar: () => "/private/cadastrarProduto",
    cadastrarVariantes: () => "/private/cadastrarProdutoVariantes",

    consultar: () => "/private/consulta",

    porId: (id: string) => `/private/produto/${id}`,
    unidades: (id: string) => `/private/produto/${id}/unidades`,
    vender: (id: string) => `/private/produto/${id}/vender`,
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
    lista: () => "/private/pedidos",
    criar: () => "/pedidos",
    conferir: () => "/pedidos/conferir",
    etiquetas: () => "/private/pedidos/etiquetas",
    separacao: (id: string) => `/private/pedidos/${id}/separacao`,
    status: (id: string) => `/private/pedidos/${id}/status`,
}

/* ==========================================================================
   WhatsApp
   ========================================================================== */

// Sem o "/private" na frente: quem chama estas é o repassar() de
// app/api/whatsapp/proxy.ts, que já o acrescenta.
export const whatsapp = {
    canal: () => "/whatsapp/canal",
    bilhete: () => "/whatsapp/bilhete",
    aparelho: () => "/whatsapp/aparelho",
    parear: () => "/whatsapp/aparelho/parear",

    conversas: () => "/whatsapp/conversas",
    mensagens: (id: string) => `/whatsapp/conversas/${id}/mensagens`,
    lida: (id: string) => `/whatsapp/conversas/${id}/lida`,
    foto: (id: string) => `/whatsapp/conversas/${id}/foto`,
    midia: (id: string) => `/whatsapp/midia/${id}`,
}
