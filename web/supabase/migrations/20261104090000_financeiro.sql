-- =====================================================================
-- Módulo financeiro interno: contas a pagar e a receber.
--
-- Acesso:
--   * Novo papel profiles.tipo = 'financeiro': só o módulo financeiro, com 2FA (AAL2).
--   * admin (AAL2) também tem acesso total ao módulo.
--   * Colaboradoras ('worker') nunca veem nada financeiro: sem política, sem RPC, sem anexos.
--
-- Escrita:
--   * Cadastros auxiliares (favorecidos, categorias, formas, contas): direto na tabela (RLS),
--     sem DELETE: cadastros só são inativados.
--   * Documentos, parcelas, movimentações e anexos: só pelas RPCs rpc_fin_* (transação única,
--     lock de linha, chave de idempotência). Nada é apagado; estorno é uma linha nova.
--   * Todo INSERT/UPDATE/DELETE nas tabelas fin_* vai para fin_historico com valores
--     antes/depois, usuário, operação e justificativa.
--
-- Dinheiro: numeric(12,2) em EUR. Valores com mais de 2 casas são recusados (sem arredondar
-- em silêncio). Datas de "hoje" no fuso Europe/Madrid.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- Papel 'financeiro'
-- ---------------------------------------------------------------------

alter table public.profiles drop constraint profiles_tipo_check;
alter table public.profiles add constraint profiles_tipo_check
  check (tipo in ('admin', 'worker', 'financeiro'));

create function private.is_financeiro()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from public.profiles
       where id = (select auth.uid()) and tipo in ('admin', 'financeiro') and ativo
     );
$$;

create function private.require_financeiro()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_financeiro() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$$;

create function private.hoje_madrid()
returns date
language sql stable set search_path = ''
as $$
  select (now() at time zone 'Europe/Madrid')::date;
$$;

-- Valor monetário válido: não nulo e com no máximo 2 casas decimais.
create function private.fin_dinheiro(p_valor numeric)
returns boolean
language sql immutable set search_path = ''
as $$
  select p_valor is not null and p_valor = round(p_valor, 2) and p_valor < 10000000000;
$$;

-- ---------------------------------------------------------------------
-- Cadastros auxiliares
-- ---------------------------------------------------------------------

create table public.fin_favorecidos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(nome) between 1 and 200),
  nif         text check (length(nif) <= 30),
  email       text check (length(email) <= 254),
  telefone    text check (length(telefone) <= 40),
  observacoes text check (length(observacoes) <= 2000),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.fin_categorias (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(nome) between 1 and 100),
  natureza   text not null check (natureza in ('receita', 'despesa')),
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index fin_categorias_nome_idx on public.fin_categorias (natureza, lower(nome));

create table public.fin_formas_pagamento (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(nome) between 1 and 100),
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index fin_formas_nome_idx on public.fin_formas_pagamento (lower(nome));

create table public.fin_contas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(nome) between 1 and 100),
  tipo       text not null check (tipo in ('banco', 'caixa')),
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index fin_contas_nome_idx on public.fin_contas (lower(nome));

-- ---------------------------------------------------------------------
-- Documentos, parcelas, movimentações e anexos
-- ---------------------------------------------------------------------

-- Um documento = uma obrigação. Nota fiscal e boleto da mesma obrigação ficam no mesmo
-- documento (como anexos), sem duplicar a despesa. Lançamentos sem documento fiscal usam
-- tipo_documento = 'sem_documento'.
create table public.fin_documentos (
  id                  uuid primary key default gen_random_uuid(),
  numero_interno      bigint generated always as identity unique,
  natureza            text not null check (natureza in ('pagar', 'receber')),
  cliente_id          uuid references public.clientes (id) on delete restrict,
  favorecido_id       uuid references public.fin_favorecidos (id) on delete restrict,
  descricao           text not null check (length(descricao) between 1 and 300),
  tipo_documento      text not null check (tipo_documento in
                        ('nota_fiscal', 'fatura', 'boleto', 'recibo', 'contrato', 'outro', 'sem_documento')),
  numero              text check (length(numero) <= 60),
  serie               text check (length(serie) <= 30),
  data_emissao        date not null,
  valor_total         numeric(12, 2) not null check (valor_total > 0),
  categoria_id        uuid not null references public.fin_categorias (id) on delete restrict,
  condicao            text not null check (condicao in ('a_vista', 'a_prazo', 'parcelado')),
  num_parcelas        integer not null check (num_parcelas between 1 and 120),
  observacoes         text check (length(observacoes) <= 2000),
  -- Vínculo opcional com um serviço. Não gera lançamento automático.
  servico_id          uuid references public.servicos (id) on delete set null,
  situacao            text not null default 'ativo' check (situacao in ('ativo', 'cancelado')),
  motivo_cancelamento text check (length(motivo_cancelamento) <= 1000),
  cancelado_em        timestamptz,
  cancelado_por       uuid references auth.users (id) on delete set null,
  chave_idempotencia  uuid not null unique,
  criado_por          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (num_nonnulls(cliente_id, favorecido_id) = 1),
  check ((condicao = 'parcelado') = (num_parcelas >= 2)),
  check (situacao = 'ativo' or (motivo_cancelamento is not null and cancelado_em is not null))
);
create index fin_documentos_natureza_idx on public.fin_documentos (natureza, data_emissao);
create index fin_documentos_dup_idx on public.fin_documentos (natureza, tipo_documento, lower(numero)) where numero is not null;
create index fin_documentos_cliente_idx on public.fin_documentos (cliente_id);
create index fin_documentos_favorecido_idx on public.fin_documentos (favorecido_id);
create index fin_documentos_servico_idx on public.fin_documentos (servico_id);

