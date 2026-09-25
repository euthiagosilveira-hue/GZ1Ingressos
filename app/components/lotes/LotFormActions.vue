<script setup lang="ts">
import AppButton from '~/components/AppButton.vue'

const emit = defineEmits<{
  cancel: []
}>()
</script>

<template>
  <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
    <AppButton variant="ghost" type="button" @click="emit('cancel')">Cancelar</AppButton>
    <AppButton variant="primary" type="submit">Salvar lote</AppButton>
  </div>
</template>
