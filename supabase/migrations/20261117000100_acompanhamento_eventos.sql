-- =============================================================================
-- GZ1 Ingresso - Acesso de acompanhamento das vendas (somente leitura)
-- Migration: acompanhamento_eventos
--
-- Requer 20261117000000_perfil_acompanhamento.sql aplicado antes.
--
-- Um usuario com perfil ACOMPANHAMENTO (ex.: socio do evento) enxerga SOMENTE
-- os eventos em que foi adicionado (public.eventos_acompanhantes), em qualquer
-- evento (em sociedade ou nao). Pode ser adicionado a varios eventos.
-- Ve: quantidade de ingressos, valores em R$, vendas por lote e por dia,
-- quantos ja entraram e a lista de compradores (SO o nome).
-- NAO ve telefone/e-mail, nao ve financeiro da galeria e NAO altera nada.
--
--   public.eventos_acompanhantes              quem acompanha qual evento
--   private.acompanhamento_ativo()             usuario logado e ACOMPANHAMENTO ativo?
--   private.exigir_acompanhante_do_evento(ev)  bloqueia evento que nao e dele
--   private.vendas_resumo_evento(ev)           totais, por lote, por dia
--   public.listar_eventos_acompanhamento()
--   public.obter_evento_acompanhamento(ev)
--   public.listar_vendas_evento_acompanhamento(ev)
--   (ADMINISTRADOR)
--   public.listar_acompanhantes_evento_admin(ev)
--   public.listar_acompanhantes_admin()
--   public.remover_acompanhante_evento_admin(ev, usuario)
--   (o convite/inclusao e feito pelo servidor: /api/admin/eventos/[id]/acompanhantes)
--
-- Base dos numeros: pedidos com pagamento APROVADO (mesma base do dashboard e
-- da divisao da sociedade). Cortesias/VIP nao entram nos valores.
-- Nenhuma funcao existente e alterada; a tabela nova nao tem acesso direto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela
-- -----------------------------------------------------------------------------
create table if not exists public.eventos_acompanhantes (
  evento_id uuid not null
    constraint fk_eventos_acompanhantes_evento references public.eventos (id) on delete cascade,
  usuario_id uuid not null
    constraint fk_eventos_acompanhantes_usuario references public.usuarios (id) on delete cascade,
  criado_em timestamptz not null default now(),
  criado_por uuid null
    constraint fk_eventos_acompanhantes_criado_por references public.usuarios (id) on delete set null,
  constraint pk_eventos_acompanhantes primary key (evento_id, usuario_id)
);

create index if not exists ix_eventos_acompanhantes_usuario
  on public.eventos_acompanhantes (usuario_id);

comment on table public.eventos_acompanhantes is
  'Usuarios ACOMPANHAMENTO que podem ver as vendas de um evento (somente leitura).';

alter table public.eventos_acompanhantes enable row level security;
revoke all on table public.eventos_acompanhantes from public, anon, authenticated;
grant all on table public.eventos_acompanhantes to service_role;

-- -----------------------------------------------------------------------------
-- Auxiliares
-- -----------------------------------------------------------------------------
create or replace function private.acompanhamento_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.usuarios u
     where u.id = auth.uid()
       and u.ativo = true
       and u.perfil::text = 'ACOMPANHAMENTO'
  );
$$;

revoke all on function private.acompanhamento_ativo() from public, anon;
grant execute on function private.acompanhamento_ativo() to authenticated, service_role;

