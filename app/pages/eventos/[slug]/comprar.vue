<script setup lang="ts">
import { computed } from 'vue'

import CheckoutPage from '~/components/public/checkout/CheckoutPage.vue'
import CheckoutUnavailable from '~/components/public/checkout/CheckoutUnavailable.vue'
import PublicEventNotFound from '~/components/public/eventos/PublicEventNotFound.vue'
import { buscarEventoPublico } from '~/data/eventosPublicos'

const route = useRoute()
const evento = computed(() => buscarEventoPublico(String(route.params.slug)))

const podeComprar = computed(() => {
  const atual = evento.value
  if (!atual || atual.situacaoVenda !== 'DISPONIVEL') return false
  if (!atual.loteId || atual.preco === null) return false
  if ((atual.disponiveis ?? 0) <= 0) return false
  return true
})

useSeoMeta({
  title: () =>
    evento.value ? `Checkout — ${evento.value.nome} | GZ1 Ingresso` : 'Checkout | GZ1 Ingresso'
})
</script>

<template>
  <CheckoutPage v-if="evento && podeComprar" :evento="evento" />
  <CheckoutUnavailable v-else-if="evento" :evento="evento" />
  <PublicEventNotFound v-else />
</template>
