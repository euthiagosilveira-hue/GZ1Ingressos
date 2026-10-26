<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ArrowDownTrayIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  EllipsisHorizontalIcon,
  EyeIcon,
  PencilSquareIcon,
  TicketIcon,
  UserGroupIcon,
  XCircleIcon
} from '@heroicons/vue/24/outline'

const props = withDefaults(defineProps<{ podeEncerrar?: boolean }>(), { podeEncerrar: false })

const emit = defineEmits<{
  action: [action: string]
}>()

const MARGEM = 8
const LARGURA_MENU = 224 // w-56

const aberto = ref(false)
const raiz = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
// O card tem overflow-hidden: o menu vai para o <body> com posicao fixa,
// abrindo para cima quando nao cabe embaixo.
const estiloMenu = ref<Record<string, string>>({})

function posicionar() {
  const botao = raiz.value?.getBoundingClientRect()
  if (!botao) return
  const alturaMenu = menu.value?.offsetHeight ?? 0
  const alturaTela = window.innerHeight
  const espacoAbaixo = alturaTela - botao.bottom - MARGEM
  const espacoAcima = botao.top - MARGEM
  const abrirParaCima = alturaMenu > espacoAbaixo && espacoAcima > espacoAbaixo

  let top = abrirParaCima ? botao.top - MARGEM - alturaMenu : botao.bottom + MARGEM
  top = Math.max(MARGEM, Math.min(top, alturaTela - alturaMenu - MARGEM))
  const left = Math.max(
    MARGEM,
    Math.min(botao.right - LARGURA_MENU, window.innerWidth - LARGURA_MENU - MARGEM)
  )

  estiloMenu.value = {
    top: `${top}px`,
    left: `${left}px`,
    maxHeight: `${alturaTela - 2 * MARGEM}px`
  }
}

async function alternar() {
  aberto.value = !aberto.value
  if (aberto.value) {
    estiloMenu.value = { visibility: 'hidden', top: '0px', left: '0px' }
    await nextTick()
    posicionar()
  }
}

function fechar() {
  aberto.value = false
}

function selecionar(action: string) {
  fechar()
  emit('action', action)
}

function aoClicarFora(evento: MouseEvent) {
  const alvo = evento.target as Node
  if (aberto.value && !raiz.value?.contains(alvo) && !menu.value?.contains(alvo)) {
    fechar()
  }
}

function aoRolarOuRedimensionar(evento: Event) {
  if (aberto.value && !(evento.target instanceof Node && menu.value?.contains(evento.target))) {
    fechar()
  }
}

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key === 'Escape') fechar()
}

onMounted(() => {
  document.addEventListener('click', aoClicarFora)
  document.addEventListener('keydown', aoTeclar)
  window.addEventListener('scroll', aoRolarOuRedimensionar, true)
  window.addEventListener('resize', aoRolarOuRedimensionar)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', aoClicarFora)
  document.removeEventListener('keydown', aoTeclar)
  window.removeEventListener('scroll', aoRolarOuRedimensionar, true)
  window.removeEventListener('resize', aoRolarOuRedimensionar)
})
</script>

<template>
  <div ref="raiz" class="relative">
    <button
      type="button"
      aria-label="Mais ações"
      class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition-colors duration-150 hover:border-zinc-600 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
      @click.stop="alternar"
    >
      <EllipsisHorizontalIcon class="h-5 w-5" />
    </button>

    <Teleport to="body">
      <div
        v-if="aberto"
        ref="menu"
        :style="estiloMenu"
        class="fixed z-50 w-56 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-1 shadow-xl shadow-black/40"
      >
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          @click.stop="selecionar('visualizar')"
        >
          <EyeIcon class="h-4 w-4 text-zinc-500" />
          Visualizar página pública
        </button>
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          @click.stop="selecionar('dashboard')"
        >
          <ChartBarIcon class="h-4 w-4 text-zinc-500" />
          Ver dashboard
        </button>
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          @click.stop="selecionar('lotes')"
        >
          <TicketIcon class="h-4 w-4 text-zinc-500" />
          Gerenciar lotes
        </button>
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          @click.stop="selecionar('vip')"
        >
          <UserGroupIcon class="h-4 w-4 text-zinc-500" />
          Lista VIP
        </button>
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          @click.stop="selecionar('editar')"
        >
          <PencilSquareIcon class="h-4 w-4 text-zinc-500" />
          Editar evento
        </button>

        <div class="my-1 h-px bg-zinc-800"></div>
        <p class="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Lista de pagantes
        </p>
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          @click.stop="selecionar('pagantes-xlsx')"
        >
          <ArrowDownTrayIcon class="h-4 w-4 text-zinc-500" />
          Baixar em Excel
        </button>
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          @click.stop="selecionar('pagantes-txt')"
        >
          <DocumentTextIcon class="h-4 w-4 text-zinc-500" />
          Baixar em bloco de notas
        </button>

        <button
          v-if="props.podeEncerrar"
          type="button"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          @click.stop="selecionar('encerrar')"
        >
          <CheckCircleIcon class="h-4 w-4 text-zinc-500" />
          Encerrar evento
        </button>

        <div class="my-1 h-px bg-zinc-800"></div>

        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10"
          @click.stop="selecionar('cancelar')"
        >
          <XCircleIcon class="h-4 w-4" />
          Cancelar evento
        </button>
      </div>
    </Teleport>
  </div>
</template>
