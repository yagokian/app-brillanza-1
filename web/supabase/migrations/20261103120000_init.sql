-- =====================================================================
-- Brillanza Limpiezas v2 - esquema inicial
-- Para um projeto Supabase NOVO, hospedado em região da UE (RGPD).
--
-- Modelo de acesso:
--   * admin  -> lê e escreve clientes, trabalhadoras e serviços pelas tabelas (RLS).
--   * worker -> NÃO acessa tabelas diretamente; usa só as funções rpc_* abaixo,
--               que devolvem o mínimo necessário e nunca valores financeiros.
--   * Ninguém vira admin por conta própria: todo usuário novo nasce 'worker'.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  nome              text not null,
  tipo              text not null default 'worker' check (tipo in ('admin', 'worker')),
  idioma            text not null default 'es' check (idioma in ('es', 'pt')),
  ativo             boolean not null default true,
  deve_trocar_senha boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.clientes (
  id                     uuid primary key default gen_random_uuid(),
  nome                   text not null,
  endereco               text,
  codigo_postal          text,
  cidade                 text default 'Barcelona',
  telefone               text,
  email                  text,
  data_contratacao       date,
  tipo_servico           text,
  frequencia             text,
  duracao_horario        text,
  dia_semana             text,
  tipo_cobranca          text check (tipo_cobranca in ('hora', 'diaria', 'fixo')),
  valor_acordado         numeric(10, 2) check (valor_acordado >= 0),
  observacoes            text,                 -- só admin
  notas_para_trabalhadora text,                -- visível para a trabalhadora do serviço
  -- RGPD
  base_legal             text not null default 'contrato' check (base_legal in ('contrato', 'consentimento')),
  aviso_privacidade_em   timestamptz,          -- quando o cliente recebeu o aviso de privacidade
  anonimizado_em         timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.trabalhadoras (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid unique references auth.users (id) on delete set null,
  nome             text not null,
  telefone         text,
  email            text,
  tipos_de_servico text[],
  tipo_pagamento   text check (tipo_pagamento in ('hora', 'diaria', 'fixo')),
  valor_pagamento  numeric(10, 2) check (valor_pagamento >= 0),
  dias_disponiveis text[],
  observacoes      text,
  ativo            boolean not null default true,
  anonimizado_em   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.servicos (
  id                          uuid primary key default gen_random_uuid(),
  -- restrict: o histórico não some; para apagar dados pessoais, anonimize o cliente.
  cliente_id                  uuid not null references public.clientes (id) on delete restrict,
  trabalhadora_id             uuid references public.trabalhadoras (id) on delete set null,
  data_servico                date not null,
  hora_inicio_prevista        time,
  duracao_estimada            interval,
  tipo_cobranca_cliente       text check (tipo_cobranca_cliente in ('hora', 'diaria', 'fixo')),
  valor_cliente               numeric(10, 2) check (valor_cliente >= 0),
  tipo_pagamento_trabalhadora text check (tipo_pagamento_trabalhadora in ('hora', 'diaria', 'fixo')),
  valor_trabalhadora          numeric(10, 2) check (valor_trabalhadora >= 0),
  status                      text not null default 'agendado'
                              check (status in ('agendado', 'em_andamento', 'concluido', 'cancelado')),
  motivo_cancelamento         text,
  checklist                   jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object'),
  observacoes_trabalhadora    text,
  hora_inicio_real            timestamptz,
  hora_fim_real               timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (hora_fim_real is null or hora_inicio_real is null or hora_fim_real >= hora_inicio_real)
);

-- Registro de alterações. Guarda QUEM mudou QUAIS campos e QUANDO,
-- mas não os valores (minimização de dados, art. 5.1.c RGPD).
create table public.audit_log (
  id          bigint generated always as identity primary key,
  tabela      text not null,
  registro_id uuid not null,
  acao        text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  campos      text[],
  usuario_id  uuid,
  created_at  timestamptz not null default now()
);

create index servicos_data_idx on public.servicos (data_servico);
create index servicos_trabalhadora_data_idx on public.servicos (trabalhadora_id, data_servico);
create index servicos_cliente_idx on public.servicos (cliente_id);
create index audit_log_registro_idx on public.audit_log (tabela, registro_id);
create index audit_log_created_idx on public.audit_log (created_at);

-- ---------------------------------------------------------------------
-- Funções auxiliares (schema privado, fora da API)
-- ---------------------------------------------------------------------

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and tipo = 'admin' and ativo
  );
$$;

create function private.current_trabalhadora_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select t.id
  from public.trabalhadoras t
  join public.profiles p on p.id = t.user_id
  where t.user_id = (select auth.uid()) and t.ativo and p.ativo
  limit 1;
$$;

create function private.require_trabalhadora()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id uuid := private.current_trabalhadora_id();
begin
  if v_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

create function private.require_admin()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$$;

create function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_campos text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_campos
    from jsonb_each(to_jsonb(new)) n
    where n.value is distinct from to_jsonb(old) -> n.key
      and n.key <> 'updated_at';
    if v_campos is null then
      return new;
    end if;
  end if;

  insert into public.audit_log (tabela, registro_id, acao, campos, usuario_id)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    tg_op,
    v_campos,
    (select auth.uid())
  );
  return coalesce(new, old);
