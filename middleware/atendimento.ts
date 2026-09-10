// O chat do site visto do lado da loja: a lista de quem escreveu e o fio de
// cada um. Tudo passa pelas rotas internas /api/atendimentos, como o resto do
// painel — o token do lojista vive num cookie httpOnly que o navegador não lê.

import { apiFetch } from "./client"

/** Uma linha da lista: com quem é a conversa e como ela está. */
export interface Atendimento {
    id: number
    cliente_id: number
    cliente_nome: string
    cliente_contato: string
    ultima_mensagem_em: string

    /** A última fala do fio, para a lista mostrar do que se trata. */
    ultima_fala: string
    ultimo_autor: string

    /** Quantas mensagens do cliente a loja ainda não leu. */
    nao_lidas: number

    /** De quem é este cliente. Vazio é fio livre, que qualquer um pode pegar. */
    responsavel_id?: number | null
    responsavel_nome?: string

    /**
     * Em que pé está o atendimento:
     *
     *   livre          — o cliente falou e ninguém pegou. É a fila, e ela
     *                    aparece para a equipe inteira.
     *   atribuido      — alguém pegou; sumiu da tela dos outros.
     *   em_atendimento — quem pegou começou.
     *   encerrado      — terminou. Sai da lista de trabalho; volta para a
     *                    fila sozinho se o cliente escrever de novo.
     */
    situacao: string
    iniciado_em?: string | null
    encerrado_em?: string | null
}

/** Os quatro estados de um atendimento, como o servidor os nomeia. */
export const LIVRE = "livre"
export const ATRIBUIDO = "atribuido"
export const EM_ATENDIMENTO = "em_atendimento"
export const ENCERRADO = "encerrado"

export interface MensagemAtendimento {
    id: number
    /** "cliente" ou "loja". */
    autor: string

    /** Quem da loja escreveu, quando o autor é a loja. */
    ator?: string

    texto: string
    criada_em: string
}

/**
 * A lista que esta pessoa pode ver.
 *
 * Quem filtra é o servidor: o dono recebe tudo, e o funcionário recebe a fila
 * mais o que é dele. Filtrar aqui seria esconder na tela o que continuaria
 * chegando ao navegador.
 */
export async function listarAtendimentos(encerrados = false): Promise<Atendimento[]> {
    const dados = await apiFetch<{ atendimentos?: Atendimento[] }>(
        encerrados ? "/api/atendimentos?encerrados=1" : "/api/atendimentos",
    )
    return Array.isArray(dados.atendimentos) ? dados.atendimentos : []
}

/** Começa ou termina o atendimento deste fio. */
export async function mudarSituacao(id: number, acao: "iniciar" | "encerrar"): Promise<void> {
    await apiFetch(`/api/atendimentos/${id}/situacao`, { method: "POST", body: { acao } })
}

/**
 * O fio de uma conversa.
 *
 * Com `desde`, devolve só o que chegou depois daquela mensagem. É o que faz a
 * atualização ao vivo custar quase nada: a resposta normal é uma lista vazia.
 */
export async function mensagensDoAtendimento(
    id: number,
    desde = 0,
): Promise<{ mensagens: MensagemAtendimento[]; digitando: boolean }> {

    const endereco = desde > 0
        ? `/api/atendimentos/${id}/mensagens?desde=${desde}`
        : `/api/atendimentos/${id}/mensagens`

    const dados = await apiFetch<{ mensagens?: MensagemAtendimento[]; digitando?: boolean }>(endereco)

    return {
        mensagens: Array.isArray(dados.mensagens) ? dados.mensagens : [],

        // Se o CLIENTE está escrevendo agora. Vem junto da consulta que a tela
        // já faz sozinha — um aviso destes não merece uma conexão própria.
        digitando: Boolean(dados.digitando),
    }
}

/**
 * Avisa o cliente de que o atendente está escrevendo.
 *
 * Disparado sem esperar resposta e sem tratar erro: é informação descartável,
 * e travar o que o atendente digita por causa dela seria inverter as
 * prioridades.
 */
export function avisarQueDigita(id: number): void {
    void fetch(`/api/atendimentos/${id}/digitando`, { method: "POST" }).catch(() => {})
}

/** O atendente respondendo. */
export async function responderAtendimento(id: number, texto: string): Promise<MensagemAtendimento> {
    const dados = await apiFetch<{ mensagem: MensagemAtendimento }>(
        `/api/atendimentos/${id}/mensagens`,
        { method: "POST", body: { texto } },
    )

    return dados.mensagem
}

/**
 * Decide de quem é este cliente.
 *
 * Sem argumentos, quem chama assume para si — o "esse cliente é comigo".
 * `liberar` devolve o fio à fila. `funcionarioId` passa para outra pessoa, e o
 * servidor só aceita isso do dono: um atendente que pudesse transferir
 * empurraria o cliente difícil para o colega.
 */
export async function definirResponsavel(
    id: number,
    opcoes: { funcionarioId?: number; liberar?: boolean } = {},
): Promise<void> {
    await apiFetch(`/api/atendimentos/${id}/responsavel`, {
        method: "POST",
        body: {
            funcionario_id: opcoes.funcionarioId ?? null,
            liberar: opcoes.liberar ?? false,
        },
    })
}
