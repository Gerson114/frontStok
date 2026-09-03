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
 */
export default function Carregando() {
    return (
        <main className="min-h-screen bg-[#F0F3F4] p-6 md:ml-64 md:p-10">

            <div className="mx-auto max-w-7xl">

                <div className="h-9 w-64 animate-pulse rounded-lg bg-[#D3DADD]" />

                <div className="mt-3 h-4 w-80 animate-pulse rounded bg-[#D3DADD]" />

                <div className="card mt-8 h-[4.5rem] animate-pulse" />

                <div className="mt-6 flex gap-2">

                    {[1, 2, 3, 4].map(item => (
                        <div key={item} className="h-9 w-28 animate-pulse rounded-lg bg-[#D3DADD]" />
                    ))}

                </div>

                <div className="card mt-6 overflow-hidden">

                    <div className="h-10 border-b border-[#D3DADD] bg-[#F7F9FA]" />

                    {[1, 2, 3, 4, 5, 6, 7, 8].map(item => (

                        <div
                            key={item}
                            className="flex items-center gap-3 border-b border-[#E4E9EB] px-4 py-2.5 last:border-b-0"
                        >

                            <div className="h-9 w-9 shrink-0 animate-pulse rounded-md bg-[#F0F3F4]" />

                            <div className="h-4 w-1/3 animate-pulse rounded bg-[#F0F3F4]" />

                            <div className="ml-auto h-4 w-20 animate-pulse rounded bg-[#F0F3F4]" />

                        </div>

                    ))}

                </div>

            </div>

        </main>
    )
}