create or replace function private.exigir_acompanhante_do_evento(p_evento_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.acompanhamento_ativo() then
    raise exception 'Permissao negada: apenas ACOMPANHAMENTO' using errcode = '42501';
  end if;
  -- Mesmo erro para "nao existe" e "nao e seu": nao revela outros eventos.
  if not exists (
    select 1 from public.eventos_acompanhantes a
     where a.evento_id = p_evento_id and a.usuario_id = auth.uid()
  ) then
    raise exception 'Evento nao encontrado' using errcode = '23503';
  end if;
end;
$$;

revoke all on function private.exigir_acompanhante_do_evento(uuid) from public, anon;
grant execute on function private.exigir_acompanhante_do_evento(uuid) to authenticated, service_role;

-- Totais, por lote e por dia (pedidos com pagamento APROVADO).
create or replace function private.vendas_resumo_evento(p_evento_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with vendas as (
    select p.lote_id,
           p.quantidade,
           pg.valor,
           pg.provedor,
           coalesce(p.pago_em, pg.confirmado_em, p.criado_em) as pago_em
      from public.pedidos p
      join public.pagamentos pg on pg.pedido_id = p.id
     where p.evento_id = p_evento_id
       and pg.status = 'APROVADO'
  ),
  por_lote as (
    select l.id, l.nome, l.ordem, l.preco, l.quantidade as disponibilizados, l.status::text as status,
           coalesce(sum(v.quantidade), 0)::int as ingressos,
           coalesce(sum(v.valor), 0)::numeric(12, 2) as valor
      from public.lotes l
      left join vendas v on v.lote_id = l.id
     where l.evento_id = p_evento_id
     group by l.id
    union all
    select null, 'Sem lote (venda na portaria / avulsa)', 999999, null, null, null,
           sum(v.quantidade)::int, sum(v.valor)::numeric(12, 2)
      from vendas v
     where v.lote_id is null
    having count(*) > 0
  ),
  por_dia as (
    select (v.pago_em at time zone 'America/Sao_Paulo')::date as dia,
           sum(v.quantidade)::int as ingressos,
           sum(v.valor)::numeric(12, 2) as valor
      from vendas v
     group by 1
  )
  select jsonb_build_object(
    'pedidos_pagos', (select count(*) from vendas),
    'ingressos', (select coalesce(sum(quantidade), 0) from vendas),
    'valor_total', (select coalesce(sum(valor), 0) from vendas),
    'valor_online', (select coalesce(sum(valor) filter (where provedor = 'MERCADO_PAGO'), 0) from vendas),
    'valor_portaria', (select coalesce(sum(valor) filter (where provedor <> 'MERCADO_PAGO'), 0) from vendas),
    'por_lote', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'lote_id', id, 'nome', nome, 'preco', preco, 'disponibilizados', disponibilizados,
               'status', status, 'ingressos', ingressos, 'valor', valor
             ) order by ordem), '[]'::jsonb)
        from por_lote
    ),
    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'dia', dia, 'ingressos', ingressos, 'valor', valor
             ) order by dia desc), '[]'::jsonb)
        from por_dia
    )
  );
$$;

revoke all on function private.vendas_resumo_evento(uuid) from public, anon, authenticated;
grant execute on function private.vendas_resumo_evento(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Meus eventos
-- -----------------------------------------------------------------------------
create or replace function public.listar_eventos_acompanhamento()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.acompanhamento_ativo() then
    raise exception 'Permissao negada: apenas ACOMPANHAMENTO' using errcode = '42501';
  end if;

  return (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'evento_id', e.id,
                 'nome', e.nome,
                 'slug', e.slug,
                 'imagem_url', e.imagem_url,
                 'inicio_em', e.inicio_em,
                 'local', e.local,
                 'status', e.status,
                 'ingressos', t.ingressos,
                 'valor_total', t.valor_total
               )
               order by
                 case e.status when 'EM_ANDAMENTO' then 0 when 'AGENDADO' then 1 else 2 end,
                 case when e.status in ('REALIZADO', 'CANCELADO') then e.inicio_em end desc nulls last,
                 e.inicio_em asc
             ),
             '[]'::jsonb
           )
      from public.eventos_acompanhantes a
      join public.eventos e on e.id = a.evento_id
      cross join lateral (
        select coalesce(sum(p.quantidade), 0) as ingressos,
               coalesce(sum(pg.valor), 0) as valor_total
          from public.pedidos p
          join public.pagamentos pg on pg.pedido_id = p.id
         where p.evento_id = e.id
           and pg.status = 'APROVADO'
      ) t
     where a.usuario_id = auth.uid()
  );
end;
$$;

revoke execute on function public.listar_eventos_acompanhamento() from public, anon, authenticated, service_role;
grant execute on function public.listar_eventos_acompanhamento() to authenticated, service_role;

comment on function public.listar_eventos_acompanhamento() is
  'Eventos que o usuario ACOMPANHAMENTO logado pode acompanhar (somente leitura).';

