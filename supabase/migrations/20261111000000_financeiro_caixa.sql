-- =============================================================================
-- GZ1 Ingresso - Financeiro da galeria, fase 1: contas, lancamentos e fluxo de caixa
-- Migration: financeiro_caixa
--
-- Transforma o Financeiro no caixa da Galeria Zero 1:
--
--   * public.financeiro_contas: onde o dinheiro esta (Itau, Stone, Mercado Pago,
--     Caixa fisico). Cada conta tem um saldo inicial informado em um momento
--     (saldo_inicial_em). Antes disso a conta esta "nao configurada".
--   * public.financeiro_categorias: categorias de entrada e de saida (editaveis).
--   * public.financeiro_lancamentos: entradas, saidas e transferencias lancadas
--     a mao (inclui o "Fechar bar da noite"). Nada e apagado: cancelamento com
--     motivo, para manter o historico.
--
-- Vendas de ingressos entram SOZINHAS (nao sao copiadas, sao lidas de
-- public.pagamentos):
--   * pagamento APROVADO/REEMBOLSADO confirmado DEPOIS do saldo inicial da conta
--     ligada ao provedor (Mercado Pago -> conta Mercado Pago, Dinheiro -> Caixa
--     fisico, Stone -> Stone);
--   * evento em sociedade com Pix dividido (produtor_recebedor_id preenchido):
--     entra so a parte da galeria (comissao_galeria); o resto foi direto ao
--     produtor. Dinheiro na portaria de evento em sociedade entra inteiro no
--     Caixa fisico; o repasse ao produtor e lancado como saida
--     (categoria "Repasse a produtor").
--   * reembolso vira saida na data do reembolso.
--
-- RPCs (somente ADMINISTRADOR, alteracoes auditadas em public.auditoria):
--   listar_financeiro_contas_admin()
--   salvar_financeiro_conta_admin(id|null, nome, tipo, ativa)
--   definir_saldo_inicial_conta_admin(conta, valor)
--   listar_financeiro_categorias_admin()
--   salvar_financeiro_categoria_admin(id|null, nome, tipo, ativa)
--   listar_financeiro_lancamentos_admin(de, ate, conta, categoria, evento, tipo, busca, incluir_cancelados)
--   salvar_financeiro_lancamento_admin(id|null, tipo, data, valor, descricao,
--       categoria, conta, conta_destino, evento, comprovante)
--   cancelar_financeiro_lancamento_admin(id, motivo)
--   fechar_bar_financeiro_admin(data, evento, valores[{conta_id, valor}], observacao)
--   obter_fluxo_caixa_admin(de, ate, agrupamento, evento, conta)
--
-- Storage: bucket privado financeiro-comprovantes (somente ADMINISTRADOR).
--
-- Nao altera checkout, pagamento, portaria nem tabelas existentes.
-- Tabelas novas: RLS ligado, sem acesso direto (somente via RPC).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table if not exists public.financeiro_contas (
  id uuid
    constraint pk_financeiro_contas primary key default gen_random_uuid(),
  nome text not null
    constraint ck_financeiro_contas_nome check (btrim(nome) <> ''),
  tipo text not null
    constraint ck_financeiro_contas_tipo check (tipo in ('BANCO', 'MAQUININHA', 'DINHEIRO', 'ONLINE')),
  -- Vendas de ingresso deste provedor caem nesta conta.
  provedor_ingressos public.provedor_pagamento null
    constraint uq_financeiro_contas_provedor unique,
  saldo_inicial numeric(12, 2) not null default 0,
  saldo_inicial_em timestamptz null,
  ativa boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.financeiro_contas is
  'Contas do caixa da galeria. saldo_inicial vale a partir de saldo_inicial_em (null = conta ainda nao configurada).';

create table if not exists public.financeiro_categorias (
  id uuid
    constraint pk_financeiro_categorias primary key default gen_random_uuid(),
  nome text not null
    constraint ck_financeiro_categorias_nome check (btrim(nome) <> ''),
  tipo text not null
    constraint ck_financeiro_categorias_tipo check (tipo in ('ENTRADA', 'SAIDA')),
  -- Categorias usadas pelo proprio sistema (ingressos, reembolsos, bar).
  chave_sistema text null
    constraint uq_financeiro_categorias_chave unique,
  ativa boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint uq_financeiro_categorias_nome_tipo unique (nome, tipo)
);

comment on table public.financeiro_categorias is
  'Categorias de entradas e saidas do caixa. chave_sistema marca as usadas pelo sistema (nao podem ser desativadas).';

create table if not exists public.financeiro_lancamentos (
  id uuid
    constraint pk_financeiro_lancamentos primary key default gen_random_uuid(),
  tipo text not null
    constraint ck_financeiro_lancamentos_tipo check (tipo in ('ENTRADA', 'SAIDA', 'TRANSFERENCIA')),
  data date not null,
  valor numeric(12, 2) not null
    constraint ck_financeiro_lancamentos_valor check (valor > 0),
  descricao text null,
  categoria_id uuid null
    constraint fk_financeiro_lancamentos_categoria references public.financeiro_categorias (id) on delete restrict,
  conta_id uuid not null
    constraint fk_financeiro_lancamentos_conta references public.financeiro_contas (id) on delete restrict,
  conta_destino_id uuid null
    constraint fk_financeiro_lancamentos_conta_destino references public.financeiro_contas (id) on delete restrict,
  evento_id uuid null
    constraint fk_financeiro_lancamentos_evento references public.eventos (id) on delete set null,
  comprovante_path text null,
  -- Lancamentos criados juntos (ex.: "Fechar bar da noite") compartilham o grupo.
  grupo_id uuid null,
  criado_por uuid null
    constraint fk_financeiro_lancamentos_criado_por references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_por uuid null
    constraint fk_financeiro_lancamentos_atualizado_por references public.usuarios (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  cancelado_em timestamptz null,
  cancelado_por uuid null
    constraint fk_financeiro_lancamentos_cancelado_por references public.usuarios (id) on delete set null,
  motivo_cancelamento text null,
  constraint ck_financeiro_lancamentos_forma check (
    (tipo = 'TRANSFERENCIA' and categoria_id is null and conta_destino_id is not null and conta_destino_id <> conta_id)
    or (tipo <> 'TRANSFERENCIA' and categoria_id is not null and conta_destino_id is null)
  )
);

create index if not exists ix_financeiro_lancamentos_data on public.financeiro_lancamentos (data);
create index if not exists ix_financeiro_lancamentos_conta on public.financeiro_lancamentos (conta_id);
create index if not exists ix_financeiro_lancamentos_conta_destino on public.financeiro_lancamentos (conta_destino_id);
create index if not exists ix_financeiro_lancamentos_evento on public.financeiro_lancamentos (evento_id);
create index if not exists ix_financeiro_lancamentos_categoria on public.financeiro_lancamentos (categoria_id);
create index if not exists ix_financeiro_lancamentos_grupo on public.financeiro_lancamentos (grupo_id);

comment on table public.financeiro_lancamentos is
  'Entradas, saidas e transferencias lancadas a mao. Vendas de ingresso NAO ficam aqui (sao lidas de pagamentos).';

alter table public.financeiro_contas enable row level security;
alter table public.financeiro_categorias enable row level security;
alter table public.financeiro_lancamentos enable row level security;

revoke all on table public.financeiro_contas from public, anon, authenticated;
revoke all on table public.financeiro_categorias from public, anon, authenticated;
revoke all on table public.financeiro_lancamentos from public, anon, authenticated;
grant all on table public.financeiro_contas to service_role;
grant all on table public.financeiro_categorias to service_role;
grant all on table public.financeiro_lancamentos to service_role;

-- -----------------------------------------------------------------------------
-- Dados iniciais (contas e categorias da Galeria Zero 1)
-- -----------------------------------------------------------------------------
insert into public.financeiro_contas (nome, tipo, provedor_ingressos, ordem)
select v.nome, v.tipo, v.provedor::public.provedor_pagamento, v.ordem
from (values
  ('Itaú', 'BANCO', null, 1),
  ('Stone', 'MAQUININHA', 'STONE', 2),
  ('Mercado Pago', 'ONLINE', 'MERCADO_PAGO', 3),
  ('Caixa físico', 'DINHEIRO', 'DINHEIRO', 4)
) as v(nome, tipo, provedor, ordem)
where not exists (select 1 from public.financeiro_contas);

insert into public.financeiro_categorias (nome, tipo, chave_sistema, ordem)
values
  ('Ingressos', 'ENTRADA', 'INGRESSOS', 1),
  ('Bar', 'ENTRADA', 'BAR', 2),
  ('Outras entradas', 'ENTRADA', null, 99),
  ('Aluguel', 'SAIDA', null, 1),
  ('Energia CEMIG', 'SAIDA', null, 2),
  ('Energia Órigo', 'SAIDA', null, 3),
  ('Água DEMAI', 'SAIDA', null, 4),
  ('Internet', 'SAIDA', null, 5),
  ('Segurança', 'SAIDA', null, 6),
  ('Portaria', 'SAIDA', null, 7),
  ('Equipe do bar', 'SAIDA', null, 8),
  ('Bartender', 'SAIDA', null, 9),
  ('Cozinheiro', 'SAIDA', null, 10),
  ('Banda', 'SAIDA', null, 11),
  ('Compras do bar', 'SAIDA', null, 12),
  ('Repasse a produtor', 'SAIDA', null, 13),
  ('Taxas e tarifas', 'SAIDA', null, 14),
  ('Reembolso de ingresso', 'SAIDA', 'REEMBOLSO_INGRESSO', 15),
  ('Outras saídas', 'SAIDA', null, 99)
on conflict (nome, tipo) do nothing;

-- -----------------------------------------------------------------------------
-- Auxiliar: todos os movimentos do caixa (manuais + automaticos de ingressos)
--
-- Uma linha por movimento em UMA conta. Transferencia gera duas linhas
-- (SAIDA na origem, ENTRADA no destino) com transferencia = true.
-- So entram lancamentos nao cancelados e ingressos confirmados depois do
-- saldo inicial da conta.
-- -----------------------------------------------------------------------------
create or replace function private.financeiro_movimentos()
returns table (
  id text,
  origem text,               -- MANUAL | INGRESSO | REEMBOLSO
  lancamento_id uuid,
  pagamento_id uuid,
  pedido_id uuid,
  tipo text,                 -- ENTRADA | SAIDA (sentido na conta)
  transferencia boolean,
  data date,
  ocorrido_em timestamptz,
  valor numeric,
  conta_id uuid,
  categoria_id uuid,
  evento_id uuid,
  descricao text
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Lancamentos manuais (entrada/saida)
  select
    'L:' || l.id::text, 'MANUAL', l.id, null::uuid, null::uuid,
    l.tipo, false, l.data, l.criado_em, l.valor, l.conta_id, l.categoria_id, l.evento_id, l.descricao
  from public.financeiro_lancamentos l
  where l.cancelado_em is null and l.tipo in ('ENTRADA', 'SAIDA')

  union all
  -- Transferencia: saida da origem
  select
    'T:' || l.id::text || ':O', 'MANUAL', l.id, null, null,
    'SAIDA', true, l.data, l.criado_em, l.valor, l.conta_id, null, l.evento_id, l.descricao
  from public.financeiro_lancamentos l
  where l.cancelado_em is null and l.tipo = 'TRANSFERENCIA'

  union all
  -- Transferencia: entrada no destino
  select
    'T:' || l.id::text || ':D', 'MANUAL', l.id, null, null,
    'ENTRADA', true, l.data, l.criado_em, l.valor, l.conta_destino_id, null, l.evento_id, l.descricao
  from public.financeiro_lancamentos l
  where l.cancelado_em is null and l.tipo = 'TRANSFERENCIA'

  union all
  -- Vendas de ingresso (parte da galeria)
  select
    'P:' || pg.id::text, 'INGRESSO', null, pg.id, p.id,
    'ENTRADA', false,
    (pg.confirmado_em at time zone 'America/Sao_Paulo')::date,
    pg.confirmado_em,
    case when pg.produtor_recebedor_id is not null then coalesce(pg.comissao_galeria, 0) else pg.valor end,
    c.id,
    (select cat.id from public.financeiro_categorias cat where cat.chave_sistema = 'INGRESSOS'),
    p.evento_id,
    'Pedido ' || p.codigo || ' - ' || coalesce(p.comprador_nome, '')
  from public.pagamentos pg
  join public.pedidos p on p.id = pg.pedido_id
  join public.financeiro_contas c on c.provedor_ingressos = pg.provedor
  where pg.status in ('APROVADO', 'REEMBOLSADO')
    and pg.confirmado_em is not null
    and c.saldo_inicial_em is not null
    and pg.confirmado_em > c.saldo_inicial_em
    and (case when pg.produtor_recebedor_id is not null then coalesce(pg.comissao_galeria, 0) else pg.valor end) > 0

  union all
  -- Reembolsos de ingresso
  select
    'R:' || pg.id::text, 'REEMBOLSO', null, pg.id, p.id,
    'SAIDA', false,
    (coalesce(pg.reembolsado_em, pg.atualizado_em) at time zone 'America/Sao_Paulo')::date,
    coalesce(pg.reembolsado_em, pg.atualizado_em),
    case
      when pg.produtor_recebedor_id is not null
        then round(coalesce(pg.comissao_galeria, 0) * pg.valor_reembolsado / nullif(pg.valor, 0), 2)
      else pg.valor_reembolsado
    end,
    c.id,
    (select cat.id from public.financeiro_categorias cat where cat.chave_sistema = 'REEMBOLSO_INGRESSO'),
    p.evento_id,
    'Reembolso do pedido ' || p.codigo || ' - ' || coalesce(p.comprador_nome, '')
  from public.pagamentos pg
  join public.pedidos p on p.id = pg.pedido_id
  join public.financeiro_contas c on c.provedor_ingressos = pg.provedor
  where coalesce(pg.valor_reembolsado, 0) > 0
    and pg.confirmado_em is not null
    and c.saldo_inicial_em is not null
    and pg.confirmado_em > c.saldo_inicial_em;
$$;

revoke all on function private.financeiro_movimentos() from public, anon, authenticated;

-- Data de inicio de uma conta (dia do saldo inicial, horario de Brasilia).
create or replace function private.financeiro_inicio_conta(p_conta public.financeiro_contas)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_conta.saldo_inicial_em at time zone 'America/Sao_Paulo')::date;
$$;

-- Saldo de cada conta ate uma data (inclusive). null = hoje e tudo lancado.
create or replace function private.financeiro_saldos(p_ate date default null)
returns table (conta_id uuid, saldo numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    (case
       when c.saldo_inicial_em is not null
            and (p_ate is null or private.financeiro_inicio_conta(c) <= p_ate)
         then c.saldo_inicial
       else 0
     end)
    + coalesce((
        select sum(case when m.tipo = 'ENTRADA' then m.valor else -m.valor end)
        from private.financeiro_movimentos() m
        where m.conta_id = c.id
          and (p_ate is null or m.data <= p_ate)
          and (c.saldo_inicial_em is null or m.data >= private.financeiro_inicio_conta(c))
      ), 0)
  from public.financeiro_contas c;
$$;

revoke all on function private.financeiro_saldos(date) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Contas
-- -----------------------------------------------------------------------------
create or replace function public.listar_financeiro_contas_admin()
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
        'provedor_ingressos', c.provedor_ingressos,
        'saldo_inicial', c.saldo_inicial,
        'saldo_inicial_em', c.saldo_inicial_em,
        'configurada', c.saldo_inicial_em is not null,
        'ativa', c.ativa,
        'saldo_atual', s.saldo
      )
      order by c.ativa desc, c.ordem, c.nome
    )
    from public.financeiro_contas c
    join private.financeiro_saldos(null) s on s.conta_id = c.id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.listar_financeiro_contas_admin() from public, anon, authenticated, service_role;
grant execute on function public.listar_financeiro_contas_admin() to authenticated, service_role;

comment on function public.listar_financeiro_contas_admin() is
  'Contas do caixa com saldo atual (ADMINISTRADOR).';

create or replace function public.salvar_financeiro_conta_admin(
  p_id uuid,
  p_nome text,
  p_tipo text,
  p_ativa boolean default true
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_antes public.financeiro_contas%rowtype;
  v_id uuid;
  v_nome text := btrim(coalesce(p_nome, ''));
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;
  if v_nome = '' then
    raise exception 'Informe o nome da conta' using errcode = '23514';
  end if;
  if p_tipo is null or p_tipo not in ('BANCO', 'MAQUININHA', 'DINHEIRO', 'ONLINE') then
    raise exception 'Tipo de conta invalido' using errcode = '23514';
  end if;

  if p_id is null then
    insert into public.financeiro_contas (nome, tipo, ativa, ordem)
    values (v_nome, p_tipo, coalesce(p_ativa, true),
            coalesce((select max(ordem) + 1 from public.financeiro_contas), 1))
    returning id into v_id;

    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (auth.uid(), 'FINANCEIRO_CONTA_CRIADA_ADMIN', 'financeiro_contas', v_id, null,
            jsonb_build_object('nome', v_nome, 'tipo', p_tipo, 'ativa', coalesce(p_ativa, true)));
  else
    select * into v_antes from public.financeiro_contas where id = p_id for update;
    if not found then
      raise exception 'Conta % nao encontrada', p_id using errcode = '23503';
    end if;

    update public.financeiro_contas
       set nome = v_nome, tipo = p_tipo, ativa = coalesce(p_ativa, true), atualizado_em = now()
     where id = p_id;
    v_id := p_id;

    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (auth.uid(), 'FINANCEIRO_CONTA_ALTERADA_ADMIN', 'financeiro_contas', v_id,
            jsonb_build_object('nome', v_antes.nome, 'tipo', v_antes.tipo, 'ativa', v_antes.ativa),
            jsonb_build_object('nome', v_nome, 'tipo', p_tipo, 'ativa', coalesce(p_ativa, true)));
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke execute on function public.salvar_financeiro_conta_admin(uuid, text, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.salvar_financeiro_conta_admin(uuid, text, text, boolean) to authenticated, service_role;

comment on function public.salvar_financeiro_conta_admin(uuid, text, text, boolean) is
  'Cria (id null) ou altera uma conta do caixa (ADMINISTRADOR, auditado).';

create or replace function public.definir_saldo_inicial_conta_admin(
  p_conta_id uuid,
  p_valor numeric
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_antes public.financeiro_contas%rowtype;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;
  if p_valor is null or round(p_valor, 2) <> p_valor then
    raise exception 'Saldo invalido' using errcode = '23514';
  end if;

  select * into v_antes from public.financeiro_contas where id = p_conta_id for update;
  if not found then
    raise exception 'Conta % nao encontrada', p_conta_id using errcode = '23503';
  end if;

  update public.financeiro_contas
     set saldo_inicial = p_valor, saldo_inicial_em = now(), atualizado_em = now()
   where id = p_conta_id;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
  values (auth.uid(), 'FINANCEIRO_SALDO_INICIAL_ADMIN', 'financeiro_contas', p_conta_id,
          jsonb_build_object('saldo_inicial', v_antes.saldo_inicial, 'saldo_inicial_em', v_antes.saldo_inicial_em),
          jsonb_build_object('saldo_inicial', p_valor, 'saldo_inicial_em', now()));

  return jsonb_build_object('id', p_conta_id, 'saldo_inicial', p_valor, 'saldo_inicial_em', now());
end;
$$;

revoke execute on function public.definir_saldo_inicial_conta_admin(uuid, numeric) from public, anon, authenticated, service_role;
grant execute on function public.definir_saldo_inicial_conta_admin(uuid, numeric) to authenticated, service_role;

comment on function public.definir_saldo_inicial_conta_admin(uuid, numeric) is
  'Informa o saldo da conta AGORA; o caixa da conta passa a contar a partir deste momento (ADMINISTRADOR, auditado).';

-- -----------------------------------------------------------------------------
-- Categorias
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
        'ativa', c.ativa
      )
      order by c.tipo, c.ativa desc, c.ordem, c.nome
    )
    from public.financeiro_categorias c
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.listar_financeiro_categorias_admin() from public, anon, authenticated, service_role;
grant execute on function public.listar_financeiro_categorias_admin() to authenticated, service_role;

create or replace function public.salvar_financeiro_categoria_admin(
  p_id uuid,
  p_nome text,
  p_tipo text,
  p_ativa boolean default true
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
  if exists (
    select 1 from public.financeiro_categorias c
    where lower(c.nome) = lower(v_nome) and c.tipo = p_tipo and (p_id is null or c.id <> p_id)
  ) then
    raise exception 'Ja existe uma categoria com esse nome' using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.financeiro_categorias (nome, tipo, ativa, ordem)
    values (v_nome, p_tipo, coalesce(p_ativa, true), 50)
    returning id into v_id;

    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (auth.uid(), 'FINANCEIRO_CATEGORIA_CRIADA_ADMIN', 'financeiro_categorias', v_id, null,
            jsonb_build_object('nome', v_nome, 'tipo', p_tipo, 'ativa', coalesce(p_ativa, true)));
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
       set nome = v_nome, tipo = p_tipo, ativa = coalesce(p_ativa, true), atualizado_em = now()
     where id = p_id;
    v_id := p_id;

    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (auth.uid(), 'FINANCEIRO_CATEGORIA_ALTERADA_ADMIN', 'financeiro_categorias', v_id,
            jsonb_build_object('nome', v_antes.nome, 'tipo', v_antes.tipo, 'ativa', v_antes.ativa),
            jsonb_build_object('nome', v_nome, 'tipo', p_tipo, 'ativa', coalesce(p_ativa, true)));
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke execute on function public.salvar_financeiro_categoria_admin(uuid, text, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.salvar_financeiro_categoria_admin(uuid, text, text, boolean) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Lancamentos: listar (manuais + ingressos automaticos)
-- -----------------------------------------------------------------------------
create or replace function public.listar_financeiro_lancamentos_admin(
  p_de date default null,
  p_ate date default null,
  p_conta_id uuid default null,
  p_categoria_id uuid default null,
  p_evento_id uuid default null,
  p_tipo text default null,              -- ENTRADA | SAIDA | TRANSFERENCIA
  p_busca text default null,
  p_incluir_cancelados boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_res jsonb;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  with automaticos as (
    select
      m.id, m.origem, null::uuid as lancamento_id, m.pagamento_id, m.pedido_id,
      m.tipo, m.data, m.ocorrido_em, m.valor,
      m.conta_id, null::uuid as conta_destino_id, m.categoria_id, m.evento_id, m.descricao,
      null::text as comprovante_path, null::uuid as grupo_id,
      null::timestamptz as cancelado_em, null::text as motivo_cancelamento,
      null::text as criado_por_nome
    from private.financeiro_movimentos() m
    where m.origem in ('INGRESSO', 'REEMBOLSO')
  ),
  manuais as (
    select
      'L:' || l.id::text as id, 'MANUAL'::text as origem, l.id as lancamento_id,
      null::uuid as pagamento_id, null::uuid as pedido_id,
      l.tipo, l.data, l.criado_em as ocorrido_em, l.valor,
      l.conta_id, l.conta_destino_id, l.categoria_id, l.evento_id, l.descricao,
      l.comprovante_path, l.grupo_id, l.cancelado_em, l.motivo_cancelamento,
      u.nome as criado_por_nome
    from public.financeiro_lancamentos l
    left join public.usuarios u on u.id = l.criado_por
    where (p_incluir_cancelados or l.cancelado_em is null)
  ),
  todos as (
    select * from automaticos
    union all
    select * from manuais
  ),
  base as (
    select t.*, cat.nome as categoria_nome, co.nome as conta_nome, cd.nome as conta_destino_nome,
           e.nome as evento_nome
    from todos t
    left join public.financeiro_categorias cat on cat.id = t.categoria_id
    left join public.financeiro_contas co on co.id = t.conta_id
    left join public.financeiro_contas cd on cd.id = t.conta_destino_id
    left join public.eventos e on e.id = t.evento_id
    where (p_de is null or t.data >= p_de)
      and (p_ate is null or t.data <= p_ate)
      and (p_conta_id is null or t.conta_id = p_conta_id or t.conta_destino_id = p_conta_id)
      and (p_categoria_id is null or t.categoria_id = p_categoria_id)
      and (p_evento_id is null or t.evento_id = p_evento_id)
      and (p_tipo is null or t.tipo = p_tipo)
      and (
        v_busca is null
        or t.descricao ilike '%' || v_busca || '%'
        or cat.nome ilike '%' || v_busca || '%'
        or e.nome ilike '%' || v_busca || '%'
      )
  )
  select jsonb_build_object(
    'resumo', jsonb_build_object(
      'entradas', coalesce((
        select sum(b.valor) from base b
        where b.cancelado_em is null and b.tipo = 'ENTRADA'
      ), 0),
      'saidas', coalesce((
        select sum(b.valor) from base b
        where b.cancelado_em is null and b.tipo = 'SAIDA'
      ), 0),
      -- Com filtro de conta, transferencias entram/saem daquela conta.
      'transferencias_entrada', coalesce((
        select sum(b.valor) from base b
        where p_conta_id is not null and b.cancelado_em is null and b.tipo = 'TRANSFERENCIA'
          and b.conta_destino_id = p_conta_id
      ), 0),
      'transferencias_saida', coalesce((
        select sum(b.valor) from base b
        where p_conta_id is not null and b.cancelado_em is null and b.tipo = 'TRANSFERENCIA'
          and b.conta_id = p_conta_id
      ), 0),
      'quantidade', (select count(*) from base)
    ),
    'itens', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'origem', b.origem,
          'lancamento_id', b.lancamento_id,
          'pagamento_id', b.pagamento_id,
          'pedido_id', b.pedido_id,
          'tipo', b.tipo,
          'data', b.data,
          'ocorrido_em', b.ocorrido_em,
          'valor', b.valor,
          'descricao', b.descricao,
          'categoria_id', b.categoria_id,
          'categoria_nome', b.categoria_nome,
          'conta_id', b.conta_id,
          'conta_nome', b.conta_nome,
          'conta_destino_id', b.conta_destino_id,
          'conta_destino_nome', b.conta_destino_nome,
          'evento_id', b.evento_id,
          'evento_nome', b.evento_nome,
          'comprovante_path', b.comprovante_path,
          'grupo_id', b.grupo_id,
          'cancelado_em', b.cancelado_em,
          'motivo_cancelamento', b.motivo_cancelamento,
          'criado_por_nome', b.criado_por_nome
        )
        order by b.data desc, b.ocorrido_em desc
      )
      from base b
    ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

revoke execute on function public.listar_financeiro_lancamentos_admin(date, date, uuid, uuid, uuid, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.listar_financeiro_lancamentos_admin(date, date, uuid, uuid, uuid, text, text, boolean)
  to authenticated, service_role;

comment on function public.listar_financeiro_lancamentos_admin(date, date, uuid, uuid, uuid, text, text, boolean) is
  'Lancamentos do caixa (manuais + vendas de ingresso automaticas) com resumo (ADMINISTRADOR).';

-- -----------------------------------------------------------------------------
-- Lancamentos: criar / editar
-- -----------------------------------------------------------------------------
create or replace function private.validar_financeiro_lancamento(
  p_tipo text,
  p_data date,
  p_valor numeric,
  p_categoria_id uuid,
  p_conta_id uuid,
  p_conta_destino_id uuid,
  p_evento_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cat_tipo text;
begin
  if p_tipo is null or p_tipo not in ('ENTRADA', 'SAIDA', 'TRANSFERENCIA') then
    raise exception 'Tipo de lancamento invalido' using errcode = '23514';
  end if;
  if p_data is null then
    raise exception 'Informe a data' using errcode = '23514';
  end if;
  if p_valor is null or p_valor <= 0 or round(p_valor, 2) <> p_valor then
    raise exception 'Informe um valor maior que zero' using errcode = '23514';
  end if;
  if not exists (select 1 from public.financeiro_contas c where c.id = p_conta_id) then
    raise exception 'Conta nao encontrada' using errcode = '23503';
  end if;

  if p_tipo = 'TRANSFERENCIA' then
    if p_conta_destino_id is null
       or not exists (select 1 from public.financeiro_contas c where c.id = p_conta_destino_id) then
      raise exception 'Informe a conta de destino' using errcode = '23514';
    end if;
    if p_conta_destino_id = p_conta_id then
      raise exception 'A conta de destino deve ser diferente da conta de origem' using errcode = '23514';
    end if;
  else
    select c.tipo into v_cat_tipo from public.financeiro_categorias c where c.id = p_categoria_id;
    if v_cat_tipo is null then
      raise exception 'Informe a categoria' using errcode = '23514';
    end if;
    if v_cat_tipo <> p_tipo then
      raise exception 'Categoria nao combina com o tipo do lancamento' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.financeiro_categorias c
      where c.id = p_categoria_id and c.chave_sistema in ('INGRESSOS', 'REEMBOLSO_INGRESSO')
    ) then
      raise exception 'Vendas e reembolsos de ingresso entram sozinhos; use outra categoria' using errcode = '23514';
    end if;
  end if;

  if p_evento_id is not null and not exists (select 1 from public.eventos e where e.id = p_evento_id) then
    raise exception 'Evento nao encontrado' using errcode = '23503';
  end if;
end;
$$;

revoke all on function private.validar_financeiro_lancamento(text, date, numeric, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

create or replace function private.financeiro_lancamento_json(p_l public.financeiro_lancamentos)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'tipo', p_l.tipo,
    'data', p_l.data,
    'valor', p_l.valor,
    'descricao', p_l.descricao,
    'categoria_id', p_l.categoria_id,
    'conta_id', p_l.conta_id,
    'conta_destino_id', p_l.conta_destino_id,
    'evento_id', p_l.evento_id,
    'comprovante_path', p_l.comprovante_path,
    'grupo_id', p_l.grupo_id
  );
$$;

create or replace function public.salvar_financeiro_lancamento_admin(
  p_id uuid,
  p_tipo text,
  p_data date,
  p_valor numeric,
  p_descricao text,
  p_categoria_id uuid,
  p_conta_id uuid,
  p_conta_destino_id uuid default null,
  p_evento_id uuid default null,
  p_comprovante_path text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_antes public.financeiro_lancamentos%rowtype;
  v_novo public.financeiro_lancamentos%rowtype;
  v_categoria uuid := case when p_tipo = 'TRANSFERENCIA' then null else p_categoria_id end;
  v_destino uuid := case when p_tipo = 'TRANSFERENCIA' then p_conta_destino_id else null end;
  v_descricao text := nullif(btrim(coalesce(p_descricao, '')), '');
  v_comprovante text := nullif(btrim(coalesce(p_comprovante_path, '')), '');
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  perform private.validar_financeiro_lancamento(
    p_tipo, p_data, p_valor, v_categoria, p_conta_id, v_destino, p_evento_id
  );

  if p_id is null then
    insert into public.financeiro_lancamentos (
      tipo, data, valor, descricao, categoria_id, conta_id, conta_destino_id,
      evento_id, comprovante_path, criado_por, atualizado_por
    )
    values (
      p_tipo, p_data, p_valor, v_descricao, v_categoria, p_conta_id, v_destino,
      p_evento_id, v_comprovante, auth.uid(), auth.uid()
    )
    returning * into v_novo;

    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (auth.uid(), 'FINANCEIRO_LANCAMENTO_CRIADO_ADMIN', 'financeiro_lancamentos', v_novo.id,
            null, private.financeiro_lancamento_json(v_novo));
  else
    select * into v_antes from public.financeiro_lancamentos where id = p_id for update;
    if not found then
      raise exception 'Lancamento % nao encontrado', p_id using errcode = '23503';
    end if;
    if v_antes.cancelado_em is not null then
      raise exception 'Lancamento cancelado nao pode ser alterado' using errcode = '23514';
    end if;

    update public.financeiro_lancamentos
       set tipo = p_tipo, data = p_data, valor = p_valor, descricao = v_descricao,
           categoria_id = v_categoria, conta_id = p_conta_id, conta_destino_id = v_destino,
           evento_id = p_evento_id, comprovante_path = v_comprovante,
           atualizado_por = auth.uid(), atualizado_em = now()
     where id = p_id
    returning * into v_novo;

    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (auth.uid(), 'FINANCEIRO_LANCAMENTO_ALTERADO_ADMIN', 'financeiro_lancamentos', v_novo.id,
            private.financeiro_lancamento_json(v_antes), private.financeiro_lancamento_json(v_novo));
  end if;

  return jsonb_build_object('id', v_novo.id);
end;
$$;

revoke execute on function public.salvar_financeiro_lancamento_admin(uuid, text, date, numeric, text, uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.salvar_financeiro_lancamento_admin(uuid, text, date, numeric, text, uuid, uuid, uuid, uuid, text)
  to authenticated, service_role;

comment on function public.salvar_financeiro_lancamento_admin(uuid, text, date, numeric, text, uuid, uuid, uuid, uuid, text) is
  'Cria (id null) ou altera um lancamento manual do caixa (ADMINISTRADOR, auditado).';

create or replace function public.cancelar_financeiro_lancamento_admin(
  p_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_antes public.financeiro_lancamentos%rowtype;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;
  if v_motivo is null then
    raise exception 'Informe o motivo do cancelamento' using errcode = '23514';
  end if;

  select * into v_antes from public.financeiro_lancamentos where id = p_id for update;
  if not found then
    raise exception 'Lancamento % nao encontrado', p_id using errcode = '23503';
  end if;
  if v_antes.cancelado_em is not null then
    return jsonb_build_object('id', p_id, 'alterado', false);
  end if;

  update public.financeiro_lancamentos
     set cancelado_em = now(), cancelado_por = auth.uid(), motivo_cancelamento = v_motivo,
         atualizado_em = now(), atualizado_por = auth.uid()
   where id = p_id;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos, observacao)
  values (auth.uid(), 'FINANCEIRO_LANCAMENTO_CANCELADO_ADMIN', 'financeiro_lancamentos', p_id,
          private.financeiro_lancamento_json(v_antes), null, v_motivo);

  return jsonb_build_object('id', p_id, 'alterado', true);
end;
$$;

revoke execute on function public.cancelar_financeiro_lancamento_admin(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.cancelar_financeiro_lancamento_admin(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Fechar bar da noite: varias entradas "Bar" de uma vez (uma por conta)
-- -----------------------------------------------------------------------------
create or replace function public.fechar_bar_financeiro_admin(
  p_data date,
  p_evento_id uuid,
  p_valores jsonb,                -- [{ "conta_id": uuid, "valor": number }]
  p_observacao text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_grupo uuid := gen_random_uuid();
  v_categoria uuid;
  v_item jsonb;
  v_conta uuid;
  v_valor numeric;
  v_conta_nome text;
  v_total numeric := 0;
  v_qtd integer := 0;
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_novo public.financeiro_lancamentos%rowtype;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;
  if p_data is null then
    raise exception 'Informe a data' using errcode = '23514';
  end if;
  if p_valores is null or jsonb_typeof(p_valores) <> 'array' then
    raise exception 'Informe os valores do bar' using errcode = '23514';
  end if;
  if p_evento_id is not null and not exists (select 1 from public.eventos e where e.id = p_evento_id) then
    raise exception 'Evento nao encontrado' using errcode = '23503';
  end if;

  select c.id into v_categoria from public.financeiro_categorias c where c.chave_sistema = 'BAR';
  if v_categoria is null then
    raise exception 'Categoria Bar nao encontrada' using errcode = '23503';
  end if;

  for v_item in select * from jsonb_array_elements(p_valores) loop
    v_conta := nullif(v_item ->> 'conta_id', '')::uuid;
    v_valor := nullif(v_item ->> 'valor', '')::numeric;
    continue when v_valor is null or v_valor = 0;

    if v_valor < 0 or round(v_valor, 2) <> v_valor then
      raise exception 'Valor invalido no fechamento do bar' using errcode = '23514';
    end if;
    select c.nome into v_conta_nome from public.financeiro_contas c where c.id = v_conta;
    if v_conta_nome is null then
      raise exception 'Conta nao encontrada no fechamento do bar' using errcode = '23503';
    end if;

    insert into public.financeiro_lancamentos (
      tipo, data, valor, descricao, categoria_id, conta_id, evento_id, grupo_id, criado_por, atualizado_por
    )
    values (
      'ENTRADA', p_data, v_valor,
      'Bar da noite - ' || v_conta_nome || coalesce(' - ' || v_obs, ''),
      v_categoria, v_conta, p_evento_id, v_grupo, auth.uid(), auth.uid()
    )
    returning * into v_novo;

    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (auth.uid(), 'FINANCEIRO_BAR_FECHADO_ADMIN', 'financeiro_lancamentos', v_novo.id,
            null, private.financeiro_lancamento_json(v_novo));

    v_total := v_total + v_valor;
    v_qtd := v_qtd + 1;
  end loop;

  if v_qtd = 0 then
    raise exception 'Informe o valor de pelo menos uma maquininha ou do dinheiro' using errcode = '23514';
  end if;

  return jsonb_build_object('grupo_id', v_grupo, 'lancamentos', v_qtd, 'total', v_total);
end;
$$;

revoke execute on function public.fechar_bar_financeiro_admin(date, uuid, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.fechar_bar_financeiro_admin(date, uuid, jsonb, text) to authenticated, service_role;

comment on function public.fechar_bar_financeiro_admin(date, uuid, jsonb, text) is
  'Lanca o total do bar da noite por conta/maquininha em um passo (ADMINISTRADOR, auditado).';

-- -----------------------------------------------------------------------------
-- Fluxo de caixa: entradas, saidas e saldo por dia/semana/mes
-- -----------------------------------------------------------------------------
create or replace function public.obter_fluxo_caixa_admin(
  p_de date,
  p_ate date,
  p_agrupamento text default 'dia',      -- dia | semana | mes
  p_evento_id uuid default null,
  p_conta_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_passo interval;
  v_trunc text;
  v_res jsonb;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_ate < p_de then
    raise exception 'Periodo invalido' using errcode = '23514';
  end if;
  if p_ate - p_de > 3700 then
    raise exception 'Periodo muito longo (maximo 10 anos)' using errcode = '23514';
  end if;

  v_trunc := case p_agrupamento when 'semana' then 'week' when 'mes' then 'month' else 'day' end;
  v_passo := case p_agrupamento when 'semana' then interval '1 week' when 'mes' then interval '1 month' else interval '1 day' end;

  with mov as (
    select m.*
    from private.financeiro_movimentos() m
    join public.financeiro_contas c on c.id = m.conta_id
    where m.data between p_de and p_ate
      and (c.saldo_inicial_em is null or m.data >= private.financeiro_inicio_conta(c))
      and (p_conta_id is null or m.conta_id = p_conta_id)
      and (p_evento_id is null or m.evento_id = p_evento_id)
      -- Sem filtro de conta, transferencia so troca dinheiro de lugar.
      and (p_conta_id is not null or not m.transferencia)
  ),
  periodos as (
    select g::date as inicio,
           least((g + v_passo)::date - 1, p_ate) as fim
    from generate_series(date_trunc(v_trunc, p_de::timestamp), p_ate::timestamp, v_passo) g
  ),
  linhas as (
    select
      greatest(pr.inicio, p_de) as inicio,
      pr.fim,
      coalesce((select sum(m.valor) from mov m where m.tipo = 'ENTRADA' and m.data between greatest(pr.inicio, p_de) and pr.fim), 0) as entradas,
      coalesce((select sum(m.valor) from mov m where m.tipo = 'SAIDA' and m.data between greatest(pr.inicio, p_de) and pr.fim), 0) as saidas,
      case when p_evento_id is null then (
        select coalesce(sum(s.saldo), 0)
        from private.financeiro_saldos(pr.fim) s
        join public.financeiro_contas c on c.id = s.conta_id
        where (p_conta_id is null or s.conta_id = p_conta_id)
          and c.saldo_inicial_em is not null
      ) end as saldo
    from periodos pr
  )
  select jsonb_build_object(
    'de', p_de,
    'ate', p_ate,
    'agrupamento', case when p_agrupamento in ('semana', 'mes') then p_agrupamento else 'dia' end,
    'totais', jsonb_build_object(
      'entradas', coalesce((select sum(m.valor) from mov m where m.tipo = 'ENTRADA'), 0),
      'saidas', coalesce((select sum(m.valor) from mov m where m.tipo = 'SAIDA'), 0),
      'saldo_inicial', case when p_evento_id is null then (
        select coalesce(sum(s.saldo), 0)
        from private.financeiro_saldos(p_de - 1) s
        join public.financeiro_contas c on c.id = s.conta_id
        where (p_conta_id is null or s.conta_id = p_conta_id)
          and c.saldo_inicial_em is not null
      ) end,
      'saldo_final', case when p_evento_id is null then (
        select coalesce(sum(s.saldo), 0)
        from private.financeiro_saldos(p_ate) s
        join public.financeiro_contas c on c.id = s.conta_id
        where (p_conta_id is null or s.conta_id = p_conta_id)
          and c.saldo_inicial_em is not null
      ) end
    ),
    'periodos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'inicio', l.inicio,
          'fim', l.fim,
          'entradas', l.entradas,
          'saidas', l.saidas,
          'resultado', l.entradas - l.saidas,
          'saldo', l.saldo
        )
        order by l.inicio
      )
      from linhas l
    ), '[]'::jsonb),
    'por_categoria', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'categoria_id', x.categoria_id,
          'categoria_nome', x.categoria_nome,
          'tipo', x.tipo,
          'total', x.total
        )
        order by x.tipo, x.total desc
      )
      from (
        select m.categoria_id,
               coalesce(cat.nome, 'Transferências') as categoria_nome,
               m.tipo,
               sum(m.valor) as total
        from mov m
        left join public.financeiro_categorias cat on cat.id = m.categoria_id
        group by m.categoria_id, coalesce(cat.nome, 'Transferências'), m.tipo
      ) x
    ), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

revoke execute on function public.obter_fluxo_caixa_admin(date, date, text, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.obter_fluxo_caixa_admin(date, date, text, uuid, uuid) to authenticated, service_role;

comment on function public.obter_fluxo_caixa_admin(date, date, text, uuid, uuid) is
  'Fluxo de caixa por dia/semana/mes: entradas, saidas, saldo e totais por categoria (ADMINISTRADOR).';

-- -----------------------------------------------------------------------------
-- Storage: comprovantes (bucket privado, somente ADMINISTRADOR)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'financeiro-comprovantes',
  'financeiro-comprovantes',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "financeiro_comprovantes_leitura_admin" on storage.objects;
create policy "financeiro_comprovantes_leitura_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'financeiro-comprovantes' and private.usuario_e_admin());

drop policy if exists "financeiro_comprovantes_insert_admin" on storage.objects;
create policy "financeiro_comprovantes_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'financeiro-comprovantes' and private.usuario_e_admin());

drop policy if exists "financeiro_comprovantes_update_admin" on storage.objects;
create policy "financeiro_comprovantes_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'financeiro-comprovantes' and private.usuario_e_admin())
  with check (bucket_id = 'financeiro-comprovantes' and private.usuario_e_admin());

drop policy if exists "financeiro_comprovantes_delete_admin" on storage.objects;
create policy "financeiro_comprovantes_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'financeiro-comprovantes' and private.usuario_e_admin());
