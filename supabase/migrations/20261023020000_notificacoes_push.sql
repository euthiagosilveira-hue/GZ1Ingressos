-- =============================================================================
-- GZ1 Ingresso - Notificacoes push de venda
-- Migration: notificacoes_push
--
-- Guarda as inscricoes Web Push (um registro por aparelho/navegador) dos
-- usuarios do administrativo. Quando um pagamento online e confirmado, o
-- backend envia uma notificacao "Nova venda" para todas as inscricoes de
-- usuarios ADMINISTRADOR ativos.
--
-- Acesso somente pelo backend (service_role): RLS ligado e sem policies.
-- =============================================================================

create table if not exists public.push_inscricoes (
  id uuid
    constraint pk_push_inscricoes primary key default gen_random_uuid(),
  usuario_id uuid not null
    constraint fk_push_inscricoes_usuario references public.usuarios (id) on delete cascade,
  endpoint text not null
    constraint uq_push_inscricoes_endpoint unique,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_push_inscricoes_usuario on public.push_inscricoes (usuario_id);

alter table public.push_inscricoes enable row level security;

revoke all on table public.push_inscricoes from public, anon, authenticated;
grant all on table public.push_inscricoes to service_role;

comment on table public.push_inscricoes is
  'Inscricoes Web Push dos usuarios do administrativo (notificacoes de venda). Somente service_role.';
