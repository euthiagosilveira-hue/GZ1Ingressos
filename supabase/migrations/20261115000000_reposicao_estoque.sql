-- =============================================================================
-- GZ1 Ingresso - Reposicao semanal de estoque (Financeiro > Reposicao)
-- Migration: reposicao_estoque
--
-- A galeria faz o pedido de reposicao (bebidas, gelo, descartaveis...) toda
-- semana. Esta migration cria:
--
--   * public.reposicao_produtos: produtos que a galeria costuma pedir
--     (nome, unidade, fornecedor, ultimo preco, quantidade ideal na semana).
--   * public.reposicao_pedidos: um pedido por semana (ABERTO ou FINALIZADO).
--     So pode haver um pedido ABERTO por vez.
--   * public.reposicao_pedido_itens: cada produto dentro do pedido, com o que
--     tem hoje, quanto pedir e se ja foi pedido ao fornecedor (checklist).
--     Nome/unidade/fornecedor/preco ficam copiados no item, para o historico
--     nao mudar se o produto for editado ou excluido depois.
--
-- Nao lanca nada no caixa: as saidas continuam sendo lancadas como hoje.
--
-- RPCs (somente ADMINISTRADOR):
--   listar_reposicao_produtos_admin()
--   salvar_reposicao_produto_admin(id, nome, unidade, fornecedor, ultimo_preco, quantidade_ideal, ativo)
--   excluir_reposicao_produto_admin(id)
--   importar_reposicao_produtos_admin(itens[{nome, ultimo_preco}])
--   obter_reposicao_pedido_aberto_admin()
--   iniciar_reposicao_pedido_admin()
--   salvar_reposicao_pedido_item_admin(item, estoque_atual, quantidade, pedido_feito)
--   finalizar_reposicao_pedido_admin(pedido)
--   descartar_reposicao_pedido_admin(pedido)
--   listar_reposicao_pedidos_admin(limite)
--
-- Nao altera nenhuma tabela nem funcao existente.
-- =============================================================================

