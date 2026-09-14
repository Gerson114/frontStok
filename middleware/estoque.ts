// Entrada de mercadoria: o que chega do fornecedor virando peça no estoque.
//
// Quem cria as peças, soma o estoque, guarda custo e fornecedor e devolve os
// ids das etiquetas é o backend (ver internal/handlers/logistica/entrada.go).
// Aqui só se monta o pedido e se lê a resposta.

import { apiFetch } from "./client"

/**
 * Uma linha da remessa: qual produto chegou, quantas peças e por quanto.
 *
 * Sem endereço de propósito: quem escolhe onde guardar é o servidor, que
 * põe as peças junto do que já existe daquele produto ou no trecho mais
 * vazio (ver estoque.SugerirEndereco). Guardar mercadoria não deveria exigir
 * que alguém decida, caixa por caixa, em que prateleira ela cabe.
 */
export interface ItemEntrada {
    produto_id: number
    quantidade: number
    custo_unitario: number

    /** Onde estas peças foram guardadas; em branco, o servidor escolhe. */
    endereco?: string
}

/** Onde o servidor guardou cada item da remessa. */
export interface EnderecoDaEntrada {
    produto_id: number
    produto_nome: string
    produto_codigo: string
    quantidade: number

    /** O destino final: o código da prateleira e o endereço falado. */
    endereco_id: number
    endereco: string
    endereco_nome: string

    /**
     * Onde a mercadoria nasceu. Igual ao destino no fluxo normal, em que
     * quem recebe é quem guarda na hora; na entrada com conferência é a
     * doca, e aí `guardar` é verdadeiro: a peça chegou, mas ainda não está
     * no lugar, e há uma tarefa na fila para levá-la até lá.
     */
    recebido_em: string
    guardar: boolean
}

export interface NovaEntrada {
    fornecedor_id?: number | null
    documento?: string
    observacao?: string
    itens: ItemEntrada[]

    /**
     * Receber com conferência: as peças nascem na doca e o sistema põe na
     * fila uma tarefa de armazenagem por item, dizendo para onde levar cada
     * um. É o fluxo de quem recebe pela manhã e guarda à tarde.
     *
     * Sem isso — o padrão — a peça nasce direto na prateleira, que é como
     * funciona a loja onde quem recebe é quem guarda, na hora.
     */
    conferir?: boolean
}

export interface RespostaEntrada {
    mensagem?: string
    entrada?: { id: number; pecas: number; custo_total: number }
    /** Onde guardar o que chegou, item a item. */
    enderecos?: EnderecoDaEntrada[]
    /** Ids das peças criadas, para imprimir as etiquetas do lote. */
    unidades_criadas?: number[]

    /** Quantas tarefas de armazenagem a remessa deixou na fila. */
    tarefas_de_armazenagem?: number
}

/** Dá entrada numa remessa inteira — tudo ou nada, numa transação só. */
export async function registrarEntrada(entrada: NovaEntrada): Promise<RespostaEntrada> {
    return apiFetch<RespostaEntrada>("/api/entradas", {
        method: "POST",
        body: entrada,
    })
}

/**
 * Devoluções: a peça que voltou fica isolada até alguém decidir o destino.
 *
 * Nada aqui decide nada — quem tira do vendável, endereça de volta, manda
 * para avaria ou apaga a peça é o backend. O front mostra a fila e envia a
 * decisão.
 */

/** Situações possíveis de uma devolução, na ordem em que ela anda. */
export type SituacaoDevolucao = "aguardando" | "agendada" | "resolvida"

/** O que se decidiu fazer com a peça devolvida. */
export type DestinoDevolucao = "estoque" | "avaria" | "descarte" | "fornecedor"

export interface Devolucao {
    id: number
    unidade_id: number
    produto_id: number
    produto_nome: string
    produto_codigo: string
    produto_variacao: string
    produto_variacao_rotulo: string
    pedido_id?: number | null
    motivo: string
    observacao: string
    situacao: SituacaoDevolucao
    agendada_para?: string | null
    destino?: DestinoDevolucao | ""
    resolvida_em?: string | null
    created_at: string
    /** Há quantos dias a peça está parada na quarentena. */
    dias_parada: number
}

export async function listarDevolucoes(): Promise<Devolucao[]> {
    const dados = await apiFetch<{ devolucoes?: Devolucao[] }>("/api/devolucoes")
    return Array.isArray(dados.devolucoes) ? dados.devolucoes : []
}

