<script setup lang="ts">
import { BellAlertIcon } from '@heroicons/vue/24/outline'
import { onMounted } from 'vue'
import { toast } from 'vue3-toastify'

import AppButton from '~/components/AppButton.vue'
import BaseCard from '~/components/BaseCard.vue'

const { estado, processando, verificar, ativar, desativar, testar } = usePushVendas()

onMounted(verificar)

async function onAtivar() {
  try {
    const ok = await ativar()
    if (ok) toast.success('Notificações de venda ativadas neste aparelho.')
    else if (estado.value === 'bloqueado') toast.error('As notificações estão bloqueadas no navegador.')
  } catch {
    toast.error('Não foi possível ativar as notificações.')
  }
}

async function onDesativar() {
  await desativar().catch(() => toast.error('Não foi possível desativar as notificações.'))
}

async function onTestar() {
  try {
    const enviadas = await testar()
    if (enviadas > 0) toast.success('Notificação de teste enviada.')
    else toast.error('Nenhum aparelho recebeu o teste. Desative e ative de novo.')
  } catch {
    toast.error('Não foi possível enviar o teste.')
  }
}
</script>

<template>
  <BaseCard class="h-full">
    <div class="flex items-start gap-3">
      <span
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 text-amber-400"
      >
        <BellAlertIcon class="h-6 w-6" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-white">Notificações de venda</p>
        <p class="mt-1 text-xs text-zinc-500">
          Receba um aviso neste aparelho a cada venda online confirmada.
        </p>

        <p v-if="estado === 'ativado'" class="mt-3 text-xs font-medium text-emerald-400">
          Ativadas neste aparelho.
        </p>
        <p v-else-if="estado === 'bloqueado'" class="mt-3 text-xs text-red-400">
          Bloqueadas pelo navegador. Libere as notificações deste site nas configurações do navegador.
        </p>
        <p v-else-if="estado === 'indisponivel'" class="mt-3 text-xs text-zinc-400">
          Este navegador não suporta notificações. No iPhone, adicione o site à Tela de Início e abra por lá.
        </p>
        <p v-else-if="estado === 'nao-configurado'" class="mt-3 text-xs text-zinc-400">
          Notificações ainda não configuradas no servidor.
        </p>

        <div class="mt-4 flex flex-wrap gap-2">
          <AppButton
            v-if="estado === 'desativado'"
            variant="primary"
            size="sm"
            :disabled="processando"
            @click="onAtivar"
          >
            Ativar neste aparelho
          </AppButton>
          <template v-if="estado === 'ativado'">
            <AppButton size="sm" :disabled="processando" @click="onTestar">Enviar teste</AppButton>
            <AppButton variant="ghost" size="sm" :disabled="processando" @click="onDesativar">
              Desativar
            </AppButton>
          </template>
        </div>
      </div>
    </div>
  </BaseCard>
</template>