create table if not exists public.reposicao_produtos (
  id uuid
    constraint pk_reposicao_produtos primary key default gen_random_uuid(),
  nome text not null
    constraint ck_reposicao_produtos_nome check (btrim(nome) <> ''),
  unidade text not null default 'unidade',
  fornecedor text,
  ultimo_preco numeric(12, 2)
    constraint ck_reposicao_produtos_preco check (ultimo_preco is null or ultimo_preco >= 0),
  quantidade_ideal numeric(12, 3) not null default 0
    constraint ck_reposicao_produtos_ideal check (quantidade_ideal >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists ux_reposicao_produtos_nome
  on public.reposicao_produtos (lower(btrim(nome)));

comment on table public.reposicao_produtos is
  'Produtos que a galeria pede na reposicao semanal de estoque.';

create table if not exists public.reposicao_pedidos (
  id uuid
    constraint pk_reposicao_pedidos primary key default gen_random_uuid(),
  status text not null default 'ABERTO'
    constraint ck_reposicao_pedidos_status check (status in ('ABERTO', 'FINALIZADO')),
  criado_por uuid,
  criado_em timestamptz not null default now(),
  finalizado_em timestamptz
);

create unique index if not exists ux_reposicao_pedidos_um_aberto
  on public.reposicao_pedidos ((true)) where status = 'ABERTO';

comment on table public.reposicao_pedidos is
  'Pedido semanal de reposicao de estoque. So um pode estar ABERTO por vez.';

create table if not exists public.reposicao_pedido_itens (
  id uuid
    constraint pk_reposicao_pedido_itens primary key default gen_random_uuid(),
  pedido_id uuid not null
    constraint fk_reposicao_pedido_itens_pedido
      references public.reposicao_pedidos (id) on delete cascade,
  produto_id uuid
    constraint fk_reposicao_pedido_itens_produto
      references public.reposicao_produtos (id) on delete set null,
  nome text not null,
  unidade text not null default 'unidade',
  fornecedor text,
  preco numeric(12, 2),
  quantidade_ideal numeric(12, 3) not null default 0,
  estoque_atual numeric(12, 3)
    constraint ck_reposicao_pedido_itens_estoque check (estoque_atual is null or estoque_atual >= 0),
  quantidade numeric(12, 3) not null default 0
    constraint ck_reposicao_pedido_itens_quantidade check (quantidade >= 0),
  pedido_feito boolean not null default false,
  pedido_feito_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create index if not exists ix_reposicao_pedido_itens_pedido
  on public.reposicao_pedido_itens (pedido_id);
create unique index if not exists ux_reposicao_pedido_itens_produto
  on public.reposicao_pedido_itens (pedido_id, produto_id) where produto_id is not null;

comment on table public.reposicao_pedido_itens is
  'Itens do pedido de reposicao: estoque de hoje, quantidade a pedir e se ja foi pedido.';

alter table public.reposicao_produtos enable row level security;
alter table public.reposicao_pedidos enable row level security;
alter table public.reposicao_pedido_itens enable row level security;
revoke all on table public.reposicao_produtos from public, anon, authenticated;
revoke all on table public.reposicao_pedidos from public, anon, authenticated;
revoke all on table public.reposicao_pedido_itens from public, anon, authenticated;
grant all on table public.reposicao_produtos to service_role;
grant all on table public.reposicao_pedidos to service_role;
grant all on table public.reposicao_pedido_itens to service_role;

-- -----------------------------------------------------------------------------
-- JSON de um produto / de um pedido (uso interno)
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
               'fornecedor', i.fornecedor,
               'preco', i.preco,
               'quantidade_ideal', i.quantidade_ideal,
               'estoque_atual', i.estoque_atual,
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

revoke all on function private.reposicao_produto_json(public.reposicao_produtos) from public, anon, authenticated;
revoke all on function private.reposicao_pedido_json(uuid, boolean) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Produtos
-- -----------------------------------------------------------------------------
create or replace function public.listar_reposicao_produtos_admin()
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
    select coalesce(jsonb_agg(private.reposicao_produto_json(p)
             order by p.ativo desc, lower(coalesce(p.fornecedor, '')), lower(p.nome)), '[]'::jsonb)
      from public.reposicao_produtos p
  );
end;
$$;

create or replace function public.salvar_reposicao_produto_admin(
  p_id uuid,
  p_nome text,
  p_unidade text,
  p_fornecedor text,
  p_ultimo_preco numeric,
  p_quantidade_ideal numeric,
  p_ativo boolean default true
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

  if exists (
    select 1 from public.reposicao_produtos
     where lower(btrim(nome)) = lower(v_nome)
       and (p_id is null or id <> p_id)
  ) then
    raise exception 'Ja existe um produto com esse nome' using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.reposicao_produtos (nome, unidade, fornecedor, ultimo_preco, quantidade_ideal, ativo)
    values (v_nome, v_unidade, v_fornecedor, round(p_ultimo_preco, 2), round(coalesce(p_quantidade_ideal, 0), 3),
            coalesce(p_ativo, true))
    returning * into v_produto;
  else
    update public.reposicao_produtos
       set nome = v_nome,
           unidade = v_unidade,
           fornecedor = v_fornecedor,
           ultimo_preco = round(p_ultimo_preco, 2),
           quantidade_ideal = round(coalesce(p_quantidade_ideal, 0), 3),
           ativo = coalesce(p_ativo, true),
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
           fornecedor = v_produto.fornecedor,
           preco = v_produto.ultimo_preco,
           quantidade_ideal = v_produto.quantidade_ideal,
           atualizado_em = now()
     where pedido_id = v_pedido_id and produto_id = v_produto.id;

    if not found and v_produto.ativo then
      insert into public.reposicao_pedido_itens
        (pedido_id, produto_id, nome, unidade, fornecedor, preco, quantidade_ideal)
      values (v_pedido_id, v_produto.id, v_produto.nome, v_produto.unidade, v_produto.fornecedor,
              v_produto.ultimo_preco, v_produto.quantidade_ideal);
    elsif not v_produto.ativo then
      -- Produto desativado sai do pedido aberto se ainda nao tinha nada nele.
      delete from public.reposicao_pedido_itens
       where pedido_id = v_pedido_id and produto_id = v_produto.id
         and quantidade = 0 and not pedido_feito;
    end if;
  end if;

  return private.reposicao_produto_json(v_produto);
end;
$$;

create or replace function public.excluir_reposicao_produto_admin(p_id uuid)
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

  -- Sai do pedido aberto; pedidos finalizados guardam a copia do nome.
  delete from public.reposicao_pedido_itens i
   using public.reposicao_pedidos pe
   where pe.id = i.pedido_id and pe.status = 'ABERTO' and i.produto_id = p_id;

  delete from public.reposicao_produtos where id = p_id;
  if not found then
    raise exception 'Produto % nao encontrado', p_id using errcode = '23503';
  end if;
  return jsonb_build_object('id', p_id);
end;
$$;

-- Cadastra varios produtos de uma vez (ex.: vindos de "Itens comprados").
-- Nomes que ja existem sao ignorados.
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

    insert into public.reposicao_produtos (nome, unidade, fornecedor, ultimo_preco)
    values (
      v_nome,
      left(coalesce(nullif(btrim(coalesce(v_item->>'unidade', '')), ''), 'unidade'), 40),
      left(nullif(btrim(coalesce(v_item->>'fornecedor', '')), ''), 120),
      round(v_preco, 2)
    )
    returning * into v_produto;
    v_importados := v_importados + 1;

    if v_pedido_id is not null then
      insert into public.reposicao_pedido_itens
        (pedido_id, produto_id, nome, unidade, fornecedor, preco, quantidade_ideal)
      values (v_pedido_id, v_produto.id, v_produto.nome, v_produto.unidade, v_produto.fornecedor,
              v_produto.ultimo_preco, v_produto.quantidade_ideal);
    end if;
  end loop;

  return jsonb_build_object('importados', v_importados);
end;
$$;

-- -----------------------------------------------------------------------------
-- Pedido da semana
-- -----------------------------------------------------------------------------
create or replace function public.obter_reposicao_pedido_aberto_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pedido_id uuid;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  select id into v_pedido_id from public.reposicao_pedidos where status = 'ABERTO';
  if v_pedido_id is null then
    return null;
  end if;
  return private.reposicao_pedido_json(v_pedido_id);
end;
$$;

-- Abre o pedido da semana com todos os produtos ativos (ou devolve o que ja
-- esta aberto).
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
      (pedido_id, produto_id, nome, unidade, fornecedor, preco, quantidade_ideal)
    select v_pedido_id, p.id, p.nome, p.unidade, p.fornecedor, p.ultimo_preco, p.quantidade_ideal
      from public.reposicao_produtos p
     where p.ativo;
  end if;

  return private.reposicao_pedido_json(v_pedido_id);
end;
$$;

create or replace function public.salvar_reposicao_pedido_item_admin(
  p_item_id uuid,
  p_estoque_atual numeric,
  p_quantidade numeric,
  p_pedido_feito boolean
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
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;
  if p_estoque_atual is not null and p_estoque_atual < 0 then
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

  update public.reposicao_pedido_itens
     set estoque_atual = round(p_estoque_atual, 3),
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
    'quantidade', v_item.quantidade,
    'pedido_feito', v_item.pedido_feito,
    'pedido_feito_em', v_item.pedido_feito_em
  );
end;
$$;

create or replace function public.finalizar_reposicao_pedido_admin(p_pedido_id uuid)
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

  update public.reposicao_pedidos
     set status = 'FINALIZADO', finalizado_em = now()
   where id = p_pedido_id and status = 'ABERTO';
  if not found then
    raise exception 'Pedido aberto % nao encontrado', p_pedido_id using errcode = '23503';
  end if;

  -- Guarda no historico so o que foi pedido.
  delete from public.reposicao_pedido_itens where pedido_id = p_pedido_id and quantidade = 0;

  return private.reposicao_pedido_json(p_pedido_id);
end;
$$;

create or replace function public.descartar_reposicao_pedido_admin(p_pedido_id uuid)
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

  delete from public.reposicao_pedidos where id = p_pedido_id and status = 'ABERTO';
  if not found then
    raise exception 'Pedido aberto % nao encontrado', p_pedido_id using errcode = '23503';
  end if;
  return jsonb_build_object('id', p_pedido_id);
end;
$$;

create or replace function public.listar_reposicao_pedidos_admin(p_limite integer default 20)
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
    select coalesce(jsonb_agg(private.reposicao_pedido_json(pe.id, true) order by pe.finalizado_em desc), '[]'::jsonb)
      from (
        select id, finalizado_em
          from public.reposicao_pedidos
         where status = 'FINALIZADO'
         order by finalizado_em desc
         limit least(greatest(coalesce(p_limite, 20), 1), 100)
      ) pe
  );
end;
$$;

revoke all on function public.listar_reposicao_produtos_admin() from public, anon;
revoke all on function public.salvar_reposicao_produto_admin(uuid, text, text, text, numeric, numeric, boolean) from public, anon;
revoke all on function public.excluir_reposicao_produto_admin(uuid) from public, anon;
revoke all on function public.importar_reposicao_produtos_admin(jsonb) from public, anon;
revoke all on function public.obter_reposicao_pedido_aberto_admin() from public, anon;
revoke all on function public.iniciar_reposicao_pedido_admin() from public, anon;
revoke all on function public.salvar_reposicao_pedido_item_admin(uuid, numeric, numeric, boolean) from public, anon;
revoke all on function public.finalizar_reposicao_pedido_admin(uuid) from public, anon;
revoke all on function public.descartar_reposicao_pedido_admin(uuid) from public, anon;
revoke all on function public.listar_reposicao_pedidos_admin(integer) from public, anon;
grant execute on function public.listar_reposicao_produtos_admin() to authenticated, service_role;
grant execute on function public.salvar_reposicao_produto_admin(uuid, text, text, text, numeric, numeric, boolean) to authenticated, service_role;
grant execute on function public.excluir_reposicao_produto_admin(uuid) to authenticated, service_role;
grant execute on function public.importar_reposicao_produtos_admin(jsonb) to authenticated, service_role;
grant execute on function public.obter_reposicao_pedido_aberto_admin() to authenticated, service_role;
grant execute on function public.iniciar_reposicao_pedido_admin() to authenticated, service_role;
grant execute on function public.salvar_reposicao_pedido_item_admin(uuid, numeric, numeric, boolean) to authenticated, service_role;
grant execute on function public.finalizar_reposicao_pedido_admin(uuid) to authenticated, service_role;
grant execute on function public.descartar_reposicao_pedido_admin(uuid) to authenticated, service_role;
grant execute on function public.listar_reposicao_pedidos_admin(integer) to authenticated, service_role;
