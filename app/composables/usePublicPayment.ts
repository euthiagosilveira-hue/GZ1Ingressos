import { computed, onMounted, onUnmounted, ref } from 'vue'

import {
  PagamentoError,
  criarPagamentoPendente,
  mensagemPagamentoErro,
  obterCheckoutPedido
} from '~/services/public/pagamentos'
import type {
  CheckoutPublico,
  PagamentoErrorCode,
  PagamentoEstado
} from '~/types/checkoutPagamento'

function ehUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)
}

/**
 * Orquestra a tela de pagamento publico usando o checkout_token.
 * O banco e a fonte de verdade; o relogio local so formata o countdown.
 */
export function usePublicPayment() {
  const route = useRoute()

  const token = computed(() => {
    const valor = route.query.token
    return typeof valor === 'string' && ehUuid(valor) ? valor : null
  })

  const checkout = ref<CheckoutPublico | null>(null)
  const carregando = ref(true)
  const erro = ref<PagamentoErrorCode | null>(null)
  const segundos = ref(0)
  const pix = ref<{ pixCopyPaste: string | null; pixQrCode: string | null; expiresAt: string | null } | null>(null)

  let timer: ReturnType<typeof setInterval> | null = null

  const estado = computed<PagamentoEstado>(() => {
    if (carregando.value) return 'CARREGANDO'
    if (!token.value) return 'NAO_ENCONTRADO'
    if (erro.value) return 'ERRO'
    const atual = checkout.value
    if (!atual) return 'NAO_ENCONTRADO'

    const pagamentoStatus = atual.pagamento?.status
    if (atual.pedidoStatus === 'PAGO' || pagamentoStatus === 'APROVADO') return 'PAGO'
    if (atual.pedidoStatus === 'CANCELADO' || pagamentoStatus === 'CANCELADO') return 'CANCELADO'
    if (atual.pedidoStatus === 'EXPIRADO' || pagamentoStatus === 'EXPIRADO') return 'EXPIRADO'
    if (pagamentoStatus === 'REJEITADO') return 'REJEITADO'
    if (pagamentoStatus === 'REEMBOLSADO') return 'REEMBOLSADO'
    return 'PENDENTE'
  })

  const expiraEm = computed(
    () => checkout.value?.pagamento?.expiraEm ?? checkout.value?.reservaExpiraEm ?? null
  )

  const textoCountdown = computed(() => {
    const total = Math.max(segundos.value, 0)
    const minutos = Math.floor(total / 60)
    const resto = total % 60
    return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
  })

  const tempoEsgotado = computed(
    () => estado.value === 'PENDENTE' && expiraEm.value !== null && segundos.value <= 0
  )

  const mensagemErro = computed(() => (erro.value ? mensagemPagamentoErro(erro.value) : ''))

  function recalcular() {
    if (!expiraEm.value) {
      segundos.value = 0
      return
    }
    const alvo = Date.parse(expiraEm.value)
    segundos.value = Number.isNaN(alvo)
      ? 0
      : Math.max(0, Math.floor((alvo - Date.now()) / 1000))
  }

  function pararTimer() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function iniciarTimer() {
    pararTimer()
    recalcular()
    // Nao reinicia em estado nao-pendente nem quando o tempo ja esgotou
    // (evita loop de refresh automatico).
    if (estado.value !== 'PENDENTE' || segundos.value <= 0) return

    timer = setInterval(() => {
      recalcular()
      if (segundos.value <= 0) {
        pararTimer()
        void atualizar()
      }
    }, 1000)
  }

  function tratarErro(e: unknown) {
    erro.value = e instanceof PagamentoError ? e.code : 'ERRO_INESPERADO'
  }

  async function buscar(): Promise<CheckoutPublico | null> {
    if (!token.value) return null
    return obterCheckoutPedido(token.value)
  }

  /** Somente leitura: usado pelo botao "Atualizar status" e pelo countdown. */
  async function atualizar() {
    if (!token.value) {
      checkout.value = null
      erro.value = null
      carregando.value = false
      return
    }
    try {
      erro.value = null
      checkout.value = await buscar()
    } catch (e) {
      tratarErro(e)
      checkout.value = null
    } finally {
      carregando.value = false
      iniciarTimer()
      void carregarPix()
    }
  }

  /** Carga inicial: recupera e, se necessario, cria/reutiliza o pagamento. */
  async function carregar() {
    carregando.value = true
    erro.value = null

    if (!token.value) {
      checkout.value = null
      carregando.value = false
      return
    }

    try {
      let atual = await buscar()
      if (atual && atual.pedidoStatus === 'RESERVADO' && !atual.pagamento) {
        await criarPagamentoPendente(token.value)
        atual = await buscar()
      }
      checkout.value = atual
    } catch (e) {
      tratarErro(e)
      checkout.value = null
    } finally {
      carregando.value = false
      iniciarTimer()
      void carregarPix()
    }
  }

  /** Busca/gera o Pix real no backend (nunca chama o provider no cliente). */
  async function carregarPix() {
    if (!token.value || estado.value !== 'PENDENTE') return
    try {
      const resposta = await $fetch<{
        pixCopyPaste?: string | null
        pixQrCode?: string | null
        expiresAt?: string | null
        error?: string
      }>('/api/payments/pix', { method: 'POST', body: { checkoutToken: token.value } })
      if (resposta && !resposta.error) {
        pix.value = {
          pixCopyPaste: resposta.pixCopyPaste ?? null,
          pixQrCode: resposta.pixQrCode ?? null,
          expiresAt: resposta.expiresAt ?? null
        }
      }
    } catch {
      // silencioso: a UI mostra o estado pendente/placeholder
    }
  }

  onMounted(() => {
    void carregar()
  })

  onUnmounted(() => {
    pararTimer()
  })

  return {
    token,
    checkout,
    carregando,
    erro,
    mensagemErro,
    estado,
    segundos,
    textoCountdown,
    tempoEsgotado,
    pix,
    carregar,
    atualizar
  }
}
