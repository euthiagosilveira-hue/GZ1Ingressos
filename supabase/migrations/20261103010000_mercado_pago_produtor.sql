-- =============================================================================
-- GZ1 Ingresso - Pix direto para o produtor (marketplace Mercado Pago) - etapa 3
-- Migration: mercado_pago_produtor
--
-- Nos eventos em sociedade o Pix e criado com a conta Mercado Pago do
-- produtor (conectada por OAuth) e a % da galeria vai como comissao
-- (application_fee) para a conta da galeria. Eventos normais nao mudam.
--
--   * public.produtores_mercado_pago: conexao OAuth de cada produtor.
--     Tokens SEMPRE cifrados pelo servidor (AES-256-GCM, MERCADO_PAGO_TOKEN_KEY).
--     Somente service_role (nenhum acesso por RPC/cliente).
--   * public.pagamentos.produtor_recebedor_id / comissao_galeria: registram,
--     por pagamento, em qual conta o Pix foi criado e a comissao enviada.
--     Vazio = Pix normal na conta da galeria (todos os pagamentos atuais).
--   * private.produtor_json passa a informar mp_conectado (tela de sociedade).
--   * public.status_mercado_pago_produtor(): o produtor logado ve se a conta
--     dele esta conectada (sem tokens).
-- =============================================================================

create table if not exists public.produtores_mercado_pago (
  produtor_id uuid
    constraint pk_produtores_mercado_pago primary key
    constraint fk_produtores_mercado_pago_produtor references public.produtores (id) on delete cascade,
  mp_user_id text not null,
  access_token_cifrado text not null,
  refresh_token_cifrado text null,
  public_key text null,
  live_mode boolean not null default false,
  expira_em timestamptz null,
  conectado_por_usuario_id uuid null
    constraint fk_produtores_mercado_pago_usuario references public.usuarios (id) on delete set null,
  conectado_em timestamptz not null default now()
);

comment on table public.produtores_mercado_pago is
  'Conta Mercado Pago (OAuth) de cada produtor. Tokens cifrados; acesso somente service_role.';

alter table public.produtores_mercado_pago enable row level security;
revoke all on table public.produtores_mercado_pago from public, anon, authenticated;
grant all on table public.produtores_mercado_pago to service_role;

alter table public.pagamentos
  add column if not exists produtor_recebedor_id uuid null
    constraint fk_pagamentos_produtor_recebedor references public.produtores (id) on delete restrict,
  add column if not exists comissao_galeria numeric(10, 2) null;

comment on column public.pagamentos.produtor_recebedor_id is
  'Pix criado na conta Mercado Pago deste produtor (evento em sociedade). Nulo = conta da galeria.';
comment on column public.pagamentos.comissao_galeria is
  'Comissao da galeria (application_fee) enviada ao Mercado Pago neste Pix.';

-- -----------------------------------------------------------------------------
-- produtor_json: + mp_conectado
-- -----------------------------------------------------------------------------
create or replace function private.produtor_json(p_produtor public.produtores)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'produtor_id', p_produtor.id,
    'nome', p_produtor.nome,
    'documento', p_produtor.documento,
    'telefone', p_produtor.telefone,
    'email', p_produtor.email,
    'ativo', p_produtor.ativo,
    'tem_login', p_produtor.usuario_id is not null,
    'mp_conectado', exists (
      select 1 from public.produtores_mercado_pago m where m.produtor_id = p_produtor.id
    )
  );
$$;

revoke all on function private.produtor_json(public.produtores) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Status da conexao para o produtor logado
-- -----------------------------------------------------------------------------
create or replace function public.status_mercado_pago_produtor()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_produtor uuid := private.produtor_atual_id();
  v_conexao public.produtores_mercado_pago%rowtype;
begin
  if v_produtor is null then
    raise exception 'Permissao negada: apenas PRODUTOR' using errcode = '42501';
  end if;

  select * into v_conexao from public.produtores_mercado_pago m where m.produtor_id = v_produtor;
  if not found then
    return jsonb_build_object('conectado', false);
  end if;

  return jsonb_build_object(
    'conectado', true,
    'conectado_em', v_conexao.conectado_em,
    'live_mode', v_conexao.live_mode
  );
end;
$$;

revoke execute on function public.status_mercado_pago_produtor() from public, anon, authenticated, service_role;
grant execute on function public.status_mercado_pago_produtor() to authenticated, service_role;

comment on function public.status_mercado_pago_produtor() is
  'Se a conta Mercado Pago do produtor logado esta conectada (PRODUTOR). Nunca devolve tokens.';