export async function registrarDevolucao(entrada: {
    produto_id: number
    quantidade: number
    motivo: string
    observacao?: string
}): Promise<void> {
    await apiFetch("/api/devolucoes", { method: "POST", body: entrada })
}

/** Marca o dia da tratativa, sem decidir o destino ainda. */
export async function agendarDevolucao(id: number, agendadaPara: string, observacao = ""): Promise<void> {
    await apiFetch(`/api/devolucoes/${id}/agendar`, {
        method: "POST",
        body: { agendada_para: agendadaPara, observacao },
    })
}

/** Dá destino à peça e a tira da quarentena. */
export async function tratarDevolucao(
    id: number,
    destino: DestinoDevolucao,
    observacao = ""
): Promise<void> {
    await apiFetch(`/api/devolucoes/${id}/tratativa`, {
        method: "POST",
        body: { destino, observacao },
    })
}

/** Como cada destino se lê num botão. */
export const DESTINOS: { chave: DestinoDevolucao; rotulo: string; descricao: string }[] = [
    {
        chave: "estoque",
        rotulo: "Voltar ao estoque",
        descricao: "A peça está boa: volta a ser vendável, num endereço escolhido pelo sistema.",
    },
    {
        chave: "avaria",
        rotulo: "Marcar avaria",
        descricao: "A peça tem defeito: continua registrada, fora do vendável, e pode ser restaurada.",
    },
    {
        chave: "fornecedor",
        rotulo: "Devolver ao fornecedor",
        descricao: "A peça volta para quem a vendeu e sai do acervo da loja.",
    },
    {
        chave: "descarte",
        rotulo: "Descartar",
        descricao: "A peça não tem mais uso e sai do acervo da loja.",
    },
]

/**
 * Consulta pelo código: passa-se o código do produto — digitado ou lido pelo
 * leitor de código de barras — e o servidor responde onde ele está, quanto
 * existe e de onde veio.
 *
 * É a mesma rota do leitor USB (que digita o código e dá Enter), então a
 * tela funciona igual com o dedo e com o bipe.
 */
export interface ProcedenciaProduto {
    entrada_id: number
    documento: string
    recebida_em: string
    custo_unitario: number
    fornecedor_id?: number
    fornecedor?: string
    contato?: string
}

export interface ConsultaPorCodigo {
    tipo: "produto"
    produto: {
        id: number
        codigo: string
        nome: string
        categoria: string
        preco: number
        variacao: string
        variacao_rotulo: string
    }
    resumo: {
        total: number
        disponiveis: number
        reservadas: number
        vendidas: number
        avariadas: number
    }
    /** Onde as peças disponíveis estão, pelo código do endereço: { "001.005.01.A": 5 }. */
    locais: Record<string, number>
    procedencia?: ProcedenciaProduto | null
}

export async function consultarPorCodigo(codigo: string): Promise<ConsultaPorCodigo> {
    return apiFetch<ConsultaPorCodigo>(`/api/bipar?codigo=${encodeURIComponent(codigo)}`)
}

/**
 * Endereços do estoque: o cadastro dos lugares onde a mercadoria fica.
 *
 * Cada endereço tem um tipo (para que serve), capacidade (quanto cabe),
 * ordem (em que ponto da caminhada ele está) e bloqueio (se aceita
 * movimentação). É esse cadastro que permite ao servidor escolher onde
 * guardar sem perguntar nada.
 */
/**
 * O lado da prateleira em que a mercadoria está — o último nível do
 * endereço, e o único que não é número.
 *
 * São dois porque uma prateleira tem dois: o da frente e o de trás, o da
 * esquerda e o da direita. O endereçamento é o que todo mundo na loja decora,
 * e um alfabeto inteiro de lados seria decorado errado.
 */
export type LadoDaPrateleira = "A" | "B"

export const LADOS: LadoDaPrateleira[] = ["A", "B"]

export type TipoEndereco =
    | "picking"
    | "pulmao"
    | "recebimento"
    | "expedicao"
    | "quarentena"
    | "avaria"

export interface EnderecoEstoque {
    id: number

    /**
     * O código da prateleira ("003.002.01.04"), como está escrito na
     * etiqueta dela, e o mesmo endereço falado ("rua 1, bloco 5"). Os dois
     * vêm prontos do servidor: o código é derivado da hierarquia, e não
     * digitado, senão as duas verdades se separam na primeira edição.
     */
    codigo: string
    nome: string

    /**
     * A hierarquia do lugar. Numa loja pequena, tudo fica no bloco 1, andar 1
     * e lado A — a estrutura só cresce quando o estoque cresce.
     */
    rua: number
    bloco: number
    andar: number

