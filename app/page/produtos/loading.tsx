import { Pagina } from "@/app/components/pagina/pagina"

/**
 * O esqueleto da grade de produtos.
 *
 * Ele já existia dentro da tela, como o ramo `if (loading)`. Mudou de lugar
 * junto com a busca dos dados: agora quem espera é o servidor, e o Next
 * mostra este arquivo sozinho enquanto a página não fica pronta — inclusive
 * durante a navegação vinda de outra tela do painel, que antes ficava parada
 * na tela anterior sem sinal nenhum de que alguma coisa estava acontecendo.
 *
 * A forma é a do que vem depois — faixa de resumo, filtros e linhas de
 * grade. Esqueleto com outra forma faz a tela pular quando os dados chegam,
 * que é pior do que não ter esqueleto.
 *
 * O título e a descrição não são mais barras cinzas: vêm do mesmo <Pagina>
 * que a tela pronta usa, e por isso já nascem escritos. Fingir o cabeçalho
 * era fingir a única parte da tela que não depende de dado nenhum.
 */
export default function Carregando() {
    return (
        <Pagina
            titulo="Produtos"
            descricao="Uma linha por peça física, com o código, o endereço em que ela está e o preço que a vitrine mostra."
        >

            <div className="card h-[4.5rem] animate-pulse" />

            <div className="flex gap-2">
                {[1, 2, 3, 4].map(item => (
                    <div key={item} className="h-9 w-28 animate-pulse rounded-lg bg-[#E1E1E1]" />
                ))}
            </div>

            <div className="card overflow-hidden">

                <div className="h-10 border-b border-[#E1E1E1] bg-[#F7F7F7]" />

                {[1, 2, 3, 4, 5, 6, 7, 8].map(item => (

                    <div
                        key={item}
                        className="flex items-center gap-3 border-b border-[#EBEBEB] px-4 py-2.5 last:border-b-0"
                    >

                        <div className="h-9 w-9 shrink-0 animate-pulse rounded-md bg-[#F1F1F1]" />

                        <div className="h-4 w-1/3 animate-pulse rounded bg-[#F1F1F1]" />

                        <div className="ml-auto h-4 w-20 animate-pulse rounded bg-[#F1F1F1]" />

                    </div>

                ))}

            </div>

        </Pagina>
    )
}
