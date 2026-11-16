<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue3-toastify'
import {
  ArrowUpTrayIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
  LinkIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import FormField from '~/components/FormField.vue'
import VinculosBarModal from '~/components/financeiro/reposicao/VinculosBarModal.vue'
import { useCaixaBase } from '~/composables/useCaixaBase'
import {
  excluirVendaBar,
  lerRelatorioBar,
  listarVendasBar,
  listarVinculosBar,
  salvarVendaBar
} from '~/services/admin/reposicao'
import type { PreviaRelatorioBar, VendaBar } from '~/types/reposicao'
import { formatarDataCurta, formatarQuantidade } from '~/utils/caixa'
import { formatMoeda } from '~/utils/format'
import { eventoDoRelatorio, mensagemErroVendasBar } from '~/utils/reposicao'

// Relatorio "Resumo de vendas" do sistema do bar: o que saiu de cada produto.
// Serve para o estoque; nao lanca nada no caixa (o dinheiro e o Fechar bar).

const { eventos, eventoOptions, carregarEventos } = useCaixaBase()

const vendas = ref<VendaBar[]>([])
const carregando = ref(true)
const erro = ref('')
const semLigacao = ref(0)

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const [lista, vinculos] = await Promise.all([listarVendasBar(), listarVinculosBar()])
    vendas.value = lista
    semLigacao.value = vinculos.filter((v) => !v.produtoId).length
  } catch (e) {
    erro.value = mensagemErroVendasBar(e, 'Não foi possível carregar as vendas do bar.')
  } finally {
    carregando.value = false
  }
}

onMounted(() => {
  void carregarEventos()
  void carregar()
})

// --- Ler relatorio ---------------------------------------------------------
const link = ref('')
const lendo = ref(false)
const erroLeitura = ref('')
const previa = ref<PreviaRelatorioBar | null>(null)
const eventoId = ref('')
const inputArquivo = ref<HTMLInputElement | null>(null)

function aoLer(r: PreviaRelatorioBar) {
  previa.value = r
  eventoId.value = eventoDoRelatorio(eventos.value, r.de)?.id ?? ''
}

async function lerLink() {
  if (!link.value.trim()) {
    erroLeitura.value = 'Cole o link do relatório.'
    return
  }
  lendo.value = true
  erroLeitura.value = ''
  previa.value = null
  try {
    if (!eventos.value.length) await carregarEventos()
    aoLer(await lerRelatorioBar({ url: link.value.trim() }))
  } catch (e) {
    erroLeitura.value = mensagemErroVendasBar(e, 'Não foi possível ler o relatório.')
  } finally {
    lendo.value = false
  }
}

async function aoEscolherArquivo(evento: Event) {
  const alvo = evento.target as HTMLInputElement
  const arquivo = alvo.files?.[0]
  alvo.value = ''
  if (!arquivo) return
  if (arquivo.size > 15 * 1024 * 1024) {
    erroLeitura.value = 'O arquivo é grande demais.'
    return
  }
  lendo.value = true
  erroLeitura.value = ''
  previa.value = null
  try {
    // O relatorio traz o visual (CSS) inteiro embutido: tira antes de enviar.
    const html = (await arquivo.text()).replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    if (!eventos.value.length) await carregarEventos()
    aoLer(await lerRelatorioBar({ html }))
  } catch (e) {
    erroLeitura.value = mensagemErroVendasBar(e, 'Não foi possível ler o arquivo.')
  } finally {
    lendo.value = false
  }
}

const periodoTexto = (de: string, ate: string) =>
  de === ate ? formatarDataCurta(de) : `${formatarDataCurta(de)} até ${formatarDataCurta(ate)}`

const jaImportado = computed(
  () => !!previa.value && vendas.value.some((v) => v.de === previa.value!.de && v.ate === previa.value!.ate)
)

const verTodosPrevia = ref(false)
const produtosPrevia = computed(() =>
  previa.value ? (verTodosPrevia.value ? previa.value.produtos : previa.value.produtos.slice(0, 10)) : []
)

const salvando = ref(false)
async function salvar() {
  if (!previa.value) return
  salvando.value = true
  try {
    await salvarVendaBar({ previa: previa.value, eventoId: eventoId.value || null })
    toast.success('Vendas do bar salvas.')
    previa.value = null
    link.value = ''
    verTodosPrevia.value = false
    await carregar()
    if (semLigacao.value > 0) modalVinculos.value = true
  } catch (e) {
    toast.error(mensagemErroVendasBar(e, 'Não foi possível salvar.'))
  } finally {
    salvando.value = false
  }
}

