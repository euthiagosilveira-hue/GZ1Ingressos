<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue3-toastify'
import { TrashIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseCard from '~/components/BaseCard.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import FormField from '~/components/FormField.vue'
import {
  adicionarAcompanhanteEventoAdmin,
  listarAcompanhantesAdmin,
  listarAcompanhantesEventoAdmin,
  removerAcompanhanteEventoAdmin
} from '~/services/admin/acompanhamento'
import type { Acompanhante } from '~/types/acompanhamento'
import type { SelectOption } from '~/types/ui'

const props = defineProps<{
  eventoId?: string | null
}>()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const carregando = ref(false)
const erroCarregar = ref('')
const doEvento = ref<Acompanhante[]>([])
const todos = ref<Acompanhante[]>([])

const escolhido = ref('')
const nome = ref('')
const email = ref('')
const erroNome = ref('')
const erroEmail = ref('')
const adicionando = ref(false)

const remover = ref<Acompanhante | null>(null)
const removendo = ref(false)

// Quem ja tem login de acompanhamento e ainda nao esta neste evento.
const disponiveis = computed(() =>
  todos.value.filter((a) => a.ativo && !doEvento.value.some((d) => d.usuarioId === a.usuarioId))
)

const opcoesExistentes = computed<SelectOption[]>(() => [
  { value: '', label: 'Pessoa nova (enviar convite)' },
  ...disponiveis.value.map((a) => ({ value: a.usuarioId, label: `${a.nome} (${a.email})` }))
])

const selecionado = computed(() => disponiveis.value.find((a) => a.usuarioId === escolhido.value) ?? null)

async function carregar() {
  if (!props.eventoId) return
  carregando.value = true
  erroCarregar.value = ''
  try {
    const [evento, lista] = await Promise.all([
      listarAcompanhantesEventoAdmin(props.eventoId),
      listarAcompanhantesAdmin()
    ])
    doEvento.value = evento
    todos.value = lista
  } catch (e) {
    erroCarregar.value = e instanceof Error ? e.message : 'Não foi possível carregar o acompanhamento.'
  } finally {
    carregando.value = false
  }
}

async function adicionar() {
  if (!props.eventoId) return
  erroNome.value = ''
  erroEmail.value = ''
  const alvoNome = selecionado.value ? selecionado.value.nome : nome.value.trim()
  const alvoEmail = selecionado.value ? selecionado.value.email : email.value.trim()
  if (!selecionado.value) {
    if (!alvoNome) erroNome.value = 'Informe o nome.'
    if (!EMAIL_RE.test(alvoEmail)) erroEmail.value = 'Informe um e-mail válido.'
    if (erroNome.value || erroEmail.value) return
  }
  adicionando.value = true
  try {
    const { conviteEnviado } = await adicionarAcompanhanteEventoAdmin(props.eventoId, alvoNome, alvoEmail)
    toast.success(
      conviteEnviado
        ? `Convite enviado para ${alvoEmail}. A pessoa cria a senha pelo e-mail.`
        : `${alvoNome} já pode acompanhar este evento.`
    )
    escolhido.value = ''
    nome.value = ''
    email.value = ''
    await carregar()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Não foi possível adicionar a pessoa.')
  } finally {
    adicionando.value = false
  }
}

async function confirmarRemocao() {
  if (!props.eventoId || !remover.value) return
  removendo.value = true
  try {
    await removerAcompanhanteEventoAdmin(props.eventoId, remover.value.usuarioId)
    toast.success(`${remover.value.nome} não acompanha mais este evento.`)
    remover.value = null
    await carregar()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Não foi possível tirar o acesso.')
  } finally {
    removendo.value = false
  }
}

onMounted(() => void carregar())
</script>

<template>
  <BaseCard class="space-y-5">
    <div class="space-y-1">
      <h2 class="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">
        7. Acompanhamento das vendas
      </h2>
      <p class="text-xs text-zinc-500">
        Quem estiver aqui entra com e-mail e senha e vê só as vendas deste evento: total em R$, ingressos
        por lote e por dia, quantos já entraram e o nome dos compradores. Não vê telefone nem e-mail dos
        compradores e não consegue alterar nada.
      </p>
    </div>

    <p v-if="!props.eventoId" class="text-sm text-zinc-500">
      Salve o evento primeiro para adicionar quem vai acompanhar as vendas.
    </p>

    <div v-else-if="carregando && doEvento.length === 0" class="h-24 animate-pulse rounded-xl bg-zinc-900" aria-busy="true" />

    <div v-else-if="erroCarregar" role="alert" class="space-y-3">
      <p class="text-sm text-red-300">{{ erroCarregar }}</p>
      <AppButton variant="outline" size="sm" @click="carregar">Tentar novamente</AppButton>
    </div>

    <template v-else>
      <p v-if="doEvento.length === 0" class="text-sm text-zinc-500">Ninguém acompanha este evento ainda.</p>
      <ul v-else class="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
        <li v-for="pessoa in doEvento" :key="pessoa.usuarioId" class="flex items-center justify-between gap-3 px-4 py-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-white">{{ pessoa.nome }}</p>
            <p class="truncate text-xs text-zinc-500">
              {{ pessoa.email }}
              <span v-if="!pessoa.ativo" class="text-red-300"> · usuário inativo</span>
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
            :aria-label="`Tirar acesso de ${pessoa.nome}`"
            @click="remover = pessoa"
          >
            <TrashIcon class="h-4 w-4" />
          </button>
        </li>
      </ul>

      <div class="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <p class="text-sm font-medium text-white">Adicionar pessoa</p>
        <FormField v-if="disponiveis.length > 0" label="Quem">
          <BaseSelect v-model="escolhido" :options="opcoesExistentes" />
        </FormField>
        <div v-if="!selecionado" class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Nome" required :error="erroNome">
            <BaseInput v-model="nome" placeholder="Nome da pessoa" :invalid="!!erroNome" />
          </FormField>
          <FormField label="E-mail" required :error="erroEmail" hint="É o e-mail que a pessoa usa para entrar.">
            <BaseInput v-model="email" type="email" placeholder="email@exemplo.com" :invalid="!!erroEmail" />
          </FormField>
        </div>
        <AppButton variant="outlineAccent" size="sm" :disabled="adicionando" @click="adicionar">
          {{ adicionando ? 'Enviando...' : selecionado ? 'Dar acesso a este evento' : 'Enviar convite de acesso' }}
        </AppButton>
        <p class="text-xs text-zinc-500">
          A pessoa recebe um e-mail para criar a senha e depois entra em gz-1-ingressos.vercel.app/login.
          A mesma pessoa pode acompanhar vários eventos.
        </p>
      </div>
    </template>

    <ConfirmDialog
      :open="remover !== null"
      title="Tirar o acesso a este evento?"
      :description="`${remover?.nome ?? ''} deixa de ver as vendas deste evento. Os outros eventos dessa pessoa continuam.`"
      confirm-label="Tirar acesso"
      tone="danger"
      :loading="removendo"
      @confirm="confirmarRemocao"
      @cancel="remover = null"
    />
  </BaseCard>
</template>
