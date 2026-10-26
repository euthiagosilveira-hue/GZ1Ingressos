-- =============================================================================
-- Conferencia automatica de Pix no inicio do evento
--
-- Quando o evento passa de AGENDADO para EM_ANDAMENTO, o banco chama (pg_net)
-- POST /api/sistema/conferir-pagamentos-evento. O servidor pergunta ao
-- Mercado Pago se os pedidos EXPIRADOS do evento foram pagos e libera os que
-- foram (confirmar_pagamento aceita pagamento tardio).
--
-- Seguranca: a chamada leva um segredo aleatorio gerado aqui e guardado em
-- private.configuracoes (fora da API). O servidor le o segredo pela RPC
-- obter_segredo_sistema (somente service_role) e compara.
--
-- Evento que ja comecou (ex.: 24/10): disparar uma vez, depois do deploy, com
--   select private.solicitar_conferencia_pagamentos('<evento_id>');
-- =============================================================================

do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  else
    raise notice 'pg_net indisponivel: conferencia no inicio do evento nao sera disparada';
  end if;
end
$do$;

create table if not exists private.configuracoes (
  chave text primary key,
  valor text not null
);

revoke all on table private.configuracoes from public;

insert into private.configuracoes (chave, valor)
values ('segredo_sistema', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (chave) do nothing;

insert into private.configuracoes (chave, valor)
values ('url_aplicacao', 'https://gz-1-ingressos.vercel.app')
on conflict (chave) do nothing;

-- Leitura do segredo pelo backend (service_role) ------------------------------
create or replace function private.obter_segredo_sistema()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.valor from private.configuracoes c where c.chave = 'segredo_sistema';
$$;

revoke all on function private.obter_segredo_sistema() from public;
grant execute on function private.obter_segredo_sistema() to service_role;

create or replace function public.obter_segredo_sistema()
returns text
language sql
stable
security invoker
set search_path = ''
as $$ select private.obter_segredo_sistema(); $$;

revoke execute on function public.obter_segredo_sistema() from public, anon, authenticated;
grant execute on function public.obter_segredo_sistema() to service_role;

-- Dispara a conferencia de um evento (assincrono, nao bloqueia) ---------------
create or replace function private.solicitar_conferencia_pagamentos(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_segredo text;
begin
  select valor into v_url from private.configuracoes where chave = 'url_aplicacao';
  select valor into v_segredo from private.configuracoes where chave = 'segredo_sistema';
  if v_url is null or v_segredo is null then
    return;
  end if;

  perform net.http_post(
    url := v_url || '/api/sistema/conferir-pagamentos-evento',
    body := jsonb_build_object('eventoId', p_evento_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_segredo
    ),
    timeout_milliseconds := 60000
  );
exception when others then
  -- Nunca impede a mudanca de status do evento.
  raise warning 'Conferencia de pagamentos nao disparada para %: %', p_evento_id, sqlerrm;
end;
$$;

revoke all on function private.solicitar_conferencia_pagamentos(uuid) from public;

-- Gatilho: evento comecou ------------------------------------------------------
create or replace function private.trg_evento_iniciado_conferir_pagamentos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.solicitar_conferencia_pagamentos(new.id);
  return new;
end;
$$;

drop trigger if exists trg_evento_iniciado_conferir_pagamentos on public.eventos;
create trigger trg_evento_iniciado_conferir_pagamentos
  after update of status on public.eventos
  for each row
  when (old.status = 'AGENDADO' and new.status = 'EM_ANDAMENTO')
  execute function private.trg_evento_iniciado_conferir_pagamentos();