    /** Lado da prateleira: "A" ou "B", e nada além disso. */
    lado: LadoDaPrateleira

    /** Agrupamento livre do armazém ("mezanino", "fundo"). */
    zona?: string

    /** Curva de giro que este lugar guarda; vazio aceita qualquer produto. */
    curva_preferida?: string

    tipo: TipoEndereco
    tipo_nome: string
    /** Zero quer dizer sem limite declarado. */
    capacidade: number
    ordem: number
    bloqueado: boolean
    motivo_bloqueio?: string
    descricao?: string
    ocupacao: number
    /** Só vem quando há capacidade declarada. */
    livre?: number
    ocupacao_percentual?: number
}

export async function listarEnderecos(): Promise<EnderecoEstoque[]> {
    const dados = await apiFetch<{ enderecos?: EnderecoEstoque[] }>("/api/enderecos")
    return Array.isArray(dados.enderecos) ? dados.enderecos : []
}

/**
 * Cadastra um lugar do estoque.
 *
 * Só a rua é obrigatória: bloco e andar assumem 1 e o lado assume A, que é o
 * estoque de quem ainda não subdividiu as prateleiras. A estrutura só cresce
 * quando o estoque cresce — e o código sai disso tudo, montado no servidor.
 */
export async function criarEndereco(entrada: {
    rua: number
    bloco?: number
    andar?: number
    lado?: LadoDaPrateleira
    zona?: string
    curva_preferida?: string
    tipo: TipoEndereco
    capacidade: number
    descricao?: string
}): Promise<void> {
    await apiFetch("/api/enderecos", { method: "POST", body: entrada })
}

/**
 * A estrutura do estoque, descrita de uma vez: as ruas, os blocos de cada
 * rua, os andares de cada bloco e os lados de cada andar.
 *
 * Cadastrar prateleira a prateleira é o que faz o lojista desistir do
 * endereçamento no primeiro dia — cinco ruas com três blocos de quatro
 * andares e dois lados são 120 formulários. A estrutura de um estoque real é
 * regular, então ela se descreve por quantos de cada nível existem.
 */
export interface EstruturaDoEstoque {
    rua_inicial: number
    rua_final: number
    blocos: number
    andares: number
    lados: LadoDaPrateleira[]
    tipo: TipoEndereco
    capacidade: number
    zona?: string
}

export interface ResultadoEstrutura {
    mensagem: string
    /** Os endereços que nasceram agora — as prateleiras ainda sem placa. */
    criados: EnderecoEstoque[]
    quantidade: number
    /** Os que já existiam e foram deixados como estavam. */
    existentes: number
    total: number
}

/** Quantos endereços a estrutura descreve, para a tela dizer antes de criar. */
export function quantidadeDaEstrutura(estrutura: EstruturaDoEstoque): number {

    const ruas = estrutura.rua_final - estrutura.rua_inicial + 1

    if (ruas <= 0 || estrutura.blocos <= 0 || estrutura.andares <= 0) return 0

    return ruas * estrutura.blocos * estrutura.andares * Math.max(estrutura.lados.length, 0)
}

/**
 * Cria os endereços que faltam para a estrutura descrita.
 *
 * Rodar de novo é seguro: o que já existe fica como está, com a capacidade e
 * o bloqueio que o lojista tiver ajustado depois — é assim que se acrescenta
 * uma rua nova sem tocar nas que já estão em uso.
 */
export async function montarEstrutura(estrutura: EstruturaDoEstoque): Promise<ResultadoEstrutura> {

    const dados = await apiFetch<Partial<ResultadoEstrutura>>("/api/enderecos/estrutura", {
        method: "POST",
        body: estrutura,
    })

    return {
        mensagem: dados.mensagem ?? "",
        criados: Array.isArray(dados.criados) ? dados.criados : [],
        quantidade: dados.quantidade ?? 0,
        existentes: dados.existentes ?? 0,
        total: dados.total ?? 0,
    }
}

export async function bloquearEndereco(id: number, bloqueado: boolean, motivo = ""): Promise<void> {
    await apiFetch(`/api/enderecos/${id}/bloqueio`, {
        method: "POST",
        body: { bloqueado, motivo },
    })
}

