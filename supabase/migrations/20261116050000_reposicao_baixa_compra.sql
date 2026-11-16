-- =============================================================================
-- GZ1 Ingresso - Reposicao: dar baixa no pedido da semana pela saida do caixa
-- Migration: reposicao_baixa_compra
--
-- Depois de lancar a saida da compra (com os itens da nota), o administrador
-- confirma quais itens sao produtos da Reposicao. Para cada um:
--
--   * o item do pedido da semana (ABERTO) fica marcado como "pedido";
--   * a quantidade comprada fica guardada (public.reposicao_baixas, ligada
--     a saida), e aparece no pedido como "Comprado";
--   * o ultimo preco do produto vira o preco pago por embalagem;
--   * o nome da nota fica lembrado para o produto (reposicao_nomes_compra).
--
-- Dar baixa de novo pela mesma saida substitui as quantidades daquela saida
-- (nao soma duas vezes).
--
-- RPC (somente ADMINISTRADOR):
--   dar_baixa_reposicao_compra_admin(lancamento, itens[{nome, produto_id,
--     quantidade, valor_total, ignorar}])
--
-- Altera private.reposicao_pedido_json (acrescenta 'quantidade_comprada').
-- =============================================================================

create table if not exists public.reposicao_baixas (
  id uuid
    constraint pk_reposicao_baixas primary key default gen_random_uuid(),
  pedido_item_id uuid not null
    constraint fk_reposicao_baixas_item
      references public.reposicao_pedido_itens (id) on delete cascade,
  lancamento_id uuid not null
    constraint fk_reposicao_baixas_lancamento
      references public.financeiro_lancamentos (id) on delete cascade,
  quantidade numeric(12, 3) not null
    constraint ck_reposicao_baixas_quantidade check (quantidade > 0),
  valor_total numeric(12, 2) null,
  criado_por uuid null,
  criado_em timestamptz not null default now(),
  constraint uq_reposicao_baixas_item_lancamento unique (pedido_item_id, lancamento_id)
);

create index if not exists ix_reposicao_baixas_lancamento
  on public.reposicao_baixas (lancamento_id);

comment on table public.reposicao_baixas is
  'Quanto de cada item do pedido de reposicao foi comprado em cada saida do caixa.';

alter table public.reposicao_baixas enable row level security;
revoke all on table public.reposicao_baixas from public, anon, authenticated;
grant all on table public.reposicao_baixas to service_role;

-- -----------------------------------------------------------------------------
-- Pedido em JSON: agora com a quantidade comprada (soma das baixas)
-- -----------------------------------------------------------------------------
create or replace function private.reposicao_pedido_json(p_pedido_id uuid, p_somente_com_quantidade boolean default false)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', pe.id,
    'status', pe.status,
    'criado_em', pe.criado_em,
    'finalizado_em', pe.finalizado_em,
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id,
               'produto_id', i.produto_id,
               'nome', i.nome,
               'unidade', i.unidade,
               'unidades_por_embalagem', i.unidades_por_embalagem,
               'unidade_avulsa', i.unidade_avulsa,
               'fornecedor', i.fornecedor,
               'preco', i.preco,
               'quantidade_ideal', i.quantidade_ideal,
               'estoque_atual', i.estoque_atual,
               'estoque_fechados', i.estoque_fechados,
               'estoque_soltos', i.estoque_soltos,
               'quantidade', i.quantidade,
               'pedido_feito', i.pedido_feito,
               'pedido_feito_em', i.pedido_feito_em,
               'quantidade_comprada', (select sum(b.quantidade) from public.reposicao_baixas b where b.pedido_item_id = i.id)
             ) order by lower(coalesce(i.fornecedor, '')), lower(i.nome))
        from public.reposicao_pedido_itens i
       where i.pedido_id = pe.id
         and (not p_somente_com_quantidade or i.quantidade > 0)
    ), '[]'::jsonb)
  )
  from public.reposicao_pedidos pe
  where pe.id = p_pedido_id;
$$;