-- valor_liquidado = principal já liquidado (sem juros/multa/desconto), mantido pelas RPCs.
create table public.fin_parcelas (
  id              uuid primary key default gen_random_uuid(),
  documento_id    uuid not null references public.fin_documentos (id) on delete restrict,
  numero          integer not null check (numero >= 1),
  valor           numeric(12, 2) not null check (valor > 0),
  vencimento      date not null,
  valor_liquidado numeric(12, 2) not null default 0,
  saldo           numeric(12, 2) generated always as (valor - valor_liquidado) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (documento_id, numero),
  check (valor_liquidado >= 0 and valor_liquidado <= valor)
);
create index fin_parcelas_vencimento_idx on public.fin_parcelas (vencimento) where valor_liquidado < valor;

-- Movimentações são imutáveis. Um estorno é outra linha, com os valores negativos e
-- estorna_id apontando para a original (unique: nunca dois estornos da mesma).
-- valor_movimentado = dinheiro que entrou/saiu = principal + juros + multa - desconto.
create table public.fin_movimentos (
  id                 uuid primary key default gen_random_uuid(),
  parcela_id         uuid not null references public.fin_parcelas (id) on delete restrict,
  documento_id       uuid not null references public.fin_documentos (id) on delete restrict,
  tipo               text not null check (tipo in ('liquidacao', 'estorno')),
  estorna_id         uuid unique references public.fin_movimentos (id) on delete restrict,
  data_efetiva       date not null,
  valor_principal    numeric(12, 2) not null,
  juros              numeric(12, 2) not null default 0,
  multa              numeric(12, 2) not null default 0,
  desconto           numeric(12, 2) not null default 0,
  valor_movimentado  numeric(12, 2) generated always as (valor_principal + juros + multa - desconto) stored,
  conta_id           uuid not null references public.fin_contas (id) on delete restrict,
  forma_id           uuid not null references public.fin_formas_pagamento (id) on delete restrict,
  observacao         text check (length(observacao) <= 1000),
  justificativa      text check (length(justificativa) <= 1000),
  chave_idempotencia uuid unique,
  criado_por         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  check (
    (tipo = 'liquidacao' and estorna_id is null and valor_principal > 0
      and juros >= 0 and multa >= 0 and desconto >= 0
      and valor_principal + juros + multa - desconto >= 0)
    or
    (tipo = 'estorno' and estorna_id is not null and valor_principal < 0
      and juros <= 0 and multa <= 0 and desconto <= 0 and justificativa is not null)
  )
);
create index fin_movimentos_parcela_idx on public.fin_movimentos (parcela_id);
create index fin_movimentos_documento_idx on public.fin_movimentos (documento_id);
create index fin_movimentos_data_idx on public.fin_movimentos (data_efetiva);

-- Arquivo no bucket privado 'financeiro'. caminho = "<documento_id>/<uuid>.<ext>" (gerado no
-- servidor); nome_original só para exibição.
create table public.fin_anexos (
  id            uuid primary key default gen_random_uuid(),
  documento_id  uuid not null references public.fin_documentos (id) on delete restrict,
  movimento_id  uuid references public.fin_movimentos (id) on delete restrict,
  tipo          text not null check (tipo in
                  ('nota_fiscal', 'fatura', 'boleto', 'recibo', 'contrato', 'comprovante', 'outro')),
  nome_original text not null check (length(nome_original) between 1 and 255),
  caminho       text not null unique,
  mime          text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  tamanho       integer not null check (tamanho > 0 and tamanho <= 8388608),
  criado_por    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index fin_anexos_documento_idx on public.fin_anexos (documento_id);

-- Histórico completo: valores antes/depois (só os campos alterados em UPDATE).
create table public.fin_historico (
  id            bigint generated always as identity primary key,
  tabela        text not null,
  registro_id   uuid,
  documento_id  uuid,
  operacao      text not null,
  antes         jsonb,
  depois        jsonb,
  justificativa text,
  usuario_id    uuid,
  created_at    timestamptz not null default now()
);
create index fin_historico_documento_idx on public.fin_historico (documento_id, id);
create index fin_historico_registro_idx on public.fin_historico (tabela, registro_id);

-- ---------------------------------------------------------------------
-- Valores iniciais dos cadastros (podem ser renomeados ou inativados)
-- ---------------------------------------------------------------------

insert into public.fin_categorias (nome, natureza) values
  ('Servicios de limpieza', 'receita'),
  ('Otros ingresos', 'receita'),
  ('Colaboradoras', 'despesa'),
  ('Alquiler', 'despesa'),
  ('Material de limpieza', 'despesa'),
  ('Transporte', 'despesa'),
  ('Impuestos y tasas', 'despesa'),
  ('Otros gastos', 'despesa');

insert into public.fin_formas_pagamento (nome) values
  ('Transferencia'), ('Efectivo'), ('Tarjeta'), ('Bizum'), ('Domiciliación');

insert into public.fin_contas (nome, tipo) values ('Caja', 'caixa');

-- ---------------------------------------------------------------------
-- Histórico (trigger)
-- As RPCs informam a operação e a justificativa com set_config(..., true), válido só na
-- transação. Sem isso, a operação é o próprio comando (insert/update/delete).
-- ---------------------------------------------------------------------

create function private.fin_log()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old    jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new    jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row    jsonb := coalesce(v_new, v_old);
  v_antes  jsonb := v_old;
  v_depois jsonb := v_new;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, v_old -> n.key), jsonb_object_agg(n.key, n.value)
    into v_antes, v_depois
    from jsonb_each(v_new) n
    where n.value is distinct from v_old -> n.key and n.key <> 'updated_at';
    if v_depois is null then
      return null;
    end if;
  end if;

  insert into public.fin_historico (tabela, registro_id, documento_id, operacao, antes, depois, justificativa, usuario_id)
  values (
    tg_table_name,
    (v_row ->> 'id')::uuid,
    case when tg_table_name = 'fin_documentos' then (v_row ->> 'id')::uuid else (v_row ->> 'documento_id')::uuid end,
    coalesce(nullif(current_setting('fin.operacao', true), ''), lower(tg_op)),
    v_antes,
    v_depois,
    nullif(current_setting('fin.justificativa', true), ''),
    (select auth.uid())
  );
  return null;
end;
$$;

create trigger set_updated_at before update on public.fin_favorecidos
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.fin_categorias
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.fin_formas_pagamento
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.fin_contas
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.fin_documentos
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.fin_parcelas
  for each row execute function private.set_updated_at();

