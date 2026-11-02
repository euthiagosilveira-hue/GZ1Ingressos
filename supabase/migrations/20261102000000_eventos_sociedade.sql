-- =============================================================================
-- GZ1 Ingresso - Eventos em sociedade com produtor (etapa 1)
-- Migration: eventos_sociedade
--
-- Alguns eventos tem a venda de ingressos dividida entre a galeria e um
-- produtor (ex.: galeria 20% / produtor 80%). A porcentagem e livre por evento.
--
--   * public.produtores: cadastro dos produtores (nome, documento, contato).
--     usuario_id fica vazio por enquanto; sera usado na etapa 2 (login do
--     produtor com acesso somente aos eventos dele).
--   * public.eventos_sociedade: 1 linha por evento em sociedade (um produtor
--     recebedor por evento, limite do split do Mercado Pago) + % da galeria.
--     Sem linha = evento normal (100% galeria), comportamento atual.
--   * RPCs (somente ADMINISTRADOR, alteracoes auditadas):
--       listar_produtores_admin()
--       salvar_produtor_admin(id|null, nome, documento, telefone, email)
--       obter_sociedade_evento_admin(evento)  -> configuracao + divisao dos
--         valores aprovados (online e portaria separados)
--       definir_sociedade_evento_admin(evento, produtor|null, % galeria)
--         produtor null = desfaz a sociedade.
--
-- A divisao e calculada sobre os pagamentos APROVADOS do evento (mesma base do
-- faturamento do dashboard), com a porcentagem atual da sociedade. Bar fica
-- fora (o sistema so tem ingressos). Cortesias/VIP nao geram valor.
--
-- Nao altera checkout, pagamento, portaria nem RLS de tabelas existentes.
-- Tabelas novas: RLS ligado, sem acesso direto (somente via RPC).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table if not exists public.produtores (
  id uuid
    constraint pk_produtores primary key default gen_random_uuid(),
  nome text not null
    constraint ck_produtores_nome check (btrim(nome) <> ''),
  documento text null,
  telefone text null,
  email text null,
  usuario_id uuid null
    constraint fk_produtores_usuario references public.usuarios (id) on delete restrict
    constraint uq_produtores_usuario unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.produtores is
  'Produtores de eventos em sociedade. usuario_id (opcional) liga ao login do produtor.';

create table if not exists public.eventos_sociedade (
  evento_id uuid
    constraint pk_eventos_sociedade primary key
    constraint fk_eventos_sociedade_evento references public.eventos (id) on delete cascade,
  produtor_id uuid not null
    constraint fk_eventos_sociedade_produtor references public.produtores (id) on delete restrict,
  percentual_galeria numeric(5, 2) not null
    constraint ck_eventos_sociedade_percentual check (percentual_galeria >= 0 and percentual_galeria <= 100),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid null
    constraint fk_eventos_sociedade_usuario references public.usuarios (id) on delete set null
);

create index if not exists ix_eventos_sociedade_produtor
  on public.eventos_sociedade (produtor_id);

comment on table public.eventos_sociedade is
  'Evento em sociedade: produtor recebedor e % da galeria (o produtor fica com o restante).';

alter table public.produtores enable row level security;
alter table public.eventos_sociedade enable row level security;

revoke all on table public.produtores from public, anon, authenticated;
revoke all on table public.eventos_sociedade from public, anon, authenticated;
grant all on table public.produtores to service_role;
grant all on table public.eventos_sociedade to service_role;

-- -----------------------------------------------------------------------------
-- Auxiliar: produtor em JSON
-- -----------------------------------------------------------------------------
create or replace function private.produtor_json(p_produtor public.produtores)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'produtor_id', p_produtor.id,
    'nome', p_produtor.nome,
    'documento', p_produtor.documento,
    'telefone', p_produtor.telefone,
    'email', p_produtor.email,
    'ativo', p_produtor.ativo,
    'tem_login', p_produtor.usuario_id is not null
  );
$$;

revoke all on function private.produtor_json(public.produtores) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Listar produtores
-- -----------------------------------------------------------------------------
create or replace function public.listar_produtores_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  return (
    select coalesce(
             jsonb_agg(
               private.produtor_json(p) || jsonb_build_object(
                 'eventos_count',
                 (select count(*) from public.eventos_sociedade s where s.produtor_id = p.id)
               )
               order by p.ativo desc, lower(p.nome)
             ),
             '[]'::jsonb
           )
      from public.produtores p
  );
end;
$$;

revoke execute on function public.listar_produtores_admin() from public, anon, authenticated, service_role;
grant execute on function public.listar_produtores_admin() to authenticated, service_role;

