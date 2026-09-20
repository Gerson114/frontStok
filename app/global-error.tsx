"use client"

import { tituloDaAba } from "@/app/marca"

/**
 * O anteparo de último recurso: erro no próprio layout raiz, antes de
 * qualquer tela existir.
 *
 * Só aparece quando `app/error.tsx` não pode aparecer — o boundary de lá
 * fica DENTRO do layout, então uma falha no layout passa por cima dele.
 * Na prática é raro; quando acontece, é o que separa uma mensagem do painel
 * de uma página em branco.
 *
 * Traz `<html>` e `<body>` porque substitui o layout raiz inteiro, e por
 * isso mesmo não recebe o globals.css nem as fontes do painel: as cores
 * abaixo estão escritas à mão de propósito, com a mesma paleta, e a fonte
 * cai na do sistema. É a única tela do projeto onde estilo solto é o
 * caminho certo.
 */
export default function GlobalError({
    error,
    retry,
}: {
    error: Error & { digest?: string }
    retry: () => void
}) {
    return (
        <html lang="pt-BR">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1.5rem",
                    background: "var(--fundo)",
                    color: "var(--ink)",
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                }}
            >
                <title>{tituloDaAba("Erro")}</title>

                <div
                    style={{
                        width: "100%",
                        maxWidth: "32rem",
                        background: "#FFFFFF",
                        border: "1px solid var(--linha)",
                        borderRadius: "0.5rem",
                        padding: "2.5rem",
                        textAlign: "center",
                    }}
                >
                    <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>
                        O painel não conseguiu abrir
                    </h1>

                    <p style={{ margin: "0.75rem 0 0", color: "var(--ink-2)", lineHeight: 1.5 }}>
                        Foi uma falha nossa, e não alguma coisa que você fez. Seus dados
                        estão salvos.
                    </p>

                    <button
                        type="button"
                        onClick={() => retry()}
                        style={{
                            marginTop: "1.5rem",
                            padding: "0.7rem 1.1rem",
                            borderRadius: "0.5rem",
                            border: "none",
                            background: "var(--azul)",
                            color: "#FFFFFF",
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        Tentar de novo
                    </button>

                    {error.digest && (
                        <p style={{ margin: "1.5rem 0 0", fontSize: "0.75rem", color: "var(--ink-3)" }}>
                            Código do erro: <strong>{error.digest}</strong>
                        </p>
                    )}
                </div>
            </body>
        </html>
    )
}