create trigger fin_log after insert or update or delete on public.fin_favorecidos
  for each row execute function private.fin_log();
create trigger fin_log after insert or update or delete on public.fin_categorias
  for each row execute function private.fin_log();
create trigger fin_log after insert or update or delete on public.fin_formas_pagamento
  for each row execute function private.fin_log();
create trigger fin_log after insert or update or delete on public.fin_contas
  for each row execute function private.fin_log();
create trigger fin_log after insert or update or delete on public.fin_documentos
  for each row execute function private.fin_log();
create trigger fin_log after insert or update or delete on public.fin_parcelas
  for each row execute function private.fin_log();
create trigger fin_log after insert or update or delete on public.fin_movimentos
  for each row execute function private.fin_log();
create trigger fin_log after insert or update or delete on public.fin_anexos
  for each row execute function private.fin_log();

-- ---------------------------------------------------------------------
-- Permissões e RLS
-- ---------------------------------------------------------------------

alter table public.fin_favorecidos      enable row level security;
alter table public.fin_categorias       enable row level security;
alter table public.fin_formas_pagamento enable row level security;
alter table public.fin_contas           enable row level security;
alter table public.fin_documentos       enable row level security;
alter table public.fin_parcelas         enable row level security;
alter table public.fin_movimentos       enable row level security;
alter table public.fin_anexos           enable row level security;
alter table public.fin_historico        enable row level security;

revoke all on public.fin_favorecidos, public.fin_categorias, public.fin_formas_pagamento, public.fin_contas,
  public.fin_documentos, public.fin_parcelas, public.fin_movimentos, public.fin_anexos, public.fin_historico
  from anon, authenticated;

grant select on public.fin_favorecidos, public.fin_categorias, public.fin_formas_pagamento, public.fin_contas,
  public.fin_documentos, public.fin_parcelas, public.fin_movimentos, public.fin_anexos, public.fin_historico
  to authenticated;
-- Cadastros: inserir e editar (inclusive inativar). Sem DELETE.
grant insert, update on public.fin_favorecidos, public.fin_categorias, public.fin_formas_pagamento, public.fin_contas
  to authenticated;

create policy "financeiro le favorecidos" on public.fin_favorecidos
  for select to authenticated using ((select private.is_financeiro()));
create policy "financeiro cria favorecidos" on public.fin_favorecidos
  for insert to authenticated with check ((select private.is_financeiro()));
create policy "financeiro altera favorecidos" on public.fin_favorecidos
  for update to authenticated using ((select private.is_financeiro())) with check ((select private.is_financeiro()));

create policy "financeiro le categorias" on public.fin_categorias
  for select to authenticated using ((select private.is_financeiro()));
create policy "financeiro cria categorias" on public.fin_categorias
  for insert to authenticated with check ((select private.is_financeiro()));
create policy "financeiro altera categorias" on public.fin_categorias
  for update to authenticated using ((select private.is_financeiro())) with check ((select private.is_financeiro()));

create policy "financeiro le formas" on public.fin_formas_pagamento
  for select to authenticated using ((select private.is_financeiro()));
create policy "financeiro cria formas" on public.fin_formas_pagamento
  for insert to authenticated with check ((select private.is_financeiro()));
create policy "financeiro altera formas" on public.fin_formas_pagamento
  for update to authenticated using ((select private.is_financeiro())) with check ((select private.is_financeiro()));

create policy "financeiro le contas" on public.fin_contas
  for select to authenticated using ((select private.is_financeiro()));
create policy "financeiro cria contas" on public.fin_contas
  for insert to authenticated with check ((select private.is_financeiro()));
create policy "financeiro altera contas" on public.fin_contas
  for update to authenticated using ((select private.is_financeiro())) with check ((select private.is_financeiro()));

create policy "financeiro le documentos" on public.fin_documentos
  for select to authenticated using ((select private.is_financeiro()));
create policy "financeiro le parcelas" on public.fin_parcelas
  for select to authenticated using ((select private.is_financeiro()));
create policy "financeiro le movimentos" on public.fin_movimentos
  for select to authenticated using ((select private.is_financeiro()));
create policy "financeiro le anexos" on public.fin_anexos
  for select to authenticated using ((select private.is_financeiro()));
create policy "financeiro le historico" on public.fin_historico
  for select to authenticated using ((select private.is_financeiro()));

-- ---------------------------------------------------------------------
-- Storage: bucket privado para os anexos (sem URL pública)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('financeiro', 'financeiro', false, 8388608, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "financeiro le arquivos" on storage.objects
  for select to authenticated
  using (bucket_id = 'financeiro' and (select private.is_financeiro()));

create policy "financeiro envia arquivos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'financeiro' and (select private.is_financeiro()));

-- Só para desfazer um envio que não chegou a ser registrado em fin_anexos.
create policy "financeiro remove envio sem registro" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'financeiro' and (select private.is_financeiro())
    and not exists (select 1 from public.fin_anexos a where a.caminho = storage.objects.name)
  );

-- ---------------------------------------------------------------------
-- Validações internas
-- ---------------------------------------------------------------------

-- Parcelas: array [{valor, vencimento}] na ordem; a soma tem de ser igual ao total.
-- O arredondamento é feito pela interface (centavos de diferença na última parcela) e
-- revisado pelo usuário: aqui só se aceita soma exata.
create function private.fin_validar_parcelas(p_total numeric, p_parcelas jsonb)
returns integer
language plpgsql stable set search_path = ''
as $$
declare
  v_n    integer;
  v_soma numeric := 0;
  v_p    jsonb;
