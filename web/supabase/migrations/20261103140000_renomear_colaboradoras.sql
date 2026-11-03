-- =====================================================================
-- Renomeia "trabalhadora(s)" para "colaboradora(s)" em todo o banco:
-- tabela, colunas, restrições, índice, política e funções.
-- Os dados existentes são mantidos.
-- =====================================================================

begin;

-- As funções antigas citam os nomes antigos no corpo: removê-las antes de renomear.
drop function public.rpc_minha_agenda(date, date);
drop function public.rpc_iniciar_servico(uuid);
drop function public.rpc_finalizar_servico(uuid, text);
drop function public.rpc_salvar_observacoes(uuid, text);
drop function public.rpc_salvar_checklist(uuid, jsonb);
drop function public.rpc_admin_anonimizar_cliente(uuid);
drop function public.rpc_admin_anonimizar_trabalhadora(uuid);
drop function private.require_trabalhadora();
drop function private.current_trabalhadora_id();

-- ---------------------------------------------------------------------
-- Tabela, colunas, índice e política
-- ---------------------------------------------------------------------

alter table public.trabalhadoras rename to colaboradoras;

alter table public.servicos rename column trabalhadora_id to colaboradora_id;
alter table public.servicos rename column tipo_pagamento_trabalhadora to tipo_pagamento_colaboradora;
alter table public.servicos rename column valor_trabalhadora to valor_colaboradora;
alter table public.servicos rename column observacoes_trabalhadora to observacoes_colaboradora;
alter table public.clientes rename column notas_para_trabalhadora to notas_para_colaboradora;

alter index public.servicos_trabalhadora_data_idx rename to servicos_colaboradora_data_idx;

alter policy "admin gerencia trabalhadoras" on public.colaboradoras rename to "admin gerencia colaboradoras";

-- Restrições com nomes gerados automaticamente (ex.: trabalhadoras_pkey).
do $$
declare
  r record;
begin
  for r in
    select con.conrelid::regclass as tabela, con.conname
    from pg_constraint con
    where con.conrelid in ('public.colaboradoras'::regclass, 'public.servicos'::regclass, 'public.clientes'::regclass)
      and con.conname like '%trabalhadora%'
  loop
    execute format('alter table %s rename constraint %I to %I',
      r.tabela, r.conname, replace(r.conname, 'trabalhadora', 'colaboradora'));
  end loop;
end;
$$;

-- Histórico de auditoria já gravado passa a usar os nomes novos.
update public.audit_log set tabela = 'colaboradoras' where tabela = 'trabalhadoras';
update public.audit_log
set campos = (
  select array_agg(replace(c, 'trabalhadora', 'colaboradora') order by replace(c, 'trabalhadora', 'colaboradora'))
  from unnest(campos) c
)
where exists (select 1 from unnest(campos) c where c like '%trabalhadora%');

-- ---------------------------------------------------------------------
-- Funções auxiliares (schema privado)
-- ---------------------------------------------------------------------

create function private.current_colaboradora_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.id
  from public.colaboradoras c
  join public.profiles p on p.id = c.user_id
  where c.user_id = (select auth.uid()) and c.ativo and p.ativo
  limit 1;
$$;

create function private.require_colaboradora()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id uuid := private.current_colaboradora_id();
begin
  if v_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

revoke all on function private.current_colaboradora_id(), private.require_colaboradora() from public, anon, authenticated;
grant execute on function private.current_colaboradora_id() to authenticated;

-- ---------------------------------------------------------------------
-- RPCs da colaboradora (sem valores financeiros)
-- Endereço e telefone do cliente só aparecem para serviços de ontem em diante.
-- ---------------------------------------------------------------------

