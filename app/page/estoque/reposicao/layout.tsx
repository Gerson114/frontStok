import type { ReactNode } from "react"
import { tituloDaAba } from "@/app/marca"

/**
 * O nome desta tela na aba do navegador.
 *
 * Mora num layout, e não na própria tela, porque a tela é Client Component —
 * e `metadata` só existe em componente de servidor. Um layout que só devolve
 * o que recebe é o jeito do Next de pendurar metadata numa rota dessas: o
 * título sai pronto no HTML, sem efeito no cliente e sem piscar.
 *
 * Sem isto, as 47 telas do painel dividiam o mesmo "Painel administrativo":
 * com seis abas abertas, nenhuma dizia qual era, e o histórico do navegador
 * virava uma lista de linhas iguais.
 */
export const metadata = {
    title: tituloDaAba("Reposição"),
}

export default function Layout({ children }: { children: ReactNode }) {
    return children
}
