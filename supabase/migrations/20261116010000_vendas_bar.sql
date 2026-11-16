-- =============================================================================
-- GZ1 Ingresso - Vendas do bar (Financeiro > Reposicao > Vendas do bar)
-- Migration: vendas_bar
--
-- O sistema do bar (Compufour) gera o relatorio "Resumo de vendas" com cada
-- produto vendido. Esta migration guarda esses relatorios para o ESTOQUE
-- (nao lanca nada no caixa: o dinheiro continua no Fechar bar):
--
--   * public.bar_vendas: um relatorio importado (periodo, evento, totais).
--     Nao pode haver dois relatorios com o mesmo periodo (evita duplicar).
--   * public.bar_vendas_itens: cada produto do relatorio, ja somado.
--   * public.bar_produtos_vinculo: liga cada produto do bar (pelo codigo do
--     sistema do bar) a um produto da Reposicao, dizendo quantas vendas
--     gastam 1 unidade do pedido (ex.: fardo de 12 latas = 12).
--
-- RPCs (somente ADMINISTRADOR):
--   salvar_bar_venda_admin(de, ate, evento, origem, itens[{grupo, codigo, descricao, quantidade, valor}])
--   listar_bar_vendas_admin(limite)
--   excluir_bar_venda_admin(id)
--   listar_bar_produtos_vinculo_admin()
--   salvar_bar_produto_vinculo_admin(codigo, produto_id, vendas_por_unidade)
--   listar_consumo_bar_reposicao_admin(semanas)
--
-- Nao altera nenhuma tabela nem funcao existente.
-- =============================================================================

create table if not exists public.bar_vendas (
  id uuid
    constraint pk_bar_vendas primary key default gen_random_uuid(),
  periodo_de date not null,
  periodo_ate date not null,
  constraint ck_bar_vendas_periodo check (periodo_ate >= periodo_de),
  evento_id uuid
    constraint fk_bar_vendas_evento references public.eventos (id) on delete set null,
  origem text,
  total_valor numeric(12, 2) not null default 0,
  total_quantidade numeric(12, 3) not null default 0,
  criado_por uuid,
  criado_em timestamptz not null default now()
);

create unique index if not exists ux_bar_vendas_periodo
  on public.bar_vendas (periodo_de, periodo_ate);

comment on table public.bar_vendas is
  'Relatorios de vendas do bar (sistema do bar) importados para o estoque. Nao lanca no caixa.';

create table if not exists public.bar_vendas_itens (
  id uuid
    constraint pk_bar_vendas_itens primary key default gen_random_uuid(),
  venda_id uuid not null
    constraint fk_bar_vendas_itens_venda references public.bar_vendas (id) on delete cascade,
  grupo text,
  codigo text not null,
  descricao text not null,
  quantidade numeric(12, 3) not null
    constraint ck_bar_vendas_itens_quantidade check (quantidade >= 0),
  valor numeric(12, 2) not null default 0
    constraint ck_bar_vendas_itens_valor check (valor >= 0)
);

create index if not exists ix_bar_vendas_itens_venda on public.bar_vendas_itens (venda_id);
create index if not exists ix_bar_vendas_itens_codigo on public.bar_vendas_itens (codigo);

comment on table public.bar_vendas_itens is
  'Produtos de cada relatorio de vendas do bar (quantidade e valor somados por produto).';

create table if not exists public.bar_produtos_vinculo (
  codigo text
    constraint pk_bar_produtos_vinculo primary key,
  produto_id uuid
    constraint fk_bar_produtos_vinculo_produto references public.reposicao_produtos (id) on delete set null,
  vendas_por_unidade numeric(12, 3) not null default 1
    constraint ck_bar_produtos_vinculo_fator check (vendas_por_unidade > 0),
  atualizado_em timestamptz not null default now()
);

comment on table public.bar_produtos_vinculo is
  'Liga o produto do sistema do bar (codigo) ao produto da Reposicao. vendas_por_unidade = quantas vendas gastam 1 unidade do pedido.';

alter table public.bar_vendas enable row level security;
alter table public.bar_vendas_itens enable row level security;
alter table public.bar_produtos_vinculo enable row level security;
revoke all on table public.bar_vendas from public, anon, authenticated;
revoke all on table public.bar_vendas_itens from public, anon, authenticated;
revoke all on table public.bar_produtos_vinculo from public, anon, authenticated;
grant all on table public.bar_vendas to service_role;
grant all on table public.bar_vendas_itens to service_role;
grant all on table public.bar_produtos_vinculo to service_role;