end;
$$;

-- Todo usuário novo nasce 'worker'. Promover a admin só via SQL (ver README).
-- Nunca confiar em raw_user_meta_data para permissões: é editável pelo usuário.
create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, nome, tipo)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), new.email), 'worker');
  return new;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.current_trabalhadora_id() to authenticated;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.clientes
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.trabalhadoras
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.servicos
  for each row execute function private.set_updated_at();

create trigger audit after insert or update or delete on public.profiles
  for each row execute function private.audit();
create trigger audit after insert or update or delete on public.clientes
  for each row execute function private.audit();
create trigger audit after insert or update or delete on public.trabalhadoras
  for each row execute function private.audit();
create trigger audit after insert or update or delete on public.servicos
  for each row execute function private.audit();

-- ---------------------------------------------------------------------
-- Permissões e RLS
-- ---------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.clientes      enable row level security;
alter table public.trabalhadoras enable row level security;
alter table public.servicos      enable row level security;
alter table public.audit_log     enable row level security;

revoke all on public.profiles, public.clientes, public.trabalhadoras, public.servicos, public.audit_log
  from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.clientes, public.trabalhadoras, public.servicos to authenticated;
grant select on public.audit_log to authenticated;

create policy "perfil proprio ou admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "admin altera perfis" on public.profiles
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "admin gerencia clientes" on public.clientes
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "admin gerencia trabalhadoras" on public.trabalhadoras
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "admin gerencia servicos" on public.servicos
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "admin le auditoria" on public.audit_log
  for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- RPCs da trabalhadora (sem valores financeiros)
-- Endereço e telefone do cliente só aparecem para serviços de ontem em diante:
-- o histórico antigo mostra apenas o nome (minimização de dados).
-- ---------------------------------------------------------------------

