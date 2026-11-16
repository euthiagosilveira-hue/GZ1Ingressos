-- =============================================================================
-- Monitor do caixa: avisos automaticos + resumo semanal da IA
--
-- * financeiro_categorias.dia_vencimento: dia do mes em que a conta fixa vence
--   (opcional, so faz sentido em categoria de saida).
-- * public.financeiro_alertas: avisos gerados (um por chave: nunca repete).
-- * private.financeiro_gerar_alertas(): confere o caixa e grava os avisos
--   novos. Regras:
--     CONTA_FIXA      conta fixa vence em ate 3 dias e nao foi lancada
--     CONTA_ATRASADA  venceu ha ate 5 dias e continua sem lancamento
--     DUPLICADO       dois lancamentos iguais (tipo, valor, conta, dia)
--     SEM_FECHAR_BAR  evento comecou ha 10h+ e nao tem lancamento do bar
--     GASTO_ALTO      saida com mais que o dobro da media da categoria
-- * private.financeiro_dados_resumo(de, ate): numeros da semana para a IA.
-- * pg_cron + pg_net chamam o site (/api/sistema/monitor-caixa), que manda
--   a notificacao e escreve o resumo com o Gemini:
--     avisos  todo dia as 10h (Brasilia)    -> '0 13 * * *' (UTC)
--     resumo  toda segunda as 11h (Brasilia) -> '0 14 * * 1' (UTC)
--   Usa private.configuracoes (url_aplicacao, segredo_sistema), criada em
--   20261026010000_conferencia_pagamentos_inicio_evento.sql.
-- =============================================================================

-- Dia de vencimento das contas fixas ------------------------------------------
alter table public.financeiro_categorias
  add column if not exists dia_vencimento smallint null;

alter table public.financeiro_categorias
  drop constraint if exists ck_financeiro_categorias_dia_vencimento;
alter table public.financeiro_categorias
  add constraint ck_financeiro_categorias_dia_vencimento
  check (dia_vencimento is null or (dia_vencimento between 1 and 31 and tipo = 'SAIDA'));

-- Avisos -----------------------------------------------------------------------
create table if not exists public.financeiro_alertas (
  id uuid
    constraint pk_financeiro_alertas primary key default gen_random_uuid(),
  tipo text not null
    constraint ck_financeiro_alertas_tipo check (tipo in (
      'CONTA_FIXA', 'CONTA_ATRASADA', 'DUPLICADO', 'SEM_FECHAR_BAR', 'GASTO_ALTO', 'RESUMO_SEMANAL'
    )),
  chave text not null
    constraint uq_financeiro_alertas_chave unique,
  titulo text not null,
  mensagem text not null,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  push_enviado_em timestamptz null
);

create index if not exists idx_financeiro_alertas_criado_em on public.financeiro_alertas (criado_em desc);

alter table public.financeiro_alertas enable row level security;
revoke all on table public.financeiro_alertas from public, anon, authenticated;
grant select, insert, update, delete on table public.financeiro_alertas to service_role;

-- Auxiliares -------------------------------------------------------------------
create or replace function private.financeiro_moeda(p_valor numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || translate(to_char(coalesce(p_valor, 0), 'FM999G999G990D00'), ',.', '.,');
$$;

create or replace function private.financeiro_dia_mes(p_data date)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p_data, 'DD/MM');
$$;

-- Data do vencimento de uma conta fixa no mes de p_ref (dia 31 em mes curto
-- vira o ultimo dia do mes).
create or replace function private.financeiro_vencimento_no_mes(p_dia integer, p_ref date)
returns date
language sql
immutable
set search_path = ''
as $$
  select (date_trunc('month', p_ref)::date
          + (least(p_dia, extract(day from (date_trunc('month', p_ref) + interval '1 month - 1 day'))::int) - 1));
$$;

