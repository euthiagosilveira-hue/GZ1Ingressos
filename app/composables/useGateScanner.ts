import { nextTick, onUnmounted, ref } from 'vue'

import { GateError, registrarEntradaQr } from '~/services/gate/entradas'
import type {
  GateCameraStatus,
  GateScanErroCode,
  RegistrarEntradaQrResult
} from '~/types/gate'
import { LeituraLock, mascararToken, qrTokenPlausivel, uuidValido } from '~/utils/gate'

const INTERVALO_LEITURA_MS = 120
const LARGURA_MAX_PX = 480

type Decodificador = typeof import('jsqr')['default']

/**
 * Scanner de portaria: camera (getUserMedia) + decode local (jsQR) +
 * chamada unica a RPC registrar_entrada_qr por leitura.
 * Toda decisao de negocio vem da RPC; aqui so ha formato + trava de leitura.
 */
export function useGateScanner(eventoId: () => string) {
  const video = ref<HTMLVideoElement | null>(null)
  const cameraStatus = ref<GateCameraStatus>('IDLE')
  const lendo = ref(false)
  const processando = ref(false)
  const resultado = ref<RegistrarEntradaQrResult | null>(null)
  const erro = ref<GateScanErroCode | null>(null)
  const ultimoToken = ref('')

  const lock = new LeituraLock()
  let stream: MediaStream | null = null
  let raf: number | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let decodificador: Decodificador | null = null
  let ultimaLeitura = 0

  function pararLoop() {
    if (raf !== null) {
      cancelAnimationFrame(raf)
      raf = null
    }
  }

  function parar() {
    pararLoop()
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      stream = null
    }
    if (video.value) video.value.srcObject = null
    cameraStatus.value = 'IDLE'
  }

  async function carregarDecodificador(): Promise<Decodificador> {
    if (!decodificador) {
      const mod = await import('jsqr')
      decodificador = mod.default
    }
    return decodificador
  }

  async function abrirStream(): Promise<MediaStream> {
    const restricoes: MediaStreamConstraints = {
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    }
    try {
      return await navigator.mediaDevices.getUserMedia(restricoes)
    } catch (e) {
      const nome = (e as DOMException)?.name
      // Dispositivo pode nao ter camera traseira: cai para qualquer camera.
      if (nome === 'OverconstrainedError' || nome === 'NotFoundError') {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }
      throw e
    }
  }

  async function iniciar() {
    if (!import.meta.client || cameraStatus.value === 'ATIVA' || cameraStatus.value === 'SOLICITANDO') {
      return
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      cameraStatus.value = 'SEM_SUPORTE'
      return
    }

    cameraStatus.value = 'SOLICITANDO'
    erro.value = null

    try {
      stream = await abrirStream()
      cameraStatus.value = 'ATIVA'
      await nextTick()

      const el = video.value
      if (!el) {
        cameraStatus.value = 'ERRO'
        return
      }
      el.srcObject = stream
      el.setAttribute('playsinline', 'true')
      el.muted = true
      await el.play().catch(() => {})
      await carregarDecodificador()
      loop()
    } catch (e) {
      parar()
      const nome = (e as DOMException)?.name
      if (nome === 'NotAllowedError' || nome === 'SecurityError') {
        cameraStatus.value = 'NEGADA'
      } else if (nome === 'NotFoundError' || nome === 'OverconstrainedError') {
        cameraStatus.value = 'INDISPONIVEL'
      } else {
        cameraStatus.value = 'ERRO'
      }
    }
  }

  function loop() {
    raf = requestAnimationFrame(loop)

    const el = video.value
    if (!el || el.readyState < 2) return
    if (!lock.podeProcessar() || processando.value) return

    const agora = performance.now()
    if (agora - ultimaLeitura < INTERVALO_LEITURA_MS) return
    ultimaLeitura = agora

    if (!canvas) {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d', { willReadFrequently: true })
    }
    if (!ctx || !decodificador) return

    const vw = el.videoWidth
    const vh = el.videoHeight
    if (!vw || !vh) return

    const escala = Math.min(1, LARGURA_MAX_PX / Math.max(vw, vh))
    const largura = Math.max(1, Math.round(vw * escala))
    const altura = Math.max(1, Math.round(vh * escala))
    canvas.width = largura
    canvas.height = altura

    ctx.drawImage(el, 0, 0, largura, altura)
    const imagem = ctx.getImageData(0, 0, largura, altura)
    const codigo = decodificador(imagem.data, largura, altura, { inversionAttempts: 'dontInvert' })

    if (codigo?.data) {
      void aoDetectar(codigo.data)
    }
  }

  async function aoDetectar(tokenBruto: string) {
    if (!lock.podeProcessar() || processando.value) return

    const token = tokenBruto.trim()
    // Formato basico apenas; nenhuma regra de negocio aqui.
    if (!qrTokenPlausivel(token)) return

    lock.bloquear()
    lendo.value = true
    ultimoToken.value = mascararToken(token)

    const evento = eventoId()
    if (!evento || !uuidValido(evento)) {
      erro.value = 'SEM_EVENTO'
      parar()
      return
    }

    processando.value = true
    try {
      resultado.value = await registrarEntradaQr({ eventoId: evento, qrToken: token })
      erro.value = null
    } catch (e) {
      resultado.value = null
      erro.value = e instanceof GateError ? e.code : 'ERRO_TEMPORARIO'
    } finally {
      processando.value = false
      // Desliga a camera ao exibir o resultado (economia/privacidade).
      parar()
    }
  }

  /** Liberado apos mostrar o resultado: pronto para o proximo ingresso. */
  function reiniciar() {
    resultado.value = null
    erro.value = null
    ultimoToken.value = ''
    lendo.value = false
    lock.liberar()
  }

  onUnmounted(() => {
    parar()
  })

  return {
    video,
    cameraStatus,
    lendo,
    processando,
    resultado,
    erro,
    ultimoToken,
    iniciar,
    parar,
    reiniciar,
    tentarNovamente: reiniciar
  }
}
