-- =============================================================================
-- GZ1 Ingresso - Reposicao: embalagem dos produtos
-- Migration: reposicao_embalagem
--
-- Alguns produtos sao comprados por unidade, outros em fardo/pacote/caixa com
-- X unidades dentro. Agora cada produto tem:
--
--   * unidade               -> a EMBALAGEM de compra (fardo, caixa, unidade...)
--   * unidades_por_embalagem -> quantas unidades vem dentro (1 = compra avulsa)
--   * unidade_avulsa        -> nome da unidade solta (lata, garrafa, unidade)
--   * ultimo_preco          -> preco de UMA embalagem (como ja era)
--   * quantidade_ideal      -> agora em UNIDADES soltas (ex.: 120 latas)
--
-- No pedido da semana, "Tem hoje" e contado em embalagens fechadas + unidades
-- soltas (estoque_fechados / estoque_soltos); estoque_atual guarda o total em
-- unidades e quantidade continua sendo o numero de EMBALAGENS a pedir.
--
-- Produtos com unidades_por_embalagem = 1 continuam funcionando como antes.
--
-- Ajuste unico: produtos ainda nao configurados (unidade = 'unidade' e
-- quantidade ideal 0) cujo nome diz quantas vem ("FD/12", "FD 24 UNID",
-- "C/144") passam a ser fardo/caixa com esse numero. Da para mudar depois.
--
-- Altera: reposicao_produtos, reposicao_pedido_itens (novas colunas) e recria
-- as funcoes da reposicao. salvar_reposicao_produto_admin e
-- salvar_reposicao_pedido_item_admin ganham parametros novos com valor padrao,
-- entao a tela antiga continua funcionando ate o merge.
-- =============================================================================

alter table public.reposicao_produtos
  add column if not exists unidades_por_embalagem numeric(12, 3) not null default 1,
  add column if not exists unidade_avulsa text not null default 'unidade';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ck_reposicao_produtos_por_embalagem') then
    alter table public.reposicao_produtos
      add constraint ck_reposicao_produtos_por_embalagem check (unidades_por_embalagem > 0);
  end if;
end $$;

alter table public.reposicao_pedido_itens
  add column if not exists unidades_por_embalagem numeric(12, 3) not null default 1,
  add column if not exists unidade_avulsa text not null default 'unidade',
  add column if not exists estoque_fechados numeric(12, 3),
  add column if not exists estoque_soltos numeric(12, 3);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ck_reposicao_pedido_itens_por_embalagem') then
    alter table public.reposicao_pedido_itens
      add constraint ck_reposicao_pedido_itens_por_embalagem check (unidades_por_embalagem > 0),
      add constraint ck_reposicao_pedido_itens_fechados check (estoque_fechados is null or estoque_fechados >= 0),
      add constraint ck_reposicao_pedido_itens_soltos check (estoque_soltos is null or estoque_soltos >= 0);
  end if;
end $$;

comment on column public.reposicao_produtos.unidade is 'Embalagem de compra (fardo, caixa, unidade...).';
comment on column public.reposicao_produtos.unidades_por_embalagem is 'Quantas unidades vem em 1 embalagem (1 = compra avulsa).';
comment on column public.reposicao_produtos.quantidade_ideal is 'Quantidade ideal na semana, em UNIDADES soltas.';
comment on column public.reposicao_produtos.ultimo_preco is 'Preco de 1 embalagem.';
comment on column public.reposicao_pedido_itens.estoque_atual is 'Total em unidades soltas (fechados x por embalagem + soltos).';
comment on column public.reposicao_pedido_itens.quantidade is 'Embalagens a pedir.';

-- -----------------------------------------------------------------------------
-- Ajuste unico pelo nome (so produtos ainda nao configurados)
-- -----------------------------------------------------------------------------
with detectado as (
  select p.id,
         coalesce(
           substring(p.nome from '(?i)(?:fd|cx|c)\s*/\s*(\d{1,4})'),
           substring(p.nome from '(?i)(\d{1,4})\s*unid'),
           substring(p.nome from '(?i)fd\s+(\d{1,4})')
         )::numeric as n,
         p.nome ~* '(^|[^a-z])c\s*/\s*\d' or p.nome ~* '(^|[^a-z])cx' as caixa
    from public.reposicao_produtos p
   where p.unidade = 'unidade'
     and p.unidades_por_embalagem = 1
     and p.quantidade_ideal = 0
)
update public.reposicao_produtos p
   set unidade = case when d.caixa then 'caixa' else 'fardo' end,
       unidades_por_embalagem = d.n,
       atualizado_em = now()
  from detectado d
 where d.id = p.id and d.n > 1;

