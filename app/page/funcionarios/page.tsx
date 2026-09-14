"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
    FiAlertCircle,
    FiCheckCircle,
    FiChevronDown,
    FiChevronRight,
    FiKey,
    FiLock,
    FiSearch,
    FiSlash,
    FiTrash2,
    FiUserPlus,
    FiUsers,
    FiX,
} from "react-icons/fi"
import { Pagina } from "@/app/components/pagina/pagina"
import FluxoDoAtendimento from "@/app/components/painel/fluxo"
import type { Funcionario, PermissaoConcedivel } from "@/app/type/type"
import {
    consultarEquipe,
    criarFuncionario,
    excluirFuncionario,
    salvarFuncionario,
    trocarSenhaDoFuncionario,
} from "@/middleware/funcionarios"

/**
 * A equipe da loja.
 *
 * O que esta tela resolve: até aqui a loja tinha uma conta só, e ela abria
 * tudo. Quem confere mercadoria via o faturamento, e tirar o acesso de quem
 * saiu significava trocar a senha de todo mundo.
 *
 * O ARRANJO é o dos painéis de administração de conta (a referência aqui é o
 * Google Workspace Admin): a lista de pessoas fica estreita à esquerda e a
 * ficha de quem se escolheu ocupa a área principal. Ele substituiu uma lista
 * de cartões em que cada pessoa carregava as trinta caixas de permissão
 * abertas — três funcionários viravam uma página de rolagem, e a pergunta
 * "quem é gerente aqui?" exigia ler tudo.
 *
 * Duas decisões que vêm desse arranjo e não são enfeite:
 *
 *   - as permissões abrem por SEÇÃO, fechadas, com a conta do que está
 *     marcado ("4 de 6"). O dono quase sempre quer conferir, não editar, e a
 *     conta responde isso sem abrir nada;
 *   - cadastrar acontece no mesmo lugar da ficha, e não numa segunda tela ou
 *     num formulário empilhado acima da lista. É a mesma área respondendo
 *     "quem é esta pessoa", esteja ela sendo criada ou editada.
 *
 * A permissão é marcada tela a tela, no mesmo catálogo que monta o menu — por
 * isso a lista aparece agrupada exatamente como o menu do lado esquerdo.
 * Marcar "Estoque" para alguém é dizer que aquele item vai existir no menu
 * dele; o que não for marcado não aparece bloqueado, simplesmente não está lá,
 * porque não é assunto dele.
 *
 * Três telas não estão na lista e não podem ser concedidas: a assinatura, a
 * conta que recebe o dinheiro das vendas e esta própria. Quem pode conceder
 * permissão pode conceder a si mesmo, e a partir daí a lista do dono deixa de
 * decidir alguma coisa. Quem decide isso é o servidor (ver o campo SoDono do
 * catálogo) — aqui a lista chega já sem elas.
 */

/** Uma tela da lista de permissões, com o que abre debaixo dela. */
interface Grupo {
    item: PermissaoConcedivel
    filhos: PermissaoConcedivel[]
}

/**
 * Agrupa as permissões como o menu: por seção, e dentro dela com as telas
 * filhas penduradas na sua.
 *
 * Filha cuja mãe não veio sobe para o primeiro nível, em vez de sumir — a
 * mesma regra do menu, e pelo mesmo motivo: melhor uma caixa solta do que uma
 * permissão que o dono não encontra para conceder.
 */
function agrupar(permissoes: PermissaoConcedivel[]): { secao: string; grupos: Grupo[] }[] {

    const porChave = new Map<string, Grupo>()

    for (const item of permissoes) {
        if (!item.pai) porChave.set(item.chave, { item, filhos: [] })
    }

    const secoes: { secao: string; grupos: Grupo[] }[] = []

    function secaoDe(nome: string) {
        const achada = secoes.find((s) => s.secao === nome)

        if (achada) return achada

        const nova = { secao: nome, grupos: [] as Grupo[] }
        secoes.push(nova)
        return nova
    }

    for (const item of permissoes) {

        const mae = item.pai ? porChave.get(item.pai) : undefined

        if (mae) {
            mae.filhos.push(item)
            continue
        }

        const grupo = porChave.get(item.chave) ?? { item, filhos: [] }

        porChave.set(item.chave, grupo)
        secaoDe(item.secao || "Painel").grupos.push(grupo)
    }

    return secoes
}

