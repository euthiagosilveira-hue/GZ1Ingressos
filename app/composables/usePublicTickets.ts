import { computed, onMounted, ref } from 'vue'

import {
  TicketsError,
  obterIngressosCheckout,
  obterIngressosRecuperacao
} from '~/services/public/ingressos'
import {
  armazenamentoNavegador,
  removerIngressoSalvo,
  salvarIngresso
} from '~/utils/ingressosSalvos'
import type { PublicOrderTickets, TicketsErrorCode } from '~/types/publicIngressos'

export type TicketsEstado =
  | 'CARREGANDO'
  | 'ERRO'
  | 'NAO_ENCONTRADO'
  | 'INDISPONIVEL'
  | 'DISPONIVEL'

function ehUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)
}

/**
 * Orquestra a pagina publica de ingressos. Aceita dois acessos:
 * - ?token=<checkout_token>   (acesso original)
 * - ?recovery=<recovery_token> (recuperacao por codigo + telefone)
 * Em ambos a RPC e a unica fonte dos dados (sem SELECT direto).
 */
export function usePublicTickets() {
  const route = useRoute()

  const token = computed(() => {
    const valor = route.query.token
    return typeof valor === 'string' && ehUuid(valor) ? valor : null
  })

  const recoveryToken = computed(() => {
    const valor = route.query.recovery
    return typeof valor === 'string' && valor.trim() ? valor.trim() : null
  })

  const tickets = ref<PublicOrderTickets | null>(null)
  const carregando = ref(true)
  const erro = ref<TicketsErrorCode | null>(null)

  const estado = computed<TicketsEstado>(() => {
    if (carregando.value) return 'CARREGANDO'
    if (!token.value && !recoveryToken.value) return 'NAO_ENCONTRADO'
    if (erro.value) return 'ERRO'
    if (!tickets.value) return 'NAO_ENCONTRADO'
    return tickets.value.disponivel ? 'DISPONIVEL' : 'INDISPONIVEL'
  })

  async function carregar() {
    carregando.value = true
    erro.value = null

    if (!token.value && !recoveryToken.value) {
      tickets.value = null
      carregando.value = false
      return
    }

    try {
      tickets.value = recoveryToken.value
        ? await obterIngressosRecuperacao(recoveryToken.value)
        : await obterIngressosCheckout(token.value as string)
      lembrarNoAparelho()
    } catch (e) {
      erro.value = e instanceof TicketsError ? e.code : 'ERRO_INESPERADO'
      tickets.value = null
    } finally {
      carregando.value = false
    }
  }

  /** Pedido aberto pelo link original fica salvo para voltar sem codigo. */
  function lembrarNoAparelho() {
    const atual = tickets.value
    if (!token.value || recoveryToken.value || !atual) return
    const storage = armazenamentoNavegador()
    if (atual.pedidoStatus === 'CANCELADO' || atual.pedidoStatus === 'EXPIRADO') {
      removerIngressoSalvo(storage, token.value)
      return
    }
    salvarIngresso(storage, {
      checkoutToken: token.value,
      codigoPedido: atual.codigoPedido,
      eventoNome: atual.eventoNome,
      eventoSlug: atual.eventoSlug,
      eventoInicioEm: atual.eventoInicioEm
    })
  }

  onMounted(() => {
    void carregar()
  })

  return {
    token,
    recoveryToken,
    tickets,
    carregando,
    erro,
    estado,
    carregar,
    atualizar: carregar
  }
}
