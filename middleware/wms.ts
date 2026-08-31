// O estoque se organizando sozinho: a fila de trabalho, o ressuprimento da
// prateleira, o giro de cada produto, o inventário rotativo e as ondas de
// separação.
//
// Nada aqui decide nada. Quem sabe o que precisa ser feito, em que ordem, o
// que está abaixo do mínimo, quais endereços passaram da hora de contar e
// quais peças entram numa onda é o backend (ver internal/services/estoque).
// Estas funções montam o pedido e leem a resposta — a tela é a fila e três
// botões.

import { apiFetch } from "./client"

// ---------------------------------------------------------------------------
// A fila de trabalho
// ---------------------------------------------------------------------------

/** Os tipos de trabalho, na ordem em que costumam acontecer. */
export type TipoTarefa = "armazenagem" | "ressuprimento" | "separacao" | "inventario"

export type SituacaoTarefa = "pendente" | "em_andamento" | "concluida" | "cancelada"

export interface Tarefa {
    id: number
    tipo: TipoTarefa
    /** O tipo em palavras, escrito pelo servidor ("Repor a prateleira"). */
    tipo_nome: string
    situacao: SituacaoTarefa

    /** Prioridade menor é atendida primeiro: 1 vem antes de 10. */
    prioridade: number
    quantidade: number

    responsavel?: string
    observacao?: string

    onda_id?: number | null
    pedido_id?: number | null

    /** Só vem quando a tarefa é de um produto (contar endereço não é). */
    produto_id?: number
    produto_nome?: string
    produto_codigo?: string
    produto_variacao?: string

    /** Códigos dos endereços ("003.002.01.04") e o nome legível de cada um. */
    origem?: string
    origem_nome?: string
    destino?: string
    destino_nome?: string

    criada_em: string
    iniciada_em?: string | null
    concluida_em?: string | null
}

export interface FiltroTarefas {
    situacao?: SituacaoTarefa
    tipo?: TipoTarefa
}

/**
 * A fila da loja, do mais urgente para o menos.
 *
 * Sem filtro vem o que está por fazer (pendente e em andamento), que é o que
 * a tela precisa quase sempre; `situacao: "concluida"` abre o histórico do
 * dia. A ordem é a que o servidor mandou — reordenar aqui seria repetir a
 * regra de prioridade em dois lugares.
 */
export async function listarTarefas(filtro: FiltroTarefas = {}): Promise<Tarefa[]> {

    const consulta = new URLSearchParams()

    if (filtro.situacao) consulta.set("situacao", filtro.situacao)
    if (filtro.tipo) consulta.set("tipo", filtro.tipo)

    const query = consulta.toString()

    const dados = await apiFetch<{ tarefas?: Tarefa[] }>(
        `/api/estoque/tarefas${query ? `?${query}` : ""}`
    )

    return Array.isArray(dados.tarefas) ? dados.tarefas : []
}

/**
 * Marca quem vai fazer o trabalho, para duas pessoas não andarem até a mesma
 * prateleira. Tarefa já assumida responde 409 — é conflito, não erro de
 * quem clicou.
 */
export async function assumirTarefa(id: number, responsavel = ""): Promise<Tarefa> {
    const dados = await apiFetch<{ tarefa: Tarefa }>(`/api/estoque/tarefas/${id}/assumir`, {
        method: "POST",
        body: { responsavel },
    })

    return dados.tarefa
}

/** Fecha a tarefa e faz o que ela mandava: mover a mercadoria de verdade. */
export async function concluirTarefa(id: number, observacao = ""): Promise<Tarefa> {
    const dados = await apiFetch<{ tarefa: Tarefa }>(`/api/estoque/tarefas/${id}/concluir`, {
        method: "POST",
        body: { observacao },
    })

    return dados.tarefa
}

/** Tira da fila o que não vai ser feito — a prateleira já reposta na mão. */
export async function cancelarTarefa(id: number, observacao = ""): Promise<Tarefa> {
    const dados = await apiFetch<{ tarefa: Tarefa }>(`/api/estoque/tarefas/${id}/cancelar`, {
        method: "POST",
        body: { observacao },
    })

    return dados.tarefa
}

// ---------------------------------------------------------------------------
// Ressuprimento e picking fixo
// ---------------------------------------------------------------------------

/** Uma linha do que precisa descer do pulmão para a prateleira de venda. */
export interface Reposicao {
    produto_id: number
    produto_nome: string
    produto_codigo: string
    variacao?: string

    destino_id: number
    destino: string
    destino_nome: string
    no_picking: number
    minimo: number
    maximo: number

    quantidade: number
    /** Vazio quando não há de onde tirar: aí o problema é de compra. */
    origem_id?: number
    origem?: string
    no_pulmao: number

    /** Prateleira já vazia: não falta pouco, falta tudo. */
    urgente: boolean
}

export interface ResumoReposicoes {
    reposicoes: Reposicao[]
    total: number
    /** Quantas prateleiras já estão vazias. */
    urgentes: number
}

