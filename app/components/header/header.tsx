"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { logout } from "@/middleware/auth"
import { Simbolo } from "@/app/components/marca/marca"
import { consultarMenu } from "@/middleware/assinatura"
import { consultarEquipeChat } from "@/middleware/equipe"
import { consultarNotificacoes } from "@/middleware/notificacoes"
import { consultarRede, trocarDeLoja } from "@/middleware/lojas"
import { escutarLoja } from "@/middleware/whatsapp"
import type { ItemMenu, LojaDaRede, Notificacoes } from "@/app/type/type"
import {
    FiArrowDown,
    FiBox,
    FiChevronDown,
    FiClipboard,
    FiRepeat,
    FiHome,
    FiPlus,
    FiMapPin,
    FiAlertTriangle,
    FiImage,
    FiSearch,
    FiShoppingBag,
    FiShoppingCart,
    FiTruck,
    FiTag,
    FiCheck,
    FiX,
    FiBarChart2,
    FiCornerUpLeft,
    FiCreditCard,
    FiEye,
    FiFilePlus,
    FiGlobe,
    FiLock,
    FiLogOut,
    FiMenu,
    FiMessageCircle,
    FiPackage,
    FiPrinter,
    FiDollarSign,
    FiUsers,
    FiCalendar,
    FiVideo,
    FiBell,
    FiArrowLeft,
    FiSmartphone,
    FiMessageSquare,
} from "react-icons/fi"
import type { IconType } from "react-icons"

// Ícone de cada tela, pela chave que o backend manda. Só isto fica aqui: o
// que existe no menu, em que seção e em que ordem é resposta do servidor
// (ver internal/services/assinatura/recursos.go), porque é lá que se sabe o
// plano da loja. Chave nova sem ícone cai no genérico e ainda aparece.
const ICONES: Record<string, IconType> = {
    inicio: FiHome,
    produtos: FiBox,
    produto: FiPlus,
    estoque: FiPackage,
    "estoque-inserir": FiTruck,
    "estoque-consultar": FiSearch,
    "estoque-enderecos": FiMapPin,
    "estoque-config": FiPrinter,
    "estoque-fila": FiClipboard,
    "estoque-reposicao": FiArrowDown,
    "estoque-inventario": FiBarChart2,
    "estoque-ondas": FiRepeat,
    "estoque-devolucoes": FiCornerUpLeft,
    avarias: FiAlertTriangle,
    banners: FiImage,
    conversas: FiMessageCircle,
    venda: FiShoppingBag,
    pedidos: FiShoppingCart,
    "pedidos-novo": FiFilePlus,
    etiquetas: FiTag,
    vendidos: FiCheck,
    loja: FiGlobe,
    vitrine: FiEye,
    assinatura: FiCreditCard,
    funcionarios: FiUsers,
    frete: FiTruck,
    entregas: FiCalendar,
    pagamento: FiDollarSign,
}

// Enquanto o menu não chega — e se ele não chegar —, o lojista fica ao menos
// com a tela de assinatura: é dela que sai o pagamento que destrava o resto.
const MENU_MINIMO: ItemMenu[] = [
    { chave: "assinatura", nome: "Assinatura", rota: "/page/assinatura", secao: "Conta", liberado: true },
]

/** Altura da barra superior. Em rem para casar com o `top-14` das telas. */
const ALTURA_TOPO = "3.5rem"

/** Uma tela do menu com o que abre debaixo dela. */
interface No {
    item: ItemMenu
    filhos: ItemMenu[]
}

/**
 * Texto pronto para comparação: minúsculo e sem acento.
 *
 * Quem procura a tela de endereços digita "enderecos" — o teclado do balcão
 * raramente tem alguém com paciência para o cedilha. Comparar sem acento faz
 * a busca achar o que a pessoa quis dizer, e não o que ela conseguiu digitar.
 */
/**
 * Uma linha do sino.
 *
 * Zero não desaparece: some o número, fica a linha em cinza. A lista precisa
 * ser sempre a mesma para o olho achar "WhatsApp" no mesmo lugar — uma lista
 * que muda de tamanho conforme o que chegou obriga a lê-la inteira toda vez.
 */