-- -----------------------------------------------------------------------------
-- Dar baixa
-- -----------------------------------------------------------------------------
create or replace function public.dar_baixa_reposicao_compra_admin(p_lancamento_id uuid, p_itens jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pedido_id uuid;
  v_item jsonb;
  v_nome text;
  v_produto public.reposicao_produtos;
  v_item_id uuid;
  v_qtd numeric;
  v_valor numeric;
  v_baixados integer := 0;
  v_produtos uuid[] := '{}';
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.financeiro_lancamentos
     where id = p_lancamento_id and tipo = 'SAIDA' and cancelado_em is null
  ) then
    raise exception 'Saida nao encontrada' using errcode = 'P0002';
  end if;

  select id into v_pedido_id from public.reposicao_pedidos where status = 'ABERTO' for update;
  if v_pedido_id is null then
    raise exception 'Nenhum pedido da semana aberto' using errcode = 'P0002';
  end if;

  -- Baixas anteriores desta mesma saida sao refeitas do zero.
  delete from public.reposicao_baixas b
   using public.reposicao_pedido_itens i
   where b.pedido_item_id = i.id
     and i.pedido_id = v_pedido_id
     and b.lancamento_id = p_lancamento_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    v_nome := left(nullif(regexp_replace(btrim(coalesce(v_item->>'nome', '')), '\s+', ' ', 'g'), ''), 120);

    -- "Nao e da reposicao": so lembra o nome para nao sugerir de novo.
    if nullif(v_item->>'produto_id', '') is null then
      if v_nome is not null and coalesce((v_item->>'ignorar')::boolean, false) then
        insert into public.reposicao_nomes_compra (nome, produto_id)
        values (v_nome, null)
        on conflict (lower(regexp_replace(btrim(nome), '\s+', ' ', 'g')))
        do update set produto_id = null;
      end if;
      continue;
    end if;

    select * into v_produto from public.reposicao_produtos where id = (v_item->>'produto_id')::uuid;
    if v_produto.id is null then
      raise exception 'Produto nao encontrado' using errcode = 'P0002';
    end if;

    v_qtd := round(coalesce((v_item->>'quantidade')::numeric, 0), 3);
    if v_qtd <= 0 then
      raise exception 'Quantidade comprada invalida' using errcode = '22023';
    end if;
    v_valor := round(nullif(v_item->>'valor_total', '')::numeric, 2);

    -- Item do produto no pedido aberto (cria se o produto ficou de fora).
    select id into v_item_id
      from public.reposicao_pedido_itens
     where pedido_id = v_pedido_id and produto_id = v_produto.id
     limit 1;
    if v_item_id is null then
      insert into public.reposicao_pedido_itens
        (pedido_id, produto_id, nome, unidade, unidades_por_embalagem, unidade_avulsa, fornecedor, preco, quantidade_ideal)
      values (v_pedido_id, v_produto.id, v_produto.nome, v_produto.unidade, v_produto.unidades_por_embalagem,
              v_produto.unidade_avulsa, v_produto.fornecedor, v_produto.ultimo_preco, v_produto.quantidade_ideal)
      returning id into v_item_id;
    end if;

    insert into public.reposicao_baixas (pedido_item_id, lancamento_id, quantidade, valor_total, criado_por)
    values (v_item_id, p_lancamento_id, v_qtd, v_valor, auth.uid())
    on conflict (pedido_item_id, lancamento_id)
    do update set quantidade = public.reposicao_baixas.quantidade + excluded.quantidade,
                  valor_total = case
                    when public.reposicao_baixas.valor_total is null or excluded.valor_total is null then null
                    else public.reposicao_baixas.valor_total + excluded.valor_total
                  end;

    -- Marca como pedido; se nao estava no pedido, a quantidade vira a comprada
    -- (para aparecer no historico ao finalizar).
    update public.reposicao_pedido_itens
       set pedido_feito = true,
           pedido_feito_em = coalesce(pedido_feito_em, now()),
           quantidade = case when quantidade > 0 then quantidade else v_qtd end
     where id = v_item_id;

    if v_nome is not null then
      insert into public.reposicao_nomes_compra (nome, produto_id)
      values (v_nome, v_produto.id)
      on conflict (lower(regexp_replace(btrim(nome), '\s+', ' ', 'g')))
      do update set produto_id = excluded.produto_id;
    end if;

    if not v_produto.id = any(v_produtos) then
      v_produtos := v_produtos || v_produto.id;
      v_baixados := v_baixados + 1;
    end if;
  end loop;

  -- Ultimo preco = preco pago por embalagem nesta saida.
  update public.reposicao_produtos p
     set ultimo_preco = round(b.valor_total / b.quantidade, 2)
    from public.reposicao_baixas b
    join public.reposicao_pedido_itens i on i.id = b.pedido_item_id
   where b.lancamento_id = p_lancamento_id
     and i.pedido_id = v_pedido_id
     and p.id = i.produto_id
     and b.valor_total is not null and b.valor_total > 0;

  update public.reposicao_pedido_itens i
     set preco = round(b.valor_total / b.quantidade, 2)
    from public.reposicao_baixas b
   where b.pedido_item_id = i.id
     and b.lancamento_id = p_lancamento_id
     and i.pedido_id = v_pedido_id
     and b.valor_total is not null and b.valor_total > 0;

  return jsonb_build_object('pedido_id', v_pedido_id, 'baixados', v_baixados);
end;
$$;

revoke all on function public.dar_baixa_reposicao_compra_admin(uuid, jsonb) from public, anon;
grant execute on function public.dar_baixa_reposicao_compra_admin(uuid, jsonb) to authenticated, service_role;