begin
  if not private.fin_dinheiro(p_total) or p_total <= 0 then
    raise exception 'valor_invalido' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_parcelas) is distinct from 'array' then
    raise exception 'parcelas_invalidas' using errcode = 'P0001';
  end if;
  v_n := jsonb_array_length(p_parcelas);
  if v_n < 1 or v_n > 120 then
    raise exception 'parcelas_invalidas' using errcode = 'P0001';
  end if;
  for v_p in select value from jsonb_array_elements(p_parcelas) loop
    if not private.fin_dinheiro((v_p ->> 'valor')::numeric) or (v_p ->> 'valor')::numeric <= 0
       or (v_p ->> 'vencimento') is null then
      raise exception 'parcelas_invalidas' using errcode = 'P0001';
    end if;
    perform (v_p ->> 'vencimento')::date;
    v_soma := v_soma + (v_p ->> 'valor')::numeric;
  end loop;
  if v_soma <> p_total then
    raise exception 'soma_parcelas' using errcode = 'P0001', detail = v_soma::text;
  end if;
  return v_n;
end;
$$;

-- Favorecido/cliente, categoria e serviço. Um cadastro inativo só é aceito se já era o do
-- documento (p_atual), para não travar a edição de documentos antigos.
create function private.fin_validar_dados(p_natureza text, p_dados jsonb, p_atual public.fin_documentos)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_cliente    uuid := nullif(p_dados ->> 'cliente_id', '')::uuid;
  v_favorecido uuid := nullif(p_dados ->> 'favorecido_id', '')::uuid;
  v_categoria  uuid := nullif(p_dados ->> 'categoria_id', '')::uuid;
  v_servico    uuid := nullif(p_dados ->> 'servico_id', '')::uuid;
begin
  if p_natureza not in ('pagar', 'receber') then
    raise exception 'invalido' using errcode = 'P0001';
  end if;
  if num_nonnulls(v_cliente, v_favorecido) <> 1 then
    raise exception 'parte_invalida' using errcode = 'P0001';
  end if;
  if v_cliente is not null and not exists (
       select 1 from public.clientes c
       where c.id = v_cliente
         and (c.anonimizado_em is null or v_cliente is not distinct from p_atual.cliente_id)) then
    raise exception 'parte_invalida' using errcode = 'P0001';
  end if;
  if v_favorecido is not null and not exists (
       select 1 from public.fin_favorecidos f
       where f.id = v_favorecido and (f.ativo or v_favorecido is not distinct from p_atual.favorecido_id)) then
    raise exception 'parte_invalida' using errcode = 'P0001';
  end if;
  if not exists (
       select 1 from public.fin_categorias c
       where c.id = v_categoria
         and c.natureza = case p_natureza when 'pagar' then 'despesa' else 'receita' end
         and (c.ativo or v_categoria is not distinct from p_atual.categoria_id)) then
    raise exception 'categoria_invalida' using errcode = 'P0001';
  end if;
  if v_servico is not null and not exists (select 1 from public.servicos s where s.id = v_servico) then
    raise exception 'servico_invalido' using errcode = 'P0001';
  end if;
  if nullif(btrim(p_dados ->> 'descricao'), '') is null or (p_dados ->> 'data_emissao') is null then
    raise exception 'invalido' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- RPCs do módulo financeiro (admin ou 'financeiro', sempre com AAL2)
-- ---------------------------------------------------------------------

-- Cria documento + parcelas numa transação. A mesma chave devolve o mesmo documento
-- (duplo clique, reenvio do formulário).
create function public.rpc_fin_criar_documento(p_dados jsonb, p_parcelas jsonb, p_chave uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id       uuid;
  v_natureza text := p_dados ->> 'natureza';
  v_total    numeric := (p_dados ->> 'valor_total')::numeric;
  v_n        integer;
begin
  perform private.require_financeiro();
  if p_chave is null then
    raise exception 'invalido' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_chave::text, 0));
  select d.id into v_id from public.fin_documentos d where d.chave_idempotencia = p_chave;
  if found then
    return v_id;
  end if;

  v_n := private.fin_validar_parcelas(v_total, p_parcelas);
  perform private.fin_validar_dados(v_natureza, p_dados, null);

  perform set_config('fin.operacao', 'criacao', true);
  perform set_config('fin.justificativa', '', true);
  insert into public.fin_documentos (
    natureza, cliente_id, favorecido_id, descricao, tipo_documento, numero, serie, data_emissao,
    valor_total, categoria_id, condicao, num_parcelas, observacoes, servico_id, chave_idempotencia, criado_por
  ) values (
    v_natureza,
    nullif(p_dados ->> 'cliente_id', '')::uuid,
    nullif(p_dados ->> 'favorecido_id', '')::uuid,
    btrim(p_dados ->> 'descricao'),
    p_dados ->> 'tipo_documento',
    nullif(btrim(p_dados ->> 'numero'), ''),
    nullif(btrim(p_dados ->> 'serie'), ''),
    (p_dados ->> 'data_emissao')::date,
    v_total,
    (p_dados ->> 'categoria_id')::uuid,
    p_dados ->> 'condicao',
    v_n,
    nullif(btrim(p_dados ->> 'observacoes'), ''),
    nullif(p_dados ->> 'servico_id', '')::uuid,
    p_chave,
    (select auth.uid())
  ) returning id into v_id;

  insert into public.fin_parcelas (documento_id, numero, valor, vencimento)
  select v_id, e.ordinality::integer, (e.value ->> 'valor')::numeric, (e.value ->> 'vencimento')::date
  from jsonb_array_elements(p_parcelas) with ordinality e;

  return v_id;
end;
$$;

