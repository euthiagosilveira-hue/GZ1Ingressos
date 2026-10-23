-- =============================================================================
-- GZ1 Ingresso - Testes: busca por nome com nomes semelhantes
-- Arquivo: supabase/tests/portaria_busca_nome_semelhante.test.sql
-- Executar como owner. begin/rollback.
-- =============================================================================

begin;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_portaria uuid := gen_random_uuid();
  v_e uuid;
  v_lote uuid;
  v_ped uuid;
  v_vip1 uuid;
  v_vip2 uuid;
  v_res jsonb;
  v_item jsonb;
  v_n integer;
begin
  insert into auth.users (id) values (v_admin), (v_portaria);
  insert into public.usuarios (id, nome, email, perfil, ativo) values
    (v_admin, 'Admin Busca', 'adminbusca_' || replace(v_admin::text,'-','') || '@test.local', 'ADMINISTRADOR', true),
    (v_portaria, 'Port Busca', 'portbusca_' || replace(v_portaria::text,'-','') || '@test.local', 'PORTARIA', true);

  insert into public.eventos (nome, slug, inicio_em, local, endereco, capacidade_total, estoque_antecipado, status, publicacao_status, vendas_status)
  values ('Evento Busca', 'busca-' || replace(gen_random_uuid()::text,'-',''), now()+interval '2 days', 'L', 'E', 100, 50, 'AGENDADO', 'RASCUNHO', 'ENCERRADAS')
  returning id into v_e;

  insert into public.lotes (evento_id, nome, ordem, quantidade, preco, tipo_ativacao, status)
  values (v_e, 'Lote', 1, 100, 40, 'MANUAL', 'ATIVO') returning id into v_lote;

  insert into public.pedidos (evento_id, lote_id, codigo, comprador_nome, comprador_telefone, quantidade, tipo_preco, valor_unitario, valor_total, status, reserva_expira_em, pago_em)
  values (v_e, v_lote, 'GZBUSCA1', 'Stephany Silva Pedrosa', '34999991234', 1, 'LOTE', 40, 40, 'PAGO', now(), now())
  returning id into v_ped;

  insert into public.ingressos (pedido_id, evento_id, lote_id, codigo, participante_nome, valor_unitario, qr_token, status)
  values (v_ped, v_e, v_lote, 'GZBUSCA1-01', 'Stephany Silva Pedrosa', 40, gen_random_uuid()::text, 'VALIDO');

  insert into public.lista_vip (evento_id, nome, telefone, criado_por_usuario_id)
  values (v_e, 'João Pedro Araújo', '34988887777', v_admin) returning id into v_vip1;

  insert into public.lista_vip (evento_id, nome, telefone, criado_por_usuario_id)
  values (v_e, 'Mariana Souza', null, v_admin) returning id into v_vip2;

  perform set_config('request.jwt.claims', json_build_object('sub', v_portaria::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_portaria::text, true);

  -- parte do nome, sem acento/caixa -> exato (semelhante = false)
  v_res := public.buscar_ingressos_por_nome(v_e, 'JOAO ara');
  if jsonb_array_length(v_res) <> 1 or (v_res->0->>'semelhante')::boolean then
    raise exception 'parte do nome deveria achar 1 exato: %', v_res;
  end if;

  -- erro de digitacao -> encontra como semelhante
  v_res := public.buscar_ingressos_por_nome(v_e, 'stefany');
  if jsonb_array_length(v_res) <> 1
     or v_res->0->>'participante_nome' <> 'Stephany Silva Pedrosa'
     or not (v_res->0->>'semelhante')::boolean then
    raise exception 'stefany deveria achar Stephany como semelhante: %', v_res;
  end if;

  -- ainda digitando com erro (comeco da palavra)
  v_res := public.buscar_ingressos_por_nome(v_e, 'marai');
  if not exists (select 1 from jsonb_array_elements(v_res) el
                  where el->>'participante_nome' = 'Mariana Souza') then
    raise exception 'marai deveria sugerir Mariana: %', v_res;
  end if;

  -- exatos vem antes dos semelhantes
  v_res := public.buscar_ingressos_por_nome(v_e, 'silva');
  if (v_res->0->>'semelhante')::boolean then
    raise exception 'primeiro resultado deveria ser exato: %', v_res;
  end if;

  -- nada parecido -> vazio
  v_res := public.buscar_ingressos_por_nome(v_e, 'xyzw');
  if jsonb_array_length(v_res) <> 0 then
    raise exception 'xyzw nao deveria achar nada: %', v_res;
  end if;

  -- palavra curta (ate 3 letras) nao aceita erro
  v_res := public.buscar_ingressos_por_nome(v_e, 'jao');
  if jsonb_array_length(v_res) <> 0 then
    raise exception 'jao nao deveria achar nada: %', v_res;
  end if;
end $$;

select 'portaria_busca_nome_semelhante: todos os testes passaram' as resultado;

rollback;
