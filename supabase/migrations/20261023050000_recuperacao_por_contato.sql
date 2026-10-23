-- =============================================================================
-- GZ1 Ingresso - Recuperacao de ingressos por telefone + e-mail (sem codigo)
-- Migration: recuperacao_por_contato
--
-- O comprador nao tem o codigo do pedido depois que sai da tela. Na compra
-- online ele sempre informa telefone e e-mail, entao a recuperacao passa a
-- usar os dois juntos.
--
--   * public.recuperar_ingressos_contato(telefone, email)
--       -> { ok, pedidos: [{ token, expira_em, codigo_pedido, evento_nome,
--                            evento_inicio_em, quantidade }] }
--
-- Reaproveita recuperacoes_ingressos (token temporario de 30 min, guardado
-- como md5) e obter_ingressos_recuperacao(token). NAO devolve checkout_token.
-- Rate limit por telefone (5 falhas / 15 min). Resposta sempre generica.
-- =============================================================================

-- Telefone so com digitos, sem o DDI 55 (aceita "+55 11 9...", "(11) 9...").
create or replace function private.normalizar_telefone_br(p_telefone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when length(d) >= 12 and left(d, 2) = '55' then substr(d, 3)
           else d
         end
    from (select regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g') as d) s;
$$;

create or replace function private.recuperar_ingressos_contato(p_telefone text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tel text;
  v_email text;
  v_chave text;
  v_tentativas integer;
  v_pedido record;
  v_token text;
  v_expira timestamptz;
  v_lista jsonb := '[]'::jsonb;
begin
  v_tel := private.normalizar_telefone_br(p_telefone);
  v_email := lower(btrim(coalesce(p_email, '')));

  if length(v_tel) < 10 or position('@' in v_email) = 0 then
    return jsonb_build_object('ok', false);
  end if;

  v_chave := 'TEL:' || v_tel;

  select count(*) into v_tentativas
    from public.tentativas_recuperacao t
   where t.codigo_normalizado = v_chave
     and t.sucesso = false
     and t.criado_em > now() - interval '15 minutes';

  if v_tentativas >= 5 then
    insert into public.tentativas_recuperacao (codigo_normalizado, sucesso)
    values (v_chave, false);
    return jsonb_build_object('ok', false);
  end if;

  v_expira := now() + interval '30 minutes';

  for v_pedido in
    select p.id, p.codigo, p.quantidade, e.nome as evento_nome, e.inicio_em as evento_inicio_em
      from public.pedidos p
      join public.eventos e on e.id = p.evento_id
     where private.normalizar_telefone_br(p.comprador_telefone) = v_tel
       and lower(btrim(coalesce(p.comprador_email, ''))) = v_email
       and p.status = 'PAGO'
       and exists (
         select 1 from public.pagamentos pg
          where pg.pedido_id = p.id and pg.status = 'APROVADO'
       )
     order by e.inicio_em desc, p.criado_em desc
     limit 20
  loop
    -- invalida recuperacoes ativas anteriores do mesmo pedido
    update public.recuperacoes_ingressos
       set expira_em = now()
     where pedido_id = v_pedido.id and usado_em is null and expira_em > now();

    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

    insert into public.recuperacoes_ingressos (pedido_id, token_hash, expira_em)
    values (v_pedido.id, md5(v_token), v_expira);

    v_lista := v_lista || jsonb_build_array(jsonb_build_object(
      'token', v_token,
      'expira_em', v_expira,
      'codigo_pedido', v_pedido.codigo,
      'evento_nome', v_pedido.evento_nome,
      'evento_inicio_em', v_pedido.evento_inicio_em,
      'quantidade', v_pedido.quantidade
    ));
  end loop;

  insert into public.tentativas_recuperacao (codigo_normalizado, sucesso)
  values (v_chave, jsonb_array_length(v_lista) > 0);

  if jsonb_array_length(v_lista) = 0 then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object('ok', true, 'pedidos', v_lista);
end;
$$;

create or replace function public.recuperar_ingressos_contato(p_telefone text, p_email text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.recuperar_ingressos_contato(p_telefone, p_email);
$$;

-- ACL ------------------------------------------------------------------------
revoke all on function private.normalizar_telefone_br(text) from public;
grant execute on function private.normalizar_telefone_br(text) to anon, authenticated, service_role;

revoke all on function private.recuperar_ingressos_contato(text, text) from public;
grant execute on function private.recuperar_ingressos_contato(text, text) to anon, authenticated, service_role;

revoke execute on function public.recuperar_ingressos_contato(text, text) from public, anon, authenticated, service_role;
grant execute on function public.recuperar_ingressos_contato(text, text) to anon, authenticated, service_role;

comment on function public.recuperar_ingressos_contato(text, text) is
  'Gera tokens temporarios de recuperacao (telefone + e-mail da compra) para os pedidos pagos. Resposta generica.';