comment on function public.listar_produtores_admin() is
  'Lista os produtores cadastrados (ADMINISTRADOR).';

-- -----------------------------------------------------------------------------
-- Criar / editar produtor
-- -----------------------------------------------------------------------------
create or replace function public.salvar_produtor_admin(
  p_produtor_id uuid default null,
  p_nome text default null,
  p_documento text default null,
  p_telefone text default null,
  p_email text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_antes public.produtores%rowtype;
  v_depois public.produtores%rowtype;
  v_nome text := nullif(btrim(coalesce(p_nome, '')), '');
  v_documento text := nullif(btrim(coalesce(p_documento, '')), '');
  v_telefone text := nullif(btrim(coalesce(p_telefone, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  if v_nome is null then
    raise exception 'Nome do produtor obrigatorio' using errcode = '23514';
  end if;

  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail do produtor invalido' using errcode = '23514';
  end if;

  if p_produtor_id is null then
    insert into public.produtores (nome, documento, telefone, email)
    values (v_nome, v_documento, v_telefone, v_email)
    returning * into v_depois;

    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (auth.uid(), 'PRODUTOR_CRIADO_ADMIN', 'produtores', v_depois.id, null, private.produtor_json(v_depois));
  else
    select * into v_antes from public.produtores p where p.id = p_produtor_id for update;
    if not found then
      raise exception 'Produtor % nao encontrado', p_produtor_id using errcode = '23503';
    end if;

    update public.produtores
       set nome = v_nome,
           documento = v_documento,
           telefone = v_telefone,
           email = v_email,
           atualizado_em = now()
     where id = p_produtor_id
    returning * into v_depois;

    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (
      auth.uid(), 'PRODUTOR_ATUALIZADO_ADMIN', 'produtores', v_depois.id,
      private.produtor_json(v_antes), private.produtor_json(v_depois)
    );
  end if;

  return private.produtor_json(v_depois);
end;
$$;

revoke execute on function public.salvar_produtor_admin(uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.salvar_produtor_admin(uuid, text, text, text, text)
  to authenticated, service_role;

comment on function public.salvar_produtor_admin(uuid, text, text, text, text) is
  'Cria (id null) ou atualiza um produtor (ADMINISTRADOR, auditado).';

-- -----------------------------------------------------------------------------
-- Sociedade do evento + divisao dos valores
-- -----------------------------------------------------------------------------
create or replace function public.obter_sociedade_evento_admin(p_evento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sociedade public.eventos_sociedade%rowtype;
  v_produtor public.produtores%rowtype;
  v_online numeric(12, 2);
  v_portaria numeric(12, 2);
  v_total numeric(12, 2);
  v_pedidos integer;
  v_galeria numeric(12, 2);
  v_galeria_online numeric(12, 2);
  v_galeria_portaria numeric(12, 2);
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  if not exists (select 1 from public.eventos e where e.id = p_evento_id) then
    raise exception 'Evento % nao encontrado', p_evento_id using errcode = '23503';
  end if;

  select * into v_sociedade from public.eventos_sociedade s where s.evento_id = p_evento_id;
  if not found then
    return jsonb_build_object('evento_id', p_evento_id, 'ativa', false);
  end if;

  select * into v_produtor from public.produtores p where p.id = v_sociedade.produtor_id;

  -- Mesma base do faturamento do dashboard: pagamentos APROVADOS.
  select coalesce(sum(pg.valor) filter (where pg.provedor = 'MERCADO_PAGO'), 0),
         coalesce(sum(pg.valor) filter (where pg.provedor <> 'MERCADO_PAGO'), 0),
         count(*)
    into v_online, v_portaria, v_pedidos
    from public.pagamentos pg
    join public.pedidos p on p.id = pg.pedido_id
   where p.evento_id = p_evento_id
     and pg.status = 'APROVADO';

  v_total := v_online + v_portaria;
  v_galeria_online := round(v_online * v_sociedade.percentual_galeria / 100, 2);
  v_galeria_portaria := round(v_portaria * v_sociedade.percentual_galeria / 100, 2);
  v_galeria := v_galeria_online + v_galeria_portaria;

  return jsonb_build_object(
    'evento_id', p_evento_id,
    'ativa', true,
    'produtor', private.produtor_json(v_produtor),
    'percentual_galeria', v_sociedade.percentual_galeria,
    'percentual_produtor', 100 - v_sociedade.percentual_galeria,
    'atualizado_em', v_sociedade.atualizado_em,
    'totais', jsonb_build_object(
      'pedidos_pagos', v_pedidos,
      'online', v_online,
      'portaria', v_portaria,
      'total', v_total,
      'galeria', v_galeria,
      'produtor', v_total - v_galeria,
      'galeria_online', v_galeria_online,
      'produtor_online', v_online - v_galeria_online,
      'galeria_portaria', v_galeria_portaria,
      'produtor_portaria', v_portaria - v_galeria_portaria
    )
  );
end;
$$;

revoke execute on function public.obter_sociedade_evento_admin(uuid) from public, anon, authenticated, service_role;
grant execute on function public.obter_sociedade_evento_admin(uuid) to authenticated, service_role;

comment on function public.obter_sociedade_evento_admin(uuid) is
  'Sociedade do evento (produtor e %) e divisao dos pagamentos aprovados entre galeria e produtor (ADMINISTRADOR).';

-- -----------------------------------------------------------------------------
-- Definir / desfazer sociedade
-- -----------------------------------------------------------------------------
create or replace function public.definir_sociedade_evento_admin(
  p_evento_id uuid,
  p_produtor_id uuid default null,
  p_percentual_galeria numeric default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_antes public.eventos_sociedade%rowtype;
  v_tinha boolean;
  v_dados_antes jsonb;
  v_dados_novos jsonb;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  perform 1 from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'Evento % nao encontrado', p_evento_id using errcode = '23503';
  end if;

  select * into v_antes from public.eventos_sociedade s where s.evento_id = p_evento_id for update;
  v_tinha := found;
  v_dados_antes := case when v_tinha then jsonb_build_object(
    'produtor_id', v_antes.produtor_id,
    'percentual_galeria', v_antes.percentual_galeria
  ) end;

  -- Desfazer
  if p_produtor_id is null then
    if not v_tinha then
      return jsonb_build_object('evento_id', p_evento_id, 'ativa', false, 'alterado', false);
    end if;

    delete from public.eventos_sociedade where evento_id = p_evento_id;

    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (auth.uid(), 'EVENTO_SOCIEDADE_REMOVIDA_ADMIN', 'eventos', p_evento_id, v_dados_antes, null);

    return jsonb_build_object('evento_id', p_evento_id, 'ativa', false, 'alterado', true);
  end if;

  if p_percentual_galeria is null or p_percentual_galeria < 0 or p_percentual_galeria > 100 then
    raise exception 'Percentual da galeria deve estar entre 0 e 100' using errcode = '23514';
  end if;

  if round(p_percentual_galeria, 2) <> p_percentual_galeria then
    raise exception 'Percentual da galeria aceita no maximo 2 casas decimais' using errcode = '23514';
  end if;

  if not exists (select 1 from public.produtores p where p.id = p_produtor_id and p.ativo) then
    raise exception 'Produtor % nao encontrado ou inativo', p_produtor_id using errcode = '23503';
  end if;

  v_dados_novos := jsonb_build_object(
    'produtor_id', p_produtor_id,
    'percentual_galeria', p_percentual_galeria
  );

  if v_tinha and v_antes.produtor_id = p_produtor_id
     and v_antes.percentual_galeria = p_percentual_galeria then
    return jsonb_build_object('evento_id', p_evento_id, 'ativa', true, 'alterado', false);
  end if;

  insert into public.eventos_sociedade (evento_id, produtor_id, percentual_galeria, atualizado_por)
  values (p_evento_id, p_produtor_id, p_percentual_galeria, auth.uid())
  on conflict (evento_id) do update
     set produtor_id = excluded.produtor_id,
         percentual_galeria = excluded.percentual_galeria,
         atualizado_em = now(),
         atualizado_por = excluded.atualizado_por;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
  values (
    auth.uid(),
    case when v_tinha then 'EVENTO_SOCIEDADE_ALTERADA_ADMIN' else 'EVENTO_SOCIEDADE_CRIADA_ADMIN' end,
    'eventos', p_evento_id, v_dados_antes, v_dados_novos
  );

  return jsonb_build_object('evento_id', p_evento_id, 'ativa', true, 'alterado', true);
end;
$$;

revoke execute on function public.definir_sociedade_evento_admin(uuid, uuid, numeric)
  from public, anon, authenticated, service_role;
grant execute on function public.definir_sociedade_evento_admin(uuid, uuid, numeric)
  to authenticated, service_role;

comment on function public.definir_sociedade_evento_admin(uuid, uuid, numeric) is
  'Define a sociedade do evento (produtor + % da galeria) ou desfaz com produtor null (ADMINISTRADOR, auditado).';