-- -----------------------------------------------------------------------------
-- Resumo de um evento
-- -----------------------------------------------------------------------------
create or replace function public.obter_evento_acompanhamento(p_evento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_res jsonb;
begin
  perform private.exigir_acompanhante_do_evento(p_evento_id);

  select jsonb_build_object(
           'evento_id', e.id,
           'nome', e.nome,
           'slug', e.slug,
           'imagem_url', e.imagem_url,
           'inicio_em', e.inicio_em,
           'local', e.local,
           'status', e.status,
           'capacidade_total', e.capacidade_total,
           'utilizados', (select count(*) from public.ingressos i
                           where i.evento_id = e.id and i.status = 'UTILIZADO'),
           'lote_ativo', (
             select jsonb_build_object('nome', l.nome, 'preco', l.preco)
               from public.lotes l
              where l.evento_id = e.id and l.status = 'ATIVO'
              order by l.ordem asc
              limit 1
           ),
           'resumo', private.vendas_resumo_evento(e.id)
         )
    into v_res
    from public.eventos e
   where e.id = p_evento_id;

  return v_res;
end;
$$;

revoke execute on function public.obter_evento_acompanhamento(uuid) from public, anon, authenticated, service_role;
grant execute on function public.obter_evento_acompanhamento(uuid) to authenticated, service_role;

comment on function public.obter_evento_acompanhamento(uuid) is
  'Resumo de vendas (R$, por lote, por dia, entradas) de um evento do acompanhante logado.';

-- -----------------------------------------------------------------------------
-- Compradores (pedidos pagos) - SO o nome
-- -----------------------------------------------------------------------------
create or replace function public.listar_vendas_evento_acompanhamento(p_evento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.exigir_acompanhante_do_evento(p_evento_id);

  return (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'codigo', p.codigo,
                 'comprador_nome', p.comprador_nome,
                 'quantidade', p.quantidade,
                 'valor_total', pg.valor,
                 'lote_nome', l.nome,
                 'forma', case when pg.provedor = 'MERCADO_PAGO' then 'ONLINE' else 'PORTARIA' end,
                 'pago_em', coalesce(p.pago_em, pg.confirmado_em)
               )
               order by coalesce(p.pago_em, pg.confirmado_em) desc nulls last
             ),
             '[]'::jsonb
           )
      from public.pedidos p
      join public.pagamentos pg on pg.pedido_id = p.id
      left join public.lotes l on l.id = p.lote_id
     where p.evento_id = p_evento_id
       and pg.status = 'APROVADO'
  );
end;
$$;

revoke execute on function public.listar_vendas_evento_acompanhamento(uuid) from public, anon, authenticated, service_role;
grant execute on function public.listar_vendas_evento_acompanhamento(uuid) to authenticated, service_role;

comment on function public.listar_vendas_evento_acompanhamento(uuid) is
  'Pedidos pagos de um evento do acompanhante logado, sem telefone/e-mail (ACOMPANHAMENTO).';

-- -----------------------------------------------------------------------------
-- ADMINISTRADOR: quem acompanha o evento
-- -----------------------------------------------------------------------------
create or replace function public.listar_acompanhantes_evento_admin(p_evento_id uuid)
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
               jsonb_build_object(
                 'usuario_id', u.id,
                 'nome', u.nome,
                 'email', u.email,
                 'ativo', u.ativo,
                 'ultimo_acesso_em', u.ultimo_acesso_em,
                 'adicionado_em', a.criado_em
               )
               order by lower(u.nome)
             ),
             '[]'::jsonb
           )
      from public.eventos_acompanhantes a
      join public.usuarios u on u.id = a.usuario_id
     where a.evento_id = p_evento_id
  );
end;
$$;

revoke execute on function public.listar_acompanhantes_evento_admin(uuid) from public, anon, authenticated, service_role;
grant execute on function public.listar_acompanhantes_evento_admin(uuid) to authenticated, service_role;

create or replace function public.listar_acompanhantes_admin()
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
               jsonb_build_object(
                 'usuario_id', u.id,
                 'nome', u.nome,
                 'email', u.email,
                 'ativo', u.ativo,
                 'eventos_count', (select count(*) from public.eventos_acompanhantes a where a.usuario_id = u.id)
               )
               order by u.ativo desc, lower(u.nome)
             ),
             '[]'::jsonb
           )
      from public.usuarios u
     where u.perfil::text = 'ACOMPANHAMENTO'
  );
end;
$$;

revoke execute on function public.listar_acompanhantes_admin() from public, anon, authenticated, service_role;
grant execute on function public.listar_acompanhantes_admin() to authenticated, service_role;

create or replace function public.remover_acompanhante_evento_admin(p_evento_id uuid, p_usuario_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  delete from public.eventos_acompanhantes
   where evento_id = p_evento_id and usuario_id = p_usuario_id;
  if not found then
    raise exception 'Acompanhante nao encontrado' using errcode = '23503';
  end if;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores)
  values (
    auth.uid(), 'ACOMPANHANTE_REMOVIDO', 'eventos', p_evento_id,
    jsonb_build_object('usuario_id', p_usuario_id)
  );

  return jsonb_build_object('removido', true);
end;
$$;

revoke execute on function public.remover_acompanhante_evento_admin(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.remover_acompanhante_evento_admin(uuid, uuid) to authenticated, service_role;

comment on function public.listar_acompanhantes_evento_admin(uuid) is 'Quem acompanha as vendas do evento (ADMINISTRADOR).';
comment on function public.listar_acompanhantes_admin() is 'Usuarios com perfil ACOMPANHAMENTO (ADMINISTRADOR).';
comment on function public.remover_acompanhante_evento_admin(uuid, uuid) is 'Tira o acesso de acompanhamento de um evento (ADMINISTRADOR, auditado).';
