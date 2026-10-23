-- =============================================================================
-- GZ1 Ingresso - Portaria: busca por nome com nomes semelhantes
-- Migration: portaria_busca_nome_semelhante
--
-- Reaplica private/public.buscar_ingressos_por_nome para que a busca encontre
-- tambem nomes PARECIDOS (pequenos erros de digitacao), alem das partes do
-- nome que ja eram aceitas. Pensada para sugestoes enquanto o operador digita.
--
-- Regra por palavra digitada (ja sem acento/caixa):
--   * aparece dentro do nome                       -> casa (distancia 0);
--   * ate 3 letras                                 -> so casa se aparecer;
--   * 4 letras                                     -> aceita 1 erro;
--   * 5+ letras                                    -> aceita 2 erros;
--   erro = letra trocada/faltando/sobrando (levenshtein) contra cada palavra
--   do nome ou contra o comeco dela (para quem ainda esta digitando).
-- Todas as palavras digitadas precisam casar. Resultado ordenado do mais
-- parecido para o menos parecido e limitado a 30 itens.
--
-- Novo campo em cada item: 'semelhante' (true quando o nome nao contem
-- exatamente o que foi digitado). Demais campos, assinatura, permissao
-- (ADMINISTRADOR/PORTARIA) e ausencia de dados financeiros sao preservados.
-- =============================================================================

create extension if not exists fuzzystrmatch with schema extensions;

create or replace function private.normalizar_nome_portaria(p_nome text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
           translate(
             lower(coalesce(p_nome, '')),
             'áàâãäéèêëíìîïóòôõöúùûüçñ',
             'aaaaaeeeeiiiiooooouuuucn'
           ),
           '\s+', ' ', 'g'
         ));
$$;

-- Distancia de uma palavra digitada ao nome (ambos normalizados).
-- 0 = aparece no nome; null = nao casa.
create or replace function private.distancia_token_nome(p_token text, p_nome text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when position(p_token in p_nome) > 0 then 0
    when length(p_token) <= 3 then null
    else (
      select nullif(least(min(d), 99), 99)
        from (
          select least(
                   extensions.levenshtein(p_token, w),
                   extensions.levenshtein(p_token, left(w, length(p_token)))
                 ) as d
            from unnest(string_to_array(p_nome, ' ')) as w
           where w <> ''
        ) x
       where d <= case when length(p_token) = 4 then 1 else 2 end
    )
  end;
$$;

create or replace function private.buscar_ingressos_por_nome(p_evento_id uuid, p_nome text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tokens text[];
begin
  if not private.usuario_pode_operar_portaria() then
    raise exception 'Permissao negada para operar portaria' using errcode = '42501';
  end if;

  select coalesce(array_agg(t), '{}')
    into v_tokens
    from unnest(string_to_array(private.normalizar_nome_portaria(p_nome), ' ')) as t
   where t <> '';

  if cardinality(v_tokens) = 0 then
    return '[]'::jsonb;
  end if;

  return (
    with base as (
      -- Ingressos normais
      select i.participante_nome as nome,
             jsonb_build_object(
               'origem', 'INGRESSO',
               'ingresso_id', i.id,
               'vip_id', null,
               'codigo', i.codigo,
               'participante_nome', i.participante_nome,
               'status', i.status,
               'utilizado_em', i.utilizado_em,
               'entrada_em', i.utilizado_em,
               'telefone', (
                 select p.comprador_telefone
                   from public.pedidos p
                  where p.id = i.pedido_id
               )
             ) as item
        from public.ingressos i
       where i.evento_id = p_evento_id
      union all
      -- Lista VIP (apenas ativos); status derivado da entrada
      select lv.nome,
             jsonb_build_object(
               'origem', 'VIP',
               'ingresso_id', null,
               'vip_id', lv.id,
               'codigo', null,
               'participante_nome', lv.nome,
               'status', case when ev.id is null then 'VALIDO' else 'UTILIZADO' end,
               'utilizado_em', ev.entrada_em,
               'entrada_em', ev.entrada_em,
               'telefone', lv.telefone
             )
        from public.lista_vip lv
        left join lateral (
          select e.id, e.entrada_em
            from public.entradas_vip e
           where e.lista_vip_id = lv.id
             and e.anulada_em is null
           order by e.entrada_em desc
           limit 1
        ) ev on true
       where lv.evento_id = p_evento_id
         and lv.ativo = true
    ),
    avaliado as (
      select b.nome, b.item, d.casadas, d.distancia
        from base b
        cross join lateral (
          select count(x.dist) as casadas, coalesce(sum(x.dist), 0) as distancia
            from (
              select private.distancia_token_nome(
                       tok, private.normalizar_nome_portaria(b.nome)
                     ) as dist
                from unnest(v_tokens) as tok
            ) x
        ) d
    ),
    escolhidos as (
      select item, nome, distancia
        from avaliado
       where casadas = cardinality(v_tokens)
       order by distancia, nome, item->>'origem'
       limit 30
    )
    select coalesce(
             jsonb_agg(
               item || jsonb_build_object('semelhante', distancia > 0)
               order by distancia, nome, item->>'origem'
             ),
             '[]'::jsonb
           )
      from escolhidos
  );
end;
$$;

create or replace function public.buscar_ingressos_por_nome(p_evento_id uuid, p_nome text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.buscar_ingressos_por_nome(p_evento_id, p_nome); $$;

-- ACL
grant usage on schema private to authenticated, service_role;

revoke all on function private.normalizar_nome_portaria(text) from public;
revoke all on function private.distancia_token_nome(text, text) from public;
grant execute on function private.normalizar_nome_portaria(text) to authenticated, service_role;
grant execute on function private.distancia_token_nome(text, text) to authenticated, service_role;

revoke all on function private.buscar_ingressos_por_nome(uuid, text) from public;
grant execute on function private.buscar_ingressos_por_nome(uuid, text) to authenticated, service_role;

revoke execute on function public.buscar_ingressos_por_nome(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.buscar_ingressos_por_nome(uuid, text) to authenticated, service_role;

comment on function public.buscar_ingressos_por_nome(uuid, text) is
  'Busca por nome no evento (ingressos + Lista VIP): partes do nome, sem acento/caixa, tolerante a pequenos erros; ordena do mais parecido, max 30. Campo semelhante=true quando nao e correspondencia exata. Sem valores/pagamento.';
