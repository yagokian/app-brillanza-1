import { supabase } from '../lib/supabase';
import { Servico } from '../types/database';

export async function getServicosWithCliente(): Promise<Servico[]> {
  const { data, error } = await supabase
    .from('servicos')
    .select(`
      *,
      cliente:clientes_publicos(id, nome, endereco, telefone, tipo_servico)
    `)
    .order('data_servico', { ascending: true })
    .order('hora_inicio_prevista', { ascending: true });

  if (error) throw error;
  return data as Servico[];
}

export async function getServicoById(id: string): Promise<Servico> {
  const { data, error } = await supabase
    .from('servicos')
    .select(`
      *,
      cliente:clientes_publicos(id, nome, endereco, telefone, tipo_servico)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Servico;
}

export async function startServico(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('rpc_start_servico', { p_id: id });
  if (error) throw error;
  return Boolean(data);
}

export async function finishServico(id: string, observacoes: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('rpc_finish_servico', {
    p_id: id,
    p_observacoes: observacoes || null,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function saveObservacoes(id: string, observacoes: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('rpc_save_observacoes', {
    p_id: id,
    p_observacoes: observacoes || null,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function saveChecklist(id: string, checklist: Record<string, boolean>): Promise<boolean> {
  const { data, error } = await supabase.rpc('rpc_save_checklist', {
    p_id: id,
    p_checklist: checklist,
  });
  if (error) throw error;
  return Boolean(data);
}