-- Pedido aberto acompanha o cadastro.
update public.reposicao_pedido_itens i
   set unidade = p.unidade,
       unidades_por_embalagem = p.unidades_por_embalagem,
       unidade_avulsa = p.unidade_avulsa
  from public.reposicao_produtos p, public.reposicao_pedidos pe
 where p.id = i.produto_id and pe.id = i.pedido_id and pe.status = 'ABERTO';

-- -----------------------------------------------------------------------------
-- JSON
-- -----------------------------------------------------------------------------
create or replace function private.reposicao_produto_json(p public.reposicao_produtos)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'nome', p.nome,
    'unidade', p.unidade,
    'unidades_por_embalagem', p.unidades_por_embalagem,
    'unidade_avulsa', p.unidade_avulsa,
    'fornecedor', p.fornecedor,
    'ultimo_preco', p.ultimo_preco,
    'quantidade_ideal', p.quantidade_ideal,
    'ativo', p.ativo,
    'atualizado_em', p.atualizado_em
  );
$$;

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
               'pedido_feito_em', i.pedido_feito_em
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
-- Salvar produto (parametros novos com padrao: null = manter / 1 ao criar)
-- -----------------------------------------------------------------------------
drop function if exists public.salvar_reposicao_produto_admin(uuid, text, text, text, numeric, numeric, boolean);

