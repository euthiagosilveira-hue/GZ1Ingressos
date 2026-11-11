<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue3-toastify'
import { PencilSquareIcon, PlusIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import FormField from '~/components/FormField.vue'
import PageHeader from '~/components/PageHeader.vue'
import FinanceiroAbas from '~/components/financeiro/caixa/FinanceiroAbas.vue'
import SaldoInicialModal from '~/components/financeiro/caixa/SaldoInicialModal.vue'
import { useCaixaBase } from '~/composables/useCaixaBase'
import {
  definirSaldoInicialConta,
  salvarCategoriaCaixa,
  salvarContaCaixa
} from '~/services/admin/caixa'
import type { CategoriaCaixa, ContaCaixa, TipoCategoria, TipoConta } from '~/types/caixa'
import type { SelectOption } from '~/types/ui'
import { TIPOS_CONTA, mensagemErroCaixa, rotuloTipoConta } from '~/utils/caixa'
import { formatDataHora, formatMoeda } from '~/utils/format'

const { contas, categorias, erroBase, carregarBase, carregarContas, carregarCategorias } = useCaixaBase()

onMounted(carregarBase)

const categoriasEntrada = computed(() => categorias.value.filter((c) => c.tipo === 'ENTRADA'))
const categoriasSaida = computed(() => categorias.value.filter((c) => c.tipo === 'SAIDA'))

const tipoContaOptions: SelectOption[] = TIPOS_CONTA.map((t) => ({ value: t.value, label: t.label }))
const tipoCategoriaOptions: SelectOption[] = [
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'SAIDA', label: 'Saída' }
]
const ativaOptions: SelectOption[] = [
  { value: 'true', label: 'Ativa' },
  { value: 'false', label: 'Inativa (esconde dos formulários)' }
]

// --- Conta ----------------------------------------------------------------
const modalConta = ref(false)
const formConta = reactive({ id: null as string | null, nome: '', tipo: 'BANCO' as TipoConta, ativa: 'true' })
const erroConta = ref('')
const salvandoConta = ref(false)

function abrirConta(conta: ContaCaixa | null) {
  formConta.id = conta?.id ?? null
  formConta.nome = conta?.nome ?? ''
  formConta.tipo = conta?.tipo ?? 'BANCO'
  formConta.ativa = conta && !conta.ativa ? 'false' : 'true'
  erroConta.value = ''
  modalConta.value = true
}

async function salvarConta() {
  if (!formConta.nome.trim()) {
    erroConta.value = 'Informe o nome.'
    return
  }
  salvandoConta.value = true
  try {
    await salvarContaCaixa({
      id: formConta.id,
      nome: formConta.nome,
      tipo: formConta.tipo,
      ativa: formConta.ativa === 'true'
    })
    toast.success('Conta salva.')
    modalConta.value = false
    await carregarContas()
  } catch (e) {
    toast.error(mensagemErroCaixa(e))
  } finally {
    salvandoConta.value = false
  }
}

// --- Saldo ----------------------------------------------------------------
const contaSaldo = ref<ContaCaixa | null>(null)
const salvandoSaldo = ref(false)

async function salvarSaldo(valor: number) {
  if (!contaSaldo.value) return
  salvandoSaldo.value = true
  try {
    await definirSaldoInicialConta(contaSaldo.value.id, valor)
    toast.success('Saldo salvo.')
    contaSaldo.value = null
    await carregarContas()
  } catch (e) {
    toast.error(mensagemErroCaixa(e))
  } finally {
    salvandoSaldo.value = false
  }
}

// --- Categoria ------------------------------------------------------------
const modalCategoria = ref(false)
const formCategoria = reactive({
  id: null as string | null,
  nome: '',
  tipo: 'SAIDA' as TipoCategoria,
  ativa: 'true',
  sistema: false
})
const erroCategoria = ref('')
const salvandoCategoria = ref(false)

function abrirCategoria(categoria: CategoriaCaixa | null, tipo: TipoCategoria = 'SAIDA') {
  formCategoria.id = categoria?.id ?? null
  formCategoria.nome = categoria?.nome ?? ''
  formCategoria.tipo = categoria?.tipo ?? tipo
  formCategoria.ativa = categoria && !categoria.ativa ? 'false' : 'true'
  formCategoria.sistema = !!categoria?.chaveSistema
  erroCategoria.value = ''
  modalCategoria.value = true
}

