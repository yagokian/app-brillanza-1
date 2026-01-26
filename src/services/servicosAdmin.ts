import { supabase } from '../lib/supabase';
import { Servico } from '../types/database';

export interface AdminServicoInput {
  cliente_id: string;
  trabalhadora_id: string | null;
  data_servico: string;
  hora_inicio_prevista?: string | null;
  duracao_estimada?: string | null;
  tipo_cobranca_cliente?: string | null;
  valor_cliente?: number | null;
  tipo_pagamento_trabalhadora?: string | null;
  valor_trabalhadora?: number | null;
  status?: string | null;
  checklist?: Record<string, boolean> | null;
  observacoes_trabalhadora?: string | null;
  hora_inicio_real?: string | null;
  hora_fim_real?: string | null;
}

export async function createServicoAdmin(payload: AdminServicoInput): Promise<Servico> {
  const { data, error } = await supabase.rpc('rpc_admin_create_servico', {
    p_cliente_id: payload.cliente_id,
    p_trabalhadora_id: payload.trabalhadora_id,
    p_data_servico: payload.data_servico,
    p_hora_inicio_prevista: payload.hora_inicio_prevista ?? null,
    p_duracao_estimada: payload.duracao_estimada ?? null,
    p_tipo_cobranca_cliente: payload.tipo_cobranca_cliente ?? null,
    p_valor_cliente: payload.valor_cliente ?? null,
    p_tipo_pagamento_trabalhadora: payload.tipo_pagamento_trabalhadora ?? null,
    p_valor_trabalhadora: payload.valor_trabalhadora ?? null,
    p_status: payload.status ?? null,
    p_checklist: payload.checklist ?? null,
    p_observacoes_trabalhadora: payload.observacoes_trabalhadora ?? null,
    p_hora_inicio_real: payload.hora_inicio_real ?? null,
    p_hora_fim_real: payload.hora_fim_real ?? null,
  });

  if (error) throw error;
  return data as Servico;
}

export async function getServicosAdmin(): Promise<Servico[]> {
  const { data, error } = await supabase
    .from('servicos')
    .select(`
      *,
      cliente:clientes(id, nome, endereco, telefone),
      trabalhadora:trabalhadoras(id, nome, telefone)
    `)
    .order('data_servico', { ascending: true })
    .order('hora_inicio_prevista', { ascending: true });

  if (error) throw error;
  return data as Servico[];
}

export async function getServicoAdmin(id: string): Promise<Servico> {
  const { data, error } = await supabase
    .from('servicos')
    .select(`
      *,
      cliente:clientes(id, nome, endereco, telefone),
      trabalhadora:trabalhadoras(id, nome, telefone)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Servico;
}

export async function updateServicoAdmin(id: string, payload: Partial<AdminServicoInput>): Promise<Servico> {
  const { data, error } = await supabase.rpc('rpc_admin_update_servico', {
    p_id: id,
    p_cliente_id: payload.cliente_id ?? null,
    p_trabalhadora_id: payload.trabalhadora_id ?? null,
    p_data_servico: payload.data_servico ?? null,
    p_hora_inicio_prevista: payload.hora_inicio_prevista ?? null,
    p_duracao_estimada: payload.duracao_estimada ?? null,
    p_tipo_cobranca_cliente: payload.tipo_cobranca_cliente ?? null,
    p_valor_cliente: payload.valor_cliente ?? null,
    p_tipo_pagamento_trabalhadora: payload.tipo_pagamento_trabalhadora ?? null,
    p_valor_trabalhadora: payload.valor_trabalhadora ?? null,
    p_status: payload.status ?? null,
    p_checklist: payload.checklist ?? null,
    p_observacoes_trabalhadora: payload.observacoes_trabalhadora ?? null,
    p_hora_inicio_real: payload.hora_inicio_real ?? null,
    p_hora_fim_real: payload.hora_fim_real ?? null,
  });

  if (error) throw error;
  return data as Servico;
}

export async function deleteServicoAdmin(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('rpc_admin_delete_servico', {
    p_id: id,
  });

  if (error) throw error;
  return Boolean(data);
}
