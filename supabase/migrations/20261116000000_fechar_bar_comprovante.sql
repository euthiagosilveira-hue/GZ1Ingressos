-- Fechar bar com foto do fechamento da maquininha (lida pela IA).
--
-- O Fechar bar passa a aceitar:
--   * p_comprovante_path: a foto do fechamento de caixa (bucket financeiro-comprovantes),
--     guardada em cada lancamento criado;
--   * "detalhe" em cada valor (ex.: "Credito R$ 100,00 · Pix R$ 50,00"), que entra na descricao.
--
-- Rode este arquivo inteiro no SQL Editor do Supabase ANTES do merge.

begin;

drop function if exists public.fechar_bar_financeiro_admin(date, uuid, jsonb, text);

create or replace function public.fechar_bar_financeiro_admin(
  p_data date,
  p_evento_id uuid,
  p_valores jsonb,                -- [{ "conta_id": uuid, "valor": number, "detalhe": text? }]
  p_observacao text default null,
  p_comprovante_path text default null
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
  v_comprovante text := nullif(btrim(coalesce(p_comprovante_path, '')), '');
  v_detalhe text;
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
    v_detalhe := left(nullif(btrim(coalesce(v_item ->> 'detalhe', '')), ''), 200);
    continue when v_valor is null or v_valor = 0;

    if v_valor < 0 or round(v_valor, 2) <> v_valor then
      raise exception 'Valor invalido no fechamento do bar' using errcode = '23514';
    end if;
    select c.nome into v_conta_nome from public.financeiro_contas c where c.id = v_conta;
    if v_conta_nome is null then
      raise exception 'Conta nao encontrada no fechamento do bar' using errcode = '23503';
    end if;

    insert into public.financeiro_lancamentos (
      tipo, data, valor, descricao, categoria_id, conta_id, evento_id, grupo_id,
      comprovante_path, criado_por, atualizado_por
    )
    values (
      'ENTRADA', p_data, v_valor,
      'Bar da noite - ' || v_conta_nome || coalesce(' (' || v_detalhe || ')', '') || coalesce(' - ' || v_obs, ''),
      v_categoria, v_conta, p_evento_id, v_grupo,
      v_comprovante, auth.uid(), auth.uid()
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

revoke execute on function public.fechar_bar_financeiro_admin(date, uuid, jsonb, text, text) from public, anon, authenticated, service_role;
grant execute on function public.fechar_bar_financeiro_admin(date, uuid, jsonb, text, text) to authenticated, service_role;

comment on function public.fechar_bar_financeiro_admin(date, uuid, jsonb, text, text) is
  'Lanca o total do bar da noite por conta/maquininha em um passo, com a foto do fechamento opcional e o detalhe credito/debito/Pix lido pela IA (ADMINISTRADOR, auditado).';

commit;
