import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Minha Loja | Moda, calçados e acessórios",
    description: "Vitrine da Minha Loja: roupas, calçados e acessórios com o estoque atualizado da loja física.",
}

export default function LojaLayout({ children }: LayoutProps<"/loja">) {
    return children
}