/** Os tipos de endereço como o lojista os escolhe. */
export const TIPOS_ENDERECO: { chave: TipoEndereco; nome: string; descricao: string }[] = [
    {
        chave: "picking",
        nome: "Prateleira de venda",
        descricao: "De onde se vende e se separa. É o lugar padrão de uma peça disponível.",
    },
    {
        chave: "pulmao",
        nome: "Reserva (pulmão)",
        descricao: "O excedente que não cabe na prateleira e desce quando ela esvazia.",
    },
    {
        chave: "recebimento",
        nome: "Recebimento",
        descricao: "A doca: onde a remessa fica até alguém guardá-la nas prateleiras.",
    },
    {
        chave: "expedicao",
        nome: "Expedição",
        descricao: "O que já foi separado e espera sair da loja.",
    },
    {
        chave: "quarentena",
        nome: "Quarentena",
        descricao: "Devoluções esperando tratativa, longe do que se vende.",
    },
    {
        chave: "avaria",
        nome: "Avarias",
        descricao: "Peças com defeito, separadas do estoque vendável.",
    },
]

/* ==========================================================================
   A devolução PEDIDA pelo cliente, antes de a peça voltar

   É o outro momento do mesmo assunto: aqui se decide se o dinheiro volta;
   nas funções acima, o que fazer com a peça quando ela chegar. As duas
   moram na mesma tela do painel de propósito — quem responde ao cliente é
   quem vai receber a mercadoria.
   ========================================================================== */

export type SituacaoPedidoDevolucao = "pedida" | "aceita" | "recusada"

/**
 * Por que a devolução pôde ser pedida.
 *
 * São as duas ÚNICAS causas que a vitrine oferece, e o servidor confere cada
 * uma contra o estado do pedido antes de aceitar:
 *
 *   "atraso"     — passou do prazo prometido e o pedido não foi entregue.
 *   "danificado" — foi entregue há poucos dias e veio quebrado ou rasgado.
 *
 * Devolução de motivo livre não existe de propósito: ela automatizaria o
 * caminho de quem recebe a mercadoria inteira e pede o dinheiro de volta
 * assim mesmo. Qualquer outro motivo chega pela conversa com a loja.
 */
export type CausaDevolucao = "atraso" | "danificado"

/** Uma peça dentro do pedido de devolução. */
export interface PecaDevolvida {
    item_pedido_id: number
    produto_id: number
    produto_nome: string
    produto_codigo: string
    quantidade: number
    preco_unitario: number
}

export interface DevolucaoPedida {
    id: number

    /** O código de seis dígitos do pedido — é por ele que o cliente liga. */
    codigo: string

    cliente_id: number
    cliente_nome: string
    cliente_contato: string

    situacao: SituacaoPedidoDevolucao

    /**
     * O que o cliente escreveu. Obrigatório na avaria — é onde ele diz o que
     * veio danificado —, opcional no atraso, onde o fato já está no sistema.
     */
    motivo: string

    /** Por que ela pôde ser pedida: atraso na entrega ou avaria. */
    causa: CausaDevolucao

    /** Quanto a loja devolve, e quanto disso é frete. */
    valor: number
    frete: number

    itens: PecaDevolvida[]

    /** O que a loja respondeu, e quem respondeu. */
    resposta?: string
    decidida_em?: string | null
    decidida_por?: string

    /** Quando o dinheiro saiu, e o número do estorno no provedor. */
    estornado_em?: string | null
    estorno_id?: string

    /**
     * Aceita sem o sistema conseguir estornar: provedor que não devolve
     * dinheiro por API, ou pedido que nunca passou por gateway. O dinheiro
     * precisa ser devolvido no painel do provedor, e esta marca é o que
     * impede a promessa de sumir da vista.
     */
    estorno_manual: boolean

    created_at: string
}

/** A fila de pedidos de devolução. Sem argumento, só os que esperam resposta. */
export async function listarDevolucoesPedidas(
    situacao: SituacaoPedidoDevolucao | "todas" = "pedida",
): Promise<DevolucaoPedida[]> {

    const dados = await apiFetch<{ devolucoes?: DevolucaoPedida[] }>(
        `/api/devolucoes/pedidas?situacao=${situacao}`,
    )

    return Array.isArray(dados.devolucoes) ? dados.devolucoes : []
}

/**
 * Aceita ou recusa o pedido de devolução.
 *
 * Aceitar estorna o dinheiro na hora, pela conta da loja no provedor. A
 * resposta escrita é obrigatória na recusa — é o que o cliente lê.
 */
export async function decidirDevolucaoPedida(
    id: number,
    aceitar: boolean,
    resposta = "",
): Promise<{ mensagem?: string }> {
    return apiFetch<{ mensagem?: string }>(`/api/devolucoes/pedidas/${id}`, {
        method: "POST",
        body: { aceitar, resposta },
    })
}
