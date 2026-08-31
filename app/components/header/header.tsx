"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { logout } from "@/middleware/auth"
import { EVENTO_ASSINATURA_ALTERADA, consultarMenu } from "@/middleware/assinatura"
import type { ItemMenu } from "@/app/type/type"
import {
    FiArrowDown,
    FiBox,
    FiChevronDown,
    FiClipboard,
    FiRepeat,
    FiHome,
    FiList,
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
    FiUsers,
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
} from "react-icons/fi"
import type { IconType } from "react-icons"

// Ícone de cada tela, pela chave que o backend manda. Só isto fica aqui: o
// que existe no menu, em que seção e em que ordem é resposta do servidor
// (ver internal/services/assinatura/recursos.go), porque é lá que se sabe o
// plano da loja. Chave nova sem ícone cai no genérico e ainda aparece.
const ICONES: Record<string, IconType> = {
    produtos: FiBox,
    produto: FiPlus,
    estoque: FiPackage,
    "estoque-inserir": FiTruck,
    "estoque-consultar": FiSearch,
    "estoque-enderecos": FiMapPin,
    "estoque-config": FiPrinter,
    "estoque-fila": FiClipboard,
    "estoque-picking": FiList,
    "estoque-reposicao": FiArrowDown,
    "estoque-inventario": FiBarChart2,
    "estoque-ondas": FiRepeat,
    "estoque-devolucoes": FiCornerUpLeft,
    avarias: FiAlertTriangle,
    banners: FiImage,
    promocoes: FiPercent,
    conversas: FiMessageCircle,
    venda: FiShoppingBag,
    pedidos: FiShoppingCart,
    "pedidos-novo": FiFilePlus,
    etiquetas: FiTag,
    vendidos: FiCheck,
    cancelados: FiX,
    loja: FiGlobe,
    vitrine: FiEye,
    assinatura: FiCreditCard,
}

const emBreve: { nome: string; Icone: IconType }[] = [
    { nome: "Clientes", Icone: FiUsers },
    { nome: "Relatórios", Icone: FiBarChart2 },
]

// Enquanto o menu não chega — e se ele não chegar —, o lojista fica ao menos
// com a tela de assinatura: é dela que sai o pagamento que destrava o resto.
const MENU_MINIMO: ItemMenu[] = [
    { chave: "assinatura", nome: "Assinatura", rota: "/page/assinatura", secao: "Conta", liberado: true },
]

/** Uma tela do menu com o que abre debaixo dela. */
interface No {
    item: ItemMenu
    filhos: ItemMenu[]
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

    const noPainel = pathname.startsWith("/page/")

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

        // A troca de plano muda o menu na hora (ver a tela de assinatura).
        window.addEventListener(EVENTO_ASSINATURA_ALTERADA, buscar)