create function public.rpc_minha_agenda(p_desde date, p_ate date)
returns table (
  id                       uuid,
  data_servico             date,
  hora_inicio_prevista     time,
  duracao_estimada         interval,
  status                   text,
  checklist                jsonb,
  observacoes_trabalhadora text,
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
  v_trab uuid := private.require_trabalhadora();
begin
  if p_desde is null or p_ate is null or p_ate < p_desde or p_ate - p_desde > 62 then
    raise exception 'invalid range' using errcode = '22023';
  end if;

  return query
  select s.id, s.data_servico, s.hora_inicio_prevista, s.duracao_estimada, s.status,
         s.checklist, s.observacoes_trabalhadora, s.hora_inicio_real, s.hora_fim_real,
         c.nome,
         case when s.data_servico >= (now() at time zone 'Europe/Madrid')::date - 1 then c.endereco end,
         case when s.data_servico >= (now() at time zone 'Europe/Madrid')::date - 1 then c.codigo_postal end,
         case when s.data_servico >= (now() at time zone 'Europe/Madrid')::date - 1 then c.cidade end,
         case when s.data_servico >= (now() at time zone 'Europe/Madrid')::date - 1 then c.telefone end,
         case when s.data_servico >= (now() at time zone 'Europe/Madrid')::date - 1 then c.notas_para_trabalhadora end
  from public.servicos s
  join public.clientes c on c.id = s.cliente_id
  where s.trabalhadora_id = v_trab
    and s.data_servico between p_desde and p_ate
  order by s.data_servico, s.hora_inicio_prevista nulls last;
end;
$$;

create function public.rpc_iniciar_servico(p_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_trab uuid := private.require_trabalhadora();
  v_count integer;
begin
  update public.servicos
  set status = 'em_andamento', hora_inicio_real = now()
  where id = p_id and trabalhadora_id = v_trab and status = 'agendado';
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create function public.rpc_finalizar_servico(p_id uuid, p_observacoes text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_trab uuid := private.require_trabalhadora();
  v_count integer;
begin
  update public.servicos
  set status = 'concluido',
      hora_fim_real = now(),
      observacoes_trabalhadora = left(p_observacoes, 2000)
  where id = p_id and trabalhadora_id = v_trab and status = 'em_andamento';
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create function public.rpc_salvar_observacoes(p_id uuid, p_observacoes text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_trab uuid := private.require_trabalhadora();
  v_count integer;
begin
  update public.servicos
  set observacoes_trabalhadora = left(p_observacoes, 2000)
  where id = p_id and trabalhadora_id = v_trab and status in ('agendado', 'em_andamento');
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create function public.rpc_salvar_checklist(p_id uuid, p_checklist jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_trab uuid := private.require_trabalhadora();
  v_count integer;
begin
  if jsonb_typeof(p_checklist) <> 'object' then
    raise exception 'invalid checklist' using errcode = '22023';
  end if;
  update public.servicos
  set checklist = p_checklist
  where id = p_id and trabalhadora_id = v_trab and status in ('agendado', 'em_andamento');
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

-- ---------------------------------------------------------------------
-- RPCs de qualquer usuário autenticado (só afetam o próprio perfil)
-- ---------------------------------------------------------------------

create function public.rpc_concluir_troca_senha()
returns void
language sql security definer set search_path = ''
as $$
  update public.profiles set deve_trocar_senha = false where id = (select auth.uid());
$$;

create function public.rpc_definir_idioma(p_idioma text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_idioma not in ('es', 'pt') then
    raise exception 'invalid language' using errcode = '22023';
  end if;
  update public.profiles set idioma = p_idioma where id = (select auth.uid());
end;
$$;

-- ---------------------------------------------------------------------
-- RPCs de admin - direito de supressão (art. 17 RGPD)
-- Anonimiza a pessoa e mantém os serviços para estatística.
-- O usuário de login da trabalhadora é apagado pelo servidor (chave secreta).
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
      observacoes = null, notas_para_trabalhadora = null,
      anonimizado_em = now()
  where id = p_id and anonimizado_em is null;
  get diagnostics v_count = row_count;

  update public.servicos set observacoes_trabalhadora = null where cliente_id = p_id;
  return v_count = 1;
end;
$$;

create function public.rpc_admin_anonimizar_trabalhadora(p_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  perform private.require_admin();
  select user_id into v_user from public.trabalhadoras where id = p_id and anonimizado_em is null;
  if not found then
    return null;
  end if;

  update public.trabalhadoras
  set nome = 'Trabajadora anonimizada',
      user_id = null, telefone = null, email = null, observacoes = null,
      ativo = false, anonimizado_em = now()
  where id = p_id;

  update public.servicos set observacoes_trabalhadora = null where trabalhadora_id = p_id;
  -- Devolve o user_id para o servidor apagar a conta de login.
  return v_user;
end;
$$;

-- Funções em public recebem EXECUTE para PUBLIC por padrão: restringir.
revoke execute on function
  public.rpc_minha_agenda(date, date),
  public.rpc_iniciar_servico(uuid),
  public.rpc_finalizar_servico(uuid, text),
  public.rpc_salvar_observacoes(uuid, text),
  public.rpc_salvar_checklist(uuid, jsonb),
  public.rpc_concluir_troca_senha(),
  public.rpc_definir_idioma(text),
  public.rpc_admin_anonimizar_cliente(uuid),
  public.rpc_admin_anonimizar_trabalhadora(uuid)
from public, anon;

grant execute on function
  public.rpc_minha_agenda(date, date),
  public.rpc_iniciar_servico(uuid),
  public.rpc_finalizar_servico(uuid, text),
  public.rpc_salvar_observacoes(uuid, text),
  public.rpc_salvar_checklist(uuid, jsonb),
  public.rpc_concluir_troca_senha(),
  public.rpc_definir_idioma(text),
  public.rpc_admin_anonimizar_cliente(uuid),
  public.rpc_admin_anonimizar_trabalhadora(uuid)
to authenticated;
