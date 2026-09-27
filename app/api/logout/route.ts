import { cookies } from "next/headers"
import { COOKIE_DA_LOJA, cabecalhoDaLojaAberta, url } from "@/app/api/backend"
import { conta } from "@/app/api/rotas"


// POST /api/logout — encerra a sessão do lojista.
//
// Apagar o cookie daqui é a parte fácil, e sozinha ela não encerra nada: o
// token é um JWT, vale porque a assinatura confere, e o servidor não guarda os
// que emitiu. Quem tivesse uma cópia dele continuava entrando pelas horas
// seguintes, mesmo com o lojista vendo a tela de login.
//
// Por isso a saída passa pelo backend, que incrementa a versão do token da
// loja e derruba toda cópia que exista (ver internal/services/login/logout.go).
// O cookie some depois, dos dois jeitos — mas o resultado da revogação é
// reportado como veio, porque "saiu" e "achou que saiu" não são a mesma coisa.
//
// Reportado, e não transformado em erro: esta rota responde 200 com
// `revogado: false` quando o backend não confirmou. O 502 de antes prendia o
// lojista numa tela morta — o cookie já tinha sido apagado aqui, então o
// painel atrás do menu não conseguia mais carregar nada, e o botão "Sair"
// respondia com uma mensagem vermelha em vez de sair. Quem decide o que fazer
// com a informação é a tela (ver handleSair, no menu): ela sai do painel de
// qualquer jeito e avisa na tela de entrada que a revogação falhou.
export async function POST() {

    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    let revogado = false

    if (token) {
        try {
            const response = await fetch(url(conta.logout()), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(await cabecalhoDaLojaAberta()),
                    Accept: "application/json",
                },
                cache: "no-store",
            })

            // 401 conta como sucesso: o token já não vale (expirou, ou outra
            // aba saiu antes), que é exatamente o estado que se queria.
            revogado = response.ok || response.status === 401

        } catch {
            revogado = false
        }
    } else {
        // Sem token não há o que revogar — sair já é o estado atual.
        revogado = true
    }

    // O cookie sai mesmo quando a revogação falhou: deixá-lo seria manter
    // esta aba usando um token que o lojista pediu para matar.
    cookieStore.delete("token")

    // A loja aberta sai junto. Ela é a escolha DAQUELA sessão, e sobrando no
    // navegador ela acompanhava a próxima: quem entrasse em seguida com outra
    // conta mandava um X-Loja que não é dela. O backend recusa esse número
    // (ver lojaAberta, em lib/midlleware/auth) e abre a principal, então não
    // era brecha — mas era um cabeçalho mentiroso viajando em toda requisição.
    cookieStore.delete(COOKIE_DA_LOJA)

    return Response.json(
        {
            mensagem: "logout realizado com sucesso",

            // Falso quer dizer: a sessão acabou NESTE navegador, mas o
            // servidor não confirmou a revogação, e uma cópia do token pode
            // continuar valendo em outro lugar.
            revogado,
        },
        { headers: { "Cache-Control": "no-store" } }
    )
}
