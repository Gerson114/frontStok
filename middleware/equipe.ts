// A conversa interna da equipe.
//
// Como o resto do painel, passa pelas rotas internas do Next: o token vive no
// cookie httpOnly e o navegador nunca o enxerga.
//
// Nada aqui decide acesso. Quem decide é o servidor, que confere três coisas a
// cada requisição — a conta está ativa nesta loja, o código foi digitado e
// ainda vale, e a sala pedida é uma de que essa pessoa participa. Esconder um
// botão no navegador não protege rota nenhuma; o endereço continua existindo.

import { apiFetch } from "./client"
import type {
    CodigoDaLoja,
    EstadoDaEquipe,
    FalaDaEquipe,
    GrupoDaEquipe,
    PedidoDeAcesso,
    SituacaoDoAcesso,
    Mural,
    NotaDaEquipe,
    TarefaDaEquipe,
} from "@/app/type/type"

/** O estado da conversa: destravada ou não, quem é você, e as salas. */
export async function consultarEquipeChat(): Promise<EstadoDaEquipe> {

    const dados = await apiFetch<EstadoDaEquipe>("/api/equipe")

    return {
        destravado: dados.destravado ?? false,
        situacao: dados.situacao ?? "",
        pode_codigo: dados.pode_codigo ?? false,
        pode_admitir: dados.pode_admitir ?? false,
        sem_codigo: dados.sem_codigo ?? false,
        eu: dados.eu,
        membros: dados.membros ?? [],
        salas: dados.salas ?? [],
    }
}

/**
 * Quem da loja está com o painel aberto agora — a bolinha verde.
 *
 * Devolve os crachás ("d3", "f12"), que é o mesmo campo que cada `Membro` já
 * traz: a tela cruza um com o outro. Pedir os nomes aqui seria repetir o que a
 * listagem já entregou, e com o risco de os dois discordarem.
 *
 * Quem responde não é o banco, e sim o socket que cada painel aberto mantém —
 * a pessoa está online exatamente enquanto a conexão dela existe. Por isso a
 * lista pode ser pedida de novo à vontade, e é o que a tela faz a cada aviso
 * de presença que chega pelo canal ao vivo.
 *
 * Um conjunto, e não uma lista: quem chama vai perguntar "fulano está aqui?"
 * uma vez por linha desenhada.
 */
export async function consultarPresenca(): Promise<Set<string>> {

    const dados = await apiFetch<{ online?: string[] }>("/api/equipe/presenca")

    return new Set(dados.online ?? [])
}

/**
 * Pede a entrada na conversa com o código da loja.
 *
 * Acertar o código NÃO abre a conversa: abre um pedido, e quem decide é o
 * dono. Por isso devolve a situação — "pendente" para quase todo mundo,
 * "aprovado" para o próprio dono, que é quem aprova.
 *
 * O código vai como foi digitado, com hífen e tudo: quem normaliza é o
 * servidor, e fazer isso nos dois lados é criar duas regras que um dia
 * divergem — e aí um traço a mais viraria uma tentativa gasta do limite de
 * força bruta.
 */
export async function entrarNaEquipe(codigo: string): Promise<SituacaoDoAcesso> {

    const dados = await apiFetch<{ situacao: SituacaoDoAcesso }>("/api/equipe/entrar", {
        method: "POST",
        body: { codigo },
    })

    return dados.situacao
}

/* ==========================================================================
   Grupos
   ========================================================================== */

/** Abre um grupo com quem foi escolhido. Quem cria entra nele. */
export async function criarGrupo(nome: string, membros: string[]): Promise<string> {

    const dados = await apiFetch<{ grupo: GrupoDaEquipe; sala: string }>("/api/equipe/grupos", {
        method: "POST",
        body: { nome, membros },
    })

    return dados.sala
}

/** Põe gente num grupo. Só o criador e o dono da loja conseguem. */
export async function porNoGrupo(grupoID: number, membros: string[]): Promise<void> {
    await apiFetch(`/api/equipe/grupos/${grupoID}/membros`, {
        method: "POST",
        body: { membros },
    })
}

/**
 * Tira alguém do grupo. Sem `cracha`, é a própria pessoa saindo — e isso
 * qualquer membro pode.
 */