-- Hoje em Brasilia.
create or replace function private.financeiro_hoje()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Contas fixas e o proximo vencimento (este mes ou o seguinte), com a
-- indicacao se ja ha lancamento perto do vencimento.
create or replace function private.financeiro_contas_fixas(p_hoje date)
returns table (
  categoria_id uuid,
  nome text,
  dia integer,
  vencimento date,
  pago boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with candidatos as (
    select c.id, c.nome, c.dia_vencimento::int as dia,
           private.financeiro_vencimento_no_mes(c.dia_vencimento, (p_hoje + make_interval(months => m))::date) as venc
    from public.financeiro_categorias c
    cross join (values (-1), (0), (1)) as meses(m)
    where c.ativa and c.tipo = 'SAIDA' and c.dia_vencimento is not null
  )
  select
    k.id, k.nome, k.dia, k.venc,
    exists (
      select 1 from public.financeiro_lancamentos l
      where l.categoria_id = k.id
        and l.tipo = 'SAIDA'
        and l.cancelado_em is null
        and l.data >= k.venc - 15
        and l.data <= greatest(p_hoje, k.venc) + 0
    )
  from candidatos k;
$$;

revoke all on function private.financeiro_contas_fixas(date) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Gera os avisos novos. Retorna os que foram criados nesta chamada.
-- -----------------------------------------------------------------------------
create or replace function private.financeiro_gerar_alertas()
returns setof public.financeiro_alertas
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hoje date := private.financeiro_hoje();
  v_inicio_caixa timestamptz;
  v_categoria_bar uuid;
begin
  select min(c.saldo_inicial_em) into v_inicio_caixa
  from public.financeiro_contas c where c.saldo_inicial_em is not null;
  if v_inicio_caixa is null then
    return; -- caixa ainda nao configurado
  end if;

  select c.id into v_categoria_bar from public.financeiro_categorias c where c.chave_sistema = 'BAR';

  -- Conta fixa vencendo (hoje ate 3 dias) ------------------------------------
  insert into public.financeiro_alertas (tipo, chave, titulo, mensagem, dados)
  select
    'CONTA_FIXA',
    'fixa:' || f.categoria_id || ':' || f.vencimento,
    f.nome || ' vence ' || case
      when f.vencimento = v_hoje then 'hoje'
      when f.vencimento = v_hoje + 1 then 'amanhã'
      else 'dia ' || private.financeiro_dia_mes(f.vencimento)
    end,
    f.nome || ' vence ' || case
      when f.vencimento = v_hoje then 'hoje'
      when f.vencimento = v_hoje + 1 then 'amanhã'
      else 'em ' || (f.vencimento - v_hoje) || ' dias'
    end || ' (' || private.financeiro_dia_mes(f.vencimento) || ') e ainda não aparece no caixa.',
    jsonb_build_object('categoria_id', f.categoria_id, 'vencimento', f.vencimento)
  from private.financeiro_contas_fixas(v_hoje) f
  where f.vencimento between v_hoje and v_hoje + 3
    and not f.pago
  on conflict (chave) do nothing;

  -- Conta fixa atrasada (venceu ha 1 a 5 dias) -------------------------------
  insert into public.financeiro_alertas (tipo, chave, titulo, mensagem, dados)
  select
    'CONTA_ATRASADA',
    'atrasada:' || f.categoria_id || ':' || f.vencimento,
    f.nome || ' venceu dia ' || private.financeiro_dia_mes(f.vencimento),
    f.nome || ' venceu dia ' || private.financeiro_dia_mes(f.vencimento)
      || ' e ainda não aparece no caixa. Se já pagou, lance a saída para o caixa ficar certo.',
    jsonb_build_object('categoria_id', f.categoria_id, 'vencimento', f.vencimento)
  from private.financeiro_contas_fixas(v_hoje) f
  where f.vencimento between v_hoje - 5 and v_hoje - 1
    and f.vencimento >= (v_inicio_caixa at time zone 'America/Sao_Paulo')::date
    and not f.pago
  on conflict (chave) do nothing;

  -- Lancamento duplicado -------------------------------------------------------
  insert into public.financeiro_alertas (tipo, chave, titulo, mensagem, dados)
  select
    'DUPLICADO',
    'dup:' || a.id || ':' || b.id,
    'Lançamento repetido? ' || private.financeiro_moeda(b.valor),
    'Há dois lançamentos iguais: ' || private.financeiro_moeda(b.valor)
      || case b.tipo when 'ENTRADA' then ' de entrada' when 'SAIDA' then ' de saída' else ' de transferência' end
      || ' em ' || ct.nome || ' no dia ' || private.financeiro_dia_mes(b.data)
      || coalesce(' (' || cat.nome || ')', '')
      || '. Confira se não foi lançado duas vezes.',
    jsonb_build_object('lancamentos', jsonb_build_array(a.id, b.id), 'data', b.data, 'valor', b.valor)
  from public.financeiro_lancamentos b
  join public.financeiro_lancamentos a
    on a.tipo = b.tipo
   and a.valor = b.valor
   and a.conta_id = b.conta_id
   and a.data = b.data
   and a.conta_destino_id is not distinct from b.conta_destino_id
   and a.id <> b.id
   and (a.criado_em, a.id) < (b.criado_em, b.id)
   and a.cancelado_em is null
   and (a.grupo_id is null or a.grupo_id is distinct from b.grupo_id)
  join public.financeiro_contas ct on ct.id = b.conta_id
  left join public.financeiro_categorias cat on cat.id = b.categoria_id
  where b.cancelado_em is null
    and b.criado_em >= now() - interval '3 days'
  on conflict (chave) do nothing;

  -- Evento sem Fechar bar ------------------------------------------------------
  insert into public.financeiro_alertas (tipo, chave, titulo, mensagem, dados)
  select
    'SEM_FECHAR_BAR',
    'bar:' || e.id,
    'Falta o Fechar bar: ' || e.nome,
    'O evento ' || e.nome || ' (' || private.financeiro_dia_mes((e.inicio_em at time zone 'America/Sao_Paulo')::date)
      || ') ainda não tem o Fechar bar lançado. Sem ele, as vendas do bar não entram no caixa.',
    jsonb_build_object('evento_id', e.id)
  from public.eventos e
  where e.status::text in ('EM_ANDAMENTO', 'REALIZADO')
    and e.inicio_em >= v_inicio_caixa
    and e.inicio_em >= now() - interval '7 days'
    and e.inicio_em <= now() - interval '10 hours'
    and not exists (
      select 1 from public.financeiro_lancamentos l
      where l.cancelado_em is null
        and l.tipo = 'ENTRADA'
        and l.categoria_id = v_categoria_bar
        and (
          l.evento_id = e.id
          or l.data between (e.inicio_em at time zone 'America/Sao_Paulo')::date
                        and (e.inicio_em at time zone 'America/Sao_Paulo')::date + 1
        )
    )
  on conflict (chave) do nothing;

  -- Gasto fora do normal -------------------------------------------------------
  insert into public.financeiro_alertas (tipo, chave, titulo, mensagem, dados)
  select
    'GASTO_ALTO',
    'alto:' || l.id,
    'Gasto alto em ' || cat.nome || ': ' || private.financeiro_moeda(l.valor),
    'A saída de ' || private.financeiro_moeda(l.valor) || ' em ' || cat.nome
      || ' (' || private.financeiro_dia_mes(l.data) || coalesce(', ' || nullif(btrim(l.descricao), ''), '')
      || ') é mais que o dobro do normal dessa categoria (média ' || private.financeiro_moeda(h.media) || ').',
    jsonb_build_object('lancamento_id', l.id, 'media', round(h.media, 2), 'quantidade', h.quantidade)
  from public.financeiro_lancamentos l
  join public.financeiro_categorias cat on cat.id = l.categoria_id
  cross join lateral (
    select avg(o.valor) as media, count(*) as quantidade
    from public.financeiro_lancamentos o
    where o.categoria_id = l.categoria_id
      and o.tipo = 'SAIDA'
      and o.cancelado_em is null
      and o.id <> l.id
      and o.data between l.data - 120 and l.data
  ) h
  where l.tipo = 'SAIDA'
    and l.cancelado_em is null
    and l.criado_em >= now() - interval '3 days'
    and h.quantidade >= 3
    and l.valor >= 2 * h.media
    and l.valor - h.media >= 100
  on conflict (chave) do nothing;

  return query
    select * from public.financeiro_alertas a
    where a.criado_em = now() and a.tipo <> 'RESUMO_SEMANAL'
    order by a.tipo, a.titulo;
end;
$$;

revoke all on function private.financeiro_gerar_alertas() from public, anon, authenticated;

-- Ponte para o servidor do site (somente service_role).
create or replace function public.gerar_financeiro_alertas_sistema()
returns setof public.financeiro_alertas
language sql
volatile
security invoker
set search_path = ''
as $$ select * from private.financeiro_gerar_alertas(); $$;

revoke execute on function public.gerar_financeiro_alertas_sistema() from public, anon, authenticated;
grant execute on function public.gerar_financeiro_alertas_sistema() to service_role;
grant execute on function private.financeiro_gerar_alertas() to service_role;

-- -----------------------------------------------------------------------------
-- Numeros da semana para o resumo (a IA so escreve o texto).
-- -----------------------------------------------------------------------------
create or replace function private.financeiro_dados_resumo(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dias integer := p_ate - p_de + 1;
  v_ant_de date := p_de - (p_ate - p_de + 1);
  v_ant_ate date := p_de - 1;
  v_hoje date := private.financeiro_hoje();
  v_bar uuid;
  v_ingressos uuid;
  v_resultado jsonb;
begin
  select c.id into v_bar from public.financeiro_categorias c where c.chave_sistema = 'BAR';
  select c.id into v_ingressos from public.financeiro_categorias c where c.chave_sistema = 'INGRESSOS';

  with mov as materialized (
    select * from private.financeiro_movimentos() m
    where m.data between v_ant_de and p_ate and not m.transferencia
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', p_de, 'ate', p_ate, 'dias', v_dias),
    'periodo_anterior', jsonb_build_object('de', v_ant_de, 'ate', v_ant_ate),
    'entradas', coalesce((select sum(valor) from mov where tipo = 'ENTRADA' and data >= p_de), 0),
    'saidas', coalesce((select sum(valor) from mov where tipo = 'SAIDA' and data >= p_de), 0),
    'entradas_anterior', coalesce((select sum(valor) from mov where tipo = 'ENTRADA' and data < p_de), 0),
    'saidas_anterior', coalesce((select sum(valor) from mov where tipo = 'SAIDA' and data < p_de), 0),
    'bar', coalesce((select sum(valor) from mov where categoria_id = v_bar and tipo = 'ENTRADA' and data >= p_de), 0),
    'bar_anterior', coalesce((select sum(valor) from mov where categoria_id = v_bar and tipo = 'ENTRADA' and data < p_de), 0),
    'ingressos', coalesce((select sum(valor) from mov where categoria_id = v_ingressos and tipo = 'ENTRADA' and data >= p_de), 0),
    'ingressos_anterior', coalesce((select sum(valor) from mov where categoria_id = v_ingressos and tipo = 'ENTRADA' and data < p_de), 0),
    'por_categoria', coalesce((
      select jsonb_agg(jsonb_build_object('categoria', x.nome, 'tipo', x.tipo, 'total', x.total) order by x.tipo, x.total desc)
      from (
        select coalesce(cat.nome, 'Sem categoria') as nome, m.tipo, sum(m.valor) as total
        from mov m
        left join public.financeiro_categorias cat on cat.id = m.categoria_id
        where m.data >= p_de
        group by 1, 2
      ) x
    ), '[]'::jsonb),
    'maiores_saidas', coalesce((
      select jsonb_agg(jsonb_build_object('valor', x.valor, 'data', x.data, 'categoria', x.categoria, 'descricao', x.descricao) order by x.valor desc)
      from (
        select m.valor, m.data, cat.nome as categoria, m.descricao
        from mov m
        left join public.financeiro_categorias cat on cat.id = m.categoria_id
        where m.data >= p_de and m.tipo = 'SAIDA'
        order by m.valor desc
        limit 3
      ) x
    ), '[]'::jsonb),
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', e.nome,
        'data', (e.inicio_em at time zone 'America/Sao_Paulo')::date,
        'ingressos', coalesce((select sum(m.valor) from mov m where m.evento_id = e.id and m.categoria_id = v_ingressos and m.tipo = 'ENTRADA'), 0),
        'bar', coalesce((select sum(m.valor) from mov m where m.categoria_id = v_bar and m.tipo = 'ENTRADA'
                          and (m.evento_id = e.id or (m.evento_id is null and m.data between (e.inicio_em at time zone 'America/Sao_Paulo')::date
                                                                                          and (e.inicio_em at time zone 'America/Sao_Paulo')::date + 1))), 0),
        'saidas', coalesce((select sum(m.valor) from mov m where m.evento_id = e.id and m.tipo = 'SAIDA'), 0)
      ) order by e.inicio_em)
      from public.eventos e
      where e.status::text in ('EM_ANDAMENTO', 'REALIZADO')
        and (e.inicio_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
    ), '[]'::jsonb),
    'saldos', coalesce((
      select jsonb_agg(jsonb_build_object('conta', c.nome, 'saldo', s.saldo) order by c.ordem, c.nome)
      from private.financeiro_saldos(null) s
      join public.financeiro_contas c on c.id = s.conta_id
      where c.ativa and c.saldo_inicial_em is not null
    ), '[]'::jsonb),
    'saldo_total', coalesce((
      select sum(s.saldo)
      from private.financeiro_saldos(null) s
      join public.financeiro_contas c on c.id = s.conta_id
      where c.ativa and c.saldo_inicial_em is not null
    ), 0),
    'contas_fixas_proximos_7_dias', coalesce((
      select jsonb_agg(jsonb_build_object('nome', f.nome, 'vencimento', f.vencimento) order by f.vencimento)
      from private.financeiro_contas_fixas(v_hoje) f
      where f.vencimento between v_hoje and v_hoje + 7 and not f.pago
    ), '[]'::jsonb),
    'avisos_na_semana', coalesce((
      select jsonb_agg(a.titulo order by a.criado_em)
      from public.financeiro_alertas a
      where a.tipo <> 'RESUMO_SEMANAL'
        and (a.criado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate + 1
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function private.financeiro_dados_resumo(date, date) from public, anon, authenticated;

create or replace function public.dados_resumo_financeiro_sistema(p_de date, p_ate date)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$ select private.financeiro_dados_resumo(p_de, p_ate); $$;

revoke execute on function public.dados_resumo_financeiro_sistema(date, date) from public, anon, authenticated;
grant execute on function public.dados_resumo_financeiro_sistema(date, date) to service_role;
grant execute on function private.financeiro_dados_resumo(date, date) to service_role;

-- -----------------------------------------------------------------------------
-- Tela: ultimos avisos (somente ADMINISTRADOR)
-- -----------------------------------------------------------------------------
create or replace function public.listar_financeiro_alertas_admin(p_limite integer default 15)
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

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'tipo', a.tipo,
        'titulo', a.titulo,
        'mensagem', a.mensagem,
        'dados', a.dados,
        'criado_em', a.criado_em,
        'atualizado_em', a.atualizado_em
      )
      order by a.criado_em desc
    )
    from (
      select * from public.financeiro_alertas
      order by criado_em desc
      limit greatest(1, least(coalesce(p_limite, 15), 50))
    ) a
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.listar_financeiro_alertas_admin(integer) from public, anon, authenticated, service_role;
grant execute on function public.listar_financeiro_alertas_admin(integer) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Categorias: listar/salvar com o dia de vencimento
-- -----------------------------------------------------------------------------
create or replace function public.listar_financeiro_categorias_admin()
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

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'nome', c.nome,
        'tipo', c.tipo,
        'chave_sistema', c.chave_sistema,
        'ativa', c.ativa,
        'dia_vencimento', c.dia_vencimento
      )
      order by c.tipo, c.ativa desc, c.ordem, c.nome
    )
    from public.financeiro_categorias c
  ), '[]'::jsonb);