function Novidade({ href, Icone, rotulo, quantos, aoIr }: {
    href: string
    Icone: IconType
    rotulo: string
    quantos: number
    aoIr: () => void
}) {
    return (
        <Link
            href={href}
            role="menuitem"
            onClick={aoIr}
            className="flex items-center gap-2.5 border-b border-[#EBEBEB] px-3 py-2.5 text-[0.8125rem] transition-colors last:border-b-0 hover:bg-[#F7F7F7]"
        >
            <Icone className="w-4 shrink-0 text-[#8A8A8A]" aria-hidden />

            <span className={`flex-1 ${quantos > 0 ? "font-medium text-[#303030]" : "text-[#8A8A8A]"}`}>
                {rotulo}
            </span>

            {quantos > 0 && (
                <span className="num rounded-full bg-[#E51C00] px-1.5 py-0.5 text-[0.6875rem] font-bold text-white">
                    {quantos > 99 ? "99+" : quantos}
                </span>
            )}
        </Link>
    )
}

function comparavel(texto: string) {
    return texto
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
}

/**
 * Monta o menu como o servidor o descreveu: agrupado por seção, e dentro de
 * cada seção com as telas filhas penduradas na sua (`pai`).
 *
 * Filho cujo pai não veio na resposta — porque o plano da loja não inclui a
 * tela de cima — sobe para o primeiro nível em vez de sumir: melhor um item
 * solto do que uma tela paga que o lojista não encontra.
 */
function montarSecoes(itens: ItemMenu[]): { titulo: string; nos: No[] }[] {

    const nosPorChave = new Map<string, No>()

    for (const item of itens) {
        if (!item.pai) nosPorChave.set(item.chave, { item, filhos: [] })
    }

    const secoes: { titulo: string; nos: No[] }[] = []

    function secaoDe(titulo: string) {
        const achada = secoes.find((s) => s.titulo === titulo)

        if (achada) return achada

        const nova = { titulo, nos: [] as No[] }
        secoes.push(nova)
        return nova
    }

    for (const item of itens) {

        const pai = item.pai ? nosPorChave.get(item.pai) : undefined

        if (pai) {
            pai.filhos.push(item)
            continue
        }

        const no = nosPorChave.get(item.chave) ?? { item, filhos: [] }

        nosPorChave.set(item.chave, no)
        secaoDe(item.secao || "Painel").nos.push(no)
    }

    return secoes
}

