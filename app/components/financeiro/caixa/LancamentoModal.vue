<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { PaperClipIcon, TrashIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import BaseTextarea from '~/components/BaseTextarea.vue'
import FormField from '~/components/FormField.vue'
import SegmentedControl from '~/components/SegmentedControl.vue'
import { enviarComprovante, linkComprovante } from '~/services/admin/caixa'
import type {
  CategoriaCaixa,
  LancamentoCaixa,
  LancamentoInput,
  TipoLancamento
} from '~/types/caixa'
import type { SelectOption } from '~/types/ui'
import {
  type ErrosLancamento,
  type FormLancamento,
  hojeIso,
  lerValorReais,
  validarLancamento
} from '~/utils/caixa'

const props = defineProps<{
  open: boolean
  /** Lancamento a editar (null = novo). */
  lancamento: LancamentoCaixa | null
  tipoInicial?: TipoLancamento
  eventoInicial?: string | null
  categorias: CategoriaCaixa[]
  contaOptions: SelectOption[]
  eventoOptions: SelectOption[]
  salvando?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [input: LancamentoInput]
}>()

const tipoOptions: SelectOption[] = [
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'SAIDA', label: 'Saída' },
  { value: 'TRANSFERENCIA', label: 'Transferência' }
]

const form = reactive<FormLancamento>({
  tipo: 'SAIDA',
  data: hojeIso(),
  valor: '',
  descricao: '',
  categoriaId: '',
  contaId: '',
  contaDestinoId: '',
  eventoId: ''
})
const comprovante = ref<string | null>(null)
const erros = ref<ErrosLancamento>({})
const enviandoArquivo = ref(false)
const erroArquivo = ref('')
const inputArquivo = ref<HTMLInputElement | null>(null)

const editando = computed(() => !!props.lancamento)

const categoriaOptions = computed<SelectOption[]>(() => [
  { value: '', label: 'Escolha a categoria' },
  ...props.categorias
    .filter(
      (c) =>
        c.tipo === form.tipo &&
        c.chaveSistema !== 'INGRESSOS' &&
        c.chaveSistema !== 'REEMBOLSO_INGRESSO' &&
        (c.ativa || c.id === form.categoriaId)
    )
    .map((c) => ({ value: c.id, label: c.ativa ? c.nome : `${c.nome} (inativa)` }))
])

const contaOptionsComVazio = computed<SelectOption[]>(() => [
  { value: '', label: 'Escolha a conta' },
  ...props.contaOptions
])

const titulo = computed(() => {
  if (editando.value) return 'Editar lançamento'
  if (form.tipo === 'ENTRADA') return 'Nova entrada'
  if (form.tipo === 'SAIDA') return 'Nova saída'
  return 'Transferência entre contas'
})

watch(
  () => props.open,
  (aberto) => {
    if (!aberto) return
    const l = props.lancamento
    form.tipo = l?.tipo ?? props.tipoInicial ?? 'SAIDA'
    form.data = l?.data ?? hojeIso()
    form.valor = l ? l.valor.toFixed(2).replace('.', ',') : ''
    form.descricao = l?.descricao ?? ''
    form.categoriaId = l?.categoriaId ?? ''
    form.contaId = l?.contaId ?? (props.contaOptions.length === 1 ? props.contaOptions[0]!.value : '')
    form.contaDestinoId = l?.contaDestinoId ?? ''
    form.eventoId = l?.eventoId ?? props.eventoInicial ?? ''
    comprovante.value = l?.comprovantePath ?? null
    erros.value = {}
    erroArquivo.value = ''
  }
)

// Trocar entre entrada/saida limpa a categoria (as listas sao diferentes).
watch(
  () => form.tipo,
  (novo, antigo) => {
    if (antigo && novo !== antigo && !props.categorias.some((c) => c.id === form.categoriaId && c.tipo === novo)) {
      form.categoriaId = ''
    }
  }
)

function escolherArquivo() {
  inputArquivo.value?.click()
}

async function aoEscolherArquivo(evento: Event) {
  const alvo = evento.target as HTMLInputElement
  const arquivo = alvo.files?.[0]
  alvo.value = ''
  if (!arquivo) return
  if (arquivo.size > 10 * 1024 * 1024) {
    erroArquivo.value = 'O arquivo deve ter no máximo 10 MB.'
    return
  }
  erroArquivo.value = ''
  enviandoArquivo.value = true
  try {
    comprovante.value = await enviarComprovante(arquivo)
  } catch {
    erroArquivo.value = 'Não foi possível enviar o comprovante. Use foto (JPG/PNG) ou PDF.'
  } finally {
    enviandoArquivo.value = false
  }
}