end;
$$;

drop function if exists public.salvar_financeiro_categoria_admin(uuid, text, text, boolean);

create or replace function public.salvar_financeiro_categoria_admin(
  p_id uuid,
  p_nome text,
  p_tipo text,
  p_ativa boolean default true,
  p_dia_vencimento integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_antes public.financeiro_categorias%rowtype;
  v_id uuid;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_dia smallint;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;
  if v_nome = '' then
    raise exception 'Informe o nome da categoria' using errcode = '23514';
  end if;
  if p_tipo is null or p_tipo not in ('ENTRADA', 'SAIDA') then
    raise exception 'Tipo de categoria invalido' using errcode = '23514';
  end if;
  if p_dia_vencimento is not null and (p_dia_vencimento < 1 or p_dia_vencimento > 31) then
    raise exception 'Dia de vencimento invalido' using errcode = '23514';
  end if;
  v_dia := case when p_tipo = 'SAIDA' then p_dia_vencimento else null end;
  if exists (
    select 1 from public.financeiro_categorias c
    where lower(c.nome) = lower(v_nome) and c.tipo = p_tipo and (p_id is null or c.id <> p_id)
  ) then
    raise exception 'Ja existe uma categoria com esse nome' using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.financeiro_categorias (nome, tipo, ativa, ordem, dia_vencimento)
    values (v_nome, p_tipo, coalesce(p_ativa, true), 50, v_dia)
    returning id into v_id;

    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (auth.uid(), 'FINANCEIRO_CATEGORIA_CRIADA_ADMIN', 'financeiro_categorias', v_id, null,
            jsonb_build_object('nome', v_nome, 'tipo', p_tipo, 'ativa', coalesce(p_ativa, true), 'dia_vencimento', v_dia));
  else
    select * into v_antes from public.financeiro_categorias where id = p_id for update;
    if not found then
      raise exception 'Categoria % nao encontrada', p_id using errcode = '23503';
    end if;
    if v_antes.chave_sistema is not null and (p_tipo <> v_antes.tipo or coalesce(p_ativa, true) = false) then
      raise exception 'Esta categoria e usada pelo sistema: so o nome pode mudar' using errcode = '23514';
    end if;
    if p_tipo <> v_antes.tipo and exists (
      select 1 from public.financeiro_lancamentos l where l.categoria_id = p_id
    ) then
      raise exception 'Categoria ja usada em lancamentos: nao pode trocar entre entrada e saida' using errcode = '23514';
    end if;

    update public.financeiro_categorias
       set nome = v_nome, tipo = p_tipo, ativa = coalesce(p_ativa, true),
           dia_vencimento = v_dia, atualizado_em = now()
     where id = p_id;
    v_id := p_id;

    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (auth.uid(), 'FINANCEIRO_CATEGORIA_ALTERADA_ADMIN', 'financeiro_categorias', v_id,
            jsonb_build_object('nome', v_antes.nome, 'tipo', v_antes.tipo, 'ativa', v_antes.ativa, 'dia_vencimento', v_antes.dia_vencimento),
            jsonb_build_object('nome', v_nome, 'tipo', p_tipo, 'ativa', coalesce(p_ativa, true), 'dia_vencimento', v_dia));
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke execute on function public.salvar_financeiro_categoria_admin(uuid, text, text, boolean, integer) from public, anon, authenticated, service_role;
grant execute on function public.salvar_financeiro_categoria_admin(uuid, text, text, boolean, integer) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Agendamento: o banco chama o site (pg_net), que avisa no celular.
-- -----------------------------------------------------------------------------
create or replace function private.solicitar_monitor_caixa(p_acao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_segredo text;
begin
  select valor into v_url from private.configuracoes where chave = 'url_aplicacao';
  select valor into v_segredo from private.configuracoes where chave = 'segredo_sistema';
  if v_url is null or v_segredo is null then
    return;
  end if;

  perform net.http_post(
    url := v_url || '/api/sistema/monitor-caixa',
    body := jsonb_build_object('acao', p_acao),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_segredo
    ),
    timeout_milliseconds := 60000
  );
exception when others then
  raise warning 'Monitor do caixa (%) nao disparado: %', p_acao, sqlerrm;
end;
$$;

revoke all on function private.solicitar_monitor_caixa(text) from public, anon, authenticated;

do $do$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron indisponivel: monitor do caixa nao agendado';
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;

  if exists (select 1 from cron.job where jobname = 'gz1-caixa-avisos') then
    perform cron.unschedule('gz1-caixa-avisos');
  end if;
  if exists (select 1 from cron.job where jobname = 'gz1-caixa-resumo-semanal') then
    perform cron.unschedule('gz1-caixa-resumo-semanal');
  end if;

  -- Horarios em UTC: 13h = 10h e 14h = 11h em Brasilia (sem horario de verao).
  perform cron.schedule('gz1-caixa-avisos', '0 13 * * *', $$select private.solicitar_monitor_caixa('AVISOS')$$);
  perform cron.schedule('gz1-caixa-resumo-semanal', '0 14 * * 1', $$select private.solicitar_monitor_caixa('RESUMO')$$);
end
$do$;
