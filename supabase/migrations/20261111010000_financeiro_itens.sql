-- =============================================================================
-- GZ1 Ingresso - Financeiro: itens dos comprovantes (historico de compras)
-- Migration: financeiro_itens
--
-- Quando um comprovante tem varios produtos (ex.: compra de bebidas), a IA le
-- os itens e a pessoa confere no formulario. Os itens ficam guardados ligados
-- ao lancamento, para consultar depois quanto se comprou de cada coisa e por
-- qual preco.
--
--   * public.financeiro_lancamento_itens: descricao, quantidade e valor total
--     de cada item de um lancamento (ENTRADA ou SAIDA).
--
-- RPCs (somente ADMINISTRADOR):
--   salvar_financeiro_lancamento_itens_admin(lancamento, itens[{descricao, quantidade, valor_total}])
--       substitui todos os itens do lancamento (lista vazia apaga).
--   listar_financeiro_lancamento_itens_admin(lancamento)
--   listar_financeiro_itens_historico_admin(de, ate, busca)
--       itens de lancamentos nao cancelados no periodo + resumo por produto.
--
-- Nao altera nenhuma tabela nem funcao existente.
-- =============================================================================

create table if not exists public.financeiro_lancamento_itens (
  id uuid
    constraint pk_financeiro_lancamento_itens primary key default gen_random_uuid(),
  lancamento_id uuid not null
    constraint fk_financeiro_lancamento_itens_lancamento
      references public.financeiro_lancamentos (id) on delete cascade,
  ordem integer not null default 0,
  descricao text not null
    constraint ck_financeiro_lancamento_itens_descricao check (btrim(descricao) <> ''),
  quantidade numeric(12, 3) not null default 1
    constraint ck_financeiro_lancamento_itens_quantidade check (quantidade > 0),
  valor_total numeric(12, 2) not null
    constraint ck_financeiro_lancamento_itens_valor check (valor_total >= 0),
  criado_em timestamptz not null default now()
);

create index if not exists ix_financeiro_lancamento_itens_lancamento
  on public.financeiro_lancamento_itens (lancamento_id);

comment on table public.financeiro_lancamento_itens is
  'Itens (produtos) de um lancamento do caixa, lidos do comprovante e conferidos pela pessoa.';

alter table public.financeiro_lancamento_itens enable row level security;
revoke all on table public.financeiro_lancamento_itens from public, anon, authenticated;
grant all on table public.financeiro_lancamento_itens to service_role;

-- -----------------------------------------------------------------------------
-- Salvar (substitui a lista inteira)
-- -----------------------------------------------------------------------------
create or replace function public.salvar_financeiro_lancamento_itens_admin(
  p_lancamento_id uuid,
  p_itens jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_lancamento public.financeiro_lancamentos%rowtype;
  v_item jsonb;
  v_ordem integer := 0;
  v_descricao text;
  v_quantidade numeric;
  v_valor numeric;
  v_antes jsonb;
  v_novos jsonb;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  select * into v_lancamento from public.financeiro_lancamentos where id = p_lancamento_id for update;
  if not found then
    raise exception 'Lancamento % nao encontrado', p_lancamento_id using errcode = '23503';
  end if;
  if v_lancamento.cancelado_em is not null then
    raise exception 'Lancamento cancelado nao pode ser alterado' using errcode = '23514';
  end if;
  if v_lancamento.tipo = 'TRANSFERENCIA' then
    raise exception 'Transferencia nao tem itens' using errcode = '22023';
  end if;

  if p_itens is not null and jsonb_typeof(p_itens) <> 'array' then
    raise exception 'Itens invalidos' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) > 200 then
    raise exception 'Itens demais (maximo 200)' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'descricao', i.descricao, 'quantidade', i.quantidade, 'valor_total', i.valor_total
         ) order by i.ordem), '[]'::jsonb)
    into v_antes
    from public.financeiro_lancamento_itens i
   where i.lancamento_id = p_lancamento_id;

  delete from public.financeiro_lancamento_itens where lancamento_id = p_lancamento_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    v_descricao := nullif(btrim(coalesce(v_item->>'descricao', '')), '');
    if v_descricao is null then
      continue;
    end if;
    begin
      v_quantidade := coalesce(nullif(v_item->>'quantidade', '')::numeric, 1);
      v_valor := coalesce(nullif(v_item->>'valor_total', '')::numeric, 0);
    exception when others then
      raise exception 'Item invalido: %', v_descricao using errcode = '22023';
    end;
    if v_quantidade <= 0 or v_valor < 0 then
      raise exception 'Item invalido: %', v_descricao using errcode = '22023';
    end if;
    v_ordem := v_ordem + 1;
    insert into public.financeiro_lancamento_itens (lancamento_id, ordem, descricao, quantidade, valor_total)
    values (p_lancamento_id, v_ordem, left(v_descricao, 200), round(v_quantidade, 3), round(v_valor, 2));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
           'descricao', i.descricao, 'quantidade', i.quantidade, 'valor_total', i.valor_total
         ) order by i.ordem), '[]'::jsonb)
    into v_novos
    from public.financeiro_lancamento_itens i
   where i.lancamento_id = p_lancamento_id;

  if v_antes is distinct from v_novos then
    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (auth.uid(), 'FINANCEIRO_ITENS_SALVOS_ADMIN', 'financeiro_lancamentos', p_lancamento_id,
            jsonb_build_object('itens', v_antes), jsonb_build_object('itens', v_novos));
  end if;

  return jsonb_build_object('lancamento_id', p_lancamento_id, 'itens', v_ordem);