-- Edita um documento. Sem movimentações: tudo pode mudar (exceto a natureza) e as parcelas
-- são refeitas. Com movimentações (mesmo estornadas): valor, favorecido/cliente, condição e
-- valores das parcelas ficam travados; só vencimentos e dados descritivos mudam, com
-- justificativa. Os valores antigos ficam em fin_historico.
create function public.rpc_fin_editar_documento(p_id uuid, p_dados jsonb, p_parcelas jsonb, p_justificativa text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_doc     public.fin_documentos;
  v_tem_mov boolean;
  v_total   numeric := (p_dados ->> 'valor_total')::numeric;
  v_n       integer;
  v_just    text := nullif(btrim(p_justificativa), '');
  v_p       record;
begin
  perform private.require_financeiro();
  select * into v_doc from public.fin_documentos where id = p_id for update;
  if not found then
    return false;
  end if;
  if v_doc.situacao = 'cancelado' then
    raise exception 'documento_cancelado' using errcode = 'P0001';
  end if;

  v_n := private.fin_validar_parcelas(v_total, p_parcelas);
  perform private.fin_validar_dados(v_doc.natureza, p_dados, v_doc);
  v_tem_mov := exists (select 1 from public.fin_movimentos m where m.documento_id = p_id);

  if v_tem_mov then
    if v_just is null then
      raise exception 'justificativa_obrigatoria' using errcode = 'P0001';
    end if;
    if v_total <> v_doc.valor_total
       or nullif(p_dados ->> 'cliente_id', '')::uuid is distinct from v_doc.cliente_id
       or nullif(p_dados ->> 'favorecido_id', '')::uuid is distinct from v_doc.favorecido_id
       or (p_dados ->> 'condicao') is distinct from v_doc.condicao
       or v_n <> v_doc.num_parcelas
       or exists (
         select 1
         from jsonb_array_elements(p_parcelas) with ordinality e
         join public.fin_parcelas p on p.documento_id = p_id and p.numero = e.ordinality
         where (e.value ->> 'valor')::numeric <> p.valor) then
      raise exception 'tem_liquidacao' using errcode = 'P0001';
    end if;
  end if;

  perform set_config('fin.operacao', 'edicao', true);
  perform set_config('fin.justificativa', coalesce(v_just, ''), true);

  update public.fin_documentos set
    cliente_id     = nullif(p_dados ->> 'cliente_id', '')::uuid,
    favorecido_id  = nullif(p_dados ->> 'favorecido_id', '')::uuid,
    descricao      = btrim(p_dados ->> 'descricao'),
    tipo_documento = p_dados ->> 'tipo_documento',
    numero         = nullif(btrim(p_dados ->> 'numero'), ''),
    serie          = nullif(btrim(p_dados ->> 'serie'), ''),
    data_emissao   = (p_dados ->> 'data_emissao')::date,
    valor_total    = v_total,
    categoria_id   = (p_dados ->> 'categoria_id')::uuid,
    condicao       = p_dados ->> 'condicao',
    num_parcelas   = v_n,
    observacoes    = nullif(btrim(p_dados ->> 'observacoes'), ''),
    servico_id     = nullif(p_dados ->> 'servico_id', '')::uuid
  where id = p_id;

  if v_tem_mov then
    for v_p in
      select e.ordinality::integer as numero, (e.value ->> 'vencimento')::date as vencimento
      from jsonb_array_elements(p_parcelas) with ordinality e
    loop
      update public.fin_parcelas set vencimento = v_p.vencimento
      where documento_id = p_id and numero = v_p.numero and vencimento <> v_p.vencimento;
    end loop;
  else
    delete from public.fin_parcelas where documento_id = p_id;
    insert into public.fin_parcelas (documento_id, numero, valor, vencimento)
    select p_id, e.ordinality::integer, (e.value ->> 'valor')::numeric, (e.value ->> 'vencimento')::date
    from jsonb_array_elements(p_parcelas) with ordinality e;
  end if;
  return true;
end;
$$;

-- Registra um pagamento/recebimento (total ou parcial) de uma parcela.
-- p_valor é o dinheiro movimentado; principal = p_valor - juros - multa + desconto.
-- Bloqueia principal acima do saldo (o saldo vai em DETAIL). Lock: documento e parcela.
create function public.rpc_fin_registrar_movimento(
  p_parcela_id uuid, p_data date, p_valor numeric, p_juros numeric, p_multa numeric, p_desconto numeric,
  p_conta_id uuid, p_forma_id uuid, p_observacao text, p_chave uuid
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id        uuid;
  v_doc       public.fin_documentos;
  v_parcela   public.fin_parcelas;
  v_juros     numeric := coalesce(p_juros, 0);
  v_multa     numeric := coalesce(p_multa, 0);
  v_desconto  numeric := coalesce(p_desconto, 0);
  v_principal numeric;
begin
  perform private.require_financeiro();
  if p_chave is null then
    raise exception 'invalido' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_chave::text, 0));
  select m.id, m.parcela_id into v_id, v_parcela.id from public.fin_movimentos m where m.chave_idempotencia = p_chave;
  if found then
    if v_parcela.id <> p_parcela_id then
      raise exception 'invalido' using errcode = 'P0001';
    end if;
    return v_id;
  end if;

  select d.* into v_doc
  from public.fin_documentos d
  where d.id = (select p.documento_id from public.fin_parcelas p where p.id = p_parcela_id)
  for update;
  if not found then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  select * into v_parcela from public.fin_parcelas where id = p_parcela_id for update;

  if v_doc.situacao = 'cancelado' then
    raise exception 'documento_cancelado' using errcode = 'P0001';
  end if;
  if not (private.fin_dinheiro(p_valor) and private.fin_dinheiro(v_juros) and private.fin_dinheiro(v_multa)
          and private.fin_dinheiro(v_desconto))
     or p_valor < 0 or v_juros < 0 or v_multa < 0 or v_desconto < 0 then
    raise exception 'valor_invalido' using errcode = 'P0001';
  end if;
  if p_data is null or p_data > private.hoje_madrid() then
    raise exception 'data_invalida' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.fin_contas where id = p_conta_id and ativo)
     or not exists (select 1 from public.fin_formas_pagamento where id = p_forma_id and ativo) then
    raise exception 'conta_invalida' using errcode = 'P0001';
  end if;

  v_principal := p_valor - v_juros - v_multa + v_desconto;
  if v_parcela.saldo <= 0 then
    raise exception 'acima_do_saldo' using errcode = 'P0001', detail = v_parcela.saldo::text;
  end if;
  if v_principal <= 0 then
    raise exception 'valor_invalido' using errcode = 'P0001';
  end if;
  if v_principal > v_parcela.saldo then
    raise exception 'acima_do_saldo' using errcode = 'P0001', detail = v_parcela.saldo::text;
  end if;

  perform set_config('fin.operacao', 'liquidacao', true);
  perform set_config('fin.justificativa', '', true);
  insert into public.fin_movimentos (
    parcela_id, documento_id, tipo, data_efetiva, valor_principal, juros, multa, desconto,
    conta_id, forma_id, observacao, chave_idempotencia, criado_por
  ) values (
    p_parcela_id, v_doc.id, 'liquidacao', p_data, v_principal, v_juros, v_multa, v_desconto,
    p_conta_id, p_forma_id, nullif(btrim(p_observacao), ''), p_chave, (select auth.uid())
  ) returning id into v_id;

  update public.fin_parcelas set valor_liquidado = valor_liquidado + v_principal where id = p_parcela_id;
  return v_id;