export async function sairDoGrupo(grupoID: number, cracha?: string): Promise<void> {

    const query = cracha ? `?cracha=${encodeURIComponent(cracha)}` : ""

    await apiFetch(`/api/equipe/grupos/${grupoID}/membros${query}`, { method: "DELETE" })
}

/* ==========================================================================
   Tarefas
   ========================================================================== */

/** O que a equipe pediu uma à outra, já na ordem em que aperta. */
export async function listarTarefas(): Promise<TarefaDaEquipe[]> {

    const dados = await apiFetch<{ tarefas: TarefaDaEquipe[] }>("/api/equipe/tarefas")

    return dados.tarefas ?? []
}

/**
 * Abre uma tarefa.
 *
 * `para` vazio quer dizer "é comigo" — anotar o próprio recado não pode custar
 * um passo a mais do que anotar para o colega. As datas vão como "2026-09-30",
 * sem hora: prazo de tarefa é um dia, e carregar hora só criaria a dúvida de
 * vencer às 00h00 ou às 23h59.
 */
export async function criarTarefa(dados: {
    titulo: string
    descricao?: string
    para?: string
    prioridade: string
    comeca_em?: string
    termina_em?: string
}): Promise<TarefaDaEquipe> {

    const resposta = await apiFetch<{ tarefa: TarefaDaEquipe }>("/api/equipe/tarefas", {
        method: "POST",
        body: dados,
    })

    return resposta.tarefa
}

/** Move a tarefa. Só o que vier no corpo muda; o resto fica como está. */
export async function mudarTarefa(
    id: number,
    mudanca: Partial<{
        situacao: string
        prioridade: string
        para: string
        comeca_em: string
        termina_em: string
    }>
): Promise<void> {
    await apiFetch(`/api/equipe/tarefas/${id}`, { method: "PUT", body: mudanca })
}

/** Apaga a tarefa. Só quem a pediu e o dono da loja. */
export async function apagarTarefa(id: number): Promise<void> {
    await apiFetch(`/api/equipe/tarefas/${id}`, { method: "DELETE" })
}

/* ==========================================================================
   O mural
   ========================================================================== */

/**
 * Abre um quadro e devolve também a lista de quadros da pessoa.
 *
 * Sem `muralID`, abre o PRÓPRIO — que o servidor cria na primeira vez, sem
 * tela de "crie seu mural". Quem decide se um quadro pedido pode ser aberto é
 * ele, contra a lista de membros.
 */
export async function abrirMural(muralID?: number): Promise<Mural> {

    const query = muralID ? `?mural=${muralID}` : ""
    const dados = await apiFetch<Mural>(`/api/equipe/notas${query}`)

    return {
        notas: dados.notas ?? [],
        murais: dados.murais ?? [],
        aberto: dados.aberto,
        membros: dados.membros ?? [],
        largura: dados.largura ?? 2400,
        altura: dados.altura ?? 1600,
    }
}

/** Chama gente para um quadro. Só quem é dono dele (e o dono da loja). */
export async function chamarParaOMural(muralID: number, membros: string[]): Promise<void> {
    await apiFetch(`/api/equipe/murais/${muralID}/membros`, {
        method: "POST",
        body: { membros },
    })
}

/**
 * Sai de um quadro, ou tira alguém dele.
 *
 * Sem `cracha`, é a própria pessoa saindo — e isso qualquer membro pode, menos
 * do próprio quadro, que é a caixa dela.
 */
export async function sairDoMural(muralID: number, cracha?: string): Promise<void> {

    const query = cracha ? `?cracha=${encodeURIComponent(cracha)}` : ""

    await apiFetch(`/api/equipe/murais/${muralID}/membros${query}`, { method: "DELETE" })
}

/** Pendura um recado novo, na posição em que a pessoa soltou. */
export async function pendurarNota(dados: {
    mural_id: number
    texto: string
    cor: string
    x: number
    y: number
}): Promise<NotaDaEquipe> {

    const resposta = await apiFetch<{ nota: NotaDaEquipe }>("/api/equipe/notas", {
        method: "POST",
        body: dados,
    })

    return resposta.nota
}

/**
 * Move, recolore, reescreve ou traz o papel para a frente.
 *
 * Só o que vier no corpo muda. Arrastar manda x e y UMA vez, no fim do gesto:
 * mandar a cada pixel encheria o canal da loja de posições.
 */