create function public.rpc_minha_agenda(p_desde date, p_ate date)
returns table (
  id                       uuid,
  data_servico             date,
  hora_inicio_prevista     time,
  duracao_estimada         interval,
  status                   text,
  checklist                jsonb,
  observacoes_colaboradora text,
  hora_inicio_real         timestamptz,
  hora_fim_real            timestamptz,
  cliente_nome             text,
  cliente_endereco         text,
  cliente_codigo_postal    text,
  cliente_cidade           text,
  cliente_telefone         text,
  cliente_notas            text
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_colab uuid := private.require_colaboradora();
begin
  if p_desde is null or p_ate is null or p_ate < p_desde or p_ate - p_desde > 62 then
    raise exception 'invalid range' using errcode = '22023';
  end if;

  return query
  select s.id, s.data_servico, s.hora_inicio_prevista, s.duracao_estimada, s.status,
         s.checklist, s.observacoes_colaboradora, s.hora_inicio_real, s.hora_fim_real,
         c.nome,
         case when s.data_servico >= (now() at time zone 'Europe/Madrid')::date - 1 then c.endereco end,
         case when s.data_servico >= (now() at time zone 'Europe/Madrid')::date - 1 then c.codigo_postal end,
         case when s.data_servico >= (now() at time zone 'Europe/Madrid')::date - 1 then c.cidade end,
         case when s.data_servico >= (now() at time zone 'Europe/Madrid')::date - 1 then c.telefone end,
         case when s.data_servico >= (now() at time zone 'Europe/Madrid')::date - 1 then c.notas_para_colaboradora end
  from public.servicos s
  join public.clientes c on c.id = s.cliente_id
  where s.colaboradora_id = v_colab
    and s.data_servico between p_desde and p_ate
  order by s.data_servico, s.hora_inicio_prevista nulls last;
end;
$$;

create function public.rpc_iniciar_servico(p_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_colab uuid := private.require_colaboradora();
  v_count integer;
begin
  update public.servicos
  set status = 'em_andamento', hora_inicio_real = now()
  where id = p_id and colaboradora_id = v_colab and status = 'agendado';
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create function public.rpc_finalizar_servico(p_id uuid, p_observacoes text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_colab uuid := private.require_colaboradora();
  v_count integer;
begin
  update public.servicos
  set status = 'concluido',
      hora_fim_real = now(),
      observacoes_colaboradora = left(p_observacoes, 2000)
  where id = p_id and colaboradora_id = v_colab and status = 'em_andamento';
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create function public.rpc_salvar_observacoes(p_id uuid, p_observacoes text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_colab uuid := private.require_colaboradora();
  v_count integer;
begin
  update public.servicos
  set observacoes_colaboradora = left(p_observacoes, 2000)
  where id = p_id and colaboradora_id = v_colab and status in ('agendado', 'em_andamento');
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create function public.rpc_salvar_checklist(p_id uuid, p_checklist jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_colab uuid := private.require_colaboradora();
  v_count integer;
begin
  if jsonb_typeof(p_checklist) <> 'object' then
    raise exception 'invalid checklist' using errcode = '22023';
  end if;
  update public.servicos
  set checklist = p_checklist
  where id = p_id and colaboradora_id = v_colab and status in ('agendado', 'em_andamento');
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

-- ---------------------------------------------------------------------
-- RPCs de admin - direito de supressão (art. 17 RGPD)
-- ---------------------------------------------------------------------

create function public.rpc_admin_anonimizar_cliente(p_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.require_admin();
  update public.clientes
  set nome = 'Cliente anonimizado',
      endereco = null, codigo_postal = null, telefone = null, email = null,
      observacoes = null, notas_para_colaboradora = null,
      anonimizado_em = now()
  where id = p_id and anonimizado_em is null;
  get diagnostics v_count = row_count;

  update public.servicos set observacoes_colaboradora = null where cliente_id = p_id;
  return v_count = 1;
end;
$$;

create function public.rpc_admin_anonimizar_colaboradora(p_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  perform private.require_admin();
  select user_id into v_user from public.colaboradoras where id = p_id and anonimizado_em is null;
  if not found then
    return null;
  end if;

  update public.colaboradoras
  set nome = 'Colaboradora anonimizada',
      user_id = null, telefone = null, email = null, observacoes = null,
      ativo = false, anonimizado_em = now()
  where id = p_id;

  update public.servicos set observacoes_colaboradora = null where colaboradora_id = p_id;
  -- Devolve o user_id para o servidor apagar a conta de login.
  return v_user;
end;
$$;

revoke execute on function
  public.rpc_minha_agenda(date, date),
  public.rpc_iniciar_servico(uuid),
  public.rpc_finalizar_servico(uuid, text),
  public.rpc_salvar_observacoes(uuid, text),
  public.rpc_salvar_checklist(uuid, jsonb),
  public.rpc_admin_anonimizar_cliente(uuid),
  public.rpc_admin_anonimizar_colaboradora(uuid)
from public, anon;

grant execute on function
  public.rpc_minha_agenda(date, date),
  public.rpc_iniciar_servico(uuid),
  public.rpc_finalizar_servico(uuid, text),
  public.rpc_salvar_observacoes(uuid, text),
  public.rpc_salvar_checklist(uuid, jsonb),
  public.rpc_admin_anonimizar_cliente(uuid),
  public.rpc_admin_anonimizar_colaboradora(uuid)
to authenticated;

commit;
