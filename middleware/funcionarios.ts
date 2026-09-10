// A equipe da loja: quem entra no painel além do dono, e o que cada um pode
// abrir. Tudo passa pela rota interna /api/funcionarios, como o resto do
// painel — o token fica no cookie httpOnly e o navegador nunca o enxerga.

import { apiFetch } from "./client"
import type { Funcionario, PermissaoConcedivel } from "@/app/type/type"

interface RespostaEquipe {
    funcionarios: Funcionario[]

    /**
     * O catálogo de telas que se pode conceder, montado pelo servidor.
     *
     * Vem junto da equipe, e não de uma lista fixa aqui no painel, pelo mesmo
     * motivo do menu: quem sabe quais telas existem é o servidor. Uma tela
     * nova aparece sozinha na lista de permissões, e nunca se oferece uma
     * permissão para uma tela que não existe mais.
     */
    permissoes: PermissaoConcedivel[]
}

export async function consultarEquipe(): Promise<RespostaEquipe> {
    const dados = await apiFetch<RespostaEquipe>("/api/funcionarios")

    return {
        funcionarios: dados.funcionarios ?? [],
        permissoes: dados.permissoes ?? [],
    }
}

export async function criarFuncionario(dados: {
    nome: string
    email: string
    password: string
    recursos: string[]
}): Promise<Funcionario> {
    const resposta = await apiFetch<{ funcionario: Funcionario }>("/api/funcionarios", {
        method: "POST",
        body: dados,
    })

    return resposta.funcionario
}

export async function salvarFuncionario(
    id: number,
    dados: { nome: string; recursos: string[]; ativo: boolean },
): Promise<Funcionario> {
    const resposta = await apiFetch<{ funcionario: Funcionario }>(`/api/funcionarios/${id}`, {
        method: "PUT",
        body: dados,
    })

    return resposta.funcionario
}

export async function trocarSenhaDoFuncionario(id: number, password: string): Promise<void> {
    await apiFetch(`/api/funcionarios/${id}/senha`, {
        method: "PUT",
        body: { password },
    })
}

export async function excluirFuncionario(id: number): Promise<void> {
    await apiFetch(`/api/funcionarios/${id}`, { method: "DELETE" })
}
