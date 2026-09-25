<script setup lang="ts">
import type { Component } from 'vue'

const props = withDefaults(
  defineProps<{
    icon: Component
    label: string
    value: string | number
    subtitle?: string
    accent?: boolean
  }>(),
  {
    subtitle: '',
    accent: false
  }
)
</script>

<template>
  <BaseCard class="flex items-center gap-4">
    <div
      class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400"
    >
      <component :is="props.icon" class="h-6 w-6" />
    </div>
    <div class="min-w-0">
      <p class="text-xs uppercase tracking-wide text-zinc-400">{{ label }}</p>
      <p
        class="truncate text-2xl font-bold"
        :class="accent ? 'text-amber-400' : 'text-white'"
      >
        {{ value }}
      </p>
      <p v-if="subtitle" class="text-xs text-zinc-400">{{ subtitle }}</p>
    </div>
  </BaseCard>
</template>
