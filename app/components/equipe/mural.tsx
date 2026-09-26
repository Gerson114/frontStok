"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FiAlertCircle, FiEdit2, FiLogOut, FiPlus, FiTrash2, FiUserPlus, FiUsers, FiX } from "react-icons/fi"
import {
    abrirMural,
    arrancarNota,
    chamarParaOMural,
    mexerNaNota,
    pendurarNota,
    sairDoMural,
} from "@/middleware/equipe"
import type {
    CorDaNota,
    MembroDaEquipe,
    MembroDoQuadro,
    NotaDaEquipe,
    QuadroDaEquipe,
} from "@/app/type/type"

/**
 * O mural da loja: os recados que ficam à vista.
 *
 * É a terceira forma da mesma conversa, ao lado das mensagens e das tarefas, e
 * existe porque as duas outras não servem para o que FICA. A mensagem rola
 * para cima e some; a tarefa tem dono, prazo e um estado que alguém fecha. O
 * recado que precisa ficar à vista não é nenhum dos dois — "a chave do
 * depósito está na gaveta de cima" — e hoje ele vive num papel colado no
 * monitor, que some quando alguém limpa a mesa.
 *
 * O quadro é da LOJA e qualquer um move qualquer papel: tirar um da frente do
 * outro, juntar os do mesmo assunto num canto, isso é usar o mural. Escrever e
 * apagar são de quem pendurou — reescrever o recado alheio é falsificá-lo.
 *
 * O ARRASTO é feito com Pointer Events, e não com a API de arrastar-e-soltar
 * do HTML. Aquela foi feita para largar coisas ENTRE aplicações, arrasta uma
 * imagem fantasma que não dá para estilizar e simplesmente não existe no
 * toque. Aqui a posição é escrita em `left`/`top` a cada movimento — nunca em
 * `transform`, que pertence às animações —, e `setPointerCapture` garante que o
 * papel continue seguindo o dedo mesmo se ele sair da área da nota; sem isso,
 * um arrasto rápido "solta" o papel no meio do caminho.
 */

const CORES: { chave: CorDaNota; rotulo: string }[] = [
    { chave: "amarela", rotulo: "Amarelo" },
    { chave: "verde", rotulo: "Verde" },
    { chave: "azul", rotulo: "Azul" },
    { chave: "rosa", rotulo: "Rosa" },
    { chave: "cinza", rotulo: "Cinza" },
]

/** O tamanho do papel na tela. Fixo: é um recado, não um documento. */
const LARGURA_NOTA = 200

