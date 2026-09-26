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
    FiChevronsLeft,
    FiChevronsRight,
    FiClipboard,
    FiGrid,
    FiLayers,
    FiRepeat,
    FiHome,
    FiPlus,
    FiMapPin,
    FiAlertTriangle,
    FiImage,
    FiSearch,
    FiSettings,
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
    FiPercent,
    FiPrinter,
    FiDollarSign,
    FiUsers,
    FiCalendar,
    FiBell,
    FiSmartphone,
    FiMessageSquare,
    FiSun,
    FiMoon,
} from "react-icons/fi"
import { useTravarRolagem } from "@/app/components/pagina/travarRolagem"
import { registrarPassada } from "@/app/components/pagina/voltar"
import { MARCA } from "@/app/marca"
import { tocarSom } from "@/app/somNotificacao"
import type { IconType } from "react-icons"

// Ícone de cada tela, pela chave que o backend manda. Só isto fica aqui: o
// que existe no menu, em que seção e em que ordem é resposta do servidor
// (ver internal/services/assinatura/recursos.go), porque é lá que se sabe o
// plano da loja. Chave nova sem ícone cai no genérico e ainda aparece.
const ICONES: Record<string, IconType> = {
    inicio: FiHome,
    "painel-produtos": FiBarChart2,
    "painel-equipe": FiUsers,
    "painel-entregas": FiTruck,
    config: FiSettings,
    produtos: FiBox,
    produto: FiPlus,
    adicionais: FiLayers,
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
    "equipe-chat": FiMessageSquare,
    etiquetas: FiTag,
    vendidos: FiCheck,
    loja: FiGlobe,
    vitrine: FiEye,
    assinatura: FiCreditCard,
    lojas: FiMapPin,
    funcionarios: FiUsers,
    comissoes: FiPercent,
    frete: FiTruck,
    entregas: FiCalendar,
    pagamento: FiDollarSign,
}

/* ==========================================================================
   As ÁREAS, cabeçalho de cada grupo do menu
   ==========================================================================

   Uma entrada por seção do menu, e as seções são as que o servidor manda
   (ver recursos.go): Painel, Vendas, Produtos e estoque, Meu site e Conta.
   Só o ícone mora aqui — o nome usado é o título que o próprio servidor
   manda (`secao.titulo`), sem abreviar: a lista tem largura de sobra para
   o nome inteiro, e uma versão curta ("Estoque" para "Produtos e estoque")
   colidia com o nome de uma tela de dentro do próprio grupo, que também se
   chama "Estoque" — o mesmo problema que fez o lojista não achar a tela
   certa. Seção nova sem entrada aqui aparece com o ícone genérico, e
   continua com o nome certo do mesmo jeito. */
const ICONE_DA_AREA: Record<string, IconType> = {
    painel: FiHome,
    vendas: FiShoppingCart,
    "produtos e estoque": FiPackage,

    // A loja de comida chama a mesma área de "Cardápio" (ver NoRamoDaLoja no
    // servidor). O cabeçalho do grupo e o primeiro item precisam dizer a
    // MESMA palavra — dois nomes para o mesmo lugar é o que fazia o padeiro
    // não achar o cardápio dele.
    cardapio: FiPackage,

    "meu site": FiGlobe,
    conta: FiUsers,
}

/* ==========================================================================
   O TRILHO: atalho fixo para o que se abre o dia inteiro
   ==========================================================================

   Ao lado do acordeão (ver `menuLateral`), sempre à vista — um clique, sem
   precisar abrir seção nenhuma. Não é o catálogo inteiro: Início e Pedidos
   são a rotina do dia; Conversas é onde se responde o cliente; Equipe e
   Funcionários são onde se fala com quem trabalha na loja e quem ela tem
   cadastrado; Lojas é para quem administra mais de um ponto de venda;
   Configurações é a cabeça da seção "Conta" para o resto (assinatura,
   comissões, regras da loja) — um atalho para ela ainda cobre "cadê a
   Conta" sem precisar listar a seção inteira aqui.

   Lojas e Funcionários entraram aqui por pedido direto do dono: as duas
   telas moravam só dentro de "Conta", atrás do clique em Configurações, e
   ele não as achava sem abrir a seção primeiro. Cadastro de gente e de
   ponto de venda é trabalho de todo dia para quem administra mais de uma
   loja — não é ajuste raro para deixar escondido.

   Uma tela só entra na faixa se o MENU desta loja a trouxer — sem isso um
   atalho fixo ofereceria uma tela que a API recusaria abrir para quem não a
   tem (ver como `trilhoParaMostrar` filtra, mais abaixo). Quem não é dono
   (ou a loja não tem plano Pro) continua vendo o ícone em cinza com
   cadeado, e não uma faixa manca com menos posições. */
const CHAVES_DO_TRILHO = ["inicio", "pedidos", "conversas", "equipe-chat", "funcionarios", "lojas", "config"]

// "Conversa da equipe" não cabe em duas linhas de 64px sem cortar de um
// jeito estranho — as outras telas do trilho têm nome curto o bastante
// para não precisar disto.
const ROTULO_CURTO_DO_TRILHO: Record<string, string> = {
    "equipe-chat": "Equipe",
}

// Enquanto o menu não chega — e se ele não chegar —, o lojista fica ao menos
// com a tela de assinatura: é dela que sai o pagamento que destrava o resto.
const MENU_MINIMO: ItemMenu[] = [
    { chave: "assinatura", nome: "Assinatura", rota: "/page/assinatura", secao: "Conta", liberado: true },
]

/** Altura da barra superior. Em rem para casar com o `top-14` das telas. */
const ALTURA_TOPO = "3.5rem"

/* Quanto da barra superior ainda está à vista, em pixels — 56 no alto da
   página, 0 depois de rolar a barra inteira.
 *
 * O menu lateral é a única coisa presa à tela: a barra rola junto com o
 * conteúdo. Sem esta medida, a coluna do menu ficaria ancorada em 3,5rem
 * para sempre e, assim que a barra saísse, sobraria uma faixa vazia acima
 * dela. Com ela, o menu sobe na mesma medida em que a barra sai e termina
 * ocupando a altura inteira da tela. */
const ALTURA_TOPO_PX = 56

