-- =============================================================================
-- GZ1 Ingresso - Reposicao: lembrar o nome da nota de cada produto
-- Migration: reposicao_nomes_compra
--
-- Problema: "Puxar de Itens comprados" comparava so pelo nome. Se o produto
-- foi renomeado na Reposicao, o nome que vem da nota voltava como "novo".
--
-- Esta migration cria public.reposicao_nomes_compra: cada nome que aparece
-- nos comprovantes fica ligado a um produto da Reposicao, ou marcado como
-- "nao e de reposicao" (produto_id nulo), para nao aparecer de novo.
--
--   * Todo produto ja cadastrado tem o nome atual registrado aqui.
--   * Todo produto novo (cadastrado a mao ou puxado) registra o nome que
--     tinha ao ser criado, entao renomear depois nao faz ele voltar.
--
-- RPCs (somente ADMINISTRADOR):
--   listar_reposicao_nomes_compra_admin()
--   vincular_reposicao_nome_compra_admin(nome, produto_id | null = ignorar)
--
-- Nao altera nenhuma funcao existente.
-- =============================================================================

create table if not exists public.reposicao_nomes_compra (
  id uuid
    constraint pk_reposicao_nomes_compra primary key default gen_random_uuid(),
  nome text not null
    constraint ck_reposicao_nomes_compra_nome check (btrim(nome) <> ''),
  produto_id uuid
    constraint fk_reposicao_nomes_compra_produto
      references public.reposicao_produtos (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create unique index if not exists ux_reposicao_nomes_compra_nome
  on public.reposicao_nomes_compra (lower(regexp_replace(btrim(nome), '\s+', ' ', 'g')));

create index if not exists ix_reposicao_nomes_compra_produto
  on public.reposicao_nomes_compra (produto_id);

comment on table public.reposicao_nomes_compra is
  'Nomes vindos das notas ligados a um produto da Reposicao (ou ignorados, produto_id nulo).';

alter table public.reposicao_nomes_compra enable row level security;
revoke all on table public.reposicao_nomes_compra from public, anon, authenticated;
grant all on table public.reposicao_nomes_compra to service_role;

-- Nome atual de cada produto ja cadastrado.
insert into public.reposicao_nomes_compra (nome, produto_id)
select regexp_replace(btrim(p.nome), '\s+', ' ', 'g'), p.id
  from public.reposicao_produtos p
on conflict do nothing;

-- Produto novo: registra o nome com que foi criado.
create or replace function private.reposicao_registrar_nome_compra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reposicao_nomes_compra (nome, produto_id)
  values (regexp_replace(btrim(new.nome), '\s+', ' ', 'g'), new.id)
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function private.reposicao_registrar_nome_compra() from public, anon, authenticated;

drop trigger if exists trg_reposicao_produtos_nome_compra on public.reposicao_produtos;
create trigger trg_reposicao_produtos_nome_compra
  after insert on public.reposicao_produtos
  for each row execute function private.reposicao_registrar_nome_compra();

-- -----------------------------------------------------------------------------
create or replace function public.listar_reposicao_nomes_compra_admin()
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
    select coalesce(jsonb_agg(jsonb_build_object('nome', n.nome, 'produto_id', n.produto_id)
             order by lower(n.nome)), '[]'::jsonb)
      from public.reposicao_nomes_compra n
  );
end;
$$;

-- Liga um nome da nota a um produto (ou ignora, se p_produto_id for nulo).
create or replace function public.vincular_reposicao_nome_compra_admin(p_nome text, p_produto_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nome text;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  v_nome := left(nullif(regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g'), ''), 120);
  if v_nome is null then
    raise exception 'Nome invalido' using errcode = '22023';
  end if;
  if p_produto_id is not null
     and not exists (select 1 from public.reposicao_produtos where id = p_produto_id) then
    raise exception 'Produto nao encontrado' using errcode = 'P0002';
  end if;

  insert into public.reposicao_nomes_compra (nome, produto_id)
  values (v_nome, p_produto_id)
  on conflict (lower(regexp_replace(btrim(nome), '\s+', ' ', 'g')))
  do update set produto_id = excluded.produto_id;
end;
$$;

revoke all on function public.listar_reposicao_nomes_compra_admin() from public, anon;
revoke all on function public.vincular_reposicao_nome_compra_admin(text, uuid) from public, anon;
grant execute on function public.listar_reposicao_nomes_compra_admin() to authenticated, service_role;
grant execute on function public.vincular_reposicao_nome_compra_admin(text, uuid) to authenticated, service_role;