        return () => {
            cancelado = true
            window.removeEventListener(EVENTO_ASSINATURA_ALTERADA, buscar)
        }
    }, [noPainel])

    // A tela em que o lojista está é UMA, e só ela fica azul.
    //
    // Casar por prefixo, item a item, acendia duas de uma vez: "Estoque"
    // (/page/estoque) casa com /page/estoque/inserir junto com "Entrada de
    // mercadoria", e casa até com /page/estoque/enderecos — que é outro
    // acordeão, ao lado. O lojista via o azul num item enquanto estava em
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

    // O painel administrativo só faz sentido dentro de /page/*.
    // As páginas públicas (landing "/", login e cadastro) não exibem o menu.
    if (!noPainel) {
        return null
    }

    async function handleSair() {
        setSaindo(true)

        try {
            await logout()
        } finally {
            router.push("/login")
        }
    }

    function itemAtivo(href: string) {
        return href !== "" && href === rotaAtiva
    }

    // Um item do menu, seja de primeiro nível ou dentro de um acordeão.
    function linkDoItem(item: ItemMenu) {

        const Icone = ICONES[item.chave] ?? FiHome

        // Tela do plano da loja, mas suspensa por assinatura atrasada:
        // continua à vista, com cadeado, e leva para onde se resolve isso.
        if (!item.liberado) {
            return (
                <Link
                    href="/page/assinatura"
                    onClick={() => setAberto(false)}
                    title="Assinatura pendente — regularize para liberar esta tela"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#B8C0C4] transition-colors hover:bg-[#F0F3F4]"
                >
                    <Icone className="w-[1.05rem] shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{item.nome}</span>
                    <FiLock className="w-3.5 shrink-0" aria-hidden />
                </Link>
            )
        }

        return (
            <Link
                href={item.rota}
                onClick={() => setAberto(false)}
                aria-current={itemAtivo(item.rota) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                    itemAtivo(item.rota)
                        ? "bg-[#0086FF] text-white"
                        : "text-[#5A6469] hover:bg-[#F0F3F4] hover:text-[#1E2428]"
                }`}
            >
                <Icone className="w-[1.05rem] shrink-0" aria-hidden />
                <span className="truncate">{item.nome}</span>
            </Link>
        )
    }

    // Bloco azul da marca — o mesmo peso de cor que o Magalu usa no topo.
    const marca = (
        <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-base font-extrabold text-[#0086FF]">
                M
            </div>
            <div className="leading-tight">
                <p className="font-display text-[1.05rem] text-white">
                    Minha Loja
                </p>
                <p className="text-[0.7rem] text-white/75">
                    Painel administrativo
                </p>
            </div>
        </div>
    )

    const conteudoMenu = (
        <>
            <nav className="flex-1 overflow-y-auto p-3">
                {carregando && (
                    <p className="px-3 py-2 text-sm text-[#8C969B]">
                        Carregando menu...
                    </p>
                )}

                {montarSecoes(menu).map((secao) => (
                    <div key={secao.titulo} className="mb-5 space-y-0.5 last:mb-0">
                        <p className="mb-2 px-3 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#8C969B]">
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

                            const aberto = acordeoes[no.item.chave] ?? naArvore

                            return (
                                <div key={no.item.chave}>

                                    <div className="flex items-center gap-1">

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
                                                    [no.item.chave]: !aberto,
                                                }))
                                            }
                                            aria-expanded={aberto}
                                            aria-label={`${aberto ? "Fechar" : "Abrir"} ${no.item.nome}`}
                                            className="shrink-0 rounded-lg p-2 text-[#8C969B] transition-colors hover:bg-[#F0F3F4] hover:text-[#1E2428]"
                                        >
                                            <FiChevronDown
                                                className={`w-4 transition-transform ${aberto ? "" : "-rotate-90"}`}
                                                aria-hidden
                                            />
                                        </button>

                                    </div>

                                    {aberto && (
                                        <div className="ml-5 space-y-0.5 border-l border-[#E4E9EB] pl-2">
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

                <p className="mb-2 px-3 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#8C969B]">
                    Em breve
                </p>

                {emBreve.map((item) => (
                    <div
                        key={item.nome}
                        aria-disabled
                        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#B8C0C4]"
                    >
                        <item.Icone className="w-[1.05rem] shrink-0" aria-hidden />
                        <span>{item.nome}</span>
                    </div>
                ))}
            </nav>

            <div className="border-t border-[#E4E9EB] p-3">
                <div className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E6F3FF] text-xs font-extrabold text-[#0075E2]">
                        AD
                    </div>
                    <div className="min-w-0 text-xs">
                        <p className="truncate font-bold text-[#1E2428]">Administrador</p>
                        <p className="truncate text-[#8C969B]">Loja única</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleSair}
                    disabled={saindo}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#D4351C] transition-colors hover:bg-[#FDECEA] disabled:opacity-50"
                >
                    <FiLogOut className="w-[1.05rem] shrink-0" aria-hidden />
                    <span>{saindo ? "Saindo..." : "Sair"}</span>
                </button>
            </div>
        </>
    )

    return (
        <>
            {/* Sidebar - desktop */}
            <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-[#D3DADD] bg-white md:flex print:hidden">
                <div className="flex h-20 shrink-0 items-center bg-[#0086FF] px-5">
                    {marca}
                </div>

                {conteudoMenu}
            </aside>

            {/* Topbar - mobile */}
            <div className="sticky top-0 z-40 flex h-16 items-center justify-between bg-[#0086FF] px-4 md:hidden print:hidden">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-extrabold text-[#0086FF]">
                        M
                    </div>
                    <span className="font-display text-base text-white">Minha Loja</span>
                </div>

                <button
                    type="button"
                    onClick={() => setAberto((v) => !v)}
                    aria-label={aberto ? "Fechar menu" : "Abrir menu"}
                    aria-expanded={aberto}
                    className="rounded-lg p-2 text-white transition-colors hover:bg-white/15"
                >
                    {aberto ? <FiX className="w-5" aria-hidden /> : <FiMenu className="w-5" aria-hidden />}
                </button>
            </div>

            {aberto && (
                <div className="fixed inset-0 z-30 md:hidden print:hidden">
                    <div
                        className="absolute inset-0 bg-[#1E2428]/50"
                        onClick={() => setAberto(false)}
                    />

                    <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white shadow-xl">
                        <div className="flex h-16 shrink-0 items-center bg-[#0086FF] px-5">
                            {marca}
                        </div>

                        {conteudoMenu}
                    </aside>
                </div>
            )}
        </>
    )
}
