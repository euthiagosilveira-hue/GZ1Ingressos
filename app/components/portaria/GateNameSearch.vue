<script setup lang="ts">
import BaseInput from '~/components/BaseInput.vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <BaseInput
    :model-value="props.modelValue"
    label="Buscar participante"
    type="search"
    placeholder="Digite o nome completo ou parte do nome..."
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
