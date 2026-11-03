<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue3-toastify'

import AppButton from '~/components/AppButton.vue'
import BaseCard from '~/components/BaseCard.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import FormField from '~/components/FormField.vue'
import SegmentedControl from '~/components/SegmentedControl.vue'
import SociedadeDivisao from '~/components/sociedade/SociedadeDivisao.vue'
import {
  criarAcessoProdutorAdmin,
  definirSociedadeEventoAdmin,
  listarProdutoresAdmin,
  obterSociedadeEventoAdmin,
  salvarProdutorAdmin
} from '~/services/admin/sociedade'
import type { Produtor, SociedadeEvento } from '~/types/sociedade'
import type { SelectOption } from '~/types/ui'

const props = defineProps<{
  eventoId?: string | null
}>()

const carregando = ref(false)
const erroCarregar = ref('')
const salvando = ref(false)
const confirmarRemocao = ref(false)

const sociedade = ref<SociedadeEvento | null>(null)
const produtores = ref<Produtor[]>([])

// Formulario
const ativa = ref('nao')
const produtorId = ref('')
const percentualGaleria = ref<string>('20')
const erroPercentual = ref('')
const erroProdutor = ref('')

// Novo produtor / editar produtor (mesmo formulario)
const novoAberto = ref(false)
const editandoId = ref<string | null>(null)
const enviandoAcesso = ref(false)
const salvandoProdutor = ref(false)
const novo = reactive({ nome: '', documento: '', telefone: '', email: '' })
const erroNovoNome = ref('')

const opcoesAtiva: SelectOption[] = [
  { value: 'nao', label: 'Não (100% galeria)' },
  { value: 'sim', label: 'Sim, em sociedade' }
]

const opcoesProdutor = computed<SelectOption[]>(() => [
  { value: '', label: 'Selecione o produtor' },
  ...produtores.value
    .filter((p) => p.ativo || p.produtorId === produtorId.value)
    .map((p) => ({ value: p.produtorId, label: p.nome }))
])