create or replace function public.salvar_reposicao_produto_admin(
  p_id uuid,
  p_nome text,
  p_unidade text,
  p_fornecedor text,
  p_ultimo_preco numeric,
  p_quantidade_ideal numeric,
  p_ativo boolean default true,
  p_unidades_por_embalagem numeric default null,
  p_unidade_avulsa text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nome text := left(nullif(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')), ''), 120);
  v_unidade text := left(coalesce(nullif(btrim(coalesce(p_unidade, '')), ''), 'unidade'), 40);
  v_fornecedor text := left(nullif(btrim(regexp_replace(coalesce(p_fornecedor, ''), '\s+', ' ', 'g')), ''), 120);
  v_avulsa text := left(nullif(btrim(coalesce(p_unidade_avulsa, '')), ''), 40);
  v_produto public.reposicao_produtos%rowtype;
  v_pedido_id uuid;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;
  if v_nome is null then
    raise exception 'Informe o nome do produto' using errcode = '22023';
  end if;
  if p_ultimo_preco is not null and p_ultimo_preco < 0 then
    raise exception 'Preco invalido' using errcode = '22023';
  end if;
  if coalesce(p_quantidade_ideal, 0) < 0 then
    raise exception 'Quantidade ideal invalida' using errcode = '22023';
  end if;
  if p_unidades_por_embalagem is not null and p_unidades_por_embalagem <= 0 then
    raise exception 'Unidades por embalagem invalida' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.reposicao_produtos
     where lower(btrim(nome)) = lower(v_nome)
       and (p_id is null or id <> p_id)
  ) then
    raise exception 'Ja existe um produto com esse nome' using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.reposicao_produtos
      (nome, unidade, fornecedor, ultimo_preco, quantidade_ideal, ativo, unidades_por_embalagem, unidade_avulsa)
    values (v_nome, v_unidade, v_fornecedor, round(p_ultimo_preco, 2), round(coalesce(p_quantidade_ideal, 0), 3),
            coalesce(p_ativo, true), round(coalesce(p_unidades_por_embalagem, 1), 3), coalesce(v_avulsa, 'unidade'))
    returning * into v_produto;
  else
    update public.reposicao_produtos
       set nome = v_nome,
           unidade = v_unidade,
           fornecedor = v_fornecedor,
           ultimo_preco = round(p_ultimo_preco, 2),
           quantidade_ideal = round(coalesce(p_quantidade_ideal, 0), 3),
           ativo = coalesce(p_ativo, true),
           unidades_por_embalagem = coalesce(round(p_unidades_por_embalagem, 3), unidades_por_embalagem),
           unidade_avulsa = coalesce(v_avulsa, unidade_avulsa),
           atualizado_em = now()
     where id = p_id
     returning * into v_produto;
    if not found then
      raise exception 'Produto % nao encontrado', p_id using errcode = '23503';
    end if;
  end if;

  -- Mantem o pedido aberto em dia com o cadastro.
  select id into v_pedido_id from public.reposicao_pedidos where status = 'ABERTO';
  if v_pedido_id is not null then
    update public.reposicao_pedido_itens
       set nome = v_produto.nome,
           unidade = v_produto.unidade,
           unidades_por_embalagem = v_produto.unidades_por_embalagem,
           unidade_avulsa = v_produto.unidade_avulsa,
           fornecedor = v_produto.fornecedor,
           preco = v_produto.ultimo_preco,
           quantidade_ideal = v_produto.quantidade_ideal,
           -- total em unidades muda se mudou o tamanho da embalagem
           estoque_atual = case
             when estoque_fechados is null and estoque_soltos is null then estoque_atual
             else coalesce(estoque_fechados, 0) * v_produto.unidades_por_embalagem + coalesce(estoque_soltos, 0)
           end,
           atualizado_em = now()
     where pedido_id = v_pedido_id and produto_id = v_produto.id;

    if not found and v_produto.ativo then
      insert into public.reposicao_pedido_itens
        (pedido_id, produto_id, nome, unidade, unidades_por_embalagem, unidade_avulsa, fornecedor, preco, quantidade_ideal)
      values (v_pedido_id, v_produto.id, v_produto.nome, v_produto.unidade, v_produto.unidades_por_embalagem,
              v_produto.unidade_avulsa, v_produto.fornecedor, v_produto.ultimo_preco, v_produto.quantidade_ideal);
    elsif not v_produto.ativo then
      delete from public.reposicao_pedido_itens
       where pedido_id = v_pedido_id and produto_id = v_produto.id
         and quantidade = 0 and not pedido_feito;
    end if;
  end if;

  return private.reposicao_produto_json(v_produto);
end;
$$;

-- -----------------------------------------------------------------------------
-- Abrir pedido (copia a embalagem)
-- -----------------------------------------------------------------------------
create or replace function public.iniciar_reposicao_pedido_admin()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pedido_id uuid;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  select id into v_pedido_id from public.reposicao_pedidos where status = 'ABERTO' for update;
  if v_pedido_id is null then
    if not exists (select 1 from public.reposicao_produtos where ativo) then
      raise exception 'Cadastre os produtos antes de montar o pedido' using errcode = '22023';
    end if;

    insert into public.reposicao_pedidos (criado_por) values (auth.uid())
    returning id into v_pedido_id;

    insert into public.reposicao_pedido_itens
      (pedido_id, produto_id, nome, unidade, unidades_por_embalagem, unidade_avulsa, fornecedor, preco, quantidade_ideal)
    select v_pedido_id, p.id, p.nome, p.unidade, p.unidades_por_embalagem, p.unidade_avulsa, p.fornecedor,
           p.ultimo_preco, p.quantidade_ideal
      from public.reposicao_produtos p
     where p.ativo;
  end if;

  return private.reposicao_pedido_json(v_pedido_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Salvar item do pedido (fechados + soltos)
-- -----------------------------------------------------------------------------
drop function if exists public.salvar_reposicao_pedido_item_admin(uuid, numeric, numeric, boolean);

create or replace function public.salvar_reposicao_pedido_item_admin(
  p_item_id uuid,
  p_estoque_atual numeric,
  p_quantidade numeric,
  p_pedido_feito boolean,
  p_estoque_fechados numeric default null,
  p_estoque_soltos numeric default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_item public.reposicao_pedido_itens%rowtype;
  v_status text;
  v_total numeric;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;
  if (p_estoque_atual is not null and p_estoque_atual < 0)
     or (p_estoque_fechados is not null and p_estoque_fechados < 0)
     or (p_estoque_soltos is not null and p_estoque_soltos < 0) then
    raise exception 'Estoque invalido' using errcode = '22023';
  end if;
  if coalesce(p_quantidade, 0) < 0 then
    raise exception 'Quantidade invalida' using errcode = '22023';
  end if;

  select * into v_item
    from public.reposicao_pedido_itens
   where id = p_item_id
   for update;
  if not found then
    raise exception 'Item % nao encontrado', p_item_id using errcode = '23503';
  end if;
  select status into v_status from public.reposicao_pedidos where id = v_item.pedido_id;
  if v_status <> 'ABERTO' then
    raise exception 'Este pedido ja foi finalizado' using errcode = '23514';
  end if;

  -- Com fechados/soltos, o total em unidades e calculado aqui.
  if p_estoque_fechados is not null or p_estoque_soltos is not null then
    v_total := coalesce(p_estoque_fechados, 0) * v_item.unidades_por_embalagem + coalesce(p_estoque_soltos, 0);
  else
    v_total := p_estoque_atual;
  end if;

  update public.reposicao_pedido_itens
     set estoque_atual = round(v_total, 3),
         estoque_fechados = round(p_estoque_fechados, 3),
         estoque_soltos = round(p_estoque_soltos, 3),
         quantidade = round(coalesce(p_quantidade, 0), 3),
         pedido_feito = coalesce(p_pedido_feito, false),
         pedido_feito_em = case
           when coalesce(p_pedido_feito, false) and not v_item.pedido_feito then now()
           when coalesce(p_pedido_feito, false) then v_item.pedido_feito_em
           else null
         end,
         atualizado_em = now()
   where id = p_item_id
   returning * into v_item;

  return jsonb_build_object(
    'id', v_item.id,
    'estoque_atual', v_item.estoque_atual,
    'estoque_fechados', v_item.estoque_fechados,
    'estoque_soltos', v_item.estoque_soltos,
    'quantidade', v_item.quantidade,
    'pedido_feito', v_item.pedido_feito,
    'pedido_feito_em', v_item.pedido_feito_em
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Importar: produtos novos ja entram com o pedido aberto com a embalagem
-- -----------------------------------------------------------------------------
create or replace function public.importar_reposicao_produtos_admin(p_itens jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_nome text;
  v_preco numeric;
  v_importados integer := 0;
  v_pedido_id uuid;
  v_produto public.reposicao_produtos%rowtype;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'Itens invalidos' using errcode = '22023';
  end if;
  if jsonb_array_length(p_itens) > 300 then
    raise exception 'Itens demais (maximo 300)' using errcode = '22023';
  end if;

  select id into v_pedido_id from public.reposicao_pedidos where status = 'ABERTO';

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_nome := left(nullif(btrim(regexp_replace(coalesce(v_item->>'nome', ''), '\s+', ' ', 'g')), ''), 120);
    if v_nome is null then
      continue;
    end if;
    if exists (select 1 from public.reposicao_produtos where lower(btrim(nome)) = lower(v_nome)) then
      continue;
    end if;
    begin
      v_preco := nullif(v_item->>'ultimo_preco', '')::numeric;
    exception when others then
      v_preco := null;
    end;
    if v_preco is not null and v_preco < 0 then
      v_preco := null;
    end if;

    insert into public.reposicao_produtos (nome, unidade, fornecedor, ultimo_preco, unidades_por_embalagem)
    values (
      v_nome,
      left(coalesce(nullif(btrim(coalesce(v_item->>'unidade', '')), ''), 'unidade'), 40),
      left(nullif(btrim(coalesce(v_item->>'fornecedor', '')), ''), 120),
      round(v_preco, 2),
      greatest(coalesce(nullif(v_item->>'unidades_por_embalagem', '')::numeric, 1), 1)
    )
    returning * into v_produto;
    v_importados := v_importados + 1;

    if v_pedido_id is not null then
      insert into public.reposicao_pedido_itens
        (pedido_id, produto_id, nome, unidade, unidades_por_embalagem, unidade_avulsa, fornecedor, preco, quantidade_ideal)
      values (v_pedido_id, v_produto.id, v_produto.nome, v_produto.unidade, v_produto.unidades_por_embalagem,
              v_produto.unidade_avulsa, v_produto.fornecedor, v_produto.ultimo_preco, v_produto.quantidade_ideal);
    end if;
  end loop;

  return jsonb_build_object('importados', v_importados);
end;
$$;

revoke all on function private.reposicao_produto_json(public.reposicao_produtos) from public, anon, authenticated;
revoke all on function private.reposicao_pedido_json(uuid, boolean) from public, anon, authenticated;
revoke all on function public.salvar_reposicao_produto_admin(uuid, text, text, text, numeric, numeric, boolean, numeric, text) from public, anon;
revoke all on function public.salvar_reposicao_pedido_item_admin(uuid, numeric, numeric, boolean, numeric, numeric) from public, anon;
grant execute on function public.salvar_reposicao_produto_admin(uuid, text, text, text, numeric, numeric, boolean, numeric, text) to authenticated, service_role;
grant execute on function public.salvar_reposicao_pedido_item_admin(uuid, numeric, numeric, boolean, numeric, numeric) to authenticated, service_role;