-- -----------------------------------------------------------------------------
-- JSON de um relatorio (uso interno)
-- -----------------------------------------------------------------------------
create or replace function private.bar_venda_json(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', v.id,
    'periodo_de', v.periodo_de,
    'periodo_ate', v.periodo_ate,
    'evento_id', v.evento_id,
    'evento_nome', e.nome,
    'origem', v.origem,
    'total_valor', v.total_valor,
    'total_quantidade', v.total_quantidade,
    'criado_em', v.criado_em,
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'grupo', i.grupo,
               'codigo', i.codigo,
               'descricao', i.descricao,
               'quantidade', i.quantidade,
               'valor', i.valor
             ) order by i.valor desc, lower(i.descricao))
        from public.bar_vendas_itens i
       where i.venda_id = v.id
    ), '[]'::jsonb)
  )
  from public.bar_vendas v
  left join public.eventos e on e.id = v.evento_id
  where v.id = p_id;
$$;

revoke all on function private.bar_venda_json(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Importar / listar / excluir relatorios
-- -----------------------------------------------------------------------------
create or replace function public.salvar_bar_venda_admin(
  p_de date,
  p_ate date,
  p_evento_id uuid,
  p_origem text,
  p_itens jsonb             -- [{ grupo, codigo, descricao, quantidade, valor }]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_codigo text;
  v_descricao text;
  v_quantidade numeric;
  v_valor numeric;
  v_total_valor numeric := 0;
  v_total_qtd numeric := 0;
  v_n integer := 0;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_ate < p_de then
    raise exception 'Periodo do relatorio invalido' using errcode = '22023';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'O relatorio nao tem produtos' using errcode = '22023';
  end if;
  if jsonb_array_length(p_itens) > 2000 then
    raise exception 'Relatorio grande demais' using errcode = '22023';
  end if;
  if p_evento_id is not null and not exists (select 1 from public.eventos e where e.id = p_evento_id) then
    raise exception 'Evento nao encontrado' using errcode = '23503';
  end if;
  if exists (select 1 from public.bar_vendas v where v.periodo_de = p_de and v.periodo_ate = p_ate) then
    raise exception 'Ja existe um relatorio do bar com esse periodo' using errcode = '23505';
  end if;

  insert into public.bar_vendas (periodo_de, periodo_ate, evento_id, origem, criado_por)
  values (p_de, p_ate, p_evento_id, left(nullif(btrim(coalesce(p_origem, '')), ''), 500), auth.uid())
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_codigo := left(nullif(btrim(coalesce(v_item ->> 'codigo', '')), ''), 40);
    v_descricao := left(nullif(btrim(regexp_replace(coalesce(v_item ->> 'descricao', ''), '\s+', ' ', 'g')), ''), 200);
    v_quantidade := nullif(v_item ->> 'quantidade', '')::numeric;
    v_valor := coalesce(nullif(v_item ->> 'valor', '')::numeric, 0);
    if v_codigo is null or v_descricao is null or v_quantidade is null or v_quantidade < 0 or v_valor < 0 then
      raise exception 'Produto invalido no relatorio' using errcode = '22023';
    end if;

    insert into public.bar_vendas_itens (venda_id, grupo, codigo, descricao, quantidade, valor)
    values (v_id, left(nullif(btrim(coalesce(v_item ->> 'grupo', '')), ''), 80), v_codigo, v_descricao,
            round(v_quantidade, 3), round(v_valor, 2));

    v_total_valor := v_total_valor + round(v_valor, 2);
    v_total_qtd := v_total_qtd + round(v_quantidade, 3);
    v_n := v_n + 1;
  end loop;

  update public.bar_vendas
     set total_valor = v_total_valor, total_quantidade = v_total_qtd
   where id = v_id;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
  values (auth.uid(), 'BAR_VENDAS_IMPORTADAS_ADMIN', 'bar_vendas', v_id, null,
          jsonb_build_object('periodo_de', p_de, 'periodo_ate', p_ate, 'evento_id', p_evento_id,
                             'produtos', v_n, 'total_valor', v_total_valor));

  return private.bar_venda_json(v_id);
end;
$$;

create or replace function public.listar_bar_vendas_admin(p_limite integer default 30)
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
    select coalesce(jsonb_agg(private.bar_venda_json(v.id) order by v.periodo_de desc, v.criado_em desc), '[]'::jsonb)
      from (
        select id, periodo_de, criado_em
          from public.bar_vendas
         order by periodo_de desc, criado_em desc
         limit least(greatest(coalesce(p_limite, 30), 1), 200)
      ) v
  );
end;
$$;

create or replace function public.excluir_bar_venda_admin(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_antes jsonb;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  v_antes := private.bar_venda_json(p_id);
  if v_antes is null then
    raise exception 'Relatorio nao encontrado' using errcode = '23503';
  end if;

  delete from public.bar_vendas where id = p_id;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
  values (auth.uid(), 'BAR_VENDAS_EXCLUIDAS_ADMIN', 'bar_vendas', p_id, v_antes - 'itens', null);
end;
$$;

-- -----------------------------------------------------------------------------
-- Ligacao produto do bar -> produto da Reposicao
-- -----------------------------------------------------------------------------
create or replace function public.listar_bar_produtos_vinculo_admin()
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

  -- Todo produto que ja apareceu num relatorio, com a ligacao (se houver).
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'codigo', b.codigo,
             'descricao', b.descricao,
             'grupo', b.grupo,
             'quantidade_total', b.quantidade_total,
             'produto_id', l.produto_id,
             'vendas_por_unidade', coalesce(l.vendas_por_unidade, 1),
             'ligado', l.produto_id is not null
           ) order by (l.produto_id is not null), b.quantidade_total desc, lower(b.descricao)), '[]'::jsonb)
      from (
        select i.codigo,
               (array_agg(i.descricao order by v.periodo_de desc))[1] as descricao,
               (array_agg(i.grupo order by v.periodo_de desc))[1] as grupo,
               sum(i.quantidade) as quantidade_total
          from public.bar_vendas_itens i
          join public.bar_vendas v on v.id = i.venda_id
         group by i.codigo
      ) b
      left join public.bar_produtos_vinculo l on l.codigo = b.codigo
  );