export default function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const [aberto, setAberto] = useState(false)
    const [saindo, setSaindo] = useState(false)
    const [erroSaida, setErroSaida] = useState("")

    // O menu vem do backend já resolvido para o plano desta loja: quem está
    // no plano de estoque não recebe "Pedidos" nem "Banners", e por isso eles
    // não aparecem aqui. Lista fixa no front repetiria a regra de plano — e
    // ofereceria telas que a API recusaria abrir.
    const [menu, setMenu] = useState<ItemMenu[]>([])
    const [carregando, setCarregando] = useState(true)

    // Acordeões que o lojista abriu ou fechou na mão. O que ele não tocou
    // fica por conta da tela em que está: o grupo da página atual nasce
    // aberto, senão quem entra em Banners não vê onde está.
    const [acordeoes, setAcordeoes] = useState<Record<string, boolean>>({})

    // Busca de tela e menu da conta, os dois controles da barra superior.
    const [busca, setBusca] = useState("")
    const [buscaFocada, setBuscaFocada] = useState(false)
    const [contaAberta, setContaAberta] = useState(false)
    const campoBusca = useRef<HTMLInputElement>(null)

    const noPainel = pathname.startsWith("/page/")

    // Dentro da conversa da equipe o menu do painel sai de cena e a própria
    // tela desenha o menu dela — grupos, pessoas, chamadas. O motivo é que
    // ali a navegação é OUTRA: quem está conversando escolhe com quem falar,
    // não em qual tela do estoque entrar, e dois menus empilhados na mesma
    // borda esquerda fariam a pessoa procurar a conversa dentro da lista de
    // pedidos.
    //
    // Só o menu sai. A barra escura de cima fica, com a marca e o caminho de
    // volta: sem ela, a conversa viraria um beco de onde só se sai pelo botão
    // de voltar do navegador.
    const noChat = pathname.startsWith("/page/equipe")

    // Quantas mensagens a equipe deixou para esta pessoa, para a bolinha do
    // ícone lá em cima. Vem da mesma rota da tela de conversa, e é o servidor
    // que decide o que ela pode ver: quem o dono ainda não confirmou recebe
    // zero, porque não tem conversa nenhuma.
    const [naoLidas, setNaoLidas] = useState(0)

    // O que chegou e ninguém viu: pedido novo, WhatsApp e chat do site.
    const [novidades, setNovidades] = useState<Notificacoes>({
        pedidos: 0, whatsapp: 0, site: 0, equipe: 0, total: 0,
    })

    const [sinoAberto, setSinoAberto] = useState(false)

    // As lojas do dono, para o seletor. Vazio para funcionário — ele não deve
    // nem saber que existem outras lojas além daquela em que trabalha.
    const [minhasLojas, setMinhasLojas] = useState<LojaDaRede[]>([])
    const [lojasAberto, setLojasAberto] = useState(false)
    const [trocando, setTrocando] = useState(0)

    useEffect(() => {
        if (!noPainel) return

        let cancelado = false

        async function buscar() {
            try {
                const itens = await consultarMenu()

                if (!cancelado) setMenu(itens.length > 0 ? itens : MENU_MINIMO)
            } catch {
                // Sem resposta do servidor, o mínimo: a tela de assinatura.
                if (!cancelado) setMenu(MENU_MINIMO)
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        buscar()

        return () => {
            cancelado = true
        }
    }, [noPainel])

    // A tela em que o lojista está é UMA, e só ela fica acesa.
    //
    // Casar por prefixo, item a item, acendia duas de uma vez: "Estoque"
    // (/page/estoque) casa com /page/estoque/inserir junto com "Entrada de
    // mercadoria", e casa até com /page/estoque/enderecos — que é outro
    // acordeão, ao lado. O lojista via o realce num item enquanto estava em
    // outro.
    //
    // Vence a rota mais longa que casa com o endereço atual: entre
    // /page/estoque e /page/estoque/enderecos, ganha a segunda. Tela que não
    // está no menu (a etiqueta de um produto, por exemplo) continua
    // acendendo a tela de que ela saiu, que é o prefixo mais longo que
    // sobrou.
    const rotaAtiva = useMemo(() => {

        let melhor = ""

        for (const item of menu) {

            const casa = pathname === item.rota || pathname.startsWith(item.rota + "/")

            if (casa && item.rota.length > melhor.length) melhor = item.rota
        }

        return melhor

    }, [menu, pathname])

    // O que a busca do topo acha. Ela procura entre as telas que ESTE lojista
    // tem — é o mesmo menu, e por isso nunca oferece uma porta que a API
    // recusaria abrir. O nome da seção também entra na comparação: quem
    // digita "estoque" encontra as telas do grupo, não só a que se chama
    // assim.
    const achados = useMemo(() => {

        const alvo = comparavel(busca.trim())

        if (alvo.length === 0) return []

        return menu
            .filter((item) =>
                comparavel(item.nome).includes(alvo) ||
                comparavel(item.secao || "").includes(alvo),
            )
            .slice(0, 8)

    }, [busca, menu])

    // A bolinha das novidades.
    //
    // Recarrega ao trocar de tela e a cada aviso do canal ao vivo — o mesmo
    // socket que já traz mensagem de cliente e pedido novo, e que agora é um
    // por aba (ver escutarLoja). Sem isto, quem está conferindo uma remessa
    // não fica sabendo que entrou uma venda até abrir outra tela.
    useEffect(() => {

        if (!noPainel) return

        let cancelado = false

        async function contar() {
            const dados = await consultarNotificacoes()

            if (!cancelado) setNovidades(dados)
        }

        contar()

        // Uma rajada de avisos vira UMA chamada.
        //
        // Sem isto, dez mensagens chegando juntas num atendimento movimentado
        // viravam dez pedidos ao servidor para desenhar o mesmo número — e a
        // loja inteira sai por um IP só, então era assim que o painel batia no
        // limite de requisições justamente na hora de mais movimento.
        let agendado: ReturnType<typeof setTimeout> | null = null

        function contarDepois() {

            if (agendado) return

            agendado = setTimeout(() => {
                agendado = null
                contar()
            }, 900)
        }

        const fechar = escutarLoja((aviso) => {
            if (["pedido", "mensagem", "conversa", "atendimento", "equipe"].includes(aviso.tipo)) {
                contarDepois()
            }
        })

        return () => {
            cancelado = true

            if (agendado) clearTimeout(agendado)

            fechar()
        }
    }, [noPainel, pathname])

    // O seletor de lojas.
    //
    // Só carrega quando o menu traz "lojas" — que é a tela do dono. Para o
    // funcionário a lista nem é pedida: a rota recusaria de todo jeito, e uma
    // requisição que se sabe que vai levar 403 é ruído no log.
    //
    // Uma vez por sessão de painel, e não a cada tela: a lista de lojas de uma
    // conta muda uma vez por ano.
    useEffect(() => {

        if (!noPainel || !menu.some((item) => item.chave === "lojas" && item.liberado)) return

        let cancelado = false

        consultarRede()
            .then((rede) => {
                if (!cancelado) setMinhasLojas(rede.lojas.filter((uma) => uma.ativa))
            })
            .catch(() => {
                // Sem a lista o seletor some, e o painel continua na loja em
                // que já estava. É degradação aceitável; travar a barra
                // superior por causa dela não seria.
                if (!cancelado) setMinhasLojas([])
            })

        return () => {
            cancelado = true
        }
    }, [noPainel, menu])

    async function abrirOutraLoja(loja: LojaDaRede) {

        if (loja.aberta) {
            setLojasAberto(false)
            return
        }

        setTrocando(loja.id)

        try {
            await trocarDeLoja(loja.id)

            // Recarga DURA: metade do painel é montada no servidor, e uma
            // navegação do Next reaproveitaria o que já está em memória — as
            // telas continuariam mostrando a loja anterior.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign("/page/inicio")
        } catch {
            setTrocando(0)
            setLojasAberto(false)
        }
    }

    const lojaAberta = minhasLojas.find((uma) => uma.aberta)

    // Se esta loja tem a conversa da equipe, e se ESTA pessoa a recebeu.
    //
    // Sai do mesmo menu que o servidor já respondeu, e não de uma lista fixa
    // aqui: quem decide o que existe e o que este funcionário pode abrir é o
    // backend (ver internal/services/assinatura/recursos.go), e um ícone fixo
    // na barra ofereceria a quem não tem a permissão uma tela que a API
    // recusaria.
    const itemDoChat = menu.find((item) => item.chave === "equipe-chat" && item.liberado)
    const temChat = itemDoChat !== undefined

    // A bolinha do ícone de conversa. Recarrega ao mudar de tela e a cada
    // aviso do canal ao vivo da loja — é o mesmo socket que já traz pedido
    // novo e mensagem de cliente, e abrir um segundo só para isto dobraria as
    // conexões de cada aba aberta.
    //
    // Falha em silêncio: o ícone sem bolinha é aceitável, uma barra superior
    // que não desenha porque a contagem não veio não é.
    useEffect(() => {

        if (!noPainel || !temChat) return

        let cancelado = false

        async function contar() {
            try {
                const estado = await consultarEquipeChat()

                if (cancelado) return

                setNaoLidas(
                    (estado.salas ?? []).reduce((soma, sala) => soma + sala.nao_lidas, 0)
                )
            } catch {
                if (!cancelado) setNaoLidas(0)
            }
        }

        contar()

        const fechar = escutarLoja((aviso) => {
            if (aviso.tipo === "equipe") contar()
        })

        return () => {
            cancelado = true
            fechar()
        }
    }, [noPainel, temChat, pathname])

    // O painel administrativo só faz sentido dentro de /page/*.
    // As páginas públicas (landing "/", login e cadastro) não exibem o menu.
    if (!noPainel) {
        return null
    }

    async function handleSair() {
        setSaindo(true)
        setErroSaida("")

        try {
            await logout()
            router.push("/login")

        } catch (e) {
            // Não navega: o cookie desta aba já foi apagado, mas o servidor
            // não conseguiu invalidar o token, que continua valendo em
            // qualquer cópia que exista. Mostrar a tela de login aqui seria
            // dizer que saiu — justamente a única coisa que não aconteceu.
            setErroSaida(e instanceof Error ? e.message : "Não foi possível encerrar a sessão.")
            setSaindo(false)
        }
    }

    function itemAtivo(href: string) {
        return href !== "" && href === rotaAtiva
    }

    /** Para onde este item leva de fato — tela suspensa manda para a assinatura. */
    function destinoDe(item: ItemMenu) {
        return item.liberado ? item.rota : "/page/assinatura"
    }

    // Um item do menu, seja de primeiro nível ou dentro de um acordeão.
    //
    // O item aceso é uma pastilha BRANCA sobre o cinza da barra, e não um
    // bloco de cor: no cinza da moldura, o branco é a superfície de quem está
    // à frente. É assim que o painel do Shopify diz "você está aqui" sem
    // gastar a cor de marca — que fica reservada para o que é clicável dentro
    // da tela de trabalho.
    function linkDoItem(item: ItemMenu) {

        const Icone = ICONES[item.chave] ?? FiHome
        const ativo = itemAtivo(item.rota)

        // Tela do plano da loja, mas suspensa por assinatura atrasada:
        // continua à vista, com cadeado, e leva para onde se resolve isso.
        if (!item.liberado) {
            return (
                <Link
                    href="/page/assinatura"
                    onClick={() => setAberto(false)}
                    title="Assinatura pendente — regularize para liberar esta tela"
                    className="flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-medium text-[#B5B5B5] transition-colors hover:bg-black/5"
                >
                    <Icone className="w-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{item.nome}</span>
                    <FiLock className="w-3.5 shrink-0" aria-hidden />
                </Link>
            )
        }

        return (
            <Link
                href={item.rota}
                onClick={() => setAberto(false)}
                aria-current={ativo ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-[0.8125rem] transition-colors ${
                    ativo
                        ? "bg-white font-semibold text-[#303030] shadow-[0_1px_0_rgba(0,0,0,0.05),inset_0_0_0_1px_#E1E1E1]"
                        : "font-medium text-[#616161] hover:bg-black/5 hover:text-[#303030]"
                }`}
            >
                <Icone
                    className={`w-4 shrink-0 ${ativo ? "text-[#303030]" : "text-[#8A8A8A]"}`}
                    aria-hidden
                />
                <span className="truncate">{item.nome}</span>
            </Link>
        )
    }

    const conteudoMenu = (
        <nav className="flex-1 overflow-y-auto px-3 py-4">
            {carregando && (
                <p className="px-2.5 py-1.5 text-[0.8125rem] text-[#8A8A8A]">
                    Carregando menu...
                </p>
            )}

            {montarSecoes(menu).map((secao) => (
                <div key={secao.titulo} className="mb-5 space-y-0.5 last:mb-0">
                    <p className="mb-1.5 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                        {secao.titulo}
                    </p>

                    {secao.nos.map((no) => {

                        // Sem filhos é um link e pronto — o acordeão só
                        // existe onde há o que abrir.
                        if (no.filhos.length === 0) {
                            return <div key={no.item.chave}>{linkDoItem(no.item)}</div>
                        }

                        const naArvore =
                            itemAtivo(no.item.rota) ||
                            no.filhos.some((filho) => itemAtivo(filho.rota))

                        const grupoAberto = acordeoes[no.item.chave] ?? naArvore

                        return (
                            <div key={no.item.chave}>

                                <div className="flex items-center gap-0.5">

                                    <div className="min-w-0 flex-1">
                                        {linkDoItem(no.item)}
                                    </div>

                                    {/* A seta abre e fecha; o nome ao lado
                                        continua levando para a tela. Juntar
                                        as duas coisas no mesmo clique faria
                                        o lojista navegar sem querer toda vez
                                        que quisesse só espiar o que tem
                                        dentro. */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setAcordeoes((atual) => ({
                                                ...atual,
                                                [no.item.chave]: !grupoAberto,
                                            }))
                                        }
                                        aria-expanded={grupoAberto}
                                        aria-label={`${grupoAberto ? "Fechar" : "Abrir"} ${no.item.nome}`}
                                        className="shrink-0 rounded-md p-1.5 text-[#8A8A8A] transition-colors hover:bg-black/5 hover:text-[#303030]"
                                    >
                                        <FiChevronDown
                                            className={`w-3.5 transition-transform ${grupoAberto ? "" : "-rotate-90"}`}
                                            aria-hidden
                                        />
                                    </button>

                                </div>

                                {grupoAberto && (
                                    <div className="ml-[1.35rem] space-y-0.5 border-l border-[#E1E1E1] pl-2">
                                        {no.filhos.map((filho) => (
                                            <div key={filho.chave}>{linkDoItem(filho)}</div>
                                        ))}
                                    </div>
                                )}

                            </div>
                        )
                    })}
                </div>
            ))}

        </nav>
    )

    return (
        <>
            {/* ==============================================================
                BARRA SUPERIOR
                Escura e de largura inteira, como a do painel do Shopify. Ela
                tira a marca e a busca de dentro da área de trabalho: o cinza
                começa embaixo dela, e a tela do lojista fica só com o que é
                daquela tela.
                ============================================================== */}
            <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 bg-[#1A1A1A] px-3 print:hidden">

                {/* Marca. No desktop ela ocupa a largura da barra lateral, de
                    modo que o começo da busca cai exatamente onde começa o
                    conteúdo da tela. */}
                <div className="flex items-center gap-2 md:w-64 md:shrink-0 md:pl-2">
                    <button
                        type="button"
                        onClick={() => setAberto((v) => !v)}
                        aria-label={aberto ? "Fechar menu" : "Abrir menu"}
                        aria-expanded={aberto}
                        className="-ml-1 rounded-lg p-2 text-white transition-colors hover:bg-white/10 md:hidden"
                    >
                        {aberto ? <FiX className="w-5" aria-hidden /> : <FiMenu className="w-5" aria-hidden />}
                    </button>

                    <Link href="/page/produtos" className="flex items-center gap-2 text-white">
                        <Simbolo className="w-5 shrink-0" />
                        <span className="font-display text-[0.9375rem] tracking-normal">
                            Arara
                        </span>
                    </Link>
                </div>

                {/* Busca de tela. Não é enfeite: procura entre as telas que
                    este lojista tem e leva para a que ele escolher. Um campo
                    de busca que não busca nada é a primeira coisa que faz um
                    painel parecer maquete. */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault()

                        const primeiro = achados[0]

                        if (!primeiro) return

                        router.push(destinoDe(primeiro))
                        setBusca("")
                        campoBusca.current?.blur()
                    }}
                    className="relative mx-auto hidden w-full max-w-md sm:block"
                >
                    <FiSearch
                        className="pointer-events-none absolute left-3 top-1/2 w-4 -translate-y-1/2 text-[#B5B5B5]"
                        aria-hidden
                    />

                    <input
                        ref={campoBusca}
                        type="search"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        onFocus={() => setBuscaFocada(true)}
                        // O clique num resultado precisa acontecer antes do
                        // fechamento, senão a lista some debaixo do dedo.
                        onBlur={() => setTimeout(() => setBuscaFocada(false), 120)}
                        placeholder="Buscar tela do painel"
                        aria-label="Buscar tela do painel"
                        className="w-full rounded-lg border border-white/15 bg-white/10 py-1.5 pl-9 pr-3 text-[0.8125rem] text-white placeholder:text-[#B5B5B5] focus:border-white/40 focus:bg-white/15 focus:outline-none"
                    />

                    {buscaFocada && busca.trim().length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 overflow-hidden rounded-xl border border-[#E1E1E1] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]">

                            {achados.length === 0 && (
                                <p className="px-3 py-3 text-[0.8125rem] text-[#616161]">
                                    Nenhuma tela com esse nome.
                                </p>
                            )}

                            {achados.map((item) => {
                                const Icone = ICONES[item.chave] ?? FiHome

                                return (
                                    <Link
                                        key={item.chave}
                                        href={destinoDe(item)}
                                        onClick={() => setBusca("")}
                                        className="flex items-center gap-3 px-3 py-2 text-[0.8125rem] text-[#303030] transition-colors hover:bg-[#F7F7F7]"
                                    >
                                        <Icone className="w-4 shrink-0 text-[#8A8A8A]" aria-hidden />

                                        <span className="flex-1 truncate font-medium">
                                            {item.nome}
                                        </span>

                                        {item.liberado ? (
                                            <span className="shrink-0 text-[0.6875rem] uppercase tracking-[0.06em] text-[#8A8A8A]">
                                                {item.secao}
                                            </span>
                                        ) : (
                                            <FiLock className="w-3.5 shrink-0 text-[#B5B5B5]" aria-hidden />
                                        )}
                                    </Link>
                                )
                            })}

                        </div>
                    )}
                </form>

                    {/* O seletor de lojas.
                        
                        Só aparece com MAIS DE UMA: quem tem uma loja só não
                        tem escolha a fazer, e um seletor de um item é ruído no
                        lugar mais disputado da tela. */}
                    {minhasLojas.length > 1 && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setLojasAberto((v) => !v)}
                                aria-expanded={lojasAberto}
                                aria-haspopup="menu"
                                className="flex max-w-[11rem] items-center gap-1.5 rounded-lg px-2 py-1.5 text-white transition-colors hover:bg-white/10"
                            >
                                <FiHome className="w-4 shrink-0" aria-hidden />

                                <span className="hidden truncate text-[0.8125rem] font-medium sm:inline">
                                    {lojaAberta?.nome ?? "Loja"}
                                </span>

                                <FiChevronDown className="w-3.5 shrink-0 text-[#B5B5B5]" aria-hidden />
                            </button>

                            {lojasAberto && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setLojasAberto(false)} />

                                    <div
                                        role="menu"
                                        className="anim-surgir absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-[#E1E1E1] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                                    >
                                        <p className="border-b border-[#EBEBEB] px-3 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#8A8A8A]">
                                            Trocar de loja
                                        </p>

                                        {minhasLojas.map((uma) => (
                                            <button
                                                key={uma.id}
                                                type="button"
                                                role="menuitem"
                                                onClick={() => abrirOutraLoja(uma)}
                                                disabled={trocando !== 0}
                                                className={`flex w-full items-center gap-2.5 border-b border-[#EBEBEB] px-3 py-2.5 text-left text-[0.8125rem] transition-colors last:border-b-0 hover:bg-[#F7F7F7] ${
                                                    uma.aberta ? "font-semibold text-[#303030]" : "text-[#616161]"
                                                }`}
                                            >
                                                <FiHome className="w-4 shrink-0 text-[#8A8A8A]" aria-hidden />

                                                <span className="min-w-0 flex-1 truncate">{uma.nome}</span>

                                                {uma.aberta && <FiCheck className="w-4 shrink-0 text-[#005BD3]" aria-hidden />}
                                                {trocando === uma.id && (
                                                    <span className="text-xs text-[#8A8A8A]">abrindo…</span>
                                                )}
                                            </button>
                                        ))}

                                        <Link
                                            href="/page/lojas"
                                            role="menuitem"
                                            onClick={() => setLojasAberto(false)}
                                            className="flex items-center gap-2.5 border-t border-[#EBEBEB] bg-[#F7F7F7] px-3 py-2 text-[0.8125rem] font-medium text-[#005BD3] transition-colors hover:bg-[#EBEBEB]"
                                        >
                                            Gerenciar minhas lojas
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                {/* Conversa da equipe e chamada, à direita da busca.
                    Ficam na barra, e não só no menu, porque são o que se abre
                    NO MEIO de outra coisa: quem está conferindo uma remessa e
                    precisa perguntar algo ao colega não vai procurar a tela
                    numa lista — e a bolinha aqui é o único lugar onde uma
                    mensagem consegue chamar atenção de quem está noutra tela.

                    Só aparecem para quem tem a conversa liberada; quem decide
                    isso é o servidor, no menu. */}
                <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">

                    {/* Voltar ao painel. Só dentro da conversa, e na barra —
                        ali o menu lateral do painel saiu de cena, e sem uma
                        saída no cromo a conversa vira um beco de onde só se
                        sai pelo botão do navegador. */}
                    {noChat && (
                        <Link
                            href="/page/inicio"
                            aria-label="Voltar ao painel"
                            title="Voltar ao painel"
                            className="rounded-lg p-2 text-white transition-colors hover:bg-white/10"
                        >
                            <FiArrowLeft className="w-5" aria-hidden />
                        </Link>
                    )}

                    {/* O sino: pedido novo e mensagem de cliente. Separado do
                        ícone da conversa interna de propósito — um é o
                        negócio batendo à porta, o outro é o colega chamando, e
                        somá-los num número só faria "3" não dizer nada sobre o
                        que fazer em seguida. */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setSinoAberto((v) => !v)}
                            aria-expanded={sinoAberto}
                            aria-haspopup="menu"
                            aria-label={
                                novidades.total > 0
                                    ? `Novidades, ${novidades.total} esperando`
                                    : "Novidades"
                            }
                            className="relative rounded-lg p-2 text-white transition-colors hover:bg-white/10"
                        >
                            <FiBell className="w-5" aria-hidden />

                            {novidades.total > 0 && (
                                <span className="num absolute -right-0.5 -top-0.5 min-w-[1.05rem] rounded-full bg-[#E51C00] px-1 text-center text-[0.625rem] font-bold leading-[1.05rem] text-white">
                                    {novidades.total > 99 ? "99+" : novidades.total}
                                </span>
                            )}
                        </button>

                        {sinoAberto && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setSinoAberto(false)} />

                                <div
                                    role="menu"
                                    className="anim-surgir absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-[#E1E1E1] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                                >
                                    <p className="border-b border-[#EBEBEB] px-3 py-2.5 text-[0.8125rem] font-semibold text-[#303030]">
                                        {novidades.total > 0 ? "Esperando você" : "Nada esperando"}
                                    </p>

                                    {novidades.total === 0 ? (
                                        <p className="px-3 py-3 text-[0.8125rem] text-[#8A8A8A]">
                                            Nenhum pedido novo e nenhuma mensagem de cliente por ler.
                                        </p>
                                    ) : (
                                        <>
                                            <Novidade
                                                href="/page/pedidos"
                                                Icone={FiShoppingCart}
                                                rotulo="Pedidos novos"
                                                quantos={novidades.pedidos}
                                                aoIr={() => setSinoAberto(false)}
                                            />

                                            <Novidade
                                                href="/page/conversas"
                                                Icone={FiSmartphone}
                                                rotulo="WhatsApp"
                                                quantos={novidades.whatsapp}
                                                aoIr={() => setSinoAberto(false)}
                                            />

                                            <Novidade
                                                href="/page/atendimento"
                                                Icone={FiMessageSquare}
                                                rotulo="Chat do site"
                                                quantos={novidades.site}
                                                aoIr={() => setSinoAberto(false)}
                                            />
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                {temChat && (
                    <>

                        <Link
                            href="/page/equipe"
                            aria-label={
                                naoLidas > 0
                                    ? `Conversa da equipe, ${naoLidas} não lidas`
                                    : "Conversa da equipe"
                            }
                            aria-current={noChat ? "page" : undefined}
                            className={`relative rounded-lg p-2 text-white transition-colors hover:bg-white/10 ${
                                noChat ? "bg-white/15" : ""
                            }`}
                        >
                            <FiMessageCircle className="w-5" aria-hidden />

                            {naoLidas > 0 && (
                                <span className="num absolute -right-0.5 -top-0.5 min-w-[1.05rem] rounded-full bg-[#005BD3] px-1 text-center text-[0.625rem] font-bold leading-[1.05rem] text-white">
                                    {naoLidas > 99 ? "99+" : naoLidas}
                                </span>
                            )}
                        </Link>

                        {/* A chamada abre na conversa, e não aqui: para chamar
                            é preciso dizer QUEM, e quem é a lista de lá. Um
                            botão de chamada na barra que abrisse uma chamada
                            com ninguém seria um botão que não faz nada. */}
                        <Link
                            href="/page/equipe?chamada=1"
                            aria-label="Chamada de vídeo com a equipe"
                            className="rounded-lg p-2 text-white transition-colors hover:bg-white/10"
                        >
                            <FiVideo className="w-5" aria-hidden />
                        </Link>
                    </>
                )}
                </div>

                {/* Conta. É daqui que se sai do sistema — e só daqui, para não
                    haver duas portas para a mesma coisa. */}
                <div className="relative md:ml-0">
                    <button
                        type="button"
                        onClick={() => setContaAberta((v) => !v)}
                        aria-expanded={contaAberta}
                        aria-haspopup="menu"
                        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-white transition-colors hover:bg-white/10"
                    >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-[0.6875rem] font-semibold">
                            AD
                        </span>
                        <span className="hidden text-[0.8125rem] font-medium lg:inline">
                            Administrador
                        </span>
                        <FiChevronDown className="hidden w-3.5 text-[#B5B5B5] lg:inline" aria-hidden />
                    </button>

                    {contaAberta && (
                        <>
                            {/* Clique fora fecha. */}
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setContaAberta(false)}
                            />

                            <div
                                role="menu"
                                className="absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-xl border border-[#E1E1E1] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                            >
                                <div className="border-b border-[#EBEBEB] px-3 py-2.5">
                                    <p className="text-[0.8125rem] font-semibold text-[#303030]">
                                        Administrador
                                    </p>
                                    <p className="text-xs text-[#8A8A8A]">
                                        Loja única
                                    </p>
                                </div>

                                <Link
                                    href="/page/assinatura"
                                    role="menuitem"
                                    onClick={() => setContaAberta(false)}
                                    className="flex items-center gap-2.5 px-3 py-2 text-[0.8125rem] font-medium text-[#303030] transition-colors hover:bg-[#F7F7F7]"
                                >
                                    <FiCreditCard className="w-4 shrink-0 text-[#8A8A8A]" aria-hidden />
                                    Assinatura
                                </Link>

                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={handleSair}
                                    disabled={saindo}
                                    className="flex w-full items-center gap-2.5 border-t border-[#EBEBEB] px-3 py-2 text-left text-[0.8125rem] font-medium text-[#8E1F0B] transition-colors hover:bg-[#FEE9E8] disabled:opacity-50"
                                >
                                    <FiLogOut className="w-4 shrink-0" aria-hidden />
                                    {saindo ? "Saindo..." : "Sair"}
                                </button>

                                {erroSaida && (
                                    <p role="alert" className="border-t border-[#EBEBEB] px-3 py-2 text-xs font-medium text-[#8E1F0B]">
                                        {erroSaida}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>

            </header>

            {/* ==============================================================
                NAVEGAÇÃO — desktop
                Sobre o mesmo cinza da moldura, sem cor de fundo própria: o
                que se destaca ali é a pastilha branca da tela atual.
                ============================================================== */}
            {!noChat && (
                <aside
                    style={{ top: ALTURA_TOPO, height: `calc(100dvh - ${ALTURA_TOPO})` }}
                    className="fixed left-0 z-30 hidden w-64 flex-col border-r border-[#E1E1E1] bg-[#F1F1F1] md:flex print:hidden"
                >
                    {conteudoMenu}
                </aside>
            )}

            {/* ==============================================================
                NAVEGAÇÃO — celular
                ============================================================== */}
            {aberto && !noChat && (
                <div
                    style={{ top: ALTURA_TOPO }}
                    className="fixed inset-x-0 bottom-0 z-40 md:hidden print:hidden"
                >
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setAberto(false)}
                    />

                    <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-[#E1E1E1] bg-[#F1F1F1] shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
                        {conteudoMenu}
                    </aside>
                </div>
            )}
        </>
    )
}
