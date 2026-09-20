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

    /**
     * Quem está olhando pode promover alguém a gerente da filial?
     *
     * Só o dono pode, e é o servidor que responde — a tela esconde o campo de
     * cargo em vez de mostrá-lo e ver a gravação recusada.
     */
    pode_promover: boolean

    /**
     * O nome da loja ABERTA no painel — a unidade em que a conta vai nascer.
     *
     * Vem porque o cadastro usa a loja do token: numa rede, quem esquecer de
     * trocar de unidade cadastra o gerente da filial dentro da matriz e só
     * descobre quando a pessoa entra na loja errada.
     */
    loja: string
}

export async function consultarEquipe(): Promise<RespostaEquipe> {
    const dados = await apiFetch<RespostaEquipe>("/api/funcionarios")

    return {
        funcionarios: dados.funcionarios ?? [],
        permissoes: dados.permissoes ?? [],
        pode_promover: dados.pode_promover ?? false,
        loja: dados.loja ?? "",
    }
}

export async function criarFuncionario(dados: {
    nome: string
    email: string
    password: string
    recursos: string[]
    gerente?: boolean
    comissao_percentual?: number
}): Promise<Funcionario & { convite_enviado: boolean }> {
    const resposta = await apiFetch<{ funcionario: Funcionario; convite_enviado?: boolean }>(
        "/api/funcionarios",
        { method: "POST", body: dados },
    )

    // `convite_enviado` diz se a pessoa recebeu por e-mail o código para criar
    // a PRÓPRIA senha. Interessa à tela porque muda o que o dono precisa fazer
    // em seguida: com o convite no ar, ele não precisa (nem deve) passar a
    // senha provisória adiante; sem ele, precisa combinar a senha de algum
    // jeito com a pessoa.
    return { ...resposta.funcionario, convite_enviado: resposta.convite_enviado === true }
}

export async function salvarFuncionario(
    id: number,
    dados: {
        nome: string
        recursos: string[]
        ativo: boolean
        gerente?: boolean

        // Só o dono manda este campo, e só o dono é obedecido: pedido de
        // gerente o backend ignora em silêncio.
        comissao_percentual?: number
    },
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