end;
$$;

-- -----------------------------------------------------------------------------
-- Itens de um lancamento (para editar)
-- -----------------------------------------------------------------------------
create or replace function public.listar_financeiro_lancamento_itens_admin(p_lancamento_id uuid)
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
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', i.id,
             'descricao', i.descricao,
             'quantidade', i.quantidade,
             'valor_total', i.valor_total
           ) order by i.ordem), '[]'::jsonb)
      from public.financeiro_lancamento_itens i
     where i.lancamento_id = p_lancamento_id
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Historico de itens comprados
-- -----------------------------------------------------------------------------
create or replace function public.listar_financeiro_itens_historico_admin(
  p_de date default null,
  p_ate date default null,
  p_busca text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_resultado jsonb;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  with base as (
    select i.id, i.descricao, i.quantidade, i.valor_total,
           case when i.quantidade > 0 then round(i.valor_total / i.quantidade, 2) else null end as valor_unitario,
           l.id as lancamento_id, l.tipo, l.data, l.descricao as lancamento_descricao,
           l.comprovante_path, c.nome as categoria_nome, ct.nome as conta_nome, e.nome as evento_nome,
           lower(btrim(regexp_replace(i.descricao, '\s+', ' ', 'g'))) as chave
      from public.financeiro_lancamento_itens i
      join public.financeiro_lancamentos l on l.id = i.lancamento_id
      left join public.financeiro_categorias c on c.id = l.categoria_id
      left join public.financeiro_contas ct on ct.id = l.conta_id
      left join public.eventos e on e.id = l.evento_id
     where l.cancelado_em is null
       and (p_de is null or l.data >= p_de)
       and (p_ate is null or l.data <= p_ate)
       and (
         v_busca is null
         or i.descricao ilike '%' || v_busca || '%'
         or coalesce(l.descricao, '') ilike '%' || v_busca || '%'
       )
  ),
  resumo as (
    select min(b.descricao) as descricao,
           count(*) as compras,
           sum(b.quantidade) as quantidade,
           sum(b.valor_total) as valor_total,
           case when sum(b.quantidade) > 0 then round(sum(b.valor_total) / sum(b.quantidade), 2) else null end as preco_medio,
           (array_agg(b.valor_unitario order by b.data desc, b.id))[1] as ultimo_preco,
           max(b.data) as ultima_data,
           min(b.valor_unitario) as menor_preco,
           max(b.valor_unitario) as maior_preco
      from base b
     group by b.chave
  )
  select jsonb_build_object(
    'totais', jsonb_build_object(
      'itens', (select count(*) from base),
      'valor_total', (select coalesce(sum(valor_total), 0) from base)
    ),
    'produtos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'descricao', r.descricao,
               'compras', r.compras,
               'quantidade', r.quantidade,
               'valor_total', r.valor_total,
               'preco_medio', r.preco_medio,
               'ultimo_preco', r.ultimo_preco,
               'ultima_data', r.ultima_data,
               'menor_preco', r.menor_preco,
               'maior_preco', r.maior_preco
             ) order by r.valor_total desc, r.descricao)
        from resumo r
    ), '[]'::jsonb),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id,
               'descricao', b.descricao,
               'quantidade', b.quantidade,
               'valor_total', b.valor_total,
               'valor_unitario', b.valor_unitario,
               'lancamento_id', b.lancamento_id,
               'tipo', b.tipo,
               'data', b.data,
               'lancamento_descricao', b.lancamento_descricao,
               'comprovante_path', b.comprovante_path,
               'categoria_nome', b.categoria_nome,
               'conta_nome', b.conta_nome,
               'evento_nome', b.evento_nome
             ) order by b.data desc, b.lancamento_id, b.descricao)
        from (select * from base order by data desc limit 1000) b
    ), '[]'::jsonb)
  )
  into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.salvar_financeiro_lancamento_itens_admin(uuid, jsonb) from public, anon;
revoke all on function public.listar_financeiro_lancamento_itens_admin(uuid) from public, anon;
revoke all on function public.listar_financeiro_itens_historico_admin(date, date, text) from public, anon;
grant execute on function public.salvar_financeiro_lancamento_itens_admin(uuid, jsonb) to authenticated, service_role;
grant execute on function public.listar_financeiro_lancamento_itens_admin(uuid) to authenticated, service_role;
grant execute on function public.listar_financeiro_itens_historico_admin(date, date, text) to authenticated, service_role;
