"use client"

import { useEffect, useRef } from "react"

import { escutarLoja } from "./whatsapp"

/**
 * Recarrega a tela quando o assunto dela mexe no servidor, sem F5.
 *
 * É o mesmo fio das conversas (ver middleware/whatsapp.escutarLoja): UM
 * socket por aba, da loja inteira, por onde passam todos os assuntos. Quem os
 * separa é o campo `tipo` do aviso, e é isso que este hook faz — escuta o fio,
 * descarta o que não for dos tipos pedidos e chama `recarregar` no que for.
 *
 * Sem o filtro, a lista de estoque recarregaria a cada mensagem de WhatsApp
 * que chegasse na loja.
 *
 * O aviso NÃO traz conteúdo, só o assunto. Quem busca os dados continua sendo
 * a rota REST de sempre, que é onde a permissão de quem está olhando é
 * conferida — o fio é da loja e chega a todas as abas dela, inclusive às de um
 * funcionário que não pode ver aquela tela.
 *
 * @param tipos     Os assuntos que interessam a esta tela. Os que o servidor
 *                  publica estão em internal/services/whatsapp/vigia.go:
 *                  "pedido", "cliente", "estoque", "separacao", "devolucao",
 *                  "comissao" e "funcionario" — mais os de conversa, que têm
 *                  hook próprio nas telas de atendimento.
 * @param recarregar O que fazer quando chega. Costuma ser a mesma função que
 *                  o primeiro carregamento da tela usa.
 */
export function useAoVivo(tipos: string[], recarregar: () => void) {

    /*
     * As duas referências existem pelo mesmo motivo: nem a lista de tipos nem
     * a função de recarregar são estáveis entre renders. A lista é um literal
     * escrito na chamada e a função quase sempre é recriada junto com o
     * estado que ela lê. Postas nas dependências do efeito, cada render
     * desinscreveria e reinscreveria o ouvinte — e, como o fio se desliga
     * cinco segundos depois do último ouvinte sair, uma tela que renderize
     * bastante ficaria derrubando e reabrindo o socket.
     *
     * Guardadas em ref, o efeito roda UMA vez e sempre enxerga a versão mais
     * nova das duas.
     */
    const ultimaFuncao = useRef(recarregar)
    const ultimosTipos = useRef(tipos)

    // A atualização fica num efeito, e não solta no corpo do componente:
    // escrever em ref durante o render é o que o React proíbe (o render pode
    // ser descartado ou refeito, e a escrita teria acontecido mesmo assim).
    // Sem lista de dependências de propósito — este efeito roda depois de
    // TODO render, que é justamente quando as duas podem ter mudado.
    useEffect(() => {
        ultimaFuncao.current = recarregar
        ultimosTipos.current = tipos
    })

    useEffect(() => {

        const fechar = escutarLoja((aviso) => {

            if (!ultimosTipos.current.includes(aviso.tipo)) return

            ultimaFuncao.current()
        })

        return fechar
    }, [])
}
