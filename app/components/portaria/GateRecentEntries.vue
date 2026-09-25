<script setup lang="ts">
import BaseCard from '~/components/BaseCard.vue'
import GateRecentEntryItem from '~/components/portaria/GateRecentEntryItem.vue'
import type { GateRecentEntry } from '~/types/portaria'

const props = defineProps<{
  entradas: GateRecentEntry[]
}>()
</script>

<template>
  <BaseCard class="space-y-4">
    <h2 class="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">
      Entradas recentes
    </h2>

    <p v-if="props.entradas.length === 0" class="text-sm text-zinc-500">
      Nenhuma entrada registrada nesta sessão.
    </p>

    <ul v-else>
      <GateRecentEntryItem
        v-for="entrada in props.entradas.slice(0, 10)"
        :key="entrada.id"
        :entrada="entrada"
      />
    </ul>
  </BaseCard>
</template>
