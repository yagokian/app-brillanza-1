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

export interface DashboardStats {
  servicosHoje: number;
  emAndamento: number;
  concluidosHoje: number;
  atividadeRecente: Servico[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const localDate = new Date();
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const todayISO = `${year}-${month}-${day}`;

  // 1. Servicos de hoje
  const { count: hojeCount, error: hojeError } = await supabase
    .from('servicos')
    .select('id', { count: 'exact', head: true })
    .eq('data_servico', todayISO);

  if (hojeError) throw hojeError;

  // 2. Em andamento
  const { count: andamentoCount, error: andamentoError } = await supabase
    .from('servicos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'em_andamento');

  if (andamentoError) throw andamentoError;

  // 3. Concluidos hoje
  const { count: concluidosCount, error: concluidosError } = await supabase
    .from('servicos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'concluido')
    .eq('data_servico', todayISO);

  if (concluidosError) throw concluidosError;

  // 4. Atividade recente (ultimos 5 servicos criados ou modificados)
  const { data: recenteData, error: recenteError } = await supabase
    .from('servicos')
    .select(`
      *,
      cliente:clientes(id, nome),
      trabalhadora:trabalhadoras(id, nome)
    `)
    .order('created_at', { ascending: false })
    .limit(5);

  if (recenteError) throw recenteError;

  return {
    servicosHoje: hojeCount || 0,
    emAndamento: andamentoCount || 0,
    concluidosHoje: concluidosCount || 0,
    atividadeRecente: (recenteData || []) as Servico[],
  };
}

export interface RelatorioStats {
  totalFaturado: number;
  totalPago: number;
  lucroLiquido: number;
  margemPorcentagem: number;
  totalServicos: number;
  trabalhadoras: {
    id: string;
    nome: string;
    servicosConcluidos: number;
    totalRecebido: number;
    margemGerada: number;
  }[];
  clientes: {
    id: string;
    nome: string;
    servicosConcluidos: number;
    totalFaturado: number;
  }[];
}

export async function getRelatorios(dataInicio: string, dataFim: string): Promise<RelatorioStats> {
  const { data, error } = await supabase
    .from('servicos')
    .select(`
      *,
      cliente:clientes(id, nome),
      trabalhadora:trabalhadoras(id, nome)
    `)
    .gte('data_servico', dataInicio)
    .lte('data_servico', dataFim);

  if (error) throw error;

  const servicos = (data || []) as Servico[];
  const servicosConcluidos = servicos.filter((s) => s.status === 'concluido');

  let totalFaturado = 0;
  let totalPago = 0;

  // Agrupadores
  const trabalhadorasMap: Record<string, { nome: string; servicosConcluidos: number; totalRecebido: number; margemGerada: number }> = {};
  const clientesMap: Record<string, { nome: string; servicosConcluidos: number; totalFaturado: number }> = {};

  for (const s of servicosConcluidos) {
    const valCliente = Number(s.valor_cliente) || 0;
    const valTrab = Number(s.valor_trabalhadora) || 0;

    totalFaturado += valCliente;
    totalPago += valTrab;

    // Trabalhadora
    if (s.trabalhadora_id && s.trabalhadora) {
      if (!trabalhadorasMap[s.trabalhadora_id]) {
        trabalhadorasMap[s.trabalhadora_id] = {
          nome: s.trabalhadora.nome,
          servicosConcluidos: 0,
          totalRecebido: 0,
          margemGerada: 0,
        };
      }
      trabalhadorasMap[s.trabalhadora_id].servicosConcluidos += 1;
      trabalhadorasMap[s.trabalhadora_id].totalRecebido += valTrab;
      trabalhadorasMap[s.trabalhadora_id].margemGerada += (valCliente - valTrab);
    }

    // Cliente
    if (s.cliente_id && s.cliente) {
      if (!clientesMap[s.cliente_id]) {
        clientesMap[s.cliente_id] = {
          nome: s.cliente.nome,
          servicosConcluidos: 0,
          totalFaturado: 0,
        };
      }
      clientesMap[s.cliente_id].servicosConcluidos += 1;
      clientesMap[s.cliente_id].totalFaturado += valCliente;
    }
  }

  const lucroLiquido = totalFaturado - totalPago;
  const margemPorcentagem = totalFaturado > 0 ? (lucroLiquido / totalFaturado) * 100 : 0;

  const trabalhadorasArr = Object.entries(trabalhadorasMap).map(([id, item]) => ({
    id,
    ...item,
  })).sort((a, b) => b.servicosConcluidos - a.servicosConcluidos);

  const clientesArr = Object.entries(clientesMap).map(([id, item]) => ({
    id,
    ...item,
  })).sort((a, b) => b.totalFaturado - a.totalFaturado);

  return {
    totalFaturado,
    totalPago,
    lucroLiquido,
    margemPorcentagem,
    totalServicos: servicosConcluidos.length,
    trabalhadoras: trabalhadorasArr,
    clientes: clientesArr,
  };
}
