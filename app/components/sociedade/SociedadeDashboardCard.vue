<script setup lang="ts">
import { ref, watch } from 'vue'

import BaseCard from '~/components/BaseCard.vue'
import SociedadeDivisao from '~/components/sociedade/SociedadeDivisao.vue'
import { obterSociedadeEventoAdmin } from '~/services/admin/sociedade'
import type { SociedadeEvento } from '~/types/sociedade'

const props = defineProps<{
  eventoId: string
}>()

const sociedade = ref<SociedadeEvento | null>(null)

async function carregar() {
  sociedade.value = null
  try {
    sociedade.value = await obterSociedadeEventoAdmin(props.eventoId)
  } catch {
    // Sem sociedade (ou banco ainda sem a migration): o card simplesmente nao aparece.
    sociedade.value = null
  }
}

watch(() => props.eventoId, () => void carregar(), { immediate: true })
</script>

<template>
  <BaseCard v-if="sociedade?.ativa" class="space-y-4">
    <h2 class="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">
      Divisão da sociedade
    </h2>
    <SociedadeDivisao :sociedade="sociedade" />
  </BaseCard>
</template>
