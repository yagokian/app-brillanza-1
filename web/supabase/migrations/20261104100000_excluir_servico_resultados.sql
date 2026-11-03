-- Excluir serviço lançado por engano e resultados financeiros (receitas x despesas).
--   * Um serviço só pode ser excluído se nunca começou (agendado ou cancelado, sem início real).
--     Iniciado ou concluído: só cancelar/editar, para não sumir do histórico e dos relatórios.
--     A exclusão fica no audit_log (trigger existente) e documentos financeiros vinculados
--     perdem só o vínculo (fin_documentos.servico_id é "on delete set null").
--   * rpc_fin_resultados: por mês, receita dos serviços concluídos, custo das colaboradoras e
--     despesas lançadas no financeiro (competência = data de emissão). Despesas vinculadas a um
--     serviço não entram (o custo já está no serviço), para não contar duas vezes.
begin;

create function private.bloquear_exclusao_servico()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status not in ('agendado', 'cancelado') or old.hora_inicio_real is not null then
    raise exception 'servico_iniciado' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger bloquear_exclusao before delete on public.servicos
  for each row execute function private.bloquear_exclusao_servico();

-- Linhas por mês. As despesas vêm do valor total do documento (não das parcelas), uma vez só.
create function public.rpc_fin_resultados(p_de date, p_ate date)
returns table (
  mes                 date,
  servicos            integer,
  receita_servicos    numeric,
  custo_colaboradoras numeric,
  despesas            numeric,
  resultado           numeric
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_financeiro();
  return query
  with meses as (
    select generate_series(date_trunc('month', p_de), date_trunc('month', p_ate), interval '1 month')::date as mes
  ),
  srv as (
    select date_trunc('month', s.data_servico)::date as mes, count(*)::integer as n,
           coalesce(sum(s.valor_cliente), 0) as receita, coalesce(sum(s.valor_colaboradora), 0) as custo
    from public.servicos s
    where s.status = 'concluido' and s.data_servico between p_de and p_ate
    group by 1
  ),
  desp as (
    select date_trunc('month', d.data_emissao)::date as mes, sum(d.valor_total) as total
    from public.fin_documentos d
    where d.natureza = 'pagar' and d.situacao = 'ativo' and d.servico_id is null
      and d.data_emissao between p_de and p_ate
    group by 1
  )
  select m.mes, coalesce(s.n, 0), coalesce(s.receita, 0), coalesce(s.custo, 0), coalesce(d.total, 0),
         coalesce(s.receita, 0) - coalesce(s.custo, 0) - coalesce(d.total, 0)
  from meses m
  left join srv s on s.mes = m.mes
  left join desp d on d.mes = m.mes
  order by m.mes;
end;
$$;

-- Despesas do período por categoria (mesmo critério de rpc_fin_resultados).
create function public.rpc_fin_despesas_categoria(p_de date, p_ate date)
returns table (categoria_id uuid, categoria text, documentos integer, total numeric)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_financeiro();
  return query
  select c.id, c.nome, count(*)::integer, sum(d.valor_total)
  from public.fin_documentos d
  join public.fin_categorias c on c.id = d.categoria_id
  where d.natureza = 'pagar' and d.situacao = 'ativo' and d.servico_id is null
    and d.data_emissao between p_de and p_ate
  group by c.id, c.nome
  order by 4 desc;
end;
$$;

revoke execute on function private.bloquear_exclusao_servico() from public, anon, authenticated;

revoke execute on function
  public.rpc_fin_resultados(date, date),
  public.rpc_fin_despesas_categoria(date, date)
from public, anon;

grant execute on function
  public.rpc_fin_resultados(date, date),
  public.rpc_fin_despesas_categoria(date, date)
to authenticated;

commit;
