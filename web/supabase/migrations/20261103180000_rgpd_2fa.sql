-- Fase 5: RGPD na interface e 2FA de admin.
--   * Admin só tem acesso às tabelas com sessão AAL2 (senha + código TOTP).
--   * Exportações de dados pessoais (art. 15 e 20 RGPD) ficam no audit_log como 'EXPORT'.
--   * Anonimizar uma colaboradora também limpa o perfil de login dela.
begin;

-- ---------------------------------------------------------------------
-- 2FA: is_admin() exige o nível AAL2 no token.
-- Sem 2FA o admin continua lendo o próprio perfil (política "perfil proprio").
-- ---------------------------------------------------------------------

create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from public.profiles
       where id = (select auth.uid()) and tipo = 'admin' and ativo
     );
$$;

-- ---------------------------------------------------------------------
-- Registro de exportações
-- ---------------------------------------------------------------------

alter table public.audit_log drop constraint audit_log_acao_check;
alter table public.audit_log add constraint audit_log_acao_check
  check (acao in ('INSERT', 'UPDATE', 'DELETE', 'EXPORT'));

-- Grava quem exportou os dados de qual pessoa e em que formato (em "campos").
create function public.rpc_admin_registrar_exportacao(p_tabela text, p_id uuid, p_formato text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_tabela not in ('clientes', 'colaboradoras') or p_formato not in ('json', 'csv') then
    raise exception 'invalid argument' using errcode = '22023';
  end if;
  if p_tabela = 'clientes' and not exists (select 1 from public.clientes where id = p_id)
     or p_tabela = 'colaboradoras' and not exists (select 1 from public.colaboradoras where id = p_id) then
    return false;
  end if;

  insert into public.audit_log (tabela, registro_id, acao, campos, usuario_id)
  values (p_tabela, p_id, 'EXPORT', array[p_formato], (select auth.uid()));
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Anonimizar colaboradora: também desativa e limpa o perfil de login,
-- caso o servidor não consiga apagar a conta logo em seguida.
-- ---------------------------------------------------------------------

create or replace function public.rpc_admin_anonimizar_colaboradora(p_id uuid)
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

  if v_user is not null then
    update public.profiles set nome = 'Colaboradora anonimizada', ativo = false where id = v_user;
  end if;
  -- Devolve o user_id para o servidor apagar a conta de login.
  return v_user;
end;
$$;

revoke execute on function
  public.rpc_admin_registrar_exportacao(text, uuid, text),
  public.rpc_admin_anonimizar_colaboradora(uuid)
from public, anon;

grant execute on function
  public.rpc_admin_registrar_exportacao(text, uuid, text),
  public.rpc_admin_anonimizar_colaboradora(uuid)
to authenticated;

commit;
