<script setup lang="ts">
import { computed } from 'vue'

import type { SociedadeEvento } from '~/types/sociedade'
import { formatMoeda } from '~/utils/format'

const props = defineProps<{
  sociedade: SociedadeEvento
}>()

function pct(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

const linhas = computed(() => {
  const t = props.sociedade.totais
  if (!t) return []
  return [
    { label: 'Online (Pix)', total: t.online, galeria: t.galeriaOnline, produtor: t.produtorOnline },
    { label: 'Portaria', total: t.portaria, galeria: t.galeriaPortaria, produtor: t.produtorPortaria }
  ]
})
</script>

<template>
  <div v-if="sociedade.ativa && sociedade.totais" class="space-y-4">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div class="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <p class="text-xs uppercase tracking-wide text-zinc-500">Total vendido</p>
        <p class="mt-1 text-xl font-semibold text-white">{{ formatMoeda(sociedade.totais.total) }}</p>
        <p class="mt-1 text-xs text-zinc-500">{{ sociedade.totais.pedidosPagos }} pagamentos confirmados</p>
      </div>
      <div class="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
        <p class="text-xs uppercase tracking-wide text-amber-400">Galeria · {{ pct(sociedade.percentualGaleria) }}</p>
        <p class="mt-1 text-xl font-semibold text-white">{{ formatMoeda(sociedade.totais.galeria) }}</p>
      </div>
      <div class="rounded-xl border border-green-500/40 bg-green-500/5 p-4">
        <p class="text-xs uppercase tracking-wide text-green-400">
          {{ sociedade.produtor?.nome ?? 'Produtor' }} · {{ pct(sociedade.percentualProdutor) }}
        </p>
        <p class="mt-1 text-xl font-semibold text-white">{{ formatMoeda(sociedade.totais.produtor) }}</p>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[420px] text-left text-sm">
        <thead class="text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th class="py-2 pr-3 font-medium">Forma</th>
            <th class="py-2 pr-3 text-right font-medium">Total</th>
            <th class="py-2 pr-3 text-right font-medium">Galeria</th>
            <th class="py-2 text-right font-medium">Produtor</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-zinc-800 text-zinc-300">
          <tr v-for="linha in linhas" :key="linha.label">
            <td class="py-2 pr-3">{{ linha.label }}</td>
            <td class="py-2 pr-3 text-right">{{ formatMoeda(linha.total) }}</td>
            <td class="py-2 pr-3 text-right">{{ formatMoeda(linha.galeria) }}</td>
            <td class="py-2 text-right">{{ formatMoeda(linha.produtor) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-zinc-500">
      Valores de ingressos com pagamento confirmado. O acerto da portaria em dinheiro é feito por fora do sistema.
    </p>
  </div>
</template>