/** O que está faltando na loja agora, sem criar tarefa nenhuma. */
export async function listarReposicoes(): Promise<ResumoReposicoes> {

    const dados = await apiFetch<Partial<ResumoReposicoes>>("/api/estoque/reposicao")

    return {
        reposicoes: Array.isArray(dados.reposicoes) ? dados.reposicoes : [],
        total: dados.total ?? 0,
        urgentes: dados.urgentes ?? 0,
    }
}

export interface TarefasCriadas {
    mensagem: string
    criadas: number
    tarefas: Tarefa[]
}

/** Põe as reposições pendentes na fila — isto cria trabalho para alguém. */
export async function gerarReposicoes(): Promise<TarefasCriadas> {
    return apiFetch<TarefasCriadas>("/api/estoque/reposicao", { method: "POST" })
}

export interface Picking {
    produto_id: number
    produto_nome: string
    endereco_id: number
    endereco: string
    endereco_nome: string
    minimo: number
    maximo: number
}

/**
 * Onde o produto mora na prateleira de venda e quanto tem de ter ali.
 *
 * `maximo` zero é o caso normal: o servidor usa a capacidade do endereço, ou
 * o dobro do mínimo quando ela não foi declarada.
 */
export async function definirPicking(
    produtoId: number,
    entrada: { endereco: string; minimo: number; maximo?: number }
): Promise<Picking> {

    const dados = await apiFetch<{ picking: Picking }>(`/api/produtos/${produtoId}/picking`, {
        method: "PUT",
        body: {
            endereco: entrada.endereco,
            minimo: entrada.minimo,
            maximo: entrada.maximo ?? 0,
        },
    })

    return dados.picking
}

// ---------------------------------------------------------------------------
// Curva ABC e inventário rotativo
// ---------------------------------------------------------------------------

export interface ResultadoCurva {
    produtos: number
    vendas: number
    desde: string
    /** Quantos produtos caíram em cada curva: { A: 12, B: 40, C: 300 }. */
    por_curva: Record<string, number>
}

/**
 * Reapura o giro de cada produto pelas vendas.
 *
 * `dias` é a janela olhada para trás; zero usa a padrão do servidor. É POST
 * porque a apuração escreve — chamá-la ao abrir uma tela faria a curva mudar
 * debaixo de quem está olhando para ela.
 */
export async function apurarCurva(dias = 0): Promise<{ resultado: ResultadoCurva; ajuda: string }> {
    return apiFetch<{ resultado: ResultadoCurva; ajuda: string }>("/api/estoque/curva-abc", {
        method: "POST",
        body: { dias },
    })
}

export interface ContagemPendente {
    endereco_id: number
    endereco: string
    endereco_nome: string
    /** A curva do endereço é a do produto de maior giro guardado nele. */
    curva: string
    pecas: number
    ultima_em?: string | null
    dias_sem_contar: number
    /** Nunca contado é diferente de atrasado: um trecho que ninguém conferiu. */
    nunca_contado: boolean
}

/** Os endereços que passaram do intervalo da curva deles. */
export async function contagensPendentes(): Promise<ContagemPendente[]> {
    const dados = await apiFetch<{ pendentes?: ContagemPendente[] }>("/api/estoque/inventario")
    return Array.isArray(dados.pendentes) ? dados.pendentes : []
}

/** Põe as contagens atrasadas na fila. `limite` zero usa o padrão do servidor. */
export async function gerarInventario(limite = 0): Promise<TarefasCriadas> {
    return apiFetch<TarefasCriadas>("/api/estoque/inventario", {
        method: "POST",
        body: { limite },
    })
}

/** As contagens já fechadas — a auditoria do que foi conferido. */
export interface Conferencia {
    id: number
    endereco_id?: number
    endereco?: string
    esperadas: number
    encontradas: number
    /** Por código e quantidade: "000618 x2, 000734 x1". */
    faltando: string
    sobrando: string
    created_at: string
}

/** Um código que não bateu, e por quantas peças. */
export interface DiferencaDaContagem {
    codigo: string
    quantidade: number
    produto_id?: number
    produto_nome?: string
    produto_variacao?: string
    endereco_id?: number | null
}

export interface ResultadoConferencia {
    conferencia: number
    esperadas: number
    encontradas: number
    /** O que o sistema esperava e não apareceu. */
    faltando: DiferencaDaContagem[]
    /** O que apareceu fora do lugar. */
    sobrando: DiferencaDaContagem[]
    bate: boolean
}

/**
 * Fecha uma contagem: manda o trecho conferido e os códigos bipados.
 *
 * O código é o do PRODUTO e ele se repete — cinco camisetas iguais são o
 * mesmo código bipado cinco vezes, e as cinco leituras contam. Endereço em
 * branco confere a loja inteira, que é a contagem geral.
 *
 * Quem compara com o esperado e grava a auditoria é o servidor: contagem que
 * não fica registrada não permite voltar meses depois e descobrir quando a
 * peça sumiu.
 */
