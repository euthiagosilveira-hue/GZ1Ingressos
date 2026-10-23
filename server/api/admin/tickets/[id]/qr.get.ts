import QRCode from 'qrcode'

import { exigirAdmin, lerIngressoIdDaRota } from '../../../../utils/admin-auth'

/**
 * QR Code REAL de um ingresso para o painel administrativo.
 * O SVG codifica o mesmo qr_token que a portaria valida.
 * Somente ADMINISTRADOR; so devolve QR para ingresso VALIDO.
 */
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')

  const ingressoId = lerIngressoIdDaRota(event)
  const admin = await exigirAdmin(event)

  const { data: ingresso, error } = await admin
    .from('ingressos')
    .select('codigo,status,qr_token')
    .eq('id', ingressoId)
    .maybeSingle()

  if (error) {
    setResponseStatus(event, 500)
    return { error: 'ERRO_INESPERADO' }
  }
  if (!ingresso) {
    setResponseStatus(event, 404)
    return { error: 'NAO_ENCONTRADO' }
  }

  const status = String(ingresso.status)
  if (status !== 'VALIDO' || !ingresso.qr_token) {
    return { codigo: ingresso.codigo, status, svg: null }
  }

  const svg = await QRCode.toString(String(ingresso.qr_token), {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 4
  })

  return { codigo: ingresso.codigo, status, svg }
})
