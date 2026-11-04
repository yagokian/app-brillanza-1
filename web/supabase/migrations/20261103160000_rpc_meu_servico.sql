-- Fase 3: detalhe de um serviço para a colaboradora.
-- Mesmas colunas de rpc_minha_agenda (sem valores financeiros); só devolve serviço da própria colaboradora.
-- Endereço, telefone e notas do cliente só aparecem para serviços de ontem em diante.
begin;

create function public.rpc_meu_servico(p_id uuid)
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
  where s.id = p_id and s.colaboradora_id = v_colab;
end;
$$;

revoke execute on function public.rpc_meu_servico(uuid) from public, anon;
grant execute on function public.rpc_meu_servico(uuid) to authenticated;

commit;