export async function mexerNaNota(
    id: number,
    mudanca: Partial<{ texto: string; cor: string; x: number; y: number; frente: boolean }>
): Promise<void> {
    await apiFetch(`/api/equipe/notas/${id}`, { method: "PUT", body: mudanca })
}

/** Arranca o papel do quadro. Só quem escreveu e o dono da loja. */
export async function arrancarNota(id: number): Promise<void> {
    await apiFetch(`/api/equipe/notas/${id}`, { method: "DELETE" })
}

/* ==========================================================================
   Quem entra na conversa — telas do dono
   ========================================================================== */

/** Quem pediu para entrar, quem já entrou e quem foi recusado. */
export async function consultarAcessos(): Promise<PedidoDeAcesso[]> {

    const dados = await apiFetch<{ acessos: PedidoDeAcesso[] }>("/api/equipe/acessos")

    return dados.acessos ?? []
}

/** Confirma ou recusa a entrada de alguém na conversa da empresa. */
export async function decidirAcesso(
    cracha: string,
    situacao: "aprovado" | "recusado"
): Promise<void> {
    await apiFetch("/api/equipe/acessos", {
        method: "POST",
        body: { cracha, situacao },
    })
}

/**
 * Sai da conversa da empresa.
 *
 * Não é "esconder": apaga a admissão, a presença nos grupos e as marcas de
 * leitura. Voltar custa os dois passos de novo — digitar o código e o dono
 * confirmar. Por isso a tela pergunta antes.
 *
 * O dono não sai: o servidor recusa. Ele é a única conta capaz de readmitir
 * quem saiu.
 */
export async function sairDaEquipe(): Promise<void> {
    await apiFetch("/api/equipe/sair", { method: "POST" })
}

/**
 * As falas de uma sala.
 *
 * `desde` é o incremental da tela aberta: ela pede só o que chegou depois do
 * que já tem, em vez de rebaixar a conversa inteira a cada aviso.
 */
export async function lerSala(sala: string, desde = 0): Promise<FalaDaEquipe[]> {

    const query = new URLSearchParams({ sala })

    if (desde > 0) query.set("desde", String(desde))

    const dados = await apiFetch<{ mensagens: FalaDaEquipe[] }>(
        `/api/equipe/mensagens?${query.toString()}`
    )

    return dados.mensagens ?? []
}

/**
 * Escreve na sala e devolve a fala já gravada.
 *
 * `respondeA` cita outra mensagem. O servidor confere que ela é da MESMA sala:
 * sem isso, daria para citar uma conversa reservada e fazer a citação devolver
 * o texto dela.
 */
export async function escreverNaSala(
    sala: string,
    texto: string,
    respondeA?: number
): Promise<FalaDaEquipe> {

    const dados = await apiFetch<{ mensagem: FalaDaEquipe }>("/api/equipe/mensagens", {
        method: "POST",
        body: { sala, texto, responde_a: respondeA },
    })

    return dados.mensagem
}

/**
 * Avisa a sala de que você está escrevendo.
 *
 * Chamada a cada dois segundos enquanto a pessoa digita, e nunca esperada: se
 * falhar, o pior caso é a outra ponta não ver as bolinhas — não vale segurar
 * o que ela está escrevendo por causa disso.
 */
export async function avisarQueDigito(sala: string): Promise<void> {
    await apiFetch("/api/equipe/digitando", { method: "POST", body: { sala } })
}

/** Zera a bolinha de não lidas de uma sala. */
export async function marcarSalaLida(sala: string, ate = 0): Promise<void> {
    await apiFetch("/api/equipe/lida", { method: "POST", body: { sala, ate } })
}

/* ==========================================================================
   O código da loja — telas do dono
   ========================================================================== */

/** O código atual, para o dono passar à equipe. */
export async function consultarCodigoDaLoja(): Promise<CodigoDaLoja> {
    return apiFetch<CodigoDaLoja>("/api/equipe/codigo")
}

/**
 * Sorteia outro código.
 *
 * Derruba TODO MUNDO que estava na conversa — inclusive o próprio dono. É o
 * que se usa no dia em que alguém sai da loja, e é por isso que a tela
 * pergunta antes.
 */
export async function trocarCodigoDaLoja(): Promise<CodigoDaLoja> {
    return apiFetch<CodigoDaLoja>("/api/equipe/codigo", { method: "POST" })
}