// --- Historico -------------------------------------------------------------
const aberta = ref<string | null>(null)
const excluindo = ref<VendaBar | null>(null)
const excluindoCarregando = ref(false)

async function confirmarExclusao() {
  if (!excluindo.value) return
  excluindoCarregando.value = true
  try {
    await excluirVendaBar(excluindo.value.id)
    toast.success('Relatório excluído.')
    excluindo.value = null
    await carregar()
  } catch (e) {
    toast.error(mensagemErroVendasBar(e, 'Não foi possível excluir.'))
  } finally {
    excluindoCarregando.value = false
  }
}

// --- Ligar produtos --------------------------------------------------------
const modalVinculos = ref(false)
</script>

<template>
  <div class="space-y-4">
    <!-- Importar -->
    <div class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div>
        <p class="text-sm font-semibold text-zinc-100">Importar relatório do bar</p>
        <p class="text-xs text-zinc-500">
          Use o "Resumo de vendas" do sistema do bar, um por noite (do dia do evento até o dia seguinte). Ele mostra o
          que saiu de cada produto. Não mexe no caixa: o dinheiro continua no Fechar bar.
        </p>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row">
        <div class="relative flex-1">
          <LinkIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            v-model="link"
            type="url"
            inputmode="url"
            placeholder="Cole aqui o link do relatório"
            class="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2.5 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
            @keydown.enter.prevent="lerLink"
          />
        </div>
        <AppButton variant="primary" :disabled="lendo" @click="lerLink">
          {{ lendo ? 'Lendo...' : 'Ler relatório' }}
        </AppButton>
      </div>
      <div class="flex items-center gap-2 text-xs text-zinc-500">
        ou
        <input ref="inputArquivo" type="file" accept=".html,.htm,text/html" class="hidden" @change="aoEscolherArquivo" />
        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-1 text-amber-400 hover:underline disabled:opacity-50"
          :disabled="lendo"
          @click="inputArquivo?.click()"
        >
          <ArrowUpTrayIcon class="h-3.5 w-3.5" /> enviar o arquivo do relatório
        </button>
      </div>
      <p v-if="erroLeitura" class="text-sm text-red-400">{{ erroLeitura }}</p>
    </div>

    <!-- Previa -->
    <div v-if="previa" class="space-y-4 rounded-xl border border-amber-400/40 bg-zinc-900 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-wide text-zinc-500">Prévia · {{ periodoTexto(previa.de, previa.ate) }}</p>
          <p class="text-2xl font-bold text-white">{{ formatMoeda(previa.totalValor) }}</p>
          <p class="text-xs text-zinc-400">
            {{ formatarQuantidade(previa.totalQuantidade) }} itens · {{ previa.produtos.length }} produtos
          </p>
        </div>
        <span
          class="rounded-full px-2.5 py-1 text-xs"
          :class="previa.conferido ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'"
        >
          {{ previa.conferido ? 'Soma confere com o relatório' : 'Confira: a soma não bateu com o total do relatório' }}
        </span>
      </div>

      <p v-if="jaImportado" class="rounded-lg border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-300">
        Esse período já foi importado. Para trocar, exclua o antigo no histórico abaixo.
      </p>

      <FormField label="Evento da noite">
        <BaseSelect v-model="eventoId" :options="eventoOptions" />
      </FormField>

      <div class="flex flex-wrap gap-2">
        <span
          v-for="g in previa.grupos"
          :key="g.grupo"
          class="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-300"
        >
          {{ g.grupo }}: <span class="font-semibold text-white">{{ formatMoeda(g.valor) }}</span>
          <span class="text-zinc-500"> · {{ formatarQuantidade(g.quantidade) }}</span>
        </span>
      </div>

      <ul class="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        <li v-for="p in produtosPrevia" :key="p.codigo" class="flex items-center gap-3 px-3 py-2 text-sm">
          <span class="min-w-0 flex-1 truncate text-zinc-100">{{ p.descricao }}</span>
          <span class="shrink-0 text-zinc-400">{{ formatarQuantidade(p.quantidade) }}</span>
          <span class="w-24 shrink-0 text-right text-zinc-300">{{ formatMoeda(p.valor) }}</span>
        </li>
      </ul>
      <button
        v-if="previa.produtos.length > 10"
        type="button"
        class="cursor-pointer text-xs text-amber-400 hover:underline"
        @click="verTodosPrevia = !verTodosPrevia"
      >
        {{ verTodosPrevia ? 'Mostrar menos' : `Ver todos os ${previa.produtos.length} produtos` }}
      </button>

      <div class="flex justify-end gap-2">
        <AppButton variant="ghost" :disabled="salvando" @click="previa = null">Cancelar</AppButton>
        <AppButton variant="primary" :disabled="salvando || jaImportado" @click="salvar">
          <DocumentArrowDownIcon class="h-4 w-4" />
          {{ salvando ? 'Salvando...' : 'Salvar vendas da noite' }}
        </AppButton>
      </div>
    </div>

    <!-- Ligar produtos -->
    <div
      v-if="!carregando && vendas.length"
      class="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="text-sm font-semibold text-zinc-100">Ligar produtos do bar à Reposição</p>
        <p class="text-xs text-zinc-500">
          <template v-if="semLigacao > 0">
            {{ semLigacao === 1 ? '1 produto do bar ainda não está ligado.' : `${semLigacao} produtos do bar ainda não estão ligados.` }}
          </template>
          Com a ligação, a Reposição mostra quanto saiu por semana de cada produto.
        </p>
      </div>
      <AppButton variant="outline" size="sm" @click="modalVinculos = true">Ligar produtos</AppButton>
    </div>

    <!-- Historico -->
    <p v-if="erro" class="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">{{ erro }}</p>

    <div v-if="carregando && !vendas.length" class="flex items-center gap-3 p-6 text-sm text-zinc-400">
      <span class="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" aria-hidden="true" />
      Carregando...
    </div>
    <p
      v-else-if="!vendas.length && !erro"
      class="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-400"
    >
      Nenhum relatório do bar importado ainda.
    </p>

    <div v-else-if="vendas.length" class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <p class="border-b border-zinc-800 bg-zinc-950/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Noites importadas
      </p>
      <ul class="divide-y divide-zinc-800">
        <li v-for="v in vendas" :key="v.id">
          <div class="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
              @click="aberta = aberta === v.id ? null : v.id"
            >
              <ChevronDownIcon class="h-4 w-4 shrink-0 text-zinc-500 transition-transform" :class="aberta === v.id ? 'rotate-180' : ''" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-zinc-100">{{ v.eventoNome ?? 'Sem evento' }}</p>
                <p class="text-xs text-zinc-500">
                  {{ periodoTexto(v.de, v.ate) }} · {{ formatarQuantidade(v.totalQuantidade) }} itens
                </p>
              </div>
              <span class="shrink-0 text-sm font-semibold text-white">{{ formatMoeda(v.totalValor) }}</span>
            </button>
            <button
              type="button"
              class="shrink-0 cursor-pointer rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
              :aria-label="`Excluir relatório de ${periodoTexto(v.de, v.ate)}`"
              @click="excluindo = v"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
          <ul v-if="aberta === v.id" class="divide-y divide-zinc-800/70 border-t border-zinc-800 bg-zinc-950/40">
            <li v-for="p in v.itens" :key="p.codigo" class="flex items-center gap-3 px-4 py-2 text-sm">
              <span class="min-w-0 flex-1 truncate text-zinc-200">
                {{ p.descricao }} <span v-if="p.grupo" class="text-xs text-zinc-500">· {{ p.grupo }}</span>
              </span>
              <span class="shrink-0 text-zinc-400">{{ formatarQuantidade(p.quantidade) }}</span>
              <span class="w-24 shrink-0 text-right text-zinc-300">{{ formatMoeda(p.valor) }}</span>
            </li>
          </ul>
        </li>
      </ul>
    </div>

    <ConfirmDialog
      :open="!!excluindo"
      title="Excluir relatório?"
      :description="`As vendas do bar de ${excluindo ? periodoTexto(excluindo.de, excluindo.ate) : ''} saem do histórico e do consumo da Reposição. Você pode importar de novo depois.`"
      confirm-label="Excluir"
      tone="danger"
      :loading="excluindoCarregando"
      @confirm="confirmarExclusao"
      @cancel="excluindo = null"
    />

    <VinculosBarModal :open="modalVinculos" @close="modalVinculos = false" @salvou="carregar" />
  </div>
</template>