export async function conferir(endereco: string, codigos: string[]): Promise<ResultadoConferencia> {

    const dados = await apiFetch<Partial<ResultadoConferencia>>("/api/conferencia", {
        method: "POST",
        body: { endereco, codigos },
    })

    return {
        conferencia: dados.conferencia ?? 0,
        esperadas: dados.esperadas ?? 0,
        encontradas: dados.encontradas ?? 0,
        faltando: Array.isArray(dados.faltando) ? dados.faltando : [],
        sobrando: Array.isArray(dados.sobrando) ? dados.sobrando : [],
        bate: dados.bate === true,
    }
}

export async function listarConferencias(): Promise<Conferencia[]> {
    const dados = await apiFetch<{ conferencias?: Conferencia[] }>("/api/conferencias")
    return Array.isArray(dados.conferencias) ? dados.conferencias : []
}

// ---------------------------------------------------------------------------
// Ondas de separação
// ---------------------------------------------------------------------------

export type SituacaoOnda = "aberta" | "em_separacao" | "concluida" | "cancelada"

export interface Onda {
    id: number
    codigo: string
    situacao: SituacaoOnda
    pedidos: number
    pecas: number
    /** Quantos pontos do estoque a onda percorre. */
    paradas: number
    concluida_em?: string | null
    created_at: string
}

/** Uma parada da volta pelo estoque: o que pegar e onde. */
export interface ParadaDaOnda {
    endereco_id: number
    endereco: string
    endereco_nome: string
    produto_id: number
    produto_nome: string
    produto_codigo: string
    variacao?: string
    quantidade: number
    unidade_ids: number[]
}

/**
 * Abre a separação de vários pedidos numa volta só.
 *
 * Onda é feita de pedidos, e pedido é coisa da vitrine: exige o plano com
 * site. Pedido que já está em outra onda responde 409, e a onda sem peça
 * reservada também — os dois são recusa do servidor, não erro de tela.
 */
export async function abrirOnda(pedidos: number[]): Promise<{ onda: Onda; paradas: ParadaDaOnda[] }> {

    const dados = await apiFetch<{ onda: Onda; paradas?: ParadaDaOnda[] }>("/api/estoque/ondas", {
        method: "POST",
        body: { pedidos },
    })

    return { onda: dados.onda, paradas: Array.isArray(dados.paradas) ? dados.paradas : [] }
}

export async function listarOndas(situacao?: SituacaoOnda): Promise<Onda[]> {

    const consulta = situacao ? `?situacao=${encodeURIComponent(situacao)}` : ""
    const dados = await apiFetch<{ ondas?: Onda[] }>(`/api/estoque/ondas${consulta}`)

    return Array.isArray(dados.ondas) ? dados.ondas : []
}

export interface OndaDetalhada {
    onda: Onda
    /** Ids dos pedidos que a onda separa. */
    pedidos: number[]
    tarefas: Tarefa[]
}

export async function verOnda(id: number): Promise<OndaDetalhada> {

    const dados = await apiFetch<Partial<OndaDetalhada>>(`/api/estoque/ondas/${id}`)

    return {
        onda: dados.onda as Onda,
        pedidos: Array.isArray(dados.pedidos) ? dados.pedidos : [],
        tarefas: Array.isArray(dados.tarefas) ? dados.tarefas : [],
    }
}

/** Desmancha a separação. As reservas dos pedidos continuam de pé. */
export async function cancelarOnda(id: number): Promise<void> {
    await apiFetch(`/api/estoque/ondas/${id}/cancelar`, { method: "POST" })
}

// ---------------------------------------------------------------------------
// Separação de um pedido só
// ---------------------------------------------------------------------------

export interface Separacao {
    pedido: { id: number; codigo: string; status: string }

    /**
     * A lista de picking: uma linha por produto em cada endereço, com a
     * quantidade a pegar ali, na ordem em que se anda pelo estoque.
     *
     * É o que vai impresso — "3x camiseta P, 001.005.01.A" —, e vem agrupada
     * do servidor: agrupar na tela faria a lista impressa e a onda de
     * separação contarem a mesma mercadoria de jeitos diferentes.
     */
    linhas: ParadaDaOnda[]

    /** As peças uma a uma, para quem precisa do detalhe. */
    pecas: PecaSeparada[]

    total: number
    /** Quantos pontos do estoque a separação percorre. */
    paradas: number
    /** Pedido antigo, de antes da reserva existir, não tem peça separada. */
    tem_reserva: boolean
}

/** Uma peça reservada para o pedido, como o servidor a descreve. */
export interface PecaSeparada {
    id: number
    sequencia: number
    endereco: string
    endereco_nome: string
    produto_id: number
    produto_nome: string
    produto_codigo: string
    produto_variacao: string
    reservada: boolean
}

/** A lista de separação de um pedido, na ordem em que se anda pelo estoque. */
export async function separarPedido(pedidoId: number): Promise<Separacao> {

    const dados = await apiFetch<Partial<Separacao>>(`/api/pedidos/${pedidoId}/separacao`)

    return {
        pedido: dados.pedido ?? { id: pedidoId, codigo: "", status: "" },
        linhas: Array.isArray(dados.linhas) ? dados.linhas : [],
        pecas: Array.isArray(dados.pecas) ? dados.pecas : [],
        total: dados.total ?? 0,
        paradas: dados.paradas ?? 0,
        tem_reserva: dados.tem_reserva === true,
    }
}
