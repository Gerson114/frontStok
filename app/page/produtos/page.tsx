import Link from "next/link"
import { FiPlus } from "react-icons/fi"
import { unstable_rethrow } from "next/navigation"
import { consultarMenu, listarProdutos, listarTodasUnidades } from "@/app/api/servidor"
import Grade from "./grade"
import { Pagina } from "@/app/components/pagina/pagina"

/**
 * A lista de produtos, montada no servidor.
 *
 * Esta tela era Client Component inteira: abria vazia, desenhava um
 * esqueleto e só então pedia produtos e unidades ao navegador — duas
 * chamadas que saíam do browser, passavam por `app/api/*` e só aí chegavam
 * ao backend. Quem confere estoque num tablet, em rede de loja, via o
 * esqueleto antes de qualquer número, toda vez.
 *
 * Agora a busca acontece aqui, ao lado do backend, e o lojista recebe a
 * grade já preenchida no primeiro quadro. O que é interação de verdade —
 * buscar, filtrar, ordenar, abrir a ficha, gravar promoção — continua no
 * cliente, em `grade.tsx`, que é onde tem de estar.
 *
 * As três chamadas vão juntas porque não dependem uma da outra: em série
 * seriam três esperas somadas para a mesma tela.
 */
export const metadata = {
    title: "Produtos | Arara",
}

export default async function ProdutosPage() {

    const [produtos, unidades, menu] = await Promise.all([
        listarProdutos(),
        listarTodasUnidades(),
        // O menu diz se a loja tem site. Falhar aqui não pode derrubar a
        // tela: sem essa resposta a grade só deixa de oferecer os botões de
        // vitrine, e o resto — preço, promoção, etiqueta, endereço —
        // continua inteiro.
        //
        // O `unstable_rethrow` é o que impede este catch de engolir o que
        // não é falha: `redirect()` funciona LANÇANDO um erro interno do
        // Next, então um catch largo aqui prendia o desvio para o login e a
        // tela ficava tentando desenhar sem sessão. Ele deixa passar o que é
        // do framework e trata só o que é erro de verdade.
        consultarMenu().catch((erro) => {
            unstable_rethrow(erro)
            return []
        }),
    ])

    const temSite = menu.some((item) => item.chave === "loja")

    return (
        <Pagina
            titulo="Produtos"
            descricao="Uma linha por peça física, com o código, o endereço em que ela está e o preço que a vitrine mostra."
            acoes={
                <Link href="/page/produto" className="btn btn-primario">
                    <FiPlus className="w-4" aria-hidden />
                    <span>Novo produto</span>
                </Link>
            }
        >
            <Grade produtos={produtos} unidades={unidades} temSite={temSite} />
        </Pagina>
    )
}
