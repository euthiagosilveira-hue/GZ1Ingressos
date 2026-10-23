import { computed, onScopeDispose, ref, watch } from 'vue'

import { useGateSession } from '~/composables/useGateSession'
import {
  GateError,
  buscarIngressosPorNome,
  registrarEntradaNome,
  registrarEntradaVip
} from '~/services/gate/ingressos'
import type { GateScanErroCode, IngressoBuscaNome, RegistrarEntradaQrResult } from '~/types/gate'
import { nomeBuscaValido, uuidValido } from '~/utils/gate'

type ContextoErro = 'BUSCA' | 'REGISTRO'

/** Espera apos a ultima tecla antes de buscar sugestoes. */
export const ATRASO_SUGESTOES_MS = 300

/**
 * Busca por nome na portaria: consulta e registro por RPC real, sempre dentro
 * do evento selecionado. Nenhuma regra de negocio no frontend.
 *
 * Sugestoes enquanto digita: com 2+ caracteres a busca roda sozinha apos uma
 * pausa curta; respostas antigas (de letras ja apagadas/trocadas) sao
 * descartadas para a lista nao "pular".
 *
 * Em erro TECNICO preserva o contexto (nome digitado / item selecionado) para
 * permitir "Tentar novamente" sem refazer o fluxo.
 */
export function useGateNameSearch(eventoId: () => string) {
  const nome = ref('')
  const buscando = ref(false)
  const registrando = ref(false)
  const resultados = ref<IngressoBuscaNome[]>([])
  const resultado = ref<RegistrarEntradaQrResult | null>(null)
  const erro = ref<GateScanErroCode | null>(null)
  const contextoErro = ref<ContextoErro | null>(null)
  const itemParaRetry = ref<IngressoBuscaNome | null>(null)
  const jaBuscou = ref(false)

  const { registrar: registrarSessao } = useGateSession()

  const nomeValido = computed(() => nomeBuscaValido(nome.value))
  const podeBuscar = computed(() => uuidValido(eventoId()) && nomeValido.value)

  let sequenciaBusca = 0
  let timerSugestoes: ReturnType<typeof setTimeout> | null = null

  function cancelarSugestoes() {
    if (timerSugestoes) clearTimeout(timerSugestoes)
    timerSugestoes = null
  }

  async function buscar() {
    cancelarSugestoes()
    erro.value = null
    contextoErro.value = null
    if (!uuidValido(eventoId())) {
      erro.value = 'SEM_EVENTO'
      return
    }
    if (!nomeValido.value) return

    const minhaBusca = ++sequenciaBusca
    buscando.value = true
    try {
      const encontrados = await buscarIngressosPorNome({
        eventoId: eventoId(),
        nome: nome.value.trim()
      })
      if (minhaBusca !== sequenciaBusca) return
      resultados.value = encontrados
      jaBuscou.value = true
    } catch (e) {
      if (minhaBusca !== sequenciaBusca) return
      // Preserva o texto digitado; erro tecnico (nao "nenhum encontrado").
      erro.value = e instanceof GateError ? e.code : 'DESCONHECIDO'
      contextoErro.value = 'BUSCA'
      resultados.value = []
    } finally {
      if (minhaBusca === sequenciaBusca) buscando.value = false
    }
  }

  // Sugestoes enquanto digita.
  watch(nome, () => {
    cancelarSugestoes()
    if (resultado.value || registrando.value) return
    if (!nomeValido.value) {
      // Texto apagado: limpa a lista e ignora respostas pendentes.
      sequenciaBusca++
      buscando.value = false
      resultados.value = []
      jaBuscou.value = false
      if (contextoErro.value === 'BUSCA') {
        erro.value = null
        contextoErro.value = null
      }
      return
    }
    timerSugestoes = setTimeout(() => {
      timerSugestoes = null
      void buscar()
    }, ATRASO_SUGESTOES_MS)
  })

  onScopeDispose(cancelarSugestoes)

  async function registrar(ingresso: IngressoBuscaNome) {
    erro.value = null
    contextoErro.value = null
    if (!uuidValido(eventoId())) {
      erro.value = 'SEM_EVENTO'
      return
    }
    registrando.value = true
    try {
      if (ingresso.origem === 'VIP') {
        if (!ingresso.vipId) {
          erro.value = 'DESCONHECIDO'
          contextoErro.value = 'REGISTRO'
          itemParaRetry.value = ingresso
          return
        }
        resultado.value = await registrarEntradaVip({
          eventoId: eventoId(),
          vipId: ingresso.vipId
        })
      } else {
        if (!ingresso.ingressoId) {
          erro.value = 'DESCONHECIDO'
          contextoErro.value = 'REGISTRO'
          itemParaRetry.value = ingresso
          return
        }
        resultado.value = await registrarEntradaNome({
          eventoId: eventoId(),
          ingressoId: ingresso.ingressoId
        })
      }

      itemParaRetry.value = null
      // Contabiliza a sessao apenas se LIBERADO (regra no reducer).
      registrarSessao(resultado.value.resultado, {
        nome: resultado.value.participanteNome ?? ingresso.participanteNome,
        tipo: ingresso.origem === 'VIP' ? 'VIP' : 'INGRESSO',
        codigo: ingresso.origem === 'VIP' ? null : ingresso.codigo
      })
    } catch (e) {
      // Preserva o item selecionado para retry; nao incrementa sessao.
      resultado.value = null
      erro.value = e instanceof GateError ? e.code : 'DESCONHECIDO'
      contextoErro.value = 'REGISTRO'
      itemParaRetry.value = ingresso
    } finally {
      registrando.value = false
    }
  }

  /** Retry da ultima busca (mesmo nome), sem limpar o input. */
  function tentarBuscarNovamente() {
    if (buscando.value) return
    void buscar()
  }

  /** Retry do ultimo registro (mesmo item), sem nova busca. */
  function tentarRegistrarNovamente() {
    const item = itemParaRetry.value
    if (!item || registrando.value) return
    void registrar(item)
  }

  function reset() {
    nome.value = ''
    resultados.value = []
    resultado.value = null
    erro.value = null
    contextoErro.value = null
    itemParaRetry.value = null
    jaBuscou.value = false
  }

  return {
    nome,
    buscando,
    registrando,
    resultados,
    resultado,
    erro,
    contextoErro,
    itemParaRetry,
    jaBuscou,
    nomeValido,
    podeBuscar,
    buscar,
    registrar,
    tentarBuscarNovamente,
    tentarRegistrarNovamente,
    reset
  }
}