async function verComprovante() {
  if (!comprovante.value) return
  try {
    window.open(await linkComprovante(comprovante.value), '_blank', 'noopener')
  } catch {
    erroArquivo.value = 'Não foi possível abrir o comprovante.'
  }
}

function enviar() {
  erros.value = validarLancamento(form)
  if (Object.keys(erros.value).length > 0) return
  emit('submit', {
    id: props.lancamento?.lancamentoId ?? null,
    tipo: form.tipo,
    data: form.data,
    valor: lerValorReais(form.valor) ?? 0,
    descricao: form.descricao,
    categoriaId: form.tipo === 'TRANSFERENCIA' ? null : form.categoriaId || null,
    contaId: form.contaId,
    contaDestinoId: form.tipo === 'TRANSFERENCIA' ? form.contaDestinoId || null : null,
    eventoId: form.eventoId || null,
    comprovantePath: comprovante.value
  })
}
</script>

<template>
  <BaseModal :open="props.open" :title="titulo" @close="emit('close')">
    <div class="space-y-4">
      <SegmentedControl v-model="form.tipo" :options="tipoOptions" />

      <p v-if="form.tipo === 'TRANSFERENCIA'" class="text-xs text-zinc-500">
        Use para mover dinheiro de uma conta para outra (ex.: depositar o dinheiro do caixa no
        Itaú). Não conta como entrada nem como saída.
      </p>

      <div class="grid grid-cols-2 gap-3">
        <FormField label="Data" required :error="erros.data">
          <BaseInput v-model="form.data" type="date" :invalid="!!erros.data" />
        </FormField>
        <FormField label="Valor" required :error="erros.valor">
          <BaseInput v-model="form.valor" prefix="R$" placeholder="0,00" :invalid="!!erros.valor" />
        </FormField>
      </div>

      <FormField v-if="form.tipo !== 'TRANSFERENCIA'" label="Categoria" required :error="erros.categoriaId">
        <BaseSelect v-model="form.categoriaId" :options="categoriaOptions" />
      </FormField>

      <div class="grid gap-3" :class="form.tipo === 'TRANSFERENCIA' ? 'grid-cols-2' : ''">
        <FormField
          :label="form.tipo === 'TRANSFERENCIA' ? 'Sai de' : form.tipo === 'ENTRADA' ? 'Entrou em' : 'Saiu de'"
          required
          :error="erros.contaId"
        >
          <BaseSelect v-model="form.contaId" :options="contaOptionsComVazio" />
        </FormField>
        <FormField v-if="form.tipo === 'TRANSFERENCIA'" label="Vai para" required :error="erros.contaDestinoId">
          <BaseSelect v-model="form.contaDestinoId" :options="contaOptionsComVazio" />
        </FormField>
      </div>

      <FormField label="Descrição" hint="Ex.: Conta de luz de outubro, cachê da banda X.">
        <BaseTextarea v-model="form.descricao" :rows="2" placeholder="Opcional" />
      </FormField>

      <FormField label="Evento" hint="Ligue ao evento para ver depois quanto cada noite custou e rendeu.">
        <BaseSelect v-model="form.eventoId" :options="props.eventoOptions" />
      </FormField>

      <FormField label="Comprovante" :error="erroArquivo">
        <input
          ref="inputArquivo"
          type="file"
          accept="image/*,application/pdf"
          class="hidden"
          @change="aoEscolherArquivo"
        />
        <div v-if="comprovante" class="flex items-center gap-2">
          <button
            type="button"
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-sm text-amber-400 hover:bg-zinc-800"
            @click="verComprovante"
          >
            <PaperClipIcon class="h-4 w-4 shrink-0" />
            <span class="truncate">Ver comprovante anexado</span>
          </button>
          <button
            type="button"
            aria-label="Remover comprovante"
            class="cursor-pointer rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
            @click="comprovante = null"
          >
            <TrashIcon class="h-5 w-5" />
          </button>
        </div>
        <AppButton v-else variant="ghost" size="sm" :disabled="enviandoArquivo" @click="escolherArquivo">
          <PaperClipIcon class="h-4 w-4" />
          {{ enviandoArquivo ? 'Enviando...' : 'Anexar foto ou PDF (opcional)' }}
        </AppButton>
      </FormField>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AppButton variant="ghost" :disabled="props.salvando" @click="emit('close')">Cancelar</AppButton>
        <AppButton variant="primary" :disabled="props.salvando || enviandoArquivo" @click="enviar">
          {{ props.salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Lançar' }}
        </AppButton>
      </div>
    </template>
  </BaseModal>
</template>