end;
$$;

create or replace function public.salvar_bar_produto_vinculo_admin(
  p_codigo text,
  p_produto_id uuid,
  p_vendas_por_unidade numeric default 1
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_codigo text := left(nullif(btrim(coalesce(p_codigo, '')), ''), 40);
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;
  if v_codigo is null then
    raise exception 'Produto do bar invalido' using errcode = '22023';
  end if;
  if p_produto_id is not null and not exists (select 1 from public.reposicao_produtos p where p.id = p_produto_id) then
    raise exception 'Produto da reposicao nao encontrado' using errcode = '23503';
  end if;
  if coalesce(p_vendas_por_unidade, 1) <= 0 then
    raise exception 'Quantidade por unidade invalida' using errcode = '22023';
  end if;

  if p_produto_id is null then
    delete from public.bar_produtos_vinculo where codigo = v_codigo;
    return;
  end if;

  insert into public.bar_produtos_vinculo (codigo, produto_id, vendas_por_unidade, atualizado_em)
  values (v_codigo, p_produto_id, round(coalesce(p_vendas_por_unidade, 1), 3), now())
  on conflict (codigo) do update
     set produto_id = excluded.produto_id,
         vendas_por_unidade = excluded.vendas_por_unidade,
         atualizado_em = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- Consumo semanal por produto da Reposicao (nas unidades do pedido)
-- -----------------------------------------------------------------------------
create or replace function public.listar_consumo_bar_reposicao_admin(p_semanas integer default 4)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_semanas integer := least(greatest(coalesce(p_semanas, 4), 1), 52);
  v_desde date := (now() at time zone 'America/Sao_Paulo')::date - (v_semanas * 7);
  v_primeiro date;
  v_divisor numeric;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  -- Se os relatorios comecaram ha menos tempo que o periodo pedido, divide
  -- pelas semanas que realmente tem dados (para a media nao sair baixa demais).
  select min(periodo_de) into v_primeiro from public.bar_vendas where periodo_de > v_desde;
  if v_primeiro is null then
    return jsonb_build_object('semanas', 0, 'produtos', '[]'::jsonb);
  end if;
  v_divisor := least(v_semanas,
                     greatest(1, ceil((((now() at time zone 'America/Sao_Paulo')::date - v_primeiro) + 1) / 7.0)));

  return jsonb_build_object(
    'semanas', v_divisor,
    'produtos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'produto_id', c.produto_id,
               'total', round(c.total, 3),
               'media_semanal', round(c.total / v_divisor, 3)
             ))
        from (
          select l.produto_id, sum(i.quantidade / l.vendas_por_unidade) as total
            from public.bar_vendas_itens i
            join public.bar_vendas v on v.id = i.venda_id
            join public.bar_produtos_vinculo l on l.codigo = i.codigo
           where v.periodo_de > v_desde
             and l.produto_id is not null
           group by l.produto_id
        ) c
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.salvar_bar_venda_admin(date, date, uuid, text, jsonb) from public, anon;
revoke all on function public.listar_bar_vendas_admin(integer) from public, anon;
revoke all on function public.excluir_bar_venda_admin(uuid) from public, anon;
revoke all on function public.listar_bar_produtos_vinculo_admin() from public, anon;
revoke all on function public.salvar_bar_produto_vinculo_admin(text, uuid, numeric) from public, anon;
revoke all on function public.listar_consumo_bar_reposicao_admin(integer) from public, anon;
grant execute on function public.salvar_bar_venda_admin(date, date, uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.listar_bar_vendas_admin(integer) to authenticated, service_role;
grant execute on function public.excluir_bar_venda_admin(uuid) to authenticated, service_role;
grant execute on function public.listar_bar_produtos_vinculo_admin() to authenticated, service_role;
grant execute on function public.salvar_bar_produto_vinculo_admin(text, uuid, numeric) to authenticated, service_role;
grant execute on function public.listar_consumo_bar_reposicao_admin(integer) to authenticated, service_role;
