import { supabase } from '../lib/supabase';
import { Trabalhadora } from '../types/database';

export interface WorkerProfileOption {
  id: string;
  nome: string;
  telefone: string | null;
}

export async function getTrabalhadoras(): Promise<Trabalhadora[]> {
  const { data, error } = await supabase
    .from('trabalhadoras')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data as Trabalhadora[];
}

export async function getTrabalhadora(id: string): Promise<Trabalhadora> {
  const { data, error } = await supabase
    .from('trabalhadoras')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Trabalhadora;
}

export async function createTrabalhadora(
  trabalhadora: Omit<Trabalhadora, 'id' | 'created_at'>
): Promise<{ id: string }> {
  const params = {
    p_nome: trabalhadora.nome,
    p_user_id: trabalhadora.user_id || null,
    p_telefone: trabalhadora.telefone || null,
    p_tipos_de_servico: trabalhadora.tipos_de_servico || null,
    p_tipo_pagamento: trabalhadora.tipo_pagamento || null,
    p_valor_pagamento: trabalhadora.valor_pagamento || null,
    p_dias_disponiveis: trabalhadora.dias_disponiveis || null,
    p_observacoes: trabalhadora.observacoes || null,
    p_ativo: trabalhadora.ativo ?? true,
  };

  const { data, error } = await supabase.rpc('rpc_create_trabalhadora', params);

  if (error) {
    console.error('Supabase createTrabalhadora error:', error);
    throw new Error(error.message || 'Erro ao criar trabalhadora');
  }

  if (!data) {
    throw new Error('Erro ao criar trabalhadora - sem retorno');
  }

  return { id: data };
}

export async function updateTrabalhadora(
  id: string,
  trabalhadora: Omit<Trabalhadora, 'id' | 'created_at'>
): Promise<boolean> {
  const { data, error } = await supabase.rpc('rpc_update_trabalhadora', {
    p_id: id,
    p_nome: trabalhadora.nome,
    p_user_id: trabalhadora.user_id,
    p_telefone: trabalhadora.telefone,
    p_tipos_de_servico: trabalhadora.tipos_de_servico,
    p_tipo_pagamento: trabalhadora.tipo_pagamento,
    p_valor_pagamento: trabalhadora.valor_pagamento,
    p_dias_disponiveis: trabalhadora.dias_disponiveis,
    p_observacoes: trabalhadora.observacoes,
    p_ativo: trabalhadora.ativo,
  });

  if (error) {
    console.error('Supabase updateTrabalhadora error:', error);
    throw new Error(error.message || 'Erro ao atualizar trabalhadora');
  }

  return data === true;
}

export async function deleteTrabalhadora(id: string): Promise<void> {
  const { data, error } = await supabase.rpc('rpc_delete_trabalhadora', {
    p_id: id,
  });

  if (error) {
    console.error('Supabase deleteTrabalhadora error:', error);
    throw new Error(error.message || 'Erro ao excluir trabalhadora');
  }

  if (!data) {
    throw new Error('Erro ao excluir trabalhadora');
  }
}

export async function searchTrabalhadoras(query: string): Promise<Trabalhadora[]> {
  const { data, error } = await supabase
    .from('trabalhadoras')
    .select('*')
    .ilike('nome', `%${query}%`)
    .order('nome', { ascending: true });

  if (error) throw error;
  return data as Trabalhadora[];
}

export async function getWorkerProfiles(): Promise<WorkerProfileOption[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, telefone')
    .eq('tipo', 'worker')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data as WorkerProfileOption[];
}
