"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
    FiAlertCircle,
    FiCheckCircle,
    FiKey,
    FiPlus,
    FiTrash2,
    FiUserPlus,
    FiUsers,
    FiX,
} from "react-icons/fi"
import { Pagina, Secao, Estado } from "@/app/components/pagina/pagina"
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
 * A permissão é marcada tela a tela, no mesmo catálogo que monta o menu — por
 * isso a lista aqui aparece agrupada exatamente como o menu do lado esquerdo.
 * Marcar "Estoque" para alguém é dizer que aquele item vai existir no menu
 * dele; o que não for marcado não aparece bloqueado, simplesmente não está
 * lá, porque não é assunto dele.
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

export default function Funcionarios() {

    const [equipe, setEquipe] = useState<Funcionario[]>([])
    const [permissoes, setPermissoes] = useState<PermissaoConcedivel[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState("")
    const [aviso, setAviso] = useState("")

    // O formulário de cadastro abre acima da lista, a partir do botão do
    // cabeçalho — não é uma segunda tela.
    const [criando, setCriando] = useState(false)
    const [nome, setNome] = useState("")
    const [email, setEmail] = useState("")
    const [senha, setSenha] = useState("")
    const [marcadas, setMarcadas] = useState<string[]>([])
    const [salvando, setSalvando] = useState(false)

    // Quem está sendo editado na lista, e a seleção em andamento dele.
    const [editando, setEditando] = useState<number | null>(null)
    const [marcadasEdicao, setMarcadasEdicao] = useState<string[]>([])

    // A troca de senha é um pedido à parte, e por isso tem estado à parte.
    const [trocandoSenha, setTrocandoSenha] = useState<number | null>(null)
    const [senhaNova, setSenhaNova] = useState("")

    const secoes = useMemo(() => agrupar(permissoes), [permissoes])

    const carregar = useCallback(async () => {
        try {
            const dados = await consultarEquipe()
            setEquipe(dados.funcionarios)
            setPermissoes(dados.permissoes)
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

    function alternar(lista: string[], chave: string): string[] {
        return lista.includes(chave)
            ? lista.filter((c) => c !== chave)
            : [...lista, chave]
    }

    /** Marca ou desmarca uma seção inteira de uma vez. */
    function alternarSecao(lista: string[], chaves: string[]): string[] {
        const todasMarcadas = chaves.every((chave) => lista.includes(chave))

        return todasMarcadas
            ? lista.filter((chave) => !chaves.includes(chave))
            : [...new Set([...lista, ...chaves])]
    }

    function limparFormulario() {
        setCriando(false)
        setNome("")
        setEmail("")
        setSenha("")
        setMarcadas([])
    }

    async function handleCriar(evento: React.FormEvent) {
        evento.preventDefault()
        setSalvando(true)
        setErro("")
        setAviso("")

        try {
            await criarFuncionario({ nome, email, password: senha, recursos: marcadas })
            limparFormulario()
            setAviso("Funcionário criado. Ele já pode entrar com o e-mail e a senha que você definiu.")
            await carregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível criar o funcionário.")
        } finally {
            setSalvando(false)
        }
    }

    async function handleSalvar(funcionario: Funcionario) {
        setSalvando(true)
        setErro("")
        setAviso("")

        try {
            await salvarFuncionario(funcionario.id, {
                nome: funcionario.nome,
                recursos: marcadasEdicao,
                ativo: funcionario.ativo,
            })
            setEditando(null)
            setAviso(`Permissões de ${funcionario.nome} atualizadas. A sessão aberta dele caiu — na próxima vez que entrar, o menu já vem novo.`)
            await carregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível salvar as permissões.")
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

    async function handleSenha(funcionario: Funcionario, evento: React.FormEvent) {
        evento.preventDefault()
        setSalvando(true)
        setErro("")
        setAviso("")

        try {
            await trocarSenhaDoFuncionario(funcionario.id, senhaNova)
            setTrocandoSenha(null)
            setSenhaNova("")
            setAviso(`Senha de ${funcionario.nome} trocada. As sessões abertas com a antiga caíram.`)
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
            await carregar()
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível excluir.")
        }
    }

    /** A grade de caixas para marcar, compartilhada pelo cadastro e pela edição. */
    function listaDePermissoes(marcadasAgora: string[], aoMudar: (novas: string[]) => void) {
        return (
            <div className="space-y-5">
                {secoes.map(({ secao, grupos }) => {

                    const chavesDaSecao = grupos.flatMap((g) => [g.item.chave, ...g.filhos.map((f) => f.chave)])
                    const todas = chavesDaSecao.every((chave) => marcadasAgora.includes(chave))

                    return (
                        <div key={secao}>

                            <div className="mb-2 flex items-center justify-between gap-3 border-b border-[#EBEBEB] pb-1.5">
                                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                                    {secao}
                                </p>

                                <button
                                    type="button"
                                    onClick={() => aoMudar(alternarSecao(marcadasAgora, chavesDaSecao))}
                                    className="text-xs font-medium text-[#005BD3] hover:underline"
                                >
                                    {todas ? "Desmarcar seção" : "Marcar seção"}
                                </button>
                            </div>

                            <div className="space-y-1">
                                {grupos.map(({ item, filhos }) => (
                                    <div key={item.chave}>

                                        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] text-[#303030] transition-colors hover:bg-[#F7F7F7]">
                                            <input
                                                type="checkbox"
                                                checked={marcadasAgora.includes(item.chave)}
                                                onChange={() => aoMudar(alternar(marcadasAgora, item.chave))}
                                                className="h-4 w-4 shrink-0 accent-[#005BD3]"
                                            />
                                            <span className="font-medium">{item.nome}</span>
                                        </label>

                                        {filhos.length > 0 && (
                                            <div className="ml-4 border-l border-[#EBEBEB] pl-2">
                                                {filhos.map((filho) => (
                                                    <label
                                                        key={filho.chave}
                                                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] text-[#616161] transition-colors hover:bg-[#F7F7F7]"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={marcadasAgora.includes(filho.chave)}
                                                            onChange={() => aoMudar(alternar(marcadasAgora, filho.chave))}
                                                            className="h-4 w-4 shrink-0 accent-[#005BD3]"
                                                        />
                                                        {filho.nome}
                                                    </label>
                                                ))}
                                            </div>
                                        )}

                                    </div>
                                ))}
                            </div>

                        </div>
                    )
                })}
            </div>
        )
    }

    /** O nome das telas de alguém, para a linha da lista não mostrar chaves. */
    function nomesDas(chaves: string[]): string {
        const nomes = chaves
            .map((chave) => permissoes.find((p) => p.chave === chave)?.nome)
            .filter((nome): nome is string => Boolean(nome))

        return nomes.join(" · ")
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
            descricao="Cada pessoa da sua equipe entra com a própria senha e enxerga só as telas que você marcar. O menu dela é montado a partir desta lista."
            acoes={
                <button
                    type="button"
                    onClick={() => setCriando((v) => !v)}
                    className="btn btn-primario"
                >
                    <FiPlus className="w-4" aria-hidden />
                    <span>Novo funcionário</span>
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

            {criando && (
                <Secao
                    titulo="Novo funcionário"
                    descricao="Ele entra pelo mesmo endereço que você, com este e-mail e esta senha."
                    acoes={
                        <button type="button" onClick={limparFormulario} className="btn btn-neutro">
                            <FiX className="w-4" aria-hidden />
                            <span>Cancelar</span>
                        </button>
                    }
                >
                    <form onSubmit={handleCriar} className="space-y-5">

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

                        <div>
                            <p className="rotulo">O que ele pode abrir</p>
                            {listaDePermissoes(marcadas, setMarcadas)}
                        </div>

                        <div className="flex justify-end gap-2 border-t border-[#EBEBEB] pt-4">
                            <button type="submit" disabled={salvando} className="btn btn-primario">
                                <FiUserPlus className="w-4" aria-hidden />
                                <span>{salvando ? "Criando..." : "Criar funcionário"}</span>
                            </button>
                        </div>

                    </form>
                </Secao>
            )}

            {equipe.length === 0 ? (
                <Estado
                    Icone={FiUsers}
                    titulo="Você é a única pessoa com acesso"
                    texto="Enquanto a loja tiver uma conta só, todo mundo que precisar do painel usa a sua senha — e ninguém consegue dizer quem fez o quê. Crie uma conta para cada pessoa e marque só as telas de que ela precisa."
                    acao={
                        <button type="button" onClick={() => setCriando(true)} className="btn btn-primario">
                            <FiPlus className="w-4" aria-hidden />
                            <span>Novo funcionário</span>
                        </button>
                    }
                />
            ) : (
                <div className="space-y-4">
                    {equipe.map((funcionario) => (
                        <Secao
                            key={funcionario.id}
                            titulo={funcionario.nome}
                            descricao={
                                <>
                                    {funcionario.email}
                                    {funcionario.recursos.length > 0 && (
                                        <span className="block text-xs text-[#8A8A8A]">
                                            {nomesDas(funcionario.recursos)}
                                        </span>
                                    )}
                                    {funcionario.recursos.length === 0 && (
                                        <span className="block text-xs text-[#8A8A8A]">
                                            Nenhuma tela marcada — ele entra e não encontra nada.
                                        </span>
                                    )}
                                </>
                            }
                            acoes={
                                <>
                                    <span className={funcionario.ativo ? "tag tag-success" : "tag tag-neutral"}>
                                        {funcionario.ativo ? "Ativo" : "Sem acesso"}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditando(editando === funcionario.id ? null : funcionario.id)
                                            setMarcadasEdicao(funcionario.recursos)
                                            setTrocandoSenha(null)
                                        }}
                                        className="btn btn-neutro"
                                    >
                                        {editando === funcionario.id ? "Fechar" : "Permissões"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTrocandoSenha(trocandoSenha === funcionario.id ? null : funcionario.id)
                                            setSenhaNova("")
                                            setEditando(null)
                                        }}
                                        title="Definir uma senha nova"
                                        aria-label={`Trocar a senha de ${funcionario.nome}`}
                                        className="btn btn-neutro"
                                    >
                                        <FiKey className="w-4" aria-hidden />
                                    </button>
                                </>
                            }
                        >

                            {editando === funcionario.id ? (
                                <div className="space-y-5">

                                    {listaDePermissoes(marcadasEdicao, setMarcadasEdicao)}

                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EBEBEB] pt-4">

                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleAtivo(funcionario, !funcionario.ativo)}
                                                className="btn btn-neutro"
                                            >
                                                {funcionario.ativo ? "Tirar o acesso" : "Devolver o acesso"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleExcluir(funcionario)}
                                                className="btn btn-neutro text-[#8E1F0B]"
                                            >
                                                <FiTrash2 className="w-4" aria-hidden />
                                                <span>Excluir</span>
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleSalvar(funcionario)}
                                            disabled={salvando}
                                            className="btn btn-primario"
                                        >
                                            {salvando ? "Salvando..." : "Salvar permissões"}
                                        </button>

                                    </div>

                                </div>

                            ) : trocandoSenha === funcionario.id ? (

                                <form onSubmit={(e) => handleSenha(funcionario, e)} className="flex flex-wrap items-end gap-3">
                                    <div className="min-w-[16rem] flex-1">
                                        <label className="rotulo" htmlFor={`senha-${funcionario.id}`}>
                                            Nova senha
                                        </label>
                                        <input
                                            id={`senha-${funcionario.id}`}
                                            type="password"
                                            value={senhaNova}
                                            onChange={(e) => setSenhaNova(e.target.value)}
                                            placeholder="Mínimo de 8 caracteres"
                                            className="field"
                                            required
                                        />
                                    </div>

                                    <button type="submit" disabled={salvando} className="btn btn-primario">
                                        {salvando ? "Trocando..." : "Trocar senha"}
                                    </button>
                                </form>

                            ) : (

                                <p className="text-sm text-[#616161]">
                                    {funcionario.recursos.length === 0
                                        ? "Sem nenhuma tela marcada. Abra as permissões para escolher o que ele faz aqui."
                                        : `${funcionario.recursos.length} tela(s) liberada(s).`}
                                </p>

                            )}

                        </Secao>
                    ))}
                </div>
            )}

            {/* ==========================
                O ATENDIMENTO DA EQUIPE

                Abaixo da lista, e não noutra tela: quem decide quem entra na
                equipe e o que cada um abre é quem precisa ver como o
                atendimento anda circulando entre eles. Uma segunda tela de
                "relatório de equipe" seria uma segunda porta para a mesma
                pergunta — e a resposta viveria longe da decisão que ela
                informa.
            ========================== */}

            <FluxoDoAtendimento />

        </Pagina>
    )
}