end;
$$;

-- Estorno: nova linha com os valores negativos; a original fica intacta. Recompõe o saldo.
create function public.rpc_fin_estornar_movimento(p_movimento_id uuid, p_justificativa text, p_data date default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_mov  public.fin_movimentos;
  v_id   uuid;
  v_just text := nullif(btrim(p_justificativa), '');
  v_data date := coalesce(p_data, private.hoje_madrid());
begin
  perform private.require_financeiro();
  if v_just is null then
    raise exception 'justificativa_obrigatoria' using errcode = 'P0001';
  end if;

  perform 1 from public.fin_documentos
  where id = (select m.documento_id from public.fin_movimentos m where m.id = p_movimento_id)
  for update;
  if not found then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  select * into v_mov from public.fin_movimentos where id = p_movimento_id;
  perform 1 from public.fin_parcelas where id = v_mov.parcela_id for update;

  if v_mov.tipo <> 'liquidacao' then
    raise exception 'invalido' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.fin_movimentos where estorna_id = p_movimento_id) then
    raise exception 'ja_estornado' using errcode = 'P0001';
  end if;
  if v_data > private.hoje_madrid() or v_data < v_mov.data_efetiva then
    raise exception 'data_invalida' using errcode = 'P0001';
  end if;

  perform set_config('fin.operacao', 'estorno', true);
  perform set_config('fin.justificativa', v_just, true);
  insert into public.fin_movimentos (
    parcela_id, documento_id, tipo, estorna_id, data_efetiva, valor_principal, juros, multa, desconto,
    conta_id, forma_id, justificativa, criado_por
  ) values (
    v_mov.parcela_id, v_mov.documento_id, 'estorno', v_mov.id, v_data,
    -v_mov.valor_principal, -v_mov.juros, -v_mov.multa, -v_mov.desconto,
    v_mov.conta_id, v_mov.forma_id, v_just, (select auth.uid())
  ) returning id into v_id;

  update public.fin_parcelas set valor_liquidado = valor_liquidado - v_mov.valor_principal where id = v_mov.parcela_id;
  return v_id;
end;
$$;