async function salvarCategoria() {
  if (!formCategoria.nome.trim()) {
    erroCategoria.value = 'Informe o nome.'
    return
  }
  salvandoCategoria.value = true
  try {
    await salvarCategoriaCaixa({
      id: formCategoria.id,
      nome: formCategoria.nome,
      tipo: formCategoria.tipo,
      ativa: formCategoria.ativa === 'true'
    })
    toast.success('Categoria salva.')
    modalCategoria.value = false
    await carregarCategorias()
  } catch (e) {
    toast.error(mensagemErroCaixa(e))
  } finally {
    salvandoCategoria.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Financeiro" subtitle="Onde o dinheiro fica (contas) e como ele é classificado (categorias)." />

    <FinanceiroAbas />

    <p v-if="erroBase" class="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">
      {{ erroBase }}
    </p>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold text-white">Contas</h2>
        <AppButton variant="outline" size="sm" @click="abrirConta(null)"><PlusIcon class="h-4 w-4" /> Nova conta</AppButton>
      </div>
      <ul class="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <li v-for="c in contas" :key="c.id" class="flex flex-wrap items-center gap-3 p-4" :class="c.ativa ? '' : 'opacity-60'">
          <div class="min-w-0 flex-1">
            <p class="font-medium text-zinc-100">
              {{ c.nome }}
              <span v-if="!c.ativa" class="ml-1 text-xs text-zinc-500">(inativa)</span>
            </p>
            <p class="text-xs text-zinc-500">
              {{ rotuloTipoConta(c.tipo) }}
              <template v-if="c.provedorIngressos"> · recebe as vendas de ingresso {{ c.provedorIngressos === 'DINHEIRO' ? 'em dinheiro' : c.provedorIngressos === 'MERCADO_PAGO' ? 'pelo Pix online' : 'da Stone' }}</template>
            </p>
            <p class="text-xs text-zinc-500">
              <template v-if="c.configurada">
                Saldo inicial {{ formatMoeda(c.saldoInicial) }} em {{ formatDataHora(c.saldoInicialEm ?? '') }}
              </template>
              <template v-else>Saldo inicial ainda não informado</template>
            </p>
          </div>
          <p v-if="c.configurada" class="text-right font-semibold text-white">{{ formatMoeda(c.saldoAtual) }}</p>
          <div class="flex gap-2">
            <AppButton variant="ghost" size="sm" @click="contaSaldo = c">
              {{ c.configurada ? 'Refazer saldo' : 'Informar saldo' }}
            </AppButton>
            <button
              type="button"
              title="Editar conta"
              class="cursor-pointer rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400"
              @click="abrirConta(c)"
            >
              <PencilSquareIcon class="h-4 w-4" />
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section class="grid gap-6 lg:grid-cols-2">
      <div v-for="grupo in [{ tipo: 'ENTRADA' as const, titulo: 'Categorias de entrada', lista: categoriasEntrada }, { tipo: 'SAIDA' as const, titulo: 'Categorias de saída', lista: categoriasSaida }]" :key="grupo.tipo" class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-white">{{ grupo.titulo }}</h2>
          <AppButton variant="outline" size="sm" @click="abrirCategoria(null, grupo.tipo)"><PlusIcon class="h-4 w-4" /> Nova</AppButton>
        </div>
        <ul class="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          <li v-for="cat in grupo.lista" :key="cat.id" class="flex items-center gap-3 px-4 py-2.5" :class="cat.ativa ? '' : 'opacity-60'">
            <p class="min-w-0 flex-1 truncate text-sm text-zinc-200">
              {{ cat.nome }}
              <span v-if="cat.chaveSistema === 'INGRESSOS' || cat.chaveSistema === 'REEMBOLSO_INGRESSO'" class="ml-1 text-xs text-zinc-500">(automática)</span>
              <span v-if="!cat.ativa" class="ml-1 text-xs text-zinc-500">(inativa)</span>
            </p>
            <button
              type="button"
              title="Editar categoria"
              class="cursor-pointer rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400"
              @click="abrirCategoria(cat)"
            >
              <PencilSquareIcon class="h-4 w-4" />
            </button>
          </li>
        </ul>
      </div>
    </section>

    <BaseModal :open="modalConta" :title="formConta.id ? 'Editar conta' : 'Nova conta'" @close="modalConta = false">
      <div class="space-y-4">
        <FormField label="Nome" required :error="erroConta">
          <BaseInput v-model="formConta.nome" placeholder="Ex.: Itaú, Caixa do bar" :invalid="!!erroConta" />
        </FormField>
        <FormField label="Tipo">
          <BaseSelect v-model="formConta.tipo" :options="tipoContaOptions" />
        </FormField>
        <FormField label="Situação">
          <BaseSelect v-model="formConta.ativa" :options="ativaOptions" />
        </FormField>
      </div>
      <template #footer>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AppButton variant="ghost" :disabled="salvandoConta" @click="modalConta = false">Cancelar</AppButton>
          <AppButton variant="primary" :disabled="salvandoConta" @click="salvarConta">
            {{ salvandoConta ? 'Salvando...' : 'Salvar' }}
          </AppButton>
        </div>
      </template>
    </BaseModal>

    <BaseModal :open="modalCategoria" :title="formCategoria.id ? 'Editar categoria' : 'Nova categoria'" @close="modalCategoria = false">
      <div class="space-y-4">
        <FormField label="Nome" required :error="erroCategoria">
          <BaseInput v-model="formCategoria.nome" placeholder="Ex.: Manutenção" :invalid="!!erroCategoria" />
        </FormField>
        <template v-if="!formCategoria.sistema">
          <FormField label="Tipo">
            <BaseSelect v-model="formCategoria.tipo" :options="tipoCategoriaOptions" />
          </FormField>
          <FormField label="Situação">
            <BaseSelect v-model="formCategoria.ativa" :options="ativaOptions" />
          </FormField>
        </template>
        <p v-else class="text-xs text-zinc-500">Esta categoria é usada pelo sistema: só o nome pode mudar.</p>
      </div>
      <template #footer>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AppButton variant="ghost" :disabled="salvandoCategoria" @click="modalCategoria = false">Cancelar</AppButton>
          <AppButton variant="primary" :disabled="salvandoCategoria" @click="salvarCategoria">
            {{ salvandoCategoria ? 'Salvando...' : 'Salvar' }}
          </AppButton>
        </div>
      </template>
    </BaseModal>

    <SaldoInicialModal
      :open="!!contaSaldo"
      :conta="contaSaldo"
      :salvando="salvandoSaldo"
      @close="contaSaldo = null"
      @submit="salvarSaldo"
    />
  </div>
</template>