const percentualNumero = computed(() => {
  const n = Number(String(percentualGaleria.value).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
})

const percentualProdutorTexto = computed(() => {
  const n = percentualNumero.value
  if (Number.isNaN(n) || n < 0 || n > 100) return '—'
  return `${(100 - n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
})

function preencherFormulario(s: SociedadeEvento) {
  ativa.value = s.ativa ? 'sim' : 'nao'
  produtorId.value = s.produtor?.produtorId ?? ''
  percentualGaleria.value = s.ativa ? String(s.percentualGaleria).replace('.', ',') : '20'
}

async function carregar() {
  if (!props.eventoId) return
  carregando.value = true
  erroCarregar.value = ''
  try {
    const [s, lista] = await Promise.all([
      obterSociedadeEventoAdmin(props.eventoId),
      listarProdutoresAdmin()
    ])
    sociedade.value = s
    produtores.value = lista
    preencherFormulario(s)
  } catch (e) {
    erroCarregar.value = e instanceof Error ? e.message : 'Não foi possível carregar a sociedade.'
  } finally {
    carregando.value = false
  }
}

const produtorSelecionado = computed(
  () => produtores.value.find((p) => p.produtorId === produtorId.value) ?? null
)

// O acesso so e oferecido depois que a sociedade com esse produtor foi salva.
const sociedadeSalvaComSelecionado = computed(
  () =>
    sociedade.value?.ativa === true &&
    sociedade.value.produtor?.produtorId === produtorId.value &&
    ativa.value === 'sim'
)

function abrirNovoProdutor() {
  editandoId.value = null
  novo.nome = ''
  novo.documento = ''
  novo.telefone = ''
  novo.email = ''
  erroNovoNome.value = ''
  novoAberto.value = true
}

function abrirEditarProdutor() {
  const p = produtorSelecionado.value
  if (!p) return
  editandoId.value = p.produtorId
  novo.nome = p.nome
  novo.documento = p.documento ?? ''
  novo.telefone = p.telefone ?? ''
  novo.email = p.email ?? ''
  erroNovoNome.value = ''
  novoAberto.value = true
}

async function enviarAcesso() {
  const p = produtorSelecionado.value
  if (!p) return
  enviandoAcesso.value = true
  try {
    await criarAcessoProdutorAdmin(p.produtorId)
    toast.success(`Convite enviado para ${p.email}.`)
    await carregar()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Não foi possível enviar o convite.')
  } finally {
    enviandoAcesso.value = false
  }
}

async function salvarNovoProdutor() {
  erroNovoNome.value = ''
  if (!novo.nome.trim()) {
    erroNovoNome.value = 'Informe o nome do produtor.'
    return
  }
  salvandoProdutor.value = true
  try {
    const criado = await salvarProdutorAdmin({
      produtorId: editandoId.value,
      nome: novo.nome,
      documento: novo.documento,
      telefone: novo.telefone,
      email: novo.email
    })
    const editando = Boolean(editandoId.value)
    produtores.value = [
      ...produtores.value.filter((p) => p.produtorId !== criado.produtorId),
      criado
    ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    produtorId.value = criado.produtorId
    novoAberto.value = false
    editandoId.value = null
    toast.success(editando ? 'Produtor atualizado.' : 'Produtor cadastrado.')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Não foi possível salvar o produtor.')
  } finally {
    salvandoProdutor.value = false
  }
}

function validar(): boolean {
  erroPercentual.value = ''
  erroProdutor.value = ''
  if (ativa.value !== 'sim') return true
  if (!produtorId.value) erroProdutor.value = 'Selecione o produtor.'
  const n = percentualNumero.value
  if (Number.isNaN(n) || n < 0 || n > 100) {
    erroPercentual.value = 'Informe um número de 0 a 100.'
  } else if (Math.round(n * 100) !== n * 100) {
    erroPercentual.value = 'Use no máximo 2 casas decimais.'
  }
  return !erroPercentual.value && !erroProdutor.value
}

async function salvar() {
  if (!props.eventoId || !validar()) return
  if (ativa.value !== 'sim' && sociedade.value?.ativa) {
    confirmarRemocao.value = true
    return
  }
  await enviar()
}

async function enviar() {
  if (!props.eventoId) return
  salvando.value = true
  try {
    if (ativa.value === 'sim') {
      await definirSociedadeEventoAdmin(props.eventoId, produtorId.value, percentualNumero.value)
      toast.success('Sociedade salva.')
    } else {
      await definirSociedadeEventoAdmin(props.eventoId, null, null)
      toast.success('Sociedade removida. O evento volta a ser 100% da galeria.')
    }
    confirmarRemocao.value = false
    await carregar()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Não foi possível salvar a sociedade.')
  } finally {
    salvando.value = false
  }
}

onMounted(() => void carregar())
</script>

<template>
  <BaseCard class="space-y-5">
    <h2 class="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">
      6. Sociedade
    </h2>

    <p v-if="!props.eventoId" class="text-sm text-zinc-500">
      Salve o evento primeiro para configurar uma sociedade com produtor.
    </p>

    <div v-else-if="carregando" class="h-24 animate-pulse rounded-xl bg-zinc-900" aria-busy="true" />

    <div v-else-if="erroCarregar" role="alert" class="space-y-3">
      <p class="text-sm text-red-300">{{ erroCarregar }}</p>
      <AppButton variant="outline" size="sm" @click="carregar">Tentar novamente</AppButton>
    </div>

    <template v-else>
      <div class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          A venda de ingressos deste evento é dividida com um produtor?
        </p>
        <SegmentedControl v-model="ativa" :options="opcoesAtiva" />
        <p class="text-xs text-zinc-500">A sociedade vale só para os ingressos. O bar é sempre da galeria.</p>
      </div>

      <template v-if="ativa === 'sim'">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Produtor" required :error="erroProdutor">
            <BaseSelect v-model="produtorId" :options="opcoesProdutor" />
            <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <button
                type="button"
                class="text-xs font-semibold uppercase tracking-wide text-amber-400 hover:text-amber-300"
                @click="abrirNovoProdutor"
              >
                + Cadastrar novo produtor
              </button>
              <button
                v-if="produtorSelecionado"
                type="button"
                class="text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-amber-300"
                @click="abrirEditarProdutor"
              >
                Editar produtor
              </button>
            </div>
          </FormField>

          <FormField
            label="Porcentagem da galeria"
            required
            :error="erroPercentual"
            :hint="`O produtor fica com ${percentualProdutorTexto}.`"
          >
            <BaseInput
              v-model="percentualGaleria"
              placeholder="20"
              :invalid="!!erroPercentual"
            />
          </FormField>
        </div>

        <div
          v-if="novoAberto"
          class="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
        >
          <p class="text-sm font-medium text-white">{{ editandoId ? 'Editar produtor' : 'Novo produtor' }}</p>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Nome" required :error="erroNovoNome">
              <BaseInput v-model="novo.nome" :invalid="!!erroNovoNome" />
            </FormField>
            <FormField label="CPF ou CNPJ">
              <BaseInput v-model="novo.documento" />
            </FormField>
            <FormField label="Telefone">
              <BaseInput v-model="novo.telefone" type="tel" />
            </FormField>
            <FormField label="E-mail" hint="É o e-mail que o produtor usa para entrar.">
              <BaseInput v-model="novo.email" type="email" />
            </FormField>
          </div>
          <div class="flex flex-wrap gap-3">
            <AppButton variant="primary" size="sm" :disabled="salvandoProdutor" @click="salvarNovoProdutor">
              Salvar produtor
            </AppButton>
            <AppButton variant="ghost" size="sm" :disabled="salvandoProdutor" @click="novoAberto = false">
              Cancelar
            </AppButton>
          </div>
        </div>
      </template>

      <div
        v-if="sociedadeSalvaComSelecionado && produtorSelecionado"
        class="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
      >
        <p class="text-sm font-medium text-white">Acesso do produtor</p>
        <template v-if="produtorSelecionado.temLogin">
          <p class="text-sm text-green-400">O produtor já tem acesso.</p>
          <p class="text-xs text-zinc-500">
            Ele entra em gz-1-ingressos.vercel.app/login com o e-mail {{ produtorSelecionado.email ?? 'cadastrado' }}
            e vê só os eventos em sociedade dele. Para bloquear, desative o usuário em Configurações › Usuários.
          </p>
        </template>
        <template v-else>
          <p class="text-xs text-zinc-500">
            O produtor recebe um e-mail para criar a senha. Depois ele vê só as vendas, a divisão, a lista
            de pagantes (sem telefone) e a lista VIP dos eventos em que estiver incluído.
          </p>
          <p v-if="!produtorSelecionado.email" class="text-xs text-amber-300">
            Cadastre o e-mail do produtor (Editar produtor) para enviar o convite.
          </p>
          <AppButton
            variant="outline"
            size="sm"
            :disabled="enviandoAcesso || !produtorSelecionado.email"
            @click="enviarAcesso"
          >
            {{ enviandoAcesso ? 'Enviando...' : 'Enviar convite de acesso' }}
          </AppButton>
        </template>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <AppButton variant="outlineAccent" :disabled="salvando" @click="salvar">
          Salvar sociedade
        </AppButton>
        <span class="text-xs text-zinc-500">Este bloco é salvo separado do restante do evento.</span>
      </div>

      <div v-if="sociedade?.ativa" class="space-y-3 border-t border-zinc-800 pt-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Divisão até agora</p>
        <SociedadeDivisao :sociedade="sociedade" />
      </div>
    </template>

    <ConfirmDialog
      :open="confirmarRemocao"
      title="Desfazer a sociedade?"
      description="O evento volta a ser 100% da galeria. Você pode configurar a sociedade de novo depois."
      confirm-label="Desfazer sociedade"
      tone="danger"
      :loading="salvando"
      @confirm="enviar"
      @cancel="confirmarRemocao = false"
    />
  </BaseCard>
</template>