export default function MuralDaEquipe({ eu, equipe }: {
    eu: MembroDaEquipe
    equipe: MembroDaEquipe[]
}) {

    const [notas, setNotas] = useState<NotaDaEquipe[]>([])
    const [quadro, setQuadro] = useState({ largura: 2400, altura: 1600 })

    const [murais, setMurais] = useState<QuadroDaEquipe[]>([])
    const [aberto, setAberto] = useState<QuadroDaEquipe | null>(null)
    const [membros, setMembros] = useState<MembroDoQuadro[]>([])
    const [chamando, setChamando] = useState(false)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [novas, setNovas] = useState<number[]>([])
    const [editando, setEditando] = useState<number | null>(null)

    const area = useRef<HTMLDivElement>(null)

    const recarregar = useCallback(async (muralID?: number) => {
        try {
            const dados = await abrirMural(muralID)

            setNotas(dados.notas)
            setMurais(dados.murais)
            setAberto(dados.aberto)
            setMembros(dados.membros)
            setQuadro({ largura: dados.largura, altura: dados.altura })
            setErro("")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível abrir o mural.")
        }
    }, [])

    useEffect(() => {

        let cancelado = false

        async function buscar() {
            try {
                const dados = await abrirMural()

                if (!cancelado) {
                    setNotas(dados.notas)
                    setMurais(dados.murais)
                    setAberto(dados.aberto)
                    setMembros(dados.membros)
                    setQuadro({ largura: dados.largura, altura: dados.altura })
                }
            } catch (e) {
                if (!cancelado) {
                    setErro(e instanceof Error ? e.message : "Não foi possível abrir o mural.")
                }
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        buscar()

        return () => {
            cancelado = true
        }
    }, [])

    /* ------------------------------------------------------------------ */

    async function pendurar() {

        setErro("")

        // O papel novo nasce no primeiro lugar LIVRE da parte do quadro que
        // está à vista.
        //
        // "À vista" e não em (0,0): com o quadro rolado, uma nota criada na
        // origem apareceria fora da tela e a pessoa acharia que o botão não
        // funcionou.
        //
        // "Livre" porque antes todas nasciam no mesmo ponto: clicar três vezes
        // empilhava três papéis exatamente um sobre o outro, e a tela mostrava
        // o que parecia ser um só — o botão funcionava e não parecia.
        const rolagem = area.current

        const { x, y } = lugarLivre(
            notas,
            rolagem?.scrollLeft ?? 0,
            rolagem?.scrollTop ?? 0,
            quadro
        )

        try {
            const nota = await pendurarNota({
                mural_id: aberto?.id ?? 0,
                texto: "Novo recado",
                cor: "amarela",
                x,
                y,
            })

            setNotas((atuais) => [...atuais, nota])
            setNovas((atuais) => [...atuais, nota.id])
            setEditando(nota.id)

        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível pendurar o recado.")
        }
    }

    /**
     * Guarda a posição no fim do gesto.
     *
     * O estado local já foi movido durante o arrasto — o servidor é avisado
     * UMA vez, quando a mão solta. Mandar a cada pixel encheria o canal da
     * loja de posições e faria a rede decidir a suavidade do arrasto.
     */
    const soltar = useCallback(async (id: number, x: number, y: number) => {
        try {
            await mexerNaNota(id, { x, y, frente: true })
        } catch (e) {
            // A nota volta para onde o servidor a conhece: deixá-la no lugar
            // novo mostraria uma posição que ninguém mais vê.
            setErro(e instanceof Error ? e.message : "Não foi possível mover o recado.")
            recarregar(aberto?.id)
        }
    }, [recarregar, aberto?.id])

    async function salvarTexto(id: number, texto: string) {

        setEditando(null)

        try {
            await mexerNaNota(id, { texto })
            setNotas((atuais) => atuais.map((n) => (n.id === id ? { ...n, texto } : n)))
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível salvar o recado.")
            recarregar(aberto?.id)
        }
    }

    async function trocarCor(id: number, cor: CorDaNota) {

        setNotas((atuais) => atuais.map((n) => (n.id === id ? { ...n, cor } : n)))

        try {
            await mexerNaNota(id, { cor })
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível trocar a cor.")
            recarregar(aberto?.id)
        }
    }

    async function arrancar(id: number) {

        setNotas((atuais) => atuais.filter((n) => n.id !== id))

        try {
            await arrancarNota(id)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível apagar o recado.")
            recarregar(aberto?.id)
        }
    }

    async function chamar(crachas: string[]) {

        if (!aberto) return

        setErro("")

        try {
            await chamarParaOMural(aberto.id, crachas)
            setChamando(false)
            await recarregar(aberto.id)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível chamar para o mural.")
        }
    }

    async function sair() {

        if (!aberto || aberto.proprio) return

        setErro("")

        try {
            await sairDoMural(aberto.id)

            // Volta para o próprio quadro: ficar no que acabou de ser deixado
            // mostraria um mural que a pessoa não pode mais abrir.
            await recarregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível sair do mural.")
        }
    }

    /* ------------------------------------------------------------------ */

    return (
        <div className="flex min-h-0 flex-1 flex-col">

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">

                <div className="min-w-0">

                    {/* O seletor de quadros. Cada pessoa tem o seu e é chamada
                        para o de outros — um mural único da loja seria o mural
                        de portaria, onde todo mundo pendura tudo e em duas
                        semanas ninguém acha nada. */}
                    <div className="flex flex-wrap items-center gap-2">

                        <label htmlFor="qual-mural" className="sr-only">Qual mural</label>

                        <select
                            id="qual-mural"
                            value={aberto?.id ?? ""}
                            onChange={(e) => recarregar(Number(e.target.value))}
                            className="field py-1.5 text-sm font-semibold"
                        >
                            {murais.map((quadro) => (
                                <option key={quadro.id} value={quadro.id}>
                                    {quadro.proprio ? "Meu mural" : `${quadro.nome} · ${quadro.dono_nome}`}
                                </option>
                            ))}
                        </select>

                        <span className="flex items-center gap-1 text-xs text-[var(--ink-3)]">
                            <FiUsers className="w-3.5" aria-hidden />
                            {membros.length === 1 ? "só você" : `${membros.length} pessoas`}
                        </span>
                    </div>

                    <p className="mt-1 text-sm text-[var(--ink-2)]">
                        Os recados que ficam à vista. Arraste para organizar — quem está no quadro
                        move qualquer papel.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">

                    {/* Chamar é de quem é dono do quadro: qualquer membro
                        convidando transformaria o quadro dos dois do
                        inventário no mural de portaria outra vez. */}
                    {aberto?.meu && (
                        <button
                            type="button"
                            onClick={() => setChamando(true)}
                            className="btn btn-neutro"
                        >
                            <FiUserPlus className="w-4" aria-hidden />
                            <span>Chamar</span>
                        </button>
                    )}

                    {/* Ninguém sai do próprio quadro: ele é a caixa da pessoa,
                        e não haveria quem a convidasse de volta. */}
                    {aberto && !aberto.proprio && (
                        <button
                            type="button"
                            onClick={sair}
                            className="btn btn-neutro"
                        >
                            <FiLogOut className="w-4" aria-hidden />
                            <span>Sair do mural</span>
                        </button>
                    )}

                    <button type="button" onClick={pendurar} className="btn btn-primario">
                        <FiPlus className="w-4" aria-hidden />
                        <span>Novo recado</span>
                    </button>
                </div>
            </div>

            {erro && (
                <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg bg-[var(--vermelho-fundo)] px-3 py-2 text-sm font-semibold text-[var(--vermelho)]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </p>
            )}

            {chamando && (
                <ChamarPessoas
                    equipe={equipe}
                    membros={membros}
                    eu={eu}
                    aoChamar={chamar}
                    aoFechar={() => setChamando(false)}
                />
            )}

            {carregando ? (
                <div className="h-full animate-pulse rounded-xl bg-[var(--fundo)]" />
            ) : (
                <div
                    ref={area}
                    className="quadro-do-mural min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--linha)]"
                >
                    {/* A área interna tem o tamanho do quadro, e é ela que
                        rola. As notas são posicionadas em pixels absolutos
                        dentro dela — é o que faz duas pessoas verem o mesmo
                        arranjo em telas de larguras diferentes. */}
                    <div
                        className="relative"
                        style={{ width: quadro.largura, height: quadro.altura }}
                    >
                        {notas.length === 0 && (
                            <p className="absolute left-8 top-8 max-w-xs text-sm text-[var(--ink-3)]">
                                O quadro está vazio. Pendure o primeiro recado — o que a equipe
                                precisa ter à vista e não cabe numa mensagem que rola para cima.
                            </p>
                        )}

                        {notas.map((nota) => (
                            <Papel
                                key={nota.id}
                                nota={nota}
                                nova={novas.includes(nota.id)}
                                meu={nota.cracha === eu.cracha || eu.dono}
                                editando={editando === nota.id}
                                limites={quadro}
                                aoEditar={() => setEditando(nota.id)}
                                aoSalvar={(texto) => salvarTexto(nota.id, texto)}
                                aoCancelar={() => setEditando(null)}
                                aoTrocarCor={(cor) => trocarCor(nota.id, cor)}
                                aoArrancar={() => arrancar(nota.id)}
                                aoMover={(x, y) => {
                                    setNotas((atuais) =>
                                        atuais.map((n) => (n.id === nota.id ? { ...n, x, y } : n))
                                    )
                                }}
                                aoSoltar={(x, y) => soltar(nota.id, x, y)}
                                aoAssentar={() =>
                                    setNovas((atuais) => atuais.filter((id) => id !== nota.id))
                                }
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

/** Quem chamar para o quadro: a equipe menos quem já está nele. */
function ChamarPessoas({ equipe, membros, eu, aoChamar, aoFechar }: {
    equipe: MembroDaEquipe[]
    membros: MembroDoQuadro[]
    eu: MembroDaEquipe
    aoChamar: (crachas: string[]) => void
    aoFechar: () => void
}) {

    const [marcados, setMarcados] = useState<string[]>([])

    const jaDentro = (membro: MembroDaEquipe) =>
        membros.some((m) => m.pessoa_id === membro.id && m.dono === membro.dono)

    // Só quem já está na conversa: chamar para o mural alguém que o dono da
    // loja ainda não admitiu seria abrir por dentro a porta que ele não abriu.
    const disponiveis = equipe.filter(
        (membro) => membro.cracha !== eu.cracha && membro.na_conversa && !jaDentro(membro)
    )

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

            <div className="anim-surgir absolute inset-0 bg-black/40" onClick={aoFechar} />

            {/* Teto de altura com rolagem: a lista de quem chamar cresce com
                o tamanho da equipe, e num celular ela passava da tela — o
                botão de confirmar ficava fora, sem como alcançá-lo. */}
            <div className="anim-tela relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--linha)] bg-[var(--superficie)] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.12)] sm:p-6">

                <div className="mb-4 flex items-start justify-between gap-4">
                    <h2 className="font-display text-lg text-[var(--ink)]">Chamar para o mural</h2>

                    <button
                        type="button"
                        onClick={aoFechar}
                        aria-label="Fechar"
                        className="rounded-lg p-1 text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)]"
                    >
                        <FiX className="w-4" aria-hidden />
                    </button>
                </div>

                {disponiveis.length === 0 ? (
                    <p className="text-sm text-[var(--ink-3)]">
                        Todo mundo da conversa já está neste mural.
                    </p>
                ) : (
                    <ul className="max-h-72 space-y-1 overflow-y-auto">
                        {disponiveis.map((membro) => (
                            <li key={membro.cracha}>
                                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--superficie-2)]">
                                    <input
                                        type="checkbox"
                                        checked={marcados.includes(membro.cracha)}
                                        onChange={() => setMarcados((atuais) =>
                                            atuais.includes(membro.cracha)
                                                ? atuais.filter((c) => c !== membro.cracha)
                                                : [...atuais, membro.cracha]
                                        )}
                                    />
                                    {membro.nome}
                                </label>
                            </li>
                        ))}
                    </ul>
                )}

                <button
                    type="button"
                    onClick={() => aoChamar(marcados)}
                    disabled={marcados.length === 0}
                    className="btn btn-primario mt-5 w-full justify-center"
                >
                    <FiUserPlus className="w-4" aria-hidden />
                    <span>Chamar</span>
                </button>
            </div>
        </div>
    )
}

/**
 * Prende a posição às bordas do quadro.
 *
 * A MARGEM é a mesma que o servidor usa (ver dentroDoMural em
 * services/equipe/mural.go). Quando as duas contas divergiam, o papel largado
 * perto da borda de baixo era aceito aqui e recuado lá — e ele "pulava"
 * sozinho na recarga seguinte, como se tivesse vontade própria.
 */
function presoAoQuadro(
    x: number,
    y: number,
    limites: { largura: number; altura: number }
): { x: number; y: number } {

    const MARGEM = 200

    // ARREDONDADO, e não só limitado. `clientX`/`clientY` são fracionários em
    // tela com escala do sistema ou zoom do navegador, e a coluna do banco é
    // inteira — mandar "300.5" fazia a gravação voltar 400 e a nota parecia
    // não obedecer ao arrasto. O servidor também arredonda; aqui é para não
    // mandar o que se sabe que ele terá de consertar.
    return {
        x: Math.round(Math.min(Math.max(x, 0), limites.largura - MARGEM)),
        y: Math.round(Math.min(Math.max(y, 0), limites.altura - MARGEM)),
    }
}

/**
 * O primeiro ponto livre a partir do canto visível do quadro.
 *
 * Varre em diagonal — direita e para baixo — testando se o retângulo do papel
 * encostaria em algum já pendurado. É a busca burra, e é a certa aqui: são no
 * máximo duzentas notas, a conta roda uma vez por clique, e qualquer estrutura
 * mais esperta custaria mais para manter do que economiza.
 *
 * Sem lugar nenhum, devolve o canto: é melhor a nota nascer sobreposta do que
 * o botão não fazer nada.
 */
function lugarLivre(
    notas: NotaDaEquipe[],
    esquerda: number,
    topo: number,
    quadro: { largura: number; altura: number }
): { x: number; y: number } {

    const PASSO = 28
    const ALTURA_APROX = 130

    const inicio = { x: esquerda + 24, y: topo + 24 }

    for (let linha = 0; linha < 14; linha++) {
        for (let coluna = 0; coluna < 14; coluna++) {

            const x = inicio.x + coluna * PASSO
            const y = inicio.y + linha * PASSO

            if (x > quadro.largura - LARGURA_NOTA || y > quadro.altura - ALTURA_APROX) continue

            const ocupado = notas.some((nota) =>
                Math.abs(nota.x - x) < LARGURA_NOTA * 0.5 &&
                Math.abs(nota.y - y) < ALTURA_APROX * 0.5
            )

            if (!ocupado) return { x, y }
        }
    }

    return inicio
}

/* ==========================================================================
   Um papel
   ========================================================================== */

function Papel({
    nota, nova, meu, editando, limites,
    aoEditar, aoSalvar, aoCancelar, aoTrocarCor, aoArrancar, aoMover, aoSoltar, aoAssentar,
}: {
    nota: NotaDaEquipe
    nova: boolean
    meu: boolean
    editando: boolean
    limites: { largura: number; altura: number }
    aoEditar: () => void
    aoSalvar: (texto: string) => void
    aoCancelar: () => void
    aoTrocarCor: (cor: CorDaNota) => void
    aoArrancar: () => void
    aoMover: (x: number, y: number) => void
    aoSoltar: (x: number, y: number) => void

    /**
     * Chamado quando a animação de chegada termina.
     *
     * A classe `nota-nova` PRECISA sair depois disso: ela é uma animação com
     * `fill-mode: both`, e enquanto estiver na nota o navegador mantém o
     * estado final dela congelado no elemento.
     */
    aoAssentar: () => void
}) {

    const [naMao, setNaMao] = useState(false)
    const [pousando, setPousando] = useState(false)

    // O rascunho nasce do texto atual e é semeado no CLIQUE de editar, não
    // num efeito: setState síncrono no corpo de um efeito faz o React
    // renderizar duas vezes por mudança.
    const [rascunho, setRascunho] = useState(nota.texto)

    const papel = useRef<HTMLDivElement>(null)

    /*
     * O arrasto é conduzido por REFS e escreve direto no DOM, e não por estado
     * do React. São dois motivos, os dois aprendidos aqui:
     *
     * O GUARDA. Antes o "estou arrastando" era um `useState`. Entre o
     * `pointerdown` e o React re-renderizar com o valor novo cabem vários
     * `pointermove`, e todos eles caíam no `if (!naMao) return` — o papel só
     * começava a andar depois, ou não andava. Um ref muda no mesmo instante em
     * que é atribuído; não há janela.
     *
     * A POSIÇÃO. Cada pixel de movimento virava um `setState` que redesenhava
     * a lista inteira de notas. Com dezenas de papéis no quadro, o arrasto
     * engasgava justamente onde precisa ser fluido. Durante o gesto quem manda
     * é `style.left/top`; o React só fica sabendo no fim, uma vez.
     */
    const arrastando = useRef(false)
    const pegada = useRef({ x: 0, y: 0 })
    const posicao = useRef({ x: nota.x, y: nota.y })

    useEffect(() => {
        posicao.current = { x: nota.x, y: nota.y }
    }, [nota.x, nota.y])

    function pegar(evento: React.PointerEvent<HTMLDivElement>) {

        // Só o botão principal, e nunca em cima de um controle: sem esta
        // guarda, clicar no lixo ou no seletor de cor começaria um arrasto.
        if (evento.button !== 0 || editando) return
        if ((evento.target as HTMLElement).closest("button, select, textarea")) return

        pegada.current = {
            x: evento.clientX - posicao.current.x,
            y: evento.clientY - posicao.current.y,
        }

        arrastando.current = true
        setNaMao(true)
        setPousando(false)

        // O papel continua seguindo o dedo mesmo se ele sair da área da nota.
        // Sem isso, um arrasto rápido solta o papel no meio do caminho.
        evento.currentTarget.setPointerCapture(evento.pointerId)
    }

    function arrastar(evento: React.PointerEvent<HTMLDivElement>) {

        if (!arrastando.current) return

        // `preventDefault` para o navegador não tentar selecionar texto nem
        // iniciar o arrasto nativo de imagem no meio do gesto.
        evento.preventDefault()

        const { x, y } = presoAoQuadro(
            evento.clientX - pegada.current.x,
            evento.clientY - pegada.current.y,
            limites
        )

        posicao.current = { x, y }

        // Direto no DOM: é o que mantém o papel colado no cursor.
        if (papel.current) {
            papel.current.style.left = `${x}px`
            papel.current.style.top = `${y}px`
        }
    }

    function soltar(evento: React.PointerEvent<HTMLDivElement>) {

        if (!arrastando.current) return

        arrastando.current = false

        if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
            evento.currentTarget.releasePointerCapture(evento.pointerId)
        }

        setNaMao(false)
        setPousando(true)

        // Só agora o React e o servidor ficam sabendo — uma vez, no fim do
        // gesto, e não a cada pixel.
        aoMover(posicao.current.x, posicao.current.y)
        aoSoltar(posicao.current.x, posicao.current.y)
    }

    return (
        <div
            ref={papel}
            onPointerDown={pegar}
            onPointerMove={arrastar}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            onAnimationEnd={() => {
                setPousando(false)
                aoAssentar()
            }}
            style={{
                // A POSIÇÃO vai em left/top, e o transform fica só para o
                // efeito (levantar, inclinar, pousar). Antes as duas coisas
                // disputavam o `transform`, e animação ganha de estilo inline:
                // com `fill-mode: both`, a nota recém-criada ficava presa no
                // `transform: none` do fim da animação — no canto do quadro e
                // impossível de arrastar. Era esse o bug.
                left: nota.x,
                top: nota.y,
                width: LARGURA_NOTA,
                zIndex: naMao ? 999 : nota.z,

                // Sem isto, no toque o navegador entende o gesto como rolagem
                // do quadro e nunca entrega o pointermove para a nota.
                touchAction: "none",
            }}
            className={`nota nota-${nota.cor} absolute select-none rounded-lg p-3 ${
                naMao ? "nota-na-mao" : pousando ? "nota-pousando" : ""
            } ${nova ? "nota-nova" : ""} ${editando ? "" : "cursor-grab"}`}
        >
            {editando ? (
                <>
                    <label htmlFor={`nota-${nota.id}`} className="sr-only">Recado</label>

                    <textarea
                        id={`nota-${nota.id}`}
                        value={rascunho}
                        onChange={(e) => setRascunho(e.target.value)}
                        rows={5}
                        maxLength={600}
                        autoFocus
                        className="w-full resize-none rounded-md border border-black/10 bg-[var(--superficie)]/70 p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--azul)]"
                    />

                    <div className="mt-2 flex items-center gap-1.5">

                        <button
                            type="button"
                            onClick={() => aoSalvar(rascunho.trim() || nota.texto)}
                            className="btn btn-primario px-2.5 py-1 text-xs"
                        >
                            Salvar
                        </button>

                        <button
                            type="button"
                            onClick={aoCancelar}
                            aria-label="Cancelar"
                            className="rounded-md p-1 text-[var(--ink-2)] hover:bg-black/5"
                        >
                            <FiX className="w-4" aria-hidden />
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <p className="whitespace-pre-wrap break-words text-sm text-[var(--ink)]">
                        {nota.texto}
                    </p>

                    <p className="mt-2 truncate text-[0.6875rem] text-black/45">
                        {nota.criada_por}
                    </p>

                    {/* Os controles só para quem escreveu (e para o dono).
                        Arrastar continua sendo de todo mundo — é um quadro de
                        recados; o que não se faz é reescrever o dos outros. */}
                    {meu && (
                        <div className="mt-1.5 flex items-center gap-1">

                            <button
                                type="button"
                                onClick={() => {
                                    setRascunho(nota.texto)
                                    aoEditar()
                                }}
                                aria-label="Escrever no recado"
                                className="rounded-md p-1 text-black/50 transition-colors hover:bg-black/10"
                            >
                                <FiEdit2 className="w-3.5" aria-hidden />
                            </button>

                            <label className="sr-only" htmlFor={`cor-${nota.id}`}>Cor do papel</label>

                            <select
                                id={`cor-${nota.id}`}
                                value={nota.cor}
                                onChange={(e) => aoTrocarCor(e.target.value as CorDaNota)}
                                className="rounded-md border border-black/10 bg-[var(--superficie)]/60 px-1 py-0.5 text-[0.6875rem] text-[var(--ink)]"
                            >
                                {CORES.map((cor) => (
                                    <option key={cor.chave} value={cor.chave}>{cor.rotulo}</option>
                                ))}
                            </select>

                            <button
                                type="button"
                                onClick={aoArrancar}
                                aria-label="Apagar recado"
                                className="ml-auto rounded-md p-1 text-[var(--vermelho)] transition-colors hover:bg-black/10"
                            >
                                <FiTrash2 className="w-3.5" aria-hidden />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
