"use client"

import { useEffect, useRef } from "react"

import { escutarLoja, fioAberto } from "./whatsapp"

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

/* ==========================================================================
   A varredura de segurança
   ========================================================================== */

/**
 * Com o fio de pé, a mensagem chega empurrada em menos de um segundo. Voltar
 * a perguntar antes de meio minuto é gastar requisição para receber de volta
 * exatamente o que a tela já tem.
 */
const COM_O_FIO_DE_PE = 30_000

/**
 * Com o fio caído, esta consulta é a ÚNICA entrega que sobra, e o intervalo
 * dela vira o tempo de resposta do produto inteiro: a pessoa do outro lado
 * escreve e espera.
 *
 * Cinco segundos é o meio-termo. É rápido o bastante para uma conversa não
 * parecer travada, e devagar o bastante para não virar uma enxurrada no
 * servidor justamente quando alguma coisa já está errada com ele — que é uma
 * das razões possíveis de o fio ter caído.
 */
const COM_O_FIO_CAIDO = 5_000

/**
 * Chama `recarregar` de tempos em tempos, no ritmo que o estado do fio pedir.
 *
 * Esta é a rede de segurança, não a entrega principal — quem entrega é o
 * WebSocket, e é por isso que o intervalo muda: os dois mundos pedem ritmos
 * opostos, e usar o mesmo número nos dois significa escolher o errado em um
 * deles. Era o que acontecia: meio minuto fixo, tanto com o fio de pé (onde
 * era desperdício) quanto com ele caído (onde era o atraso que a pessoa
 * sentia ao mandar mensagem).
 *
 * O relógio é um `setTimeout` que se reagenda, e não um `setInterval`: o
 * período precisa ser decidido A CADA volta, porque o fio pode cair ou voltar
 * entre uma e outra.
 *
 * @param recarregar O que buscar de novo.
 * @param ativa      Passe `false` enquanto a tela ainda está carregando — a
 *                   varredura não tem o que cobrir antes da primeira busca.
 */
export function useVarredura(recarregar: () => void, ativa = true) {

    // Mesma razão do useAoVivo: a função é recriada a cada render, e nas
    // dependências do efeito ela derrubaria e recriaria o relógio sem parar.
    const ultimaFuncao = useRef(recarregar)

    useEffect(() => {
        ultimaFuncao.current = recarregar
    })

    useEffect(() => {

        if (!ativa) return

        let relogio: ReturnType<typeof setTimeout> | null = null

        function agendar() {
            relogio = setTimeout(() => {
                ultimaFuncao.current()
                agendar()
            }, fioAberto() ? COM_O_FIO_DE_PE : COM_O_FIO_CAIDO)
        }

        agendar()

        return () => {
            if (relogio) clearTimeout(relogio)
        }
    }, [ativa])
}
