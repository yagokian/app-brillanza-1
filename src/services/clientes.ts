import { supabase } from '../lib/supabase';
import { Cliente } from '../types/database';

export async function getClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data as Cliente[];
}

export async function getCliente(id: string): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Cliente;
}

export async function createCliente(cliente: Omit<Cliente, 'id' | 'created_at'>): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc('rpc_create_cliente', {
    p_nome: cliente.nome,
    p_endereco: cliente.endereco,
    p_telefone: cliente.telefone,
    p_email: cliente.email,
    p_data_contratacao: cliente.data_contratacao,
    p_tipo_servico: cliente.tipo_servico,
    p_frequencia: cliente.frequencia,
    p_duracao_horario: cliente.duracao_horario,
    p_dia_semana: cliente.dia_semana,
    p_tipo_cobranca: cliente.tipo_cobranca,
    p_valor_acordado: cliente.valor_acordado,
    p_observacoes: cliente.observacoes,
    p_aceite_lgpd: cliente.aceite_lgpd,
    p_data_aceite_lgpd: cliente.data_aceite_lgpd,
  });

  if (error) {
    console.error('Supabase createCliente error:', error);
    throw new Error(error.message || 'Erro ao criar cliente');
  }

  if (!data) {
    throw new Error('Erro ao criar cliente');
  }

  return { id: data };
}

export async function updateCliente(
  id: string,
  cliente: Omit<Cliente, 'id' | 'created_at'>
): Promise<boolean> {
  const { data, error } = await supabase.rpc('rpc_update_cliente', {
    p_id: id,
    p_nome: cliente.nome,
    p_endereco: cliente.endereco,
    p_telefone: cliente.telefone,
    p_email: cliente.email,
    p_data_contratacao: cliente.data_contratacao,
    p_tipo_servico: cliente.tipo_servico,
    p_frequencia: cliente.frequencia,
    p_duracao_horario: cliente.duracao_horario,
    p_dia_semana: cliente.dia_semana,
    p_tipo_cobranca: cliente.tipo_cobranca,
    p_valor_acordado: cliente.valor_acordado,
    p_observacoes: cliente.observacoes,
    p_aceite_lgpd: cliente.aceite_lgpd,
    p_data_aceite_lgpd: cliente.data_aceite_lgpd,
  });

  if (error) {
    console.error('Supabase updateCliente error:', error);
    throw new Error(error.message || 'Erro ao atualizar cliente');
  }

  return data === true;
}

export async function deleteCliente(id: string): Promise<void> {
  const { data, error } = await supabase.rpc('rpc_delete_cliente', {
    p_id: id,
  });

  if (error) {
    console.error('Supabase deleteCliente error:', error);
    throw new Error(error.message || 'Erro ao excluir cliente');
  }

  if (!data) {
    throw new Error('Erro ao excluir cliente');
  }
}

export async function searchClientes(query: string): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .ilike('nome', `%${query}%`)
    .order('nome', { ascending: true });

  if (error) throw error;
  return data as Cliente[];
}