/** A inicial que vai no círculo da lista, para o olho achar a linha de novo. */
function inicial(nome: string): string {
    return (nome.trim()[0] ?? "?").toUpperCase()
}

/** Texto pronto para busca: minúsculo e sem acento. */
function comparavel(texto: string): string {
    return texto
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
}

export default function Funcionarios() {

    const [equipe, setEquipe] = useState<Funcionario[]>([])
    const [permissoes, setPermissoes] = useState<PermissaoConcedivel[]>([])
    const [podePromover, setPodePromover] = useState(false)
    const [lojaAberta, setLojaAberta] = useState("")

    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")
    const [salvando, setSalvando] = useState(false)

    // Quem está aberto na ficha à direita. `"novo"` é o cadastro, que ocupa a
    // mesma área — é a mesma pergunta ("quem é esta pessoa?"), sendo criada em
    // vez de editada.
    const [escolhido, setEscolhido] = useState<number | "novo" | null>(null)

    const [busca, setBusca] = useState("")

    // O rascunho da ficha aberta. Fica em estado próprio, e não lido direto da
    // lista, porque é ele que o botão Salvar grava — e é ele que se descarta
    // ao trocar de pessoa sem salvar.
    const [nome, setNome] = useState("")
    const [email, setEmail] = useState("")
    const [senha, setSenha] = useState("")
    const [marcadas, setMarcadas] = useState<string[]>([])
    const [gerente, setGerente] = useState(false)

    // Seções de permissão abertas. Todas nascem fechadas: a conta ao lado do
    // título ("4 de 6") responde à conferência sem abrir nada.
    const [abertas, setAbertas] = useState<Record<string, boolean>>({})

    // A troca de senha é um pedido à parte do servidor, e por isso tem estado
    // à parte — salvar a ficha não mexe na senha, e vice-versa.
    const [trocandoSenha, setTrocandoSenha] = useState(false)
    const [senhaNova, setSenhaNova] = useState("")

    const secoes = useMemo(() => agrupar(permissoes), [permissoes])

    const carregar = useCallback(async () => {
        try {
            const dados = await consultarEquipe()
            setEquipe(dados.funcionarios)
            setPermissoes(dados.permissoes)
            setPodePromover(dados.pode_promover)
            setLojaAberta(dados.loja)
            setErro("")
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível carregar a equipe.")
        } finally {
            setCarregando(false)
        }
    }, [])

    // A primeira carga fica aqui dentro, e não numa chamada ao `carregar`
    // acima: assim a gravação de estado acontece depois do await, e não no
    // corpo do efeito — que é o que provoca a renderização em cascata. O
    // `cancelado` cobre quem sai da tela antes de a resposta chegar.
    useEffect(() => {

        let cancelado = false

        async function buscar() {
            try {
                const dados = await consultarEquipe()

                if (!cancelado) {
                    setEquipe(dados.funcionarios)
                    setPermissoes(dados.permissoes)
                    setPodePromover(dados.pode_promover)
                    setLojaAberta(dados.loja)
                }
            } catch (e) {
                if (!cancelado) {
                    setErro(e instanceof Error ? e.message : "Não foi possível carregar a equipe.")
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

    const pessoa = useMemo(
        () => (typeof escolhido === "number" ? equipe.find((f) => f.id === escolhido) ?? null : null),
        [escolhido, equipe],
    )

    const listados = useMemo(() => {

        const termo = comparavel(busca.trim())

        if (termo === "") return equipe

        return equipe.filter((f) =>
            comparavel(f.nome).includes(termo) || comparavel(f.email).includes(termo))
    }, [busca, equipe])

    /** Abre a ficha de alguém, descartando o rascunho de quem estava aberto. */
    function abrir(funcionario: Funcionario) {
        setEscolhido(funcionario.id)
        setNome(funcionario.nome)
        setEmail(funcionario.email)
        setMarcadas(funcionario.recursos)
        setGerente(funcionario.gerente)
        setSenha("")
        setTrocandoSenha(false)
        setSenhaNova("")
        setAbertas({})
    }

    function abrirCadastro() {
        setEscolhido("novo")
        setNome("")
        setEmail("")
        setSenha("")
        setMarcadas([])
        setGerente(false)
        setTrocandoSenha(false)
        setAbertas({})
    }

    function alternar(chave: string) {
        setMarcadas((atual) =>
            atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave])
    }

    function alternarSecao(chaves: string[]) {
        setMarcadas((atual) => {
            const todas = chaves.every((chave) => atual.includes(chave))

            return todas
                ? atual.filter((chave) => !chaves.includes(chave))
                : [...new Set([...atual, ...chaves])]
        })
    }

    async function handleCriar(evento: React.FormEvent) {
        evento.preventDefault()
        setSalvando(true)
        setErro("")
        setAviso("")

        try {
            const criado = await criarFuncionario({ nome, email, password: senha, recursos: marcadas, gerente })

            // O que dizer ao dono depende de a pessoa ter recebido o convite.
            //
            // Com o convite no ar, a senha que ele digitou é provisória e ele
            // não deve passá-la adiante: a pessoa cria a dela pelo código que
            // chegou no e-mail. Sem servidor de e-mail, o convite não sai, e aí
            // a senha provisória é mesmo a única forma de a pessoa entrar — e o
            // dono precisa saber disso para combiná-la com ela.
            setAviso(
                criado.convite_enviado
                    ? `${nome} recebeu um e-mail com um código para criar a própria senha. Até usar o código, a senha provisória que você digitou é que vale — prefira não passá-la adiante.`
                    : `${nome} já pode entrar com o e-mail e a senha que você definiu. Peça que ele a troque assim que entrar.`,
            )
            setEscolhido(null)
            await carregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível criar o funcionário.")
        } finally {
            setSalvando(false)
        }
    }

    async function handleSalvar() {

        if (!pessoa) return

        setSalvando(true)
        setErro("")
        setAviso("")

        try {
            await salvarFuncionario(pessoa.id, {
                nome,
                recursos: marcadas,
                ativo: pessoa.ativo,
                gerente,
            })
            setAviso(`${pessoa.nome} atualizado. A sessão aberta dele caiu — na próxima vez que entrar, o menu já vem novo.`)
            await carregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível salvar.")
        } finally {
            setSalvando(false)
        }
    }

    async function handleAtivo(funcionario: Funcionario, ativo: boolean) {
        setErro("")
        setAviso("")

        try {
            await salvarFuncionario(funcionario.id, {
                nome: funcionario.nome,
                recursos: funcionario.recursos,
                ativo,
            })
            setAviso(ativo
                ? `${funcionario.nome} voltou a ter acesso.`
                : `${funcionario.nome} não entra mais. A conta continua aqui, com o histórico do que ele fez.`)
            await carregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível mudar a situação.")
        }
    }

    async function handleSenha(evento: React.FormEvent) {
        evento.preventDefault()

        if (!pessoa) return

        setSalvando(true)
        setErro("")
        setAviso("")

        try {
            await trocarSenhaDoFuncionario(pessoa.id, senhaNova)
            setTrocandoSenha(false)
            setSenhaNova("")
            setAviso(`Senha de ${pessoa.nome} trocada. As sessões abertas com a antiga caíram.`)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível trocar a senha.")
        } finally {
            setSalvando(false)
        }
    }

    async function handleExcluir(funcionario: Funcionario) {
        setErro("")
        setAviso("")

        try {
            await excluirFuncionario(funcionario.id)
            setAviso(`${funcionario.nome} foi excluído.`)
            setEscolhido(null)
            await carregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível excluir.")
        }
    }

    /**
     * As permissões, por seção e fechadas.
     *
     * Fechadas porque a pergunta frequente é de conferência ("ele vê o
     * estoque?"), e a conta no cabeçalho da seção já responde. Abrir as trinta
     * caixas de uma vez era o que fazia esta tela parecer um formulário de
     * imposto de renda.
     */
    function listaDePermissoes() {
        return (
            <div className="divide-y divide-[#EBEBEB] border-y border-[#EBEBEB]">
                {secoes.map(({ secao, grupos }) => {

                    const chaves = grupos.flatMap((g) => [g.item.chave, ...g.filhos.map((f) => f.chave)])
                    const marcadasAqui = chaves.filter((chave) => marcadas.includes(chave)).length
                    const aberta = abertas[secao] ?? false

                    return (
                        <div key={secao}>

                            <div className="flex items-center gap-2">

                                <button
                                    type="button"
                                    onClick={() => setAbertas((a) => ({ ...a, [secao]: !aberta }))}
                                    aria-expanded={aberta}
                                    className="flex flex-1 items-center gap-2 py-3 text-left transition-colors hover:bg-[#F7F7F7]"
                                >
                                    {aberta
                                        ? <FiChevronDown className="w-4 shrink-0 text-[#8A8A8A]" aria-hidden />
                                        : <FiChevronRight className="w-4 shrink-0 text-[#8A8A8A]" aria-hidden />}

                                    <span className="flex-1 text-sm font-semibold text-[#303030]">
                                        {secao}
                                    </span>

                                    <span className={`num text-xs ${
                                        marcadasAqui > 0 ? "font-semibold text-[#303030]" : "text-[#8A8A8A]"
                                    }`}>
                                        {marcadasAqui} de {chaves.length}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => alternarSecao(chaves)}
                                    className="shrink-0 px-2 py-1 text-xs font-semibold text-[#005BD3] hover:underline"
                                >
                                    {marcadasAqui === chaves.length ? "Limpar" : "Marcar tudo"}
                                </button>
                            </div>

                            {aberta && (
                                <div className="grid gap-1 pb-3 pl-6 sm:grid-cols-2">
                                    {grupos.map((grupo) => (
                                        <div key={grupo.item.chave} className="min-w-0">

                                            <label className="flex items-center gap-2 py-1 text-sm text-[#303030]">
                                                <input
                                                    type="checkbox"
                                                    checked={marcadas.includes(grupo.item.chave)}
                                                    onChange={() => alternar(grupo.item.chave)}
                                                    className="h-4 w-4 shrink-0"
                                                />
                                                <span className="truncate">{grupo.item.nome}</span>
                                            </label>

                                            {grupo.filhos.map((filho) => (
                                                <label
                                                    key={filho.chave}
                                                    className="flex items-center gap-2 py-1 pl-6 text-sm text-[#616161]"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={marcadas.includes(filho.chave)}
                                                        onChange={() => alternar(filho.chave)}
                                                        className="h-4 w-4 shrink-0"
                                                    />
                                                    <span className="truncate">{filho.nome}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    /** O seletor de cargo — só para o dono, que é quem promove. */
    function campoDeCargo() {

        if (!podePromover) return null

        return (
            <div>
                <label htmlFor="cargo" className="rotulo">Cargo</label>

                <select
                    id="cargo"
                    value={gerente ? "gerente" : "funcionario"}
                    onChange={(e) => setGerente(e.target.value === "gerente")}
                    className="field w-full sm:max-w-xs"
                >
                    <option value="funcionario">Funcionário — só as telas marcadas</option>
                    <option value="gerente">Gerente — administra esta loja</option>
                </select>

                <p className="mt-1.5 text-xs text-[#616161]">
                    {gerente
                        ? "Abre o sistema inteiro desta loja e cuida da equipe daqui. Não alcança o que é seu: a assinatura e o plano, as suas outras lojas, a conta que recebe o dinheiro e a cara do site."
                        : "Enxerga só o que você marcar abaixo. O menu dele é montado a partir dessa marcação."}
                </p>
            </div>
        )
    }

    if (carregando) {
        return (
            <Pagina titulo="Funcionários">
                <div className="card p-8 text-center text-sm text-[#616161]">Carregando equipe...</div>
            </Pagina>
        )
    }

    return (
        <Pagina
            titulo="Funcionários"
            descricao={
                lojaAberta
                    ? `A equipe de ${lojaAberta}. Cada pessoa entra com a própria senha, e quem você cadastrar aqui nasce nesta loja — para outra unidade, troque de loja no topo.`
                    : "Cada pessoa da sua equipe entra com a própria senha e enxerga só as telas que você marcar."
            }
            acoes={
                <button type="button" onClick={abrirCadastro} className="btn btn-primario">
                    <FiUserPlus className="w-4" aria-hidden />
                    <span>Adicionar pessoa</span>
                </button>
            }
        >

            {erro && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-[#FEE9E8] px-4 py-3 text-sm font-semibold text-[#8E1F0B]">
                    <FiAlertCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{erro}</span>
                </div>
            )}

            {aviso && (
                <div role="status" className="flex items-start gap-2.5 rounded-lg bg-[#CDFEE1] px-4 py-3 text-sm font-semibold text-[#0C5132]">
                    <FiCheckCircle className="mt-0.5 w-4 shrink-0" aria-hidden />
                    <span>{aviso}</span>
                </div>
            )}

            {/* Lista estreita e ficha larga. No celular viram uma coluna só: a
                lista primeiro e a ficha embaixo, que é a ordem em que se usa. */}
            <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">

                {/* ---------------------------------------------------------
                    A LISTA
                    --------------------------------------------------------- */}
                <section className="card flex max-h-[calc(100dvh-14rem)] flex-col overflow-hidden p-0">

                    <div className="border-b border-[#EBEBEB] p-3">
                        <div className="relative">
                            <FiSearch className="pointer-events-none absolute left-2.5 top-1/2 w-4 -translate-y-1/2 text-[#8A8A8A]" aria-hidden />

                            <input
                                type="search"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar pessoa"
                                aria-label="Buscar pessoa na equipe"
                                className="field w-full pl-8"
                            />
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">

                        {listados.length === 0 && (
                            <p className="px-4 py-6 text-center text-sm text-[#616161]">
                                {equipe.length === 0
                                    ? "Ninguém cadastrado ainda."
                                    : "Ninguém com esse nome."}
                            </p>
                        )}

                        {listados.map((funcionario) => {

                            const ativo = escolhido === funcionario.id

                            return (
                                <button
                                    key={funcionario.id}
                                    type="button"
                                    onClick={() => abrir(funcionario)}
                                    aria-current={ativo ? "true" : undefined}
                                    className={`flex w-full items-center gap-3 border-b border-[#F1F1F1] px-3 py-2.5 text-left transition-colors last:border-b-0 ${
                                        ativo ? "bg-[#F1F1F1]" : "hover:bg-[#F7F7F7]"
                                    }`}
                                >
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                        funcionario.ativo
                                            ? "bg-[#303030] text-white"
                                            : "bg-[#E1E1E1] text-[#8A8A8A]"
                                    }`}>
                                        {inicial(funcionario.nome)}
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-[#303030]">
                                            {funcionario.nome}
                                        </span>

                                        <span className="block truncate text-xs text-[#616161]">
                                            {funcionario.gerente ? "Gerente" : "Funcionário"}
                                            {!funcionario.ativo && " · sem acesso"}
                                        </span>
                                    </span>

                                    {funcionario.gerente && (
                                        <FiLock className="w-3.5 shrink-0 text-[#8A8A8A]" aria-hidden />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </section>

                {/* ---------------------------------------------------------
                    A FICHA
                    --------------------------------------------------------- */}
                <section className="card p-6">

                    {escolhido === null && (
                        <div className="flex min-h-[18rem] flex-col items-center justify-center text-center">
                            <FiUsers className="w-8 text-[#B5B5B5]" aria-hidden />

                            <p className="mt-3 font-display text-base text-[#303030]">
                                Escolha alguém na lista
                            </p>

                            <p className="mt-1 max-w-sm text-sm text-[#616161]">
                                A ficha mostra o cargo da pessoa, as telas que ela abre e o que
                                fazer com a conta dela.
                            </p>
                        </div>
                    )}

                    {escolhido === "novo" && (
                        <form onSubmit={handleCriar} className="space-y-5">

                            <div className="flex items-start justify-between gap-3">
                                <p className="font-display text-lg text-[#303030]">Nova pessoa</p>

                                <button
                                    type="button"
                                    onClick={() => setEscolhido(null)}
                                    aria-label="Cancelar"
                                    className="rounded-lg p-1.5 text-[#616161] hover:bg-[#F1F1F1]"
                                >
                                    <FiX className="w-4" aria-hidden />
                                </button>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="rotulo" htmlFor="nome">Nome</label>
                                    <input
                                        id="nome"
                                        value={nome}
                                        onChange={(e) => setNome(e.target.value)}
                                        placeholder="Ex: Ana Paula"
                                        className="field"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="rotulo" htmlFor="email">E-mail</label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="ana@sualoja.com.br"
                                        className="field"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="rotulo" htmlFor="senha">Senha</label>
                                    <input
                                        id="senha"
                                        type="password"
                                        value={senha}
                                        onChange={(e) => setSenha(e.target.value)}
                                        placeholder="Mínimo de 8 caracteres"
                                        className="field"
                                        required
                                    />
                                </div>
                            </div>

                            {campoDeCargo()}

                            {/* O gerente abre tudo por cargo: as caixas não
                                decidiriam nada, e mostrá-las diria o contrário
                                do que o servidor faz. */}
                            {!gerente && (
                                <div>
                                    <p className="rotulo">O que ele pode abrir</p>
                                    {listaDePermissoes()}
                                </div>
                            )}

                            <div className="flex justify-end gap-2 border-t border-[#EBEBEB] pt-4">
                                <button type="button" onClick={() => setEscolhido(null)} className="btn btn-neutro">
                                    Cancelar
                                </button>

                                <button type="submit" disabled={salvando} className="btn btn-primario">
                                    <FiUserPlus className="w-4" aria-hidden />
                                    <span>{salvando ? "Criando..." : "Criar conta"}</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {pessoa && (
                        <div className="space-y-6">

                            {/* Identidade. O e-mail não se edita: é com ele
                                que a pessoa entra, e trocá-lo no mesmo
                                formulário do resto é como se troca login por
                                engano. */}
                            <div className="flex items-start gap-3">
                                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                    pessoa.ativo ? "bg-[#303030] text-white" : "bg-[#E1E1E1] text-[#8A8A8A]"
                                }`}>
                                    {inicial(pessoa.nome)}
                                </span>

                                <div className="min-w-0 flex-1">
                                    <input
                                        value={nome}
                                        onChange={(e) => setNome(e.target.value)}
                                        aria-label="Nome"
                                        className="field w-full sm:max-w-sm"
                                    />

                                    <p className="mt-1 truncate text-sm text-[#616161]">{pessoa.email}</p>
                                </div>

                                <span className={pessoa.ativo ? "tag tag-success" : "tag tag-neutral"}>
                                    {pessoa.ativo ? "Ativo" : "Sem acesso"}
                                </span>
                            </div>

                            {campoDeCargo()}

                            {gerente ? (
                                <p className="rounded-lg bg-[#F1F1F1] px-4 py-3 text-sm text-[#616161]">
                                    Como gerente, abre o sistema inteiro desta loja — não há telas a
                                    marcar. Volte o cargo para funcionário se quiser escolher uma a uma.
                                </p>
                            ) : (
                                <div>
                                    <p className="rotulo">O que ele pode abrir</p>
                                    {listaDePermissoes()}
                                </div>
                            )}

                            <div className="flex justify-end border-t border-[#EBEBEB] pt-4">
                                <button
                                    type="button"
                                    onClick={handleSalvar}
                                    disabled={salvando}
                                    className="btn btn-primario"
                                >
                                    {salvando ? "Salvando..." : "Salvar"}
                                </button>
                            </div>

                            {/* ------------------------------------------------
                                SEGURANÇA — o que mexe na conta, e não no que
                                ela vê. Fica no fim e separado por uma linha
                                justamente porque é o que não se clica por
                                engano.
                                ------------------------------------------------ */}
                            <div className="border-t border-[#EBEBEB] pt-5">

                                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                                    Segurança
                                </p>

                                <div className="mt-3 flex flex-wrap gap-2">

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTrocandoSenha((v) => !v)
                                            setSenhaNova("")
                                        }}
                                        className="btn btn-neutro"
                                    >
                                        <FiKey className="w-4" aria-hidden />
                                        <span>Trocar senha</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleAtivo(pessoa, !pessoa.ativo)}
                                        className="btn btn-neutro"
                                    >
                                        <FiSlash className="w-4" aria-hidden />
                                        <span>{pessoa.ativo ? "Tirar o acesso" : "Devolver o acesso"}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleExcluir(pessoa)}
                                        className="btn btn-neutro text-[#8E1F0B]"
                                    >
                                        <FiTrash2 className="w-4" aria-hidden />
                                        <span>Excluir</span>
                                    </button>
                                </div>

                                <p className="mt-2 text-xs text-[#8A8A8A]">
                                    Tirar o acesso mantém a conta e o histórico do que ela fez —
                                    é o caminho de quem saiu da empresa. Excluir apaga a linha e
                                    leva junto a resposta de quem deu entrada em cada mercadoria.
                                </p>

                                {trocandoSenha && (
                                    <form onSubmit={handleSenha} className="mt-4 flex flex-wrap items-end gap-3">
                                        <div className="min-w-[14rem] flex-1">
                                            <label className="rotulo" htmlFor="senha-nova">Senha nova</label>

                                            <input
                                                id="senha-nova"
                                                type="password"
                                                value={senhaNova}
                                                onChange={(e) => setSenhaNova(e.target.value)}
                                                placeholder="Mínimo de 8 caracteres"
                                                className="field w-full"
                                                required
                                            />
                                        </div>

                                        <button type="submit" disabled={salvando} className="btn btn-primario">
                                            {salvando ? "Trocando..." : "Trocar senha"}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setTrocandoSenha(false)}
                                            className="btn btn-neutro"
                                        >
                                            Cancelar
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    )}
                </section>
            </div>

            <FluxoDoAtendimento />

        </Pagina>
    )
}