/** O nome da variável que as colunas do menu leem para saber onde começar. */
const VAR_TOPO_VISIVEL = "--topo-visivel"

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
            className="flex items-center gap-2.5 border-b border-[var(--linha-suave)] px-3 py-2.5 text-[0.8125rem] transition-colors last:border-b-0 hover:bg-[var(--superficie-2)]"
        >
            <Icone className="w-4 shrink-0 text-[var(--ink-3)]" aria-hidden />

            <span className={`flex-1 ${quantos > 0 ? "font-medium text-[var(--ink)]" : "text-[var(--ink-3)]"}`}>
                {rotulo}
            </span>

            {quantos > 0 && (
                <span className="num rounded-full bg-[var(--vermelho-forte)] px-1.5 py-0.5 text-[0.6875rem] font-bold text-white">
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

    // Menu recolhido deixa só uma aba estreita para reabrir — e 15rem a
    // mais para a tabela.
    const [painelRecolhido, setPainelRecolhido] = useState(false)

    /* A área ABERTA na gaveta do celular — e só no celular.
     *
     * No desktop não há acordeão nenhum: a coluna segue a rota e mostra a
     * área ativa inteira (ver `conteudoDaColuna`). No celular não existe
     * trilho ao lado para trocar de área, então a gaveta precisa oferecer
     * todas elas — e as cinco áreas abertas de uma vez dão uma lista de
     * quase trinta linhas num vidro de 640px de altura: achar "Banners"
     * exigia rolar a gaveta inteira de cima a baixo. O acordeão devolve o
     * catálogo completo em cinco linhas de cabeçalho.
     *
     * Uma por vez, e não várias: abrir a segunda fecha a primeira, senão
     * duas áreas abertas já empurram a terceira para fora da tela e o
     * ganho de ter o catálogo em cinco linhas se perde.
     *
     * `null` significa "ainda não escolheram nada" — nesse caso vale a área
     * da rota atual (ver `areaAbertaNoCelular`), para a gaveta abrir já
     * mostrando onde a pessoa está. */
    const [areaTocada, setAreaTocada] = useState<string | null>(null)


    // Busca de tela e menu da conta, os dois controles da barra superior.
    const [busca, setBusca] = useState("")
    const [buscaFocada, setBuscaFocada] = useState(false)
    const [contaAberta, setContaAberta] = useState(false)
    const campoBusca = useRef<HTMLInputElement>(null)

    const noPainel = pathname.startsWith("/page/")

    // Menu do celular aberto segura a rolagem da página atrás dele.
    useTravarRolagem(aberto)

    /* Conta as trocas de tela desta aba, para o botão de voltar saber se há
     * para onde voltar dentro do sistema (ver components/pagina/voltar.tsx).
     * Mora aqui porque este componente é o único que o layout monta em toda
     * página — e porque ele já acompanha a rota por outros motivos. */
    const rotaAnterior = useRef(pathname)

    useEffect(() => {

        if (rotaAnterior.current === pathname) return

        rotaAnterior.current = pathname

        registrarPassada()

    }, [pathname])

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

    // Claro ou escuro. Sem estado do React de propósito: guardar "está
    // escuro?" num useState exigiria lê-lo do <html> depois de montar (o
    // script do <head> em layout.tsx já escreveu o atributo antes da
    // primeira pintura), e o primeiro render do React no cliente PRECISA
    // bater com o que o servidor mandou — ler o DOM ali dentro é a receita
    // do "hidratação não bate". O botão troca de ícone sozinho, só com CSS
    // (ver .icone-tema-* em globals.css), então não há estado nenhum para
    // desencontrar.
    function alternarTema() {

        const escuro = document.documentElement.getAttribute("data-theme") === "dark"

        if (escuro) {
            document.documentElement.removeAttribute("data-theme")
        } else {
            document.documentElement.setAttribute("data-theme", "dark")
        }

        // Falha em silêncio: sem guardar, o painel só volta a abrir no claro
        // da próxima vez — incômodo, não incorreto.
        try {
            localStorage.setItem("tema", escuro ? "claro" : "escuro")
        } catch { }
    }

    // O script do <head> (ver layout.tsx) só roda numa carga de página nova
    // — ele não vê a troca de rota do Next, que é só JavaScript trocando o
    // conteúdo. Sem este efeito, sair do painel para o login por um link
    // (sem recarregar a aba) deixaria o atributo escuro grudado numa tela
    // que não tem interruptor para tirá-lo. Some ao sair do painel, e volta
    // se a escolha guardada for escura ao entrar de novo.
    useEffect(() => {

        if (!noPainel) {
            document.documentElement.removeAttribute("data-theme")
            return
        }

        try {
            if (localStorage.getItem("tema") === "escuro") {
                document.documentElement.setAttribute("data-theme", "dark")
            }
        } catch { }

    }, [noPainel])

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
    // grupo, ao lado. O lojista via o realce num item enquanto estava em
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

    /* ==================================================================
       As áreas e qual delas está na tela
       ================================================================== */

    const secoes = useMemo(() => montarSecoes(menu), [menu])

    /* As telas do trilho, na ordem de CHAVES_DO_TRILHO — e só as que O MENU
     * DESTA LOJA já trouxe, liberadas ou trancadas (trancada ainda mostra
     * o ícone, em cinza com cadeado: é assim que se descobre que o Pro
     * existe). Sem o item no menu, o atalho simplesmente não nasce — nunca
     * oferece uma porta que a API recusaria abrir. */
    const trilhoParaMostrar = useMemo(() => {

        return CHAVES_DO_TRILHO.flatMap((chave) => {

            const item = menu.find((umItem) => umItem.chave === chave)

            return item ? [item] : []
        })

    }, [menu])

    /* Chaves que já têm um atalho fixo no trilho — a coluna ao lado não
       repete a linha delas. Repetir "Início" e "Pedidos" nos dois lugares
       era a queixa: a mesma tela contada duas vezes inflava a lista sem
       dar nenhuma porta nova. Um item com filhos (como Configurações, que
       abre Assinatura, Funcionários etc.) mantém os filhos na coluna —
       só o link repetido do pai é que some, porque o trilho já leva lá. */
    /* A coluna mostra só a ÁREA em que o lojista já está — ela segue a rota,
       nunca pede um clique a mais para escolher. Clicar em Início no
       trilho, ou em qualquer link de Vendas, já é o clique que decide: a
       coluna troca sozinha para a área certa. Sem cabeçalho para abrir,
       sem lista de outras áreas competindo por espaço — só o que pertence
       a onde a pessoa está agora. Área que a rota não identifica (recém
       aberto, antes do menu chegar) cai na primeira da lista. */
    const secaoAtiva = useMemo(() => {

        if (!rotaAtiva) return secoes[0]

        return secoes.find((secao) =>
            secao.nos.some(
                (no) => no.item.rota === rotaAtiva || no.filhos.some((filho) => filho.rota === rotaAtiva),
            ),
        ) ?? secoes[0]

    }, [secoes, rotaAtiva])

    /* Qual área a gaveta do celular mostra aberta: a que foi tocada, ou — se
     * ninguém tocou em nada — a da tela em que se está. */
    const areaAbertaNoCelular = areaTocada ?? secaoAtiva?.titulo ?? null

    /* Abrir a gaveta esquece a área tocada na vez anterior, para a abertura
     * voltar a seguir a rota. Sem isto, quem abriu "Meu site" numa tela de
     * Vendas encontraria "Meu site" aberto para sempre, inclusive depois de
     * trocar de tela. */
    function alternarGaveta() {
        if (!aberto) setAreaTocada(null)

        setAberto(!aberto)
    }

    /* Onde o menu começa, anunciado às colunas dele.
     *
     * A escrita é direta no evento, sem requestAnimationFrame no meio: o
     * navegador já entrega no máximo um evento de rolagem por quadro, e o
     * trabalho aqui é uma propriedade só. Com rAF havia um efeito colateral
     * de verdade — em aba escondida ele não roda, então a medida ficava
     * parada no último valor e a coluna voltava fora do lugar ao reaparecer.
     *
     * Fora do painel a variável não existe — quem a lê são as colunas, e
     * elas só existem dentro de /page/. */
    useEffect(() => {

        if (!noPainel) return

        function medir() {
            const sobrando = Math.max(0, ALTURA_TOPO_PX - window.scrollY)

            document.documentElement.style.setProperty(VAR_TOPO_VISIVEL, `${sobrando}px`)
        }

        medir()

        window.addEventListener("scroll", medir, { passive: true })
        window.addEventListener("resize", medir)

        return () => {
            window.removeEventListener("scroll", medir)
            window.removeEventListener("resize", medir)

            document.documentElement.style.removeProperty(VAR_TOPO_VISIVEL)
        }

    }, [noPainel])

    /* A largura que o menu ocupa, anunciada às telas.
     *
     * Elas leem --menu pela classe .com-menu (ver globals.css) em vez de cada
     * uma saber quanto mede o menu. Por isso o valor é escrito aqui, que é o
     * único lugar que sabe se o menu está aberto: sem isso, recolhê-lo
     * deixaria 15rem de papel vazio em toda tela do painel.
     *
     * O trilho (4.5rem) fica sempre, dentro e fora da conversa da equipe —
     * só o acordeão ao lado dele recolhe, e vira uma tira de 2.5rem para
     * reabrir. 19.5rem = trilho + acordeão; 7rem = trilho + tira. A
     * conversa não lê esta variável (o `ml-[19.5rem]` dela é escrito à
     * mão, ver page/equipe/page.tsx), então noChat não entra aqui. */
    useEffect(() => {

        if (!noPainel) return

        document.documentElement.style.setProperty("--menu", painelRecolhido ? "7rem" : "19.5rem")

        return () => {
            document.documentElement.style.removeProperty("--menu")
        }

    }, [painelRecolhido, noPainel])

    /* Quantas coisas esperam NESTA tela.
     *
     * O número é o mesmo do sino — ele não conta nada por conta própria, só
     * mostra ao lado do nome o que já estava contado lá em cima. Antes, para
     * descobrir que eram três no chat do site e não no WhatsApp, era preciso
     * abrir o sino e ler a lista; agora está escrito na porta de cada uma.
     *
     * Tela sem contagem devolve zero e não desenha nada: contador que mostra
     * "0" é ruído, e vinte deles numa lista de menu é uma lista ilegível. */
    function contagemDoItem(chave: string): number {

        switch (chave) {
            case "pedidos":
                return novidades.pedidos
            case "conversas":
                return novidades.whatsapp
            case "atendimento":
                return novidades.site
            case "equipe-chat":
                return naoLidas
            default:
                return 0
        }
    }

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
            if (aviso.tipo === "pedido") {
                contarDepois()
                tocarSom("pedido")
            } else if (["mensagem", "conversa", "atendimento", "equipe"].includes(aviso.tipo)) {
                contarDepois()
                tocarSom("mensagem")
            }
        })

        /* A rede de segurança: uma recontagem por minuto, aconteça o que
         * acontecer.
         *
         * O socket é quem faz o número aparecer na hora, e ele se reconecta
         * sozinho — menos num caso: endereço de socket mal configurado, em que
         * ele desiste de vez de propósito (ver escutarLoja) para não bater no
         * servidor a cada trinta segundos para sempre. Nesse caso o contador
         * congelava até alguém trocar de tela, e ninguém tinha como desconfiar:
         * um número parado parece um número certo.
         *
         * Um minuto é devagar de propósito. Não é por aqui que a venda nova
         * aparece — isso continua sendo o socket, em menos de um segundo. Isto
         * aqui é só o conserto de quem ficou sem ele.
         */
        const varredura = setInterval(contar, 60000)

        return () => {
            cancelado = true

            if (agendado) clearTimeout(agendado)

            clearInterval(varredura)

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
            // replace: depois de sair, o "voltar" do navegador não pode
            // devolver a tela do painel de quem acabou de sair dela.
            router.replace("/login")

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

    /**
     * Para onde este item leva de fato.
     *
     * Tela suspensa manda para onde se resolve o motivo — e o motivo decide
     * qual é esse lugar: pagamento e plano se resolvem na assinatura, mas o
     * layout se resolve trocando de loja, então o caminho é a tela das lojas.
     */
    function destinoDe(item: ItemMenu) {

        if (item.liberado) return item.rota

        return item.motivo === "so_matriz" ? "/page/lojas" : "/page/assinatura"
    }

    // Um item do menu, seja de primeiro nível ou filho de outra tela.
    /**
     * Uma tela do menu.
     *
     * O número que ela mostra é só o dela. Houve aqui um parâmetro `somar`,
     * que jogava no pai o que estava pendurado nos filhos escondidos: com o
     * acordeão fora, não há filho escondido, e somar de novo faria o olho
     * contar a mesma coisa duas vezes — uma no pai e outra na linha logo
     * abaixo.
     */
    // `ehFilho` distingue mãe de filha sem empurrar nada para o lado — a
    // hierarquia que o recuo dava antes agora é só peso de letra: a mãe (a
    // tela que abre uma seção) fica em negrito mesmo apagada, a filha fica
    // no peso normal e um tom mais claro de tinta. A ORDEM continua fazendo
    // o resto do trabalho (a filha vem logo depois da mãe); o peso só ajuda
    // o olho a separar "onde começa cada assunto" numa lista comprida sem
    // reintroduzir o fio de recuo que o lojista já pediu para tirar.
    function linkDoItem(item: ItemMenu, ehFilho = false) {

        const Icone = ICONES[item.chave] ?? FiHome
        const ativo = itemAtivo(item.rota)
        const esperando = contagemDoItem(item.chave)

        // Tela que não abre agora: continua à vista, em cinza e com cadeado, e
        // leva para onde se resolve isso — que é a mesma tela nos dois casos,
        // ainda que por motivos diferentes.
        //
        // Ficar à vista é deliberado no caso do Pro: é assim que o lojista
        // descobre que a conversa da equipe e as várias lojas existem. Um menu
        // que esconde o que ele não assinou vende o Pro só para quem já foi
        // procurar a tela de assinatura.
        if (!item.liberado) {
            return (
                <Link
                    href="/page/assinatura"
                    onClick={() => setAberto(false)}
                    title={
                        item.motivo === "plano_pro"
                            ? `${item.nome} faz parte do plano Pro — veja o que ele inclui`
                            : item.motivo === "so_matriz"
                                ? `${item.nome} é do dono, na loja principal: a cara do site é da rede e cada loja a herda`
                                : "Assinatura pendente — regularize para liberar esta tela"
                    }
                    className="flex items-center gap-2.5 py-2 pl-2.5 pr-3 text-[0.8125rem] font-medium text-[var(--ink-4)] transition-colors hover:bg-[var(--fundo)] focus-visible:bg-[var(--fundo)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--azul)]"
                >
                    <span className="flex w-1.5 shrink-0 items-center justify-center" aria-hidden />
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
                /* Como se marca "onde estou": o ponto cheio do C do logotipo,
                   e não um fio azul na borda ou uma pílula de fundo.

                   Passou por três formas antes desta: uma pílula de canto
                   arredondado (saiu porque a escala de raio do painel é zero,
                   e cápsula colorida em item de menu é a assinatura visual de
                   painel gerado por template), depois um fio azul na margem
                   esquerda com fundo azul fraco — que funcionava, mas era a
                   mesma gramática de "aceso = fio + tinta" que qualquer
                   painel usa. O ponto é a única coisa aqui que não veio de
                   nenhum outro sistema: é o miolo do símbolo da marca (ver
                   components/marca/marca.tsx) reaproveitado como sinalização,
                   e não decoração.

                   O espaço do ponto existe mesmo vazio no item inativo — é
                   por isso que o texto de todas as linhas começa na mesma
                   coluna e não pula quando a tela muda. */
                className={`flex items-center gap-2.5 py-2 pl-2.5 pr-3 text-[0.8125rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--azul)] ${
                    ativo
                        ? "font-semibold text-[var(--azul)]"
                        : ehFilho
                            ? "font-normal text-[var(--ink-2)] hover:bg-[var(--fundo)] hover:text-[var(--ink)] focus-visible:bg-[var(--fundo)]"
                            : "font-semibold text-[var(--ink)] hover:bg-[var(--fundo)] focus-visible:bg-[var(--fundo)]"
                }`}
            >
                <span className="flex w-1.5 shrink-0 items-center justify-center">
                    {ativo && <span className="marca-ponto text-[var(--azul)]" aria-hidden />}
                </span>

                <Icone
                    className={`w-4 shrink-0 ${ativo ? "text-[var(--azul)]" : "text-[var(--ink-2)]"}`}
                    aria-hidden
                />

                <span className="truncate">{item.nome}</span>

                {/* O número do que espera nesta tela. Encostado à direita, e
                    não colado no nome: assim os contadores de todas as linhas
                    ficam na mesma coluna e se leem de cima a baixo, em vez de
                    dançar conforme o tamanho de cada palavra. */}
                {esperando > 0 && (
                    <span
                        className="num ml-auto shrink-0 rounded-full bg-[var(--vermelho-forte)] px-1.5 text-[0.6875rem] font-bold leading-[1.05rem] text-white"
                        aria-label={`${esperando} esperando`}
                    >
                        {esperando > 99 ? "99+" : esperando}
                    </span>
                )}
            </Link>
        )
    }

    /* A lista de telas de UMA área, tudo na mesma coluna — mãe e filhas
       alinhadas, sem recuo. Serve o painel do desktop e a gaveta do celular.

       Havia um recuo aqui, com um fio à esquerda marcando até onde cada
       grupo ia — a peça que sobrou de um acordeão mais antigo. O lojista
       pediu para tirar também: numa coluna já estreita, uma tela recuada
       parecia torta, não subordinada. A ordem continua contando a mesma
       história (a filha vem logo depois da mãe), só que sem empurrar nada
       para o lado. */
    function listaDeNos(nos: No[]) {
        let ordem = 0
        return nos.flatMap((no) => [
            <div key={no.item.chave} className="anim-item" style={{ animationDelay: `${Math.min(ordem++, 6) * 25}ms` }}>
                {linkDoItem(no.item)}
            </div>,
            ...no.filhos.map((filho) => (
                <div key={filho.chave} className="anim-item" style={{ animationDelay: `${Math.min(ordem++, 6) * 25}ms` }}>
                    {linkDoItem(filho, true)}
                </div>
            )),
        ])
    }

    /* O retrato da lista antes dela existir: mesma largura de coluna do ícone
       e do texto de um item real, para a lista não pular de tamanho quando o
       servidor responde. Cada barra tem uma largura diferente — de propósito,
       nomes de tela não têm todos o mesmo tamanho — para não ler como grade. */
    function esqueletoDeTelas() {
        const larguras = ["72%", "56%", "64%", "44%"]

        return (
            <div aria-hidden>
                {larguras.map((largura, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-2 pl-2.5 pr-3">
                        <span className="w-1.5 shrink-0" />
                        <span className="esqueleto-menu w-4 shrink-0" style={{ animationDelay: `${i * 90}ms` }} />
                        <span className="esqueleto-menu" style={{ width: largura, animationDelay: `${i * 90}ms` }} />
                    </div>
                ))}
            </div>
        )
    }

    /* O conteúdo da coluna do DESKTOP: só os itens da área ativa (ver
       `secaoAtiva`, acima), mãe e filhas juntas. Ao lado dela o trilho
       continua de pé, e é ele que troca de área com um clique — por isso a
       coluna não precisa mostrar as outras.
       Ver `conteudoCompletoDoCelular`, logo abaixo, para o celular: lá não
       há trilho nenhum ao lado para trocar de área, então a gaveta precisa
       mostrar TODAS elas, ou o resto do menu vira uma tela que existe mas
       que ninguém no celular consegue abrir. */
    function conteudoDaColuna() {

        if (!secaoAtiva) return null

        return <div className="space-y-0.5">{listaDeNos(secaoAtiva.nos)}</div>
    }

    /* O conteúdo da gaveta do CELULAR: todas as áreas, uma debaixo da outra,
       e cada uma abre e fecha no toque do próprio título.

       O catálogo inteiro precisa estar aqui, e não só a área ativa: sem o
       trilho ao lado (ele é `hidden md:flex`), um celular que visse só a
       área da rota nunca teria como abrir "Produtos e estoque" ou "Meu
       site" a não ser tropeçando num link solto.

       O acordeão é a diferença em relação ao desktop, e existe só aqui: no
       desktop a coluna é alta e mostra UMA área, então não há nada a
       dobrar; no celular são as cinco áreas na mesma gaveta, quase trinta
       linhas numa tela que mostra dez — a pessoa rolava a gaveta inteira
       para achar uma tela. Fechadas, as cinco áreas cabem na primeira
       tela, e a da rota atual já vem aberta.

       Só uma aberta por vez (ver `areaTocada`): abrir a segunda fecha a
       primeira, senão duas áreas já derrubam o ganho. */
    function conteudoCompletoDoCelular() {

        return (
            <div className="space-y-1">
                {secoes.map((secao) => {

                    const IconeDaSecao = ICONE_DA_AREA[comparavel(secao.titulo)] ?? FiGrid
                    const abertaAqui = secao.titulo === areaAbertaNoCelular

                    // O identificador liga o cabeçalho à lista que ele abre,
                    // para o leitor de tela anunciar as duas como uma peça.
                    const idDaLista = `area-${comparavel(secao.titulo).replace(/[^a-z0-9]+/g, "-")}`

                    /* Quantas telas desta área têm algo esperando. Fechada, a
                       área ainda precisa dizer que tem trabalho dentro —
                       senão o acordeão esconderia justamente o pedido novo
                       que é o motivo de abrir o menu. */
                    const esperandoNaArea = secao.nos.reduce(
                        (total, no) =>
                            total
                            + contagemDoItem(no.item.chave)
                            + no.filhos.reduce((soma, filho) => soma + contagemDoItem(filho.chave), 0),
                        0,
                    )

                    return (
                        <div key={secao.titulo}>
                            <button
                                type="button"
                                onClick={() => setAreaTocada(abertaAqui ? "" : secao.titulo)}
                                aria-expanded={abertaAqui}
                                aria-controls={idDaLista}
                                /* min-h-11: o alvo do dedo. Um cabeçalho de
                                   duas linhas de texto dá 36px, abaixo do
                                   mínimo de 44px que o dedo acerta sem
                                   pegar a linha vizinha. */
                                className="flex min-h-11 w-full items-center gap-2 px-2 py-2 text-left transition-colors hover:bg-[var(--fundo)] focus-visible:bg-[var(--fundo)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--azul)]"
                            >
                                <IconeDaSecao className="w-4 shrink-0 text-[var(--azul)]" aria-hidden />

                                <span className="font-display flex-1 text-[0.8125rem] leading-snug text-[var(--ink)]">
                                    {secao.titulo}
                                </span>

                                {!abertaAqui && esperandoNaArea > 0 && (
                                    <span
                                        className="num shrink-0 rounded-full bg-[var(--vermelho-forte)] px-1.5 text-[0.6875rem] font-bold leading-[1.05rem] text-white"
                                        aria-label={`${esperandoNaArea} esperando nesta área`}
                                    >
                                        {esperandoNaArea > 99 ? "99+" : esperandoNaArea}
                                    </span>
                                )}

                                <FiChevronDown
                                    className={`w-4 shrink-0 text-[var(--ink-3)] transition-transform duration-150 ${abertaAqui ? "" : "-rotate-90"}`}
                                    aria-hidden
                                />
                            </button>

                            {abertaAqui && (
                                <div id={idDaLista} className="space-y-0.5 pb-1">
                                    {listaDeNos(secao.nos)}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    /* O trilho (ver CHAVES_DO_TRILHO, lá em cima): cinco ícones fixos,
       sempre à vista, nunca escondidos atrás de uma seção fechada do
       acordeão ao lado. Fica de pé mesmo dentro da conversa da equipe — só
       o acordeão dá lugar à lista dela ali (ver `noChat`, mais abaixo). */
    const trilho = (
        <nav className="trilho-rolagem flex flex-1 flex-col items-stretch gap-1 overflow-y-auto px-2 py-3">
            {trilhoParaMostrar.map((item) => {

                const Icone = ICONES[item.chave] ?? FiHome
                const esperando = contagemDoItem(item.chave)
                const aqui = itemAtivo(item.rota)

                return (
                    <Link
                        key={item.chave}
                        href={destinoDe(item)}
                        aria-label={
                            !item.liberado
                                ? `${item.nome} — faz parte do plano Pro`
                                : esperando > 0
                                    ? `${item.nome}, ${esperando} esperando`
                                    : item.nome
                        }
                        aria-current={aqui ? "page" : undefined}
                        className="group relative flex flex-col items-center gap-2 py-3.5 transition-colors hover:bg-[var(--topo-hover)] focus-visible:bg-[var(--topo-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                    >
                        {aqui && (
                            <span
                                className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-sm bg-white transition-[height] duration-150"
                                aria-hidden
                            />
                        )}

                        <span className="relative flex h-6 w-6 items-center justify-center">
                            <Icone className={`w-[1.3rem] ${aqui ? "text-white" : "text-[var(--topo-texto)]"}`} aria-hidden />

                            {!item.liberado ? (
                                <FiLock className="absolute -right-1.5 -top-1.5 w-3 rounded-full bg-[var(--topo)] p-px text-white" aria-hidden />
                            ) : esperando > 0 ? (
                                <span className="num absolute -right-1.5 -top-1.5 min-w-[0.9rem] rounded-full border border-[var(--topo)] bg-[var(--vermelho-forte)] px-0.5 text-center text-[0.5rem] font-bold leading-[0.85rem] text-white">
                                    {esperando > 99 ? "99+" : esperando}
                                </span>
                            ) : null}
                        </span>

                        <span className={`text-[0.6875rem] leading-tight tracking-[0.01em] ${aqui ? "font-bold text-white" : "font-medium text-[var(--topo-texto)]"}`}>
                            {ROTULO_CURTO_DO_TRILHO[item.chave] ?? item.nome}
                        </span>

                        {/* A dica com o nome inteiro, para quando o rótulo do trilho
                            veio abreviado (ver ROTULO_CURTO_DO_TRILHO) ou quando a tela
                            está trancada — o `title` nativo do navegador some 1s depois
                            de o dedo parar, essa não some enquanto o dedo estiver ali. */}
                        <span
                            role="tooltip"
                            className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-x-1 -translate-y-1/2 whitespace-nowrap bg-[var(--topo-2)] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.28)] transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                        >
                            {item.nome}
                            {!item.liberado && " — plano Pro"}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )

    /* ==================================================================
       O MENU — uma coluna só, ao lado do trilho, sempre na área ativa

       Foi um painel separado do trilho, mostrando só as telas da área
       clicada — a anatomia do Slack e do Teams. Na prática o lojista não
       estava achando a tela que procurava: precisava primeiro adivinhar em
       qual das cinco áreas ela morava, clicar num cabeçalho para abri-la, e
       só então ler a lista — dois passos, dois lugares, para uma linha só.
       Depois virou acordeão, depois virou lista única com tudo à vista de
       uma vez — e "tudo à vista" trouxe de volta a bagunça: cinco áreas
       empilhadas na mesma coluna estreita, a maioria irrelevante para onde
       o lojista estava.

       Esta versão não pede clique nenhum: a coluna segue a ROTA (ver
       `secaoAtiva`, acima). Entrar em Início mostra a área de Início;
       entrar em Vendas, a de Vendas — o mesmo clique que já leva à tela
       troca a coluna sozinho. O título no alto (ícone + nome da área) é só
       para confirmar onde se está, não um botão. */
    const IconeDaAreaAtiva = secaoAtiva ? (ICONE_DA_AREA[comparavel(secaoAtiva.titulo)] ?? FiGrid) : FiGrid

    /* O cabeçalho da coluna: ícone e nome da área, na mesma tinta do símbolo
       da marca (--azul, o quadrado da Marca em marca.tsx) — não um chip
       colorido dentro de uma caixa, que é o mesmo enfeite que qualquer
       painel gerado usa. O nome não trunca: "Produtos e estoque" é o nome
       mais comprido que existe, e cortá-lo era pior que deixá-lo quebrar em
       duas linhas — a coluna já é alta o bastante para sobrar espaço. */
    function cabecalhoDaColuna(botaoDeRecolher?: React.ReactNode) {
        return (
            <div className="flex min-h-[3.75rem] shrink-0 items-start gap-2.5 border-b border-[var(--linha)] px-4 py-3.5">
                <IconeDaAreaAtiva className="mt-0.5 w-[1.125rem] shrink-0 text-[var(--azul)]" aria-hidden />

                <p className="font-display flex-1 text-[0.9375rem] leading-snug text-[var(--ink)]">
                    {secaoAtiva?.titulo ?? "Menu"}
                </p>

                {botaoDeRecolher}
            </div>
        )
    }

    const menuLateral = (
        <>
            {cabecalhoDaColuna(
                <button
                    type="button"
                    onClick={() => setPainelRecolhido(true)}
                    aria-label="Recolher o menu"
                    title="Recolher o menu"
                    className="-mr-1.5 -mt-0.5 shrink-0 rounded-md p-1.5 text-[var(--ink-3)] transition-colors hover:bg-[var(--fundo)] hover:text-[var(--ink)] focus-visible:bg-[var(--fundo)] focus-visible:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--azul)]"
                >
                    <FiChevronsLeft className="w-3.5" aria-hidden />
                </button>,
            )}

            <nav className="menu-rolagem flex-1 overflow-y-auto px-2 py-3">
                {carregando ? esqueletoDeTelas() : conteudoDaColuna()}
            </nav>
        </>
    )

    /* O MENU DO CELULAR não é o mesmo molde do `menuLateral` de desktop — de
       propósito, e por dois motivos.

       O primeiro é o catálogo: no desktop o trilho ao lado troca de área com
       um clique, então a coluna só precisa da área ativa; no celular não há
       trilho nenhum (ele também é `hidden md:flex`), e um menu preso numa
       área só deixaria o resto do catálogo sem porta nenhuma. Por isso
       mostra TODAS as áreas, em acordeão (ver `conteudoCompletoDoCelular`).

       O segundo é o lugar na tela. Isto já foi uma gaveta `fixed` por cima
       do conteúdo, com fundo escurecido — e no celular ela cobria a tela
       inteira enquanto estivesse aberta. Agora o menu é um bloco no FLUXO
       da página, logo abaixo da barra: abrir empurra o conteúdo para baixo,
       fechar devolve o lugar, e a rolagem é uma só. Nada fica preso à tela,
       que é o que o celular pede — a tela é pequena demais para ceder uma
       faixa permanente a navegação. */
    const menuDoCelular = (
        /* Coluna PRESA À TELA, não um bloco no meio da página.
         *
         * Ela já foi as duas coisas. No fluxo, abrir o menu empurrava o
         * conteúdo para baixo e a lista de telas rolava junto com a página:
         * escolher uma tela da última área exigia rolar o menu inteiro e
         * perder de vista de onde se tinha saído. Presa, ela fica parada
         * enquanto o dedo percorre as áreas, e some inteira ao escolher.
         *
         * Começa onde a barra superior termina — e a barra ROLA (é a única
         * coisa que não fica presa neste painel, por pedido do dono), então
         * a medida é a variável `--topo-visivel`: 3,5rem no alto da página,
         * 0 depois que a barra sai. A mesma que as colunas do desktop leem.
         *
         * `[&_a]:min-h-11`: no dedo cada link precisa dos 44px de alvo que o
         * mouse não exige. Vale só aqui, e não no `linkDoItem` em si, porque
         * no desktop a mesma altura esticaria a coluna inteira sem motivo. */
        <div
            style={{ top: `var(${VAR_TOPO_VISIVEL}, ${ALTURA_TOPO})` }}
            className="fixed inset-x-0 bottom-0 z-40 md:hidden print:hidden"
        >
            {/* O fundo escurecido é o que diz que o resto da tela está
                esperando — e fechá-lo é tocar nele, que é o gesto que a
                pessoa já tenta antes de procurar o X. */}
            <div
                className="anim-surgir absolute inset-0 bg-black/40"
                onClick={() => setAberto(false)}
            />

            <nav
                id="menu-do-celular"
                className="anim-gaveta menu-rolagem absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col overflow-y-auto border-r border-[var(--linha)] bg-[var(--superficie)] px-3 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.12)] [&_a]:min-h-11"
            >
                {carregando ? esqueletoDeTelas() : conteudoCompletoDoCelular()}
            </nav>
        </div>
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
            {/* No celular a barra aperta o respiro: com px-3 e gap-2 em todos
                os lados, os sete controles dela (gaveta, marca, seletor de
                loja, tema, sino, conta) somavam mais de 360px e o último era
                empurrado para fora da tela. */}
            <header className="z-50 flex h-14 shrink-0 items-center gap-1 border-b border-[var(--linha)] bg-[var(--superficie)] px-2 print:hidden sm:gap-2 sm:px-3">

                {/* Marca. No desktop ela ocupa a largura da barra lateral, de
                    modo que o começo da busca cai exatamente onde começa o
                    conteúdo da tela. */}
                <div className="flex min-w-0 items-center gap-2 md:w-[var(--menu)] md:shrink-0 md:pl-2">
                    {/* Some dentro da conversa da equipe: a gaveta que este
                        botão abriria é justamente a que `noChat` desliga (a
                        tela tem a própria, com as salas — ver equipe/page.tsx),
                        e um botão que troca de ícone sem abrir nada é pior do
                        que nenhum botão. */}
                    {!noChat && (
                        <button
                            type="button"
                            onClick={alternarGaveta}
                            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
                            aria-expanded={aberto}
                            aria-controls="menu-do-celular"
                            className="-ml-1 p-2 text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)] md:hidden"
                        >
                            {aberto ? <FiX className="w-5" aria-hidden /> : <FiMenu className="w-5" aria-hidden />}
                        </button>
                    )}

                    <Link href="/page/produtos" className="flex min-w-0 items-center gap-2 text-[var(--ink)]">
                        <Simbolo className="w-5 shrink-0" />

                        {/* O nome trunca em vez de empurrar: numa tela estreita
                            é melhor ler "Chonnos…" ao lado do símbolo — que já
                            identifica a marca — do que perder o botão da conta
                            na borda. */}
                        <span className="font-display truncate text-[0.9375rem] tracking-normal">
                            {MARCA}
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
                        className="pointer-events-none absolute left-4 top-1/2 w-4 -translate-y-1/2 text-[var(--ink-2)]"
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
                        className="w-full border border-transparent bg-[var(--fundo)] py-2 pl-11 pr-4 text-[0.8125rem] text-[var(--ink)] placeholder:text-[var(--ink-2)] focus:border-[var(--azul)] focus:bg-[var(--superficie)] focus:outline-none"
                    />

                    {buscaFocada && busca.trim().length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 overflow-hidden border border-[var(--linha)] bg-[var(--superficie)] shadow-[0_4px_12px_rgba(0,0,0,0.12)]">

                            {achados.length === 0 && (
                                <p className="px-3 py-3 text-[0.8125rem] text-[var(--ink-2)]">
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
                                        className="flex items-center gap-3 px-3 py-2 text-[0.8125rem] text-[var(--ink)] transition-colors hover:bg-[var(--superficie-2)]"
                                    >
                                        <Icone className="w-4 shrink-0 text-[var(--ink-3)]" aria-hidden />

                                        <span className="flex-1 truncate font-medium">
                                            {item.nome}
                                        </span>

                                        {item.liberado ? (
                                            <span className="shrink-0 text-[0.6875rem] text-[var(--ink-3)]">
                                                {item.secao}
                                            </span>
                                        ) : (
                                            <FiLock className="w-3.5 shrink-0 text-[var(--ink-4)]" aria-hidden />
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
                                className="flex max-w-[11rem] items-center gap-1.5 px-3 py-1.5 text-[0.8125rem] text-[var(--ink)] transition-colors hover:bg-[var(--fundo)]"
                            >
                                <FiHome className="w-4 shrink-0" aria-hidden />

                                <span className="hidden truncate text-[0.8125rem] font-medium sm:inline">
                                    {lojaAberta?.nome ?? "Loja"}
                                </span>

                                <FiChevronDown className="w-3.5 shrink-0 text-[var(--ink-4)]" aria-hidden />
                            </button>

                            {lojasAberto && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setLojasAberto(false)} />

                                    <div
                                        role="menu"
                                        className="anim-surgir absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden border border-[var(--linha)] bg-[var(--superficie)] shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                                    >
                                        <p className="border-b border-[var(--linha-suave)] px-3 py-2.5 text-[0.6875rem] font-semibold text-[var(--ink-3)]">
                                            Trocar de loja
                                        </p>

                                        {minhasLojas.map((uma) => (
                                            <button
                                                key={uma.id}
                                                type="button"
                                                role="menuitem"
                                                onClick={() => abrirOutraLoja(uma)}
                                                disabled={trocando !== 0}
                                                className={`flex w-full items-center gap-2.5 border-b border-[var(--linha-suave)] px-3 py-2.5 text-left text-[0.8125rem] transition-colors last:border-b-0 hover:bg-[var(--superficie-2)] ${
                                                    uma.aberta ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-2)]"
                                                }`}
                                            >
                                                <FiHome className="w-4 shrink-0 text-[var(--ink-3)]" aria-hidden />

                                                <span className="min-w-0 flex-1 truncate">{uma.nome}</span>

                                                {uma.aberta && <FiCheck className="w-4 shrink-0 text-[var(--azul)]" aria-hidden />}
                                                {trocando === uma.id && (
                                                    <span className="text-xs text-[var(--ink-3)]">abrindo…</span>
                                                )}
                                            </button>
                                        ))}

                                        <Link
                                            href="/page/lojas"
                                            role="menuitem"
                                            onClick={() => setLojasAberto(false)}
                                            className="flex items-center gap-2.5 border-t border-[var(--linha-suave)] bg-[var(--superficie-2)] px-3 py-2 text-[0.8125rem] font-medium text-[var(--azul)] transition-colors hover:bg-[var(--linha-suave)]"
                                        >
                                            Gerenciar minhas lojas
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">

                    {/* Claro/escuro. Um ícone só, do que ACONTECE ao clicar
                        (a lua aparece no claro — clicar escurece — e o sol
                        aparece no escuro — clicar clareia), não do estado
                        atual: é o padrão que o resto de botão de tema usa. */}
                    <button
                        type="button"
                        onClick={alternarTema}
                        aria-label="Alternar entre tema claro e escuro"
                        title="Alternar tema"
                        className="p-2 text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)] hover:text-[var(--ink)]"
                    >
                        <FiMoon className="icone-tema-claro w-5" aria-hidden />
                        <FiSun className="icone-tema-escuro w-5" aria-hidden />
                    </button>

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
                            className="relative p-2 text-[var(--ink-2)] transition-colors hover:bg-[var(--fundo)] hover:text-[var(--ink)]"
                        >
                            <FiBell className="w-5" aria-hidden />

                            {novidades.total > 0 && (
                                <span className="num absolute -right-0.5 -top-0.5 min-w-[1.05rem] rounded-full bg-[var(--vermelho-forte)] px-1 text-center text-[0.625rem] font-bold leading-[1.05rem] text-white">
                                    {novidades.total > 99 ? "99+" : novidades.total}
                                </span>
                            )}
                        </button>

                        {sinoAberto && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setSinoAberto(false)} />

                                <div
                                    role="menu"
                                    className="anim-surgir absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden border border-[var(--linha)] bg-[var(--superficie)] shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                                >
                                    <p className="border-b border-[var(--linha-suave)] px-3 py-2.5 text-[0.8125rem] font-semibold text-[var(--ink)]">
                                        {novidades.total > 0 ? "Esperando você" : "Nada esperando"}
                                    </p>

                                    {novidades.total === 0 ? (
                                        <p className="px-3 py-3 text-[0.8125rem] text-[var(--ink-3)]">
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

                </div>

                {/* Conta. É daqui que se sai do sistema — e só daqui, para não
                    haver duas portas para a mesma coisa. */}
                <div className="relative md:ml-0">
                    <button
                        type="button"
                        onClick={() => setContaAberta((v) => !v)}
                        aria-expanded={contaAberta}
                        aria-haspopup="menu"
                        className="flex items-center gap-2 py-1 pl-1 pr-2 text-[var(--ink)] transition-colors hover:bg-[var(--fundo)]"
                    >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--azul)] text-[0.6875rem] font-semibold text-white">
                            AD
                        </span>
                        <span className="hidden text-[0.8125rem] font-medium lg:inline">
                            Administrador
                        </span>
                        <FiChevronDown className="hidden w-3.5 text-[var(--ink-2)] lg:inline" aria-hidden />
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
                                className="absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden border border-[var(--linha)] bg-[var(--superficie)] shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                            >
                                <div className="border-b border-[var(--linha-suave)] px-3 py-2.5">
                                    <p className="text-[0.8125rem] font-semibold text-[var(--ink)]">
                                        Administrador
                                    </p>
                                    <p className="text-xs text-[var(--ink-3)]">
                                        Loja única
                                    </p>
                                </div>

                                <Link
                                    href="/page/assinatura"
                                    role="menuitem"
                                    onClick={() => setContaAberta(false)}
                                    className="flex items-center gap-2.5 px-3 py-2 text-[0.8125rem] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--superficie-2)]"
                                >
                                    <FiCreditCard className="w-4 shrink-0 text-[var(--ink-3)]" aria-hidden />
                                    Assinatura
                                </Link>

                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={handleSair}
                                    disabled={saindo}
                                    className="flex w-full items-center gap-2.5 border-t border-[var(--linha-suave)] px-3 py-2 text-left text-[0.8125rem] font-medium text-[var(--vermelho)] transition-colors hover:bg-[var(--vermelho-fundo)] disabled:opacity-50"
                                >
                                    <FiLogOut className="w-4 shrink-0" aria-hidden />
                                    {saindo ? "Saindo..." : "Sair"}
                                </button>

                                {erroSaida && (
                                    <p role="alert" className="border-t border-[var(--linha-suave)] px-3 py-2 text-xs font-medium text-[var(--vermelho)]">
                                        {erroSaida}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>

            </header>

            {/* ==============================================================
                NAVEGAÇÃO — desktop: trilho de atalhos + acordeão

                O trilho (ver `trilho`, acima) é permanente e fica de PÉ
                mesmo dentro da conversa da equipe — só o acordeão ao lado
                dá lugar à lista dela ali (ver `noChat`). */}
            <aside
                style={{
                    top: `var(${VAR_TOPO_VISIVEL}, ${ALTURA_TOPO})`,
                    height: `calc(100dvh - var(${VAR_TOPO_VISIVEL}, ${ALTURA_TOPO}))`,
                    // Um degradê quase imperceptível, de cima para baixo —
                    // não é enfeite, é o que faz o fundo chapado parecer
                    // material e não papel de parede. Sutil de propósito.
                    backgroundImage: "linear-gradient(180deg, var(--topo-hover) 0%, var(--topo) 22%, var(--topo-2) 100%)",
                }}
                className="fixed left-0 z-30 hidden w-[4.5rem] flex-col border-r border-[var(--topo-linha)] md:flex print:hidden"
            >
                {trilho}
            </aside>

            {!noChat && !painelRecolhido && (
                <aside
                    style={{
                        top: `var(${VAR_TOPO_VISIVEL}, ${ALTURA_TOPO})`,
                        height: `calc(100dvh - var(${VAR_TOPO_VISIVEL}, ${ALTURA_TOPO}))`,
                    }}
                    className="anim-surgir fixed left-[4.5rem] z-30 hidden w-[var(--painel-menu)] flex-col border-r border-[var(--linha)] bg-[var(--superficie)] md:flex print:hidden"
                >
                    {menuLateral}
                </aside>
            )}

            {/* A aba de reabrir, quando o acordeão está recolhido — só o
                bastante para lembrar que existe e para reabrir com um
                clique. Fica encostada no trilho, nunca sozinha na borda. */}
            {!noChat && painelRecolhido && (
                <button
                    type="button"
                    onClick={() => setPainelRecolhido(false)}
                    aria-label="Abrir o menu"
                    title="Abrir o menu"
                    style={{
                        top: `var(${VAR_TOPO_VISIVEL}, ${ALTURA_TOPO})`,
                        height: `calc(100dvh - var(${VAR_TOPO_VISIVEL}, ${ALTURA_TOPO}))`,
                    }}
                    className="anim-surgir fixed left-[4.5rem] z-30 hidden w-10 flex-col items-center justify-center border-r border-[var(--linha)] bg-[var(--superficie)] text-[var(--ink-3)] transition-colors hover:bg-[var(--fundo)] hover:text-[var(--ink)] focus-visible:bg-[var(--fundo)] focus-visible:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--azul)] md:flex print:hidden"
                >
                    <FiChevronsRight className="w-3.5 shrink-0" aria-hidden />
                </button>
            )}

            {/* ==============================================================
                NAVEGAÇÃO — celular
                ============================================================== */}
            {aberto && !noChat && menuDoCelular}
        </>
    )
}