-- Cancela o documento (nunca apaga). Com liquidação ativa, é preciso estornar antes.
create function public.rpc_fin_cancelar_documento(p_id uuid, p_justificativa text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_doc  public.fin_documentos;
  v_just text := nullif(btrim(p_justificativa), '');
begin
  perform private.require_financeiro();
  if v_just is null then
    raise exception 'justificativa_obrigatoria' using errcode = 'P0001';
  end if;
  select * into v_doc from public.fin_documentos where id = p_id for update;
  if not found then
    return false;
  end if;
  if v_doc.situacao = 'cancelado' then
    raise exception 'documento_cancelado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.fin_parcelas where documento_id = p_id and valor_liquidado > 0) then
    raise exception 'estornar_antes' using errcode = 'P0001';
  end if;

  perform set_config('fin.operacao', 'cancelamento', true);
  perform set_config('fin.justificativa', v_just, true);
  update public.fin_documentos
  set situacao = 'cancelado', motivo_cancelamento = v_just, cancelado_em = now(), cancelado_por = (select auth.uid())
  where id = p_id;
  return true;
end;
$$;

-- Registra um arquivo já enviado ao bucket 'financeiro' (o servidor gera o caminho).
create function public.rpc_fin_registrar_anexo(
  p_documento_id uuid, p_movimento_id uuid, p_tipo text, p_nome_original text, p_caminho text, p_mime text, p_tamanho integer
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_financeiro();
  if not exists (select 1 from public.fin_documentos where id = p_documento_id) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if p_movimento_id is not null and not exists (
       select 1 from public.fin_movimentos where id = p_movimento_id and documento_id = p_documento_id) then
    raise exception 'invalido' using errcode = 'P0001';
  end if;
  if p_caminho is null
     or p_caminho !~ ('^' || p_documento_id::text || '/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$')
     or not exists (select 1 from storage.objects o where o.bucket_id = 'financeiro' and o.name = p_caminho) then
    raise exception 'arquivo_invalido' using errcode = 'P0001';
  end if;

  perform set_config('fin.operacao', 'anexo', true);
  perform set_config('fin.justificativa', '', true);
  insert into public.fin_anexos (documento_id, movimento_id, tipo, nome_original, caminho, mime, tamanho, criado_por)
  values (p_documento_id, p_movimento_id, p_tipo, left(btrim(p_nome_original), 255), p_caminho, p_mime, p_tamanho,
          (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- Lista parcelas com a situação calculada (fuso Europe/Madrid). Filtros em p_filtros:
--   natureza, documento_id, periodo ('emissao' | 'vencimento' | 'liquidacao'), de, ate,
--   cliente_id, favorecido_id, categoria_id, conta_id, forma_id,
--   situacao ('aberta' | 'parcial' | 'quitada' | 'cancelada' | 'em_aberto' | 'vencida' | 'vence_hoje' | 'a_vencer'),
--   servico ('com' | 'sem' | <uuid>), limite.
-- Conta, forma e período de liquidação olham as liquidações não estornadas.
create function public.rpc_fin_listar_parcelas(p_filtros jsonb)
returns table (
  parcela_id          uuid,
  documento_id        uuid,
  numero_interno      bigint,
  natureza            text,
  parte_tipo          text,
  parte_id            uuid,
  parte_nome          text,
  descricao           text,
  tipo_documento      text,
  numero_documento    text,
  serie               text,
  categoria_id        uuid,
  categoria_nome      text,
  data_emissao        date,
  servico_id          uuid,
  documento_situacao  text,
  parcela_numero      integer,
  num_parcelas        integer,
  vencimento          date,
  valor               numeric,
  valor_liquidado     numeric,
  saldo               numeric,
  total_movimentado   numeric,
  ultima_liquidacao   date,
  situacao_liquidacao text,
  situacao_vencimento text
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_hoje     date := private.hoje_madrid();
  v_periodo  text := p_filtros ->> 'periodo';
  v_de       date := nullif(p_filtros ->> 'de', '')::date;
  v_ate      date := nullif(p_filtros ->> 'ate', '')::date;
  v_situacao text := nullif(p_filtros ->> 'situacao', '');
  v_servico  text := nullif(p_filtros ->> 'servico', '');
  v_conta    uuid := nullif(p_filtros ->> 'conta_id', '')::uuid;
  v_forma    uuid := nullif(p_filtros ->> 'forma_id', '')::uuid;
begin
  perform private.require_financeiro();
  return query
  with base as (
    select
      p.id as parcela_id, d.id as documento_id, d.numero_interno, d.natureza,
      case when d.cliente_id is not null then 'cliente' else 'favorecido' end as parte_tipo,
      coalesce(d.cliente_id, d.favorecido_id) as parte_id,
      coalesce(c.nome, f.nome) as parte_nome,
      d.descricao, d.tipo_documento, d.numero as numero_documento, d.serie,
      d.categoria_id, cat.nome as categoria_nome, d.data_emissao, d.servico_id, d.situacao as documento_situacao,
      p.numero as parcela_numero, d.num_parcelas, p.vencimento, p.valor, p.valor_liquidado, p.saldo,
      coalesce((select sum(m.valor_movimentado) from public.fin_movimentos m where m.parcela_id = p.id), 0) as total_movimentado,
      (select max(m.data_efetiva) from public.fin_movimentos m
        where m.parcela_id = p.id and m.tipo = 'liquidacao'
          and not exists (select 1 from public.fin_movimentos e where e.estorna_id = m.id)) as ultima_liquidacao,
      case
        when d.situacao = 'cancelado' then 'cancelada'
        when p.saldo = 0 then 'quitada'
        when p.valor_liquidado > 0 then 'parcial'
        else 'aberta'
      end as situacao_liquidacao,
      case
        when d.situacao = 'cancelado' or p.saldo = 0 then null
        when p.vencimento < v_hoje then 'vencida'
        when p.vencimento = v_hoje then 'vence_hoje'
        else 'a_vencer'
      end as situacao_vencimento
    from public.fin_parcelas p
    join public.fin_documentos d on d.id = p.documento_id
    join public.fin_categorias cat on cat.id = d.categoria_id
    left join public.clientes c on c.id = d.cliente_id
    left join public.fin_favorecidos f on f.id = d.favorecido_id
    where (p_filtros ->> 'natureza' is null or d.natureza = p_filtros ->> 'natureza')
      and (nullif(p_filtros ->> 'documento_id', '') is null or d.id = (p_filtros ->> 'documento_id')::uuid)
      and (nullif(p_filtros ->> 'cliente_id', '') is null or d.cliente_id = (p_filtros ->> 'cliente_id')::uuid)
      and (nullif(p_filtros ->> 'favorecido_id', '') is null or d.favorecido_id = (p_filtros ->> 'favorecido_id')::uuid)
      and (nullif(p_filtros ->> 'categoria_id', '') is null or d.categoria_id = (p_filtros ->> 'categoria_id')::uuid)
      and (v_servico is null
           or (v_servico = 'com' and d.servico_id is not null)
           or (v_servico = 'sem' and d.servico_id is null)
           or (v_servico not in ('com', 'sem') and d.servico_id::text = v_servico))
      and (v_periodo is distinct from 'emissao'
           or ((v_de is null or d.data_emissao >= v_de) and (v_ate is null or d.data_emissao <= v_ate)))
      and (v_periodo is distinct from 'vencimento'
           or ((v_de is null or p.vencimento >= v_de) and (v_ate is null or p.vencimento <= v_ate)))
      and ((v_periodo is distinct from 'liquidacao' and v_conta is null and v_forma is null)
           or exists (
             select 1 from public.fin_movimentos m
             where m.parcela_id = p.id and m.tipo = 'liquidacao'
               and not exists (select 1 from public.fin_movimentos e where e.estorna_id = m.id)
               and (v_conta is null or m.conta_id = v_conta)
               and (v_forma is null or m.forma_id = v_forma)
               and (v_periodo is distinct from 'liquidacao'
                    or ((v_de is null or m.data_efetiva >= v_de) and (v_ate is null or m.data_efetiva <= v_ate)))))
  )
  select b.* from base b
  where v_situacao is null
     or b.situacao_liquidacao = v_situacao
     or b.situacao_vencimento = v_situacao
     or (v_situacao = 'em_aberto' and b.situacao_vencimento is not null)
  order by b.vencimento, b.numero_interno, b.parcela_numero
  limit least(coalesce(nullif(p_filtros ->> 'limite', '')::integer, 500), 2000);
end;
$$;

-- Painel: saldos em aberto (só parcelas com saldo de documentos ativos) e o que foi pago e
-- recebido no período pelas datas efetivas (estornos entram negativos na data do estorno).
-- Cada valor vem das parcelas ou das movimentações, nunca do documento + parcelas.
create function public.rpc_fin_painel(p_de date, p_ate date)
returns table (
  hoje                date,
  pagar_vencido       numeric,
  receber_vencido     numeric,
  pagar_hoje          numeric,
  receber_hoje        numeric,
  pagar_7dias         numeric,
  receber_7dias       numeric,
  pagar_mes           numeric,
  receber_mes         numeric,
  pago_periodo        numeric,
  recebido_periodo    numeric,
  saldo_movimentacoes numeric
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_hoje date := private.hoje_madrid();
  v_mes  date := date_trunc('month', v_hoje)::date;
begin
  perform private.require_financeiro();
  return query
  with abertas as (
    select d.natureza, p.vencimento, p.saldo
    from public.fin_parcelas p
    join public.fin_documentos d on d.id = p.documento_id
    where d.situacao = 'ativo' and p.saldo > 0
  ),
  movs as (
    select d.natureza, coalesce(sum(m.valor_movimentado), 0) as total
    from public.fin_movimentos m
    join public.fin_documentos d on d.id = m.documento_id
    where m.data_efetiva between p_de and p_ate
    group by d.natureza
  ),
  a as (
    select
      coalesce(sum(saldo) filter (where natureza = 'pagar' and vencimento < v_hoje), 0) as pv,
      coalesce(sum(saldo) filter (where natureza = 'receber' and vencimento < v_hoje), 0) as rv,
      coalesce(sum(saldo) filter (where natureza = 'pagar' and vencimento = v_hoje), 0) as ph,
      coalesce(sum(saldo) filter (where natureza = 'receber' and vencimento = v_hoje), 0) as rh,
      coalesce(sum(saldo) filter (where natureza = 'pagar' and vencimento between v_hoje and v_hoje + 6), 0) as p7,
      coalesce(sum(saldo) filter (where natureza = 'receber' and vencimento between v_hoje and v_hoje + 6), 0) as r7,
      coalesce(sum(saldo) filter (where natureza = 'pagar' and vencimento >= v_mes
                                    and vencimento < (v_mes + interval '1 month')::date), 0) as pm,
      coalesce(sum(saldo) filter (where natureza = 'receber' and vencimento >= v_mes
                                    and vencimento < (v_mes + interval '1 month')::date), 0) as rm
    from abertas
  )
  select v_hoje, a.pv, a.rv, a.ph, a.rh, a.p7, a.r7, a.pm, a.rm,
         coalesce((select total from movs where natureza = 'pagar'), 0),
         coalesce((select total from movs where natureza = 'receber'), 0),
         coalesce((select total from movs where natureza = 'receber'), 0)
           - coalesce((select total from movs where natureza = 'pagar'), 0)
  from a;
end;
$$;

-- Histórico de um documento (inclui parcelas, movimentações e anexos), com o nome do usuário.
create function public.rpc_fin_historico(p_documento_id uuid)
returns table (
  id            bigint,
  tabela        text,
  registro_id   uuid,
  operacao      text,
  antes         jsonb,
  depois        jsonb,
  justificativa text,
  usuario_nome  text,
  created_at    timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_financeiro();
  return query
  select h.id, h.tabela, h.registro_id, h.operacao, h.antes, h.depois, h.justificativa, pr.nome, h.created_at
  from public.fin_historico h
  left join public.profiles pr on pr.id = h.usuario_id
  where h.documento_id = p_documento_id
  order by h.id desc;
end;
$$;

-- Clientes para documentos a receber: só id e nome (sem os outros dados pessoais).
create function public.rpc_fin_clientes()
returns table (id uuid, nome text, anonimizado boolean)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_financeiro();
  return query
  select c.id, c.nome, c.anonimizado_em is not null
  from public.clientes c
  order by c.anonimizado_em is not null, c.nome;
end;
$$;

-- Serviços para o vínculo opcional: data, cliente e situação. Por id ou por período/cliente.
create function public.rpc_fin_servicos(p_cliente_id uuid, p_de date, p_ate date, p_id uuid default null)
returns table (id uuid, data_servico date, cliente_nome text, status text)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_financeiro();
  return query
  select s.id, s.data_servico, c.nome, s.status
  from public.servicos s
  join public.clientes c on c.id = s.cliente_id
  where (p_id is not null and s.id = p_id)
     or (p_id is null
         and (p_cliente_id is null or s.cliente_id = p_cliente_id)
         and (p_de is null or s.data_servico >= p_de)
         and (p_ate is null or s.data_servico <= p_ate))
  order by s.data_servico desc
  limit 300;
end;
$$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

revoke execute on function
  private.is_financeiro(),
  private.require_financeiro(),
  private.hoje_madrid(),
  private.fin_dinheiro(numeric),
  private.fin_log(),
  private.fin_validar_parcelas(numeric, jsonb),
  private.fin_validar_dados(text, jsonb, public.fin_documentos)
from public, anon, authenticated;
grant execute on function private.is_financeiro() to authenticated;

revoke execute on function
  public.rpc_fin_criar_documento(jsonb, jsonb, uuid),
  public.rpc_fin_editar_documento(uuid, jsonb, jsonb, text),
  public.rpc_fin_registrar_movimento(uuid, date, numeric, numeric, numeric, numeric, uuid, uuid, text, uuid),
  public.rpc_fin_estornar_movimento(uuid, text, date),
  public.rpc_fin_cancelar_documento(uuid, text),
  public.rpc_fin_registrar_anexo(uuid, uuid, text, text, text, text, integer),
  public.rpc_fin_listar_parcelas(jsonb),
  public.rpc_fin_painel(date, date),
  public.rpc_fin_historico(uuid),
  public.rpc_fin_clientes(),
  public.rpc_fin_servicos(uuid, date, date, uuid)
from public, anon;

grant execute on function
  public.rpc_fin_criar_documento(jsonb, jsonb, uuid),
  public.rpc_fin_editar_documento(uuid, jsonb, jsonb, text),
  public.rpc_fin_registrar_movimento(uuid, date, numeric, numeric, numeric, numeric, uuid, uuid, text, uuid),
  public.rpc_fin_estornar_movimento(uuid, text, date),
  public.rpc_fin_cancelar_documento(uuid, text),
  public.rpc_fin_registrar_anexo(uuid, uuid, text, text, text, text, integer),
  public.rpc_fin_listar_parcelas(jsonb),
  public.rpc_fin_painel(date, date),
  public.rpc_fin_historico(uuid),
  public.rpc_fin_clientes(),
  public.rpc_fin_servicos(uuid, date, date, uuid)
to authenticated;

commit;
